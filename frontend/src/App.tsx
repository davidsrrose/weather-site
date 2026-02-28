import { type FormEvent } from 'react'
import { useHourlyForecast, useLocationSuggestions } from '@/api/hooks'
import { AppShell } from '@/components/AppShell'
import { Dashboard } from '@/components/Dashboard'
import { useHealthCheck } from '@/hooks/useHealthCheck'
import { useLocationState } from '@/hooks/useLocationState'
import { useThemePreference } from '@/hooks/useThemePreference'

const ZIP_REGEX = /^\d{5}$/
const ZIP_PARTIAL_REGEX = /^\d{1,4}$/

function App() {
  const { isDarkMode, toggleThemeMode } = useThemePreference()
  const { healthMessage, healthState } = useHealthCheck()
  const {
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
  } = useLocationState()
  const locationSuggestionsQuery = useLocationSuggestions(locationQuery, 8)
  const hourlyForecast = useHourlyForecast(currentLocation?.lat, currentLocation?.lon)

  const handleLocationSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = locationQuery.trim()

    if (query.length < 2) {
      setLocationMessage('Type at least 2 characters or a 5-digit ZIP.')
      return
    }

    if (ZIP_PARTIAL_REGEX.test(query)) {
      setLocationMessage('Enter all 5 digits for ZIP search.')
      return
    }

    if (locationSuggestionsQuery.isFetching) {
      setLocationMessage('Searching locations...')
      return
    }

    const suggestions = locationSuggestionsQuery.data ?? []
    if (suggestions.length === 0) {
      if (ZIP_REGEX.test(query)) {
        setLocationMessage('No ZIP match found. Check the ZIP and try again.')
        return
      }
      setLocationMessage('No location matches found. Try city, state or ZIP.')
      return
    }

    applySearchSuggestion(suggestions[0])
  }

  const forecastPeriods = hourlyForecast.data?.periods ?? []
  const isForecastLoading = hourlyForecast.isLoading && !hourlyForecast.data
  const isRefreshingForecast = hourlyForecast.isFetching && !isForecastLoading
  const forecastErrorMessage = hourlyForecast.error?.message ?? 'Unable to load forecast.'
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
        locationQuery={locationQuery}
        onLocationQueryChange={setLocationQuery}
        onLocationSearchSubmit={handleLocationSearchSubmit}
        locationSuggestions={locationSuggestionsQuery.data ?? []}
        isLocationSuggestionsLoading={locationSuggestionsQuery.isFetching}
        locationSuggestionsError={locationSuggestionsQuery.error?.message ?? ''}
        onLocationSuggestionSelect={applySearchSuggestion}
        locationMessage={locationMessage}
        onRefreshForecast={() => {
          void hourlyForecast.refetch()
        }}
        canRefreshForecast={Boolean(currentLocation)}
        isRefreshingForecast={isRefreshingForecast}
        isForecastLoading={isForecastLoading}
        isForecastError={hourlyForecast.isError}
        forecastErrorMessage={forecastErrorMessage}
        periods={forecastPeriods}
        generatedAt={hourlyForecast.data?.generated_at ?? null}
        healthMessage={
          healthState === 'ok'
            ? healthMessage
            : healthState === 'loading'
              ? 'Checking API health...'
              : healthMessage
        }
      />
    </AppShell>
  )
}

export default App
