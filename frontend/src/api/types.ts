export type GeocodeResponse = {
  zip: string
  lat: number
  lon: number
  city: string
  state: string
  source: 'cache' | 'upstream'
}

export type CitySuggestion = {
  label: string
  city: string
  state: string
  zip?: string | null
  lat: number
  lon: number
}

export type CitySuggestionsResponse = {
  query: string
  suggestions: CitySuggestion[]
}

export type LocationSuggestion = {
  kind: 'city' | 'zip'
  label: string
  city: string
  state: string
  zip?: string
  lat: number
  lon: number
  source?: 'cache' | 'upstream'
}

export type HourlyPeriod = {
  startTime: string
  temperature: number | null
  temperatureUnit: string | null
  isDaytime: boolean | null
  shortForecast: string | null
  windSpeedMph: number | null
  windDirection: string | null
  probabilityOfPrecipitation: number | null
  skyCover: number | null
  relativeHumidity: number | null
  icon: string | null
}

export type HourlyResponse = {
  generated_at: string
  location: {
    lat: number
    lon: number
  }
  periods: HourlyPeriod[]
}
