import { useQuery } from '@tanstack/react-query'

import { ApiError, fetchJson } from '@/api/client'
import type {
  CitySuggestionsResponse,
  HourlyResponse,
  LocationSuggestion,
  GeocodeResponse,
} from '@/api/types'

const FORECAST_QUERY_STALE_TIME_MS = 5 * 60 * 1000
const ZIP_REGEX = /^\d{5}$/

export function useHourlyForecast(lat?: number, lon?: number) {
  return useQuery<HourlyResponse, ApiError>({
    queryKey: ['hourly', lat, lon],
    enabled: typeof lat === 'number' && typeof lon === 'number',
    staleTime: FORECAST_QUERY_STALE_TIME_MS,
    retry: 1,
    queryFn: () => fetchJson<HourlyResponse>(`/api/weather/hourly?lat=${lat}&lon=${lon}`),
  })
}

export function useLocationSuggestions(query: string, limit = 8) {
  const normalizedQuery = query.trim()

  return useQuery<LocationSuggestion[], ApiError>({
    queryKey: ['location-suggestions', normalizedQuery, limit],
    enabled: normalizedQuery.length >= 2,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => error.status >= 500 && failureCount < 1,
    queryFn: async () => {
      if (ZIP_REGEX.test(normalizedQuery)) {
        const zipData = await fetchJson<GeocodeResponse>(`/api/geocode/zip/${normalizedQuery}`)
        return [
          {
            kind: 'zip',
            label: `${zipData.city}, ${zipData.state}`,
            city: zipData.city,
            state: zipData.state,
            zip: zipData.zip,
            lat: zipData.lat,
            lon: zipData.lon,
            source: zipData.source,
          },
        ]
      }

      const cityData = await fetchJson<CitySuggestionsResponse>(
        `/api/geocode/city?query=${encodeURIComponent(normalizedQuery)}&limit=${limit}`,
      )
      return cityData.suggestions.map((suggestion) => ({
        kind: 'city' as const,
        label: suggestion.label,
        city: suggestion.city,
        state: suggestion.state,
        zip: typeof suggestion.zip === 'string' ? suggestion.zip : undefined,
        lat: suggestion.lat,
        lon: suggestion.lon,
      }))
    },
  })
}
