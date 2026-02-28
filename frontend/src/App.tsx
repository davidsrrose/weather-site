import { useState, type FormEvent } from "react"
import { useCitySuggestions, useGeocodeZip, useHourlyForecast } from "@/api/hooks"
import { AppShell } from "@/components/AppShell"
import { Dashboard } from "@/components/Dashboard"
import type { TimelineWindow } from "@/components/HourlyTimeline"
import { useHealthCheck } from "@/hooks/useHealthCheck"
import { useLocationState } from "@/hooks/useLocationState"
import { useThemePreference } from "@/hooks/useThemePreference"

const ZIP_REGEX = /^\d{5}$/

function App() {
  const { isDarkMode, toggleThemeMode } = useThemePreference()
  const { healthMessage, healthState } = useHealthCheck()
  const {
    favorites,
    currentLocation,
    locationStatus,
    showLocationControls,
    setShowLocationControls,
    zipInput,
    setZipInput,
    zipMessage,
    setZipMessage,
    cityQuery,
    setCityQuery,
    selectFavorite,
    applyZipResult,
    applyCitySuggestion,
  } = useLocationState()
  const [timelineWindow, setTimelineWindow] = useState<TimelineWindow | null>(null)

  const geocodeZip = useGeocodeZip()
  const citySuggestionsQuery = useCitySuggestions(cityQuery, 8)
  const hourlyForecast = useHourlyForecast(currentLocation?.lat, currentLocation?.lon)

  const handleZipSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const zip = zipInput.trim()

    if (!ZIP_REGEX.test(zip)) {
      setZipMessage("ZIP must be exactly 5 digits.")
      return
    }

    setZipMessage(`Looking up ZIP ${zip}...`)

    try {
      const data = await geocodeZip.mutateAsync(zip)
      applyZipResult(data)
    } catch (error) {
      setZipMessage(
        `ZIP lookup failed: ${error instanceof Error ? error.message : "unknown error"}`
      )
    }
  }

  const nowPeriod = hourlyForecast.data?.periods?.[0] ?? null
  const forecastPeriods = hourlyForecast.data?.periods ?? []
  const isForecastLoading = hourlyForecast.isLoading && !hourlyForecast.data
  const isRefreshingForecast = hourlyForecast.isFetching && !isForecastLoading
  const forecastErrorMessage = hourlyForecast.error?.message ?? "Unable to load forecast."
  const timelineWindowStartIndex = timelineWindow?.windowStartIndex ?? 0
  const timelineWindowSize = timelineWindow?.windowSize ?? 48

  return (
    <AppShell
      title="Weather Site"
      subtitle="Location-first weather dashboard optimized for mobile and desktop."
      isDarkMode={isDarkMode}
      onToggleDarkMode={toggleThemeMode}
    >
      <Dashboard
        currentLocation={currentLocation}
        locationStatus={locationStatus}
        favorites={favorites}
        showLocationControls={showLocationControls}
        onToggleLocationControls={() => {
          setShowLocationControls((prev) => !prev)
        }}
        onFavoriteChange={selectFavorite}
        zipInput={zipInput}
        onZipInputChange={setZipInput}
        onZipSubmit={handleZipSubmit}
        cityQuery={cityQuery}
        onCityQueryChange={setCityQuery}
        citySuggestions={citySuggestionsQuery.data?.suggestions ?? []}
        isCitySuggestionsLoading={citySuggestionsQuery.isFetching}
        citySuggestionsError={citySuggestionsQuery.error?.message ?? ""}
        onCitySuggestionSelect={applyCitySuggestion}
        zipMessage={zipMessage}
        isZipLoading={geocodeZip.isPending}
        isZipError={geocodeZip.isError}
        onRefreshForecast={() => {
          void hourlyForecast.refetch()
        }}
        canRefreshForecast={Boolean(currentLocation)}
        isRefreshingForecast={isRefreshingForecast}
        isForecastLoading={isForecastLoading}
        isForecastError={hourlyForecast.isError}
        forecastErrorMessage={forecastErrorMessage}
        periods={forecastPeriods}
        nowPeriod={nowPeriod}
        generatedAt={hourlyForecast.data?.generated_at ?? null}
        healthMessage={
          healthState === "ok"
            ? healthMessage
            : healthState === "loading"
              ? "Checking API health..."
              : healthMessage
        }
        timelineWindowStartIndex={timelineWindowStartIndex}
        timelineWindowSize={timelineWindowSize}
        onTimelineWindowChange={setTimelineWindow}
      />
    </AppShell>
  )
}

export default App
