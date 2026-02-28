import { useMutation, useQuery } from "@tanstack/react-query"

import { ApiError, fetchJson } from "@/api/client"
import type {
  CitySuggestionsResponse,
  GeocodeResponse,
  HourlyResponse,
} from "@/api/types"

const FORECAST_QUERY_STALE_TIME_MS = 5 * 60 * 1000

export function useHourlyForecast(lat?: number, lon?: number) {
  return useQuery<HourlyResponse, ApiError>({
    queryKey: ["hourly", lat, lon],
    enabled: typeof lat === "number" && typeof lon === "number",
    staleTime: FORECAST_QUERY_STALE_TIME_MS,
    retry: 1,
    queryFn: () =>
      fetchJson<HourlyResponse>(`/api/weather/hourly?lat=${lat}&lon=${lon}`),
  })
}

export function useGeocodeZip() {
  return useMutation<GeocodeResponse, ApiError, string>({
    retry: 1,
    mutationFn: (zip: string) => fetchJson<GeocodeResponse>(`/api/geocode/zip/${zip}`),
  })
}

export function useCitySuggestions(query: string, limit = 8) {
  const normalizedQuery = query.trim()

  return useQuery<CitySuggestionsResponse, ApiError>({
    queryKey: ["city-suggestions", normalizedQuery, limit],
    enabled: normalizedQuery.length >= 2,
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: () =>
      fetchJson<CitySuggestionsResponse>(
        `/api/geocode/city?query=${encodeURIComponent(normalizedQuery)}&limit=${limit}`
      ),
  })
}
