/** CSV parsing for the bulk-validation uploader. */
import Papa from "papaparse";
import type { AddressInput } from "../types";

/**
 * Parse a pasted/uploaded address list into AddressInput rows.
 *
 * Two accepted shapes:
 *  - CSV with headers (line1/street, city/locality, state/region, zip/postalCode,
 *    country). Header matching is case-insensitive and tolerant of common aliases.
 *  - Plain text, one full address per line (goes into line1 unparsed).
 */
export function parseAddresses(raw: string): AddressInput[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const firstLine = trimmed.split(/\r?\n/, 1)[0]!.toLowerCase();
  const looksLikeCsv =
    firstLine.includes(",") &&
    /(line1|street|address|city|locality|state|region|zip|postal|country)/.test(firstLine);

  if (looksLikeCsv) {
    const { data } = Papa.parse<Record<string, string>>(trimmed, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    return data.map((row, i) => ({
      id: String(i),
      line1: pick(row, ["line1", "street", "address", "address1", "addressline1"]),
      locality: pick(row, ["city", "locality", "town"]),
      region: pick(row, ["state", "region", "province"]),
      postalCode: pick(row, ["zip", "zipcode", "postal", "postalcode"]),
      country: pick(row, ["country"]) || "US",
    }));
  }

  // Plain text fallback: one address per line.
  return trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line1, i) => ({ id: String(i), line1, country: "US" }));
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] != null && row[k].trim()) return row[k].trim();
  }
  return "";
}
