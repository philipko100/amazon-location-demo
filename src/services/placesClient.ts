/**
 * GeoPlaces client + address enrichment (V2 "latest" Places API).
 *
 * The Jobs ValidateAddress schema requires non-empty address components (e.g.
 * AddressComponents_Locality). A user typing "410 Terry Ave N, Seattle" leaves
 * those structured fields blank, so the job fails with
 * "'AddressComponents_Locality' must have length at least 1".
 *
 * Autocomplete returns a full structured Address (Locality, Region, PostalCode,
 * Street, AddressNumber, Country) inline in its top ResultItem — no separate
 * GetPlace call needed. We run each row through it and fill in any blanks before
 * encoding to Parquet.
 */
import { GeoPlacesClient, AutocompleteCommand } from "@aws-sdk/client-geo-places";
import { getAuthHelper } from "./auth";
import { AWS_REGION } from "../config/aws";
import type { AddressInput } from "../types";

let clientPromise: Promise<GeoPlacesClient> | null = null;

function getPlacesClient(): Promise<GeoPlacesClient> {
  if (!clientPromise) {
    clientPromise = getAuthHelper().then(
      (authHelper) =>
        new GeoPlacesClient({
          region: AWS_REGION,
          ...authHelper.getClientConfig(),
        }),
    );
  }
  return clientPromise;
}

/** A free-text query for the row: prefer the joined fields, else line1. */
function queryTextFor(addr: AddressInput): string {
  return [addr.line1, addr.locality, addr.region, addr.postalCode]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Enrich one address via Autocomplete: take the top result's structured Address
 * and fill any components the user left blank. Existing user-supplied values win
 * (we only fill gaps). On no match / error, the row is returned unchanged so the
 * caller can decide how to handle it.
 */
export async function enrichAddress(addr: AddressInput): Promise<AddressInput> {
  const query = queryTextFor(addr);
  if (!query) return addr;

  const client = await getPlacesClient();
  const res = await client.send(
    new AutocompleteCommand({
      QueryText: query,
      MaxResults: 1,
      // Constrain to countries the Jobs ValidateAddress action supports.
      Filter: { IncludeCountries: ["USA", "CAN", "GBR", "AUS"] },
    }),
  );

  const top = res.ResultItems?.[0]?.Address;
  if (!top) return addr;

  const fill = (existing: string | undefined, next: string | undefined) =>
    existing && existing.trim() ? existing : (next?.trim() || existing);

  return {
    ...addr,
    line1: fill(addr.line1, top.Label) ?? addr.line1,
    locality: fill(addr.locality, top.Locality),
    region: fill(addr.region, top.Region?.Code ?? top.Region?.Name),
    postalCode: fill(addr.postalCode, top.PostalCode),
    country: fill(addr.country, top.Country?.Code3 ?? top.Country?.Code2),
  };
}
