import { COUNTRY_CENTROIDS, COUNTRY_CENTROID_BY_CODE, type CountryCentroid } from "@/lib/geo/country-centroids"

const COUNTRY_ALIAS_INDEX = new Map<string, CountryCentroid>()

for (const country of COUNTRY_CENTROIDS) {
  COUNTRY_ALIAS_INDEX.set(normalizeLocationValue(country.countryCode), country)
  COUNTRY_ALIAS_INDEX.set(normalizeLocationValue(country.countryName), country)
  for (const alias of country.aliases) {
    COUNTRY_ALIAS_INDEX.set(normalizeLocationValue(alias), country)
  }
}

export type NormalizedCountry = {
  countryCode: string
  countryName: string
  latitude: number
  longitude: number
}

export function normalizeCountry(value: unknown): NormalizedCountry | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const raw = String(value).trim()
  if (!raw) return null

  const directCode = COUNTRY_CENTROID_BY_CODE.get(raw.toUpperCase())
  if (directCode) return toNormalizedCountry(directCode)

  const normalized = normalizeLocationValue(raw)
  const direct = COUNTRY_ALIAS_INDEX.get(normalized)
  if (direct) return toNormalizedCountry(direct)

  const parts = normalized.split(/[,/|]+/).map((part) => part.trim()).filter(Boolean)
  for (const part of parts) {
    const found = COUNTRY_ALIAS_INDEX.get(part)
    if (found) return toNormalizedCountry(found)
  }

  return null
}

export function normalizeLocationValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\./g, "")
    .replace(/&/g, " and ")
    .replace(/[\s_-]+/g, " ")
    .replace(/[^a-z0-9 ,/|]+/g, "")
}

function toNormalizedCountry(country: CountryCentroid): NormalizedCountry {
  return {
    countryCode: country.countryCode,
    countryName: country.countryName,
    latitude: country.latitude,
    longitude: country.longitude,
  }
}
