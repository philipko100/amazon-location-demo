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

/**
 * Encode addresses to Parquet for a ValidateAddress job.
 *
 * We submit the full (enriched) address as free-form AddressLines_1 — the schema
 * allows a single-line address there. The schema's guidance is that you MAY also
 * supply last-line components (Locality, Region, Country, PostalCode) via
 * AddressComponents alongside AddressLines; we include AddressComponents_Country
 * because the job requires a recognized country in AddressLines OR
 * AddressComponents.Country, and the free-form label doesn't reliably carry one.
 * Country is always populated (defaults to USA), so the column is never empty.
 */
/**
 * Normalize a country value to a code the ValidateAddress job recognizes.
 * Handles user input (US, UK, GB, "United States") and Autocomplete codes
 * (USA, GBR). Note "UK" is NOT an ISO code — it must be GB/GBR. Falls back to
 * USA so AddressComponents_Country is never empty (Jobs supports US/CA/UK/AU).
 */
function normalizeCountry(raw: string | undefined): string {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return "USA";
  const map: Record<string, string> = {
    US: "USA", USA: "USA", "UNITED STATES": "USA",
    CA: "CAN", CAN: "CAN", CANADA: "CAN",
    UK: "GBR", GB: "GBR", GBR: "GBR", "UNITED KINGDOM": "GBR", "GREAT BRITAIN": "GBR",
    AU: "AUS", AUS: "AUS", AUSTRALIA: "AUS",
  };
  return map[v] ?? v;
}

export async function addressesToParquet(addresses: AddressInput[]): Promise<Uint8Array> {
  const wasm = await loadWasm();

  const fullLine = (a: AddressInput) =>
    a.line1?.trim() ||
    [a.line1, a.locality, a.region, a.postalCode, a.country]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(", ");

  const table = tableFromArrays({
    Id: addresses.map((a) => a.id),
    AddressLines_1: addresses.map(fullLine),
    AddressComponents_Country: addresses.map((a) => normalizeCountry(a.country)),
  });

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
  const bool = (v: unknown): boolean | undefined => {
    if (v == null) return undefined;
    if (typeof v === "boolean") return v;
    return String(v).toLowerCase() === "true";
  };

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
      mailable: bool(get(i, "Output_AddressMetadata_DeliveryIndicators_Mailable")),
      position: lng != null && lat != null ? [lng, lat] : undefined,
    });
  }
  return results;
}
