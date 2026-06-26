/**
 * Browser-side Parquet I/O for the Jobs API (ValidateAddress reads/writes Parquet).
 *
 * parquet-wasm is ~1-2 MB; it's dynamically imported so it only loads the first
 * time a user runs a bulk validation, not on initial page load.
 *
 * ⚠️ VERIFY: the OUTPUT column names below ("Output_Address_Label",
 * "Output_ValidationResults_*", "Output_Position_*") are inferred from the docs.
 * After your first successful job, inspect the actual output Parquet columns and
 * adjust `parseResults` to match. The INPUT schema (all string columns) is the
 * documented contract.
 */
import { tableFromArrays, tableFromIPC, tableToIPC, type Table } from "apache-arrow";
import type { AddressInput, ValidationResult, MatchConfidence } from "../types";

type ParquetWasm = typeof import("parquet-wasm");
let wasmPromise: Promise<ParquetWasm> | null = null;
async function loadWasm(): Promise<ParquetWasm> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const mod = await import("parquet-wasm");
      // wasm-bindgen modules expose a default init() that must be awaited before
      // any exported function is called — otherwise calls hit the not-yet-
      // instantiated WASM and throw "Cannot read properties of undefined
      // (reading '__wbindgen_add_to_stack_pointer')". With no argument it loads
      // the bundled .wasm (vite-plugin-wasm resolves the URL).
      await mod.default();
      return mod;
    })();
  }
  return wasmPromise;
}

/** Encode addresses to Parquet bytes using the documented input column schema. */
export async function addressesToParquet(addresses: AddressInput[]): Promise<Uint8Array> {
  const wasm = await loadWasm();

  // The Jobs input is columnar and each AddressComponents_* column it scans must
  // be non-empty for EVERY row ("must have length at least 1"). So a column is
  // only included when all rows have a value for it — otherwise a single blank
  // cell would fail the whole job. Callers pre-filter rows lacking a locality.
  const columns: Record<string, string[]> = {
    Id: addresses.map((a) => a.id),
    AddressLines_1: addresses.map((a) => a.line1),
    AddressComponents_Locality: addresses.map((a) => a.locality ?? ""),
  };
  const addIfComplete = (name: string, pick: (a: AddressInput) => string | undefined) => {
    const vals = addresses.map((a) => pick(a)?.trim() ?? "");
    if (vals.every((v) => v.length > 0)) columns[name] = vals;
  };
  addIfComplete("AddressComponents_Region", (a) => a.region);
  addIfComplete("AddressComponents_PostalCode", (a) => a.postalCode);
  addIfComplete("AddressComponents_Country", (a) => a.country);

  const table = tableFromArrays(columns);

  // apache-arrow -> Arrow IPC stream -> parquet-wasm Table -> Parquet bytes.
  const ipc = tableToIPC(table, "stream");
  const arrowTable = wasm.Table.fromIPCStream(ipc);
  const parquet = wasm.writeParquet(arrowTable);
  return parquet;
}

/** Decode the job's output Parquet into ValidationResult rows. */
export async function parseResults(parquetBytes: Uint8Array): Promise<ValidationResult[]> {
  const wasm = await loadWasm();
  const arrowTable = wasm.readParquet(parquetBytes);
  const ipc = arrowTable.intoIPCStream();
  const table: Table = tableFromIPC(ipc);

  const get = (row: number, col: string): unknown => {
    const c = table.getChild(col as never);
    return c ? c.get(row) : undefined;
  };
  const str = (v: unknown): string | undefined =>
    v == null ? undefined : String(v);
  const num = (v: unknown): number | undefined =>
    v == null ? undefined : Number(v);

  const results: ValidationResult[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const lng = num(get(i, "Output_Position_Longitude"));
    const lat = num(get(i, "Output_Position_Latitude"));
    results.push({
      id: str(get(i, "Input_Id")) ?? str(get(i, "Id")) ?? String(i),
      inputLabel:
        str(get(i, "Input_AddressLines_1")) ??
        str(get(i, "AddressLines_1")) ??
        "",
      outputLabel: str(get(i, "Output_Address_Label")),
      granularity: str(get(i, "Output_ValidationResults_ValidationGranularity")),
      confidence: str(
        get(i, "Output_ValidationResults_MatchConfidence"),
      ) as MatchConfidence | undefined,
      confidenceScore: num(get(i, "Output_ValidationResults_MatchConfidenceScore")),
      position: lng != null && lat != null ? [lng, lat] : undefined,
    });
  }
  return results;
}
