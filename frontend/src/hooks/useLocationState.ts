import { useCallback, useEffect, useState } from "react"

import type { LocationSuggestion } from "@/api/types"

export type LocationKind = "geo" | "favorite" | "zip" | "city"

export type Location = {
  kind: LocationKind
  label: string
  lat: number
  lon: number
  zip?: string
}

const FAVORITES_STORAGE_KEY = "weather_site_favorites"
const LAST_LOCATION_STORAGE_KEY = "weather_site_last_location"

const DEFAULT_FAVORITES: Location[] = [
  { kind: "favorite", label: "Golden, CO", lat: 39.7555, lon: -105.2211 },
  { kind: "favorite", label: "Winter Park, CO", lat: 39.8917, lon: -105.7631 },
]

function loadStoredFavorites(): Location[] {
  if (typeof window === "undefined") {
    return DEFAULT_FAVORITES
  }

  const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
  if (!raw) {
    return DEFAULT_FAVORITES
  }

  try {
    const parsed = JSON.parse(raw) as Location[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_FAVORITES
    }
    return parsed
  } catch {
    return DEFAULT_FAVORITES
  }
}

function loadStoredLocation(): Location | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(LAST_LOCATION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Location
    if (
      !parsed ||
      typeof parsed.label !== "string" ||
      typeof parsed.lat !== "number" ||
      typeof parsed.lon !== "number" ||
      (parsed.kind !== "geo" &&
        parsed.kind !== "favorite" &&
        parsed.kind !== "zip" &&
        parsed.kind !== "city")
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function useLocationState() {
  const [favorites] = useState<Location[]>(() => loadStoredFavorites())
  const [currentLocation, setCurrentLocation] = useState<Location | null>(() =>
    loadStoredLocation()
  )
  const [locationStatus, setLocationStatus] = useState<string>(() => {
    const stored = loadStoredLocation()
    return stored
      ? `Using saved location: ${stored.label}.`
      : "Requesting location permission..."
  })
  const [showLocationControls, setShowLocationControls] = useState(false)
  const [locationQuery, setLocationQuery] = useState("")
  const [locationMessage, setLocationMessage] = useState(
    "Enter a city, state, or ZIP code."
  )

  const applyLocation = useCallback((location: Location, statusMessage: string) => {
    setCurrentLocation(location)
    setLocationStatus(statusMessage)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        LAST_LOCATION_STORAGE_KEY,
        JSON.stringify(location)
      )
    }
  }, [])

  const applySearchSuggestion = useCallback(
    (suggestion: LocationSuggestion) => {
      const clarifiedLabel = suggestion.zip
        ? `${suggestion.city}, ${suggestion.state} (${suggestion.zip})`
        : `${suggestion.city}, ${suggestion.state}`
      const location: Location = {
        kind: suggestion.kind,
        label: clarifiedLabel,
        lat: suggestion.lat,
        lon: suggestion.lon,
        zip: suggestion.zip,
      }

      if (suggestion.kind === "zip" && suggestion.zip) {
        applyLocation(location, `Using ZIP ${suggestion.zip}: ${suggestion.label}.`)
        setLocationMessage(
          `Selected ZIP ${suggestion.zip} -> ${suggestion.city}, ${suggestion.state}.`
        )
      } else if (suggestion.zip) {
        applyLocation(location, `Using city: ${suggestion.label} (ZIP ${suggestion.zip}).`)
        setLocationMessage(
          `Selected ${suggestion.city}, ${suggestion.state} (ZIP ${suggestion.zip}).`
        )
      } else {
        applyLocation(location, `Using city: ${suggestion.label}.`)
        setLocationMessage(`Selected ${suggestion.city}, ${suggestion.state}.`)
      }

      setLocationQuery(clarifiedLabel)
      setShowLocationControls(false)
    },
    [applyLocation]
  )

  const selectFavorite = useCallback(
    (label: string) => {
      const selectedFavorite = favorites.find((favorite) => favorite.label === label)
      if (!selectedFavorite) {
        return
      }

      applyLocation(selectedFavorite, `Using favorite: ${selectedFavorite.label}.`)
      setLocationQuery(selectedFavorite.label)
      setLocationMessage(`Selected favorite: ${selectedFavorite.label}.`)
      setShowLocationControls(false)
    },
    [applyLocation, favorites]
  )

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(favorites)
      )
    }
  }, [favorites])

  useEffect(() => {
    if (currentLocation) {
      return
    }

    if (!("geolocation" in navigator)) {
      applyLocation(favorites[0], "Geolocation unavailable. Using favorite location.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: Location = {
          kind: "geo",
          label: "Current Location",
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }
        applyLocation(location, "Using current browser location.")
      },
      () => {
        applyLocation(
          favorites[0],
          "Location not available. Defaulted to favorite location."
        )
      },
      { timeout: 10000 }
    )
  }, [applyLocation, currentLocation, favorites])

  return {
    favorites,
    currentLocation,
    locationStatus,
    showLocationControls,
    setShowLocationControls,
    locationQuery,
    setLocationQuery,
    locationMessage,
    setLocationMessage,
    selectFavorite,
    applySearchSuggestion,
  }
}
