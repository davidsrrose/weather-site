import type { FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'

import type { HourlyPeriod, LocationSuggestion } from '@/api/types'
import { HourlyGraphPanel } from '@/components/HourlyGraphPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type DashboardLocation = {
  label: string
  lat: number
  lon: number
}

type DashboardProps = {
  currentLocation: DashboardLocation | null
  locationStatus: string
  favorites: DashboardLocation[]
  showLocationControls: boolean
  onToggleLocationControls: () => void
  onFavoriteChange: (label: string) => void
  locationQuery: string
  onLocationQueryChange: (value: string) => void
  onLocationSearchSubmit: (event: FormEvent<HTMLFormElement>) => void
  locationSuggestions: LocationSuggestion[]
  isLocationSuggestionsLoading: boolean
  locationSuggestionsError: string
  onLocationSuggestionSelect: (suggestion: LocationSuggestion) => void
  locationMessage: string
  onRefreshForecast: () => void
  canRefreshForecast: boolean
  isRefreshingForecast: boolean
  isForecastLoading: boolean
  isForecastError: boolean
  forecastErrorMessage: string
  periods: HourlyPeriod[]
  generatedAt: string | null
  healthMessage: string
}

type ForecastErrorStateProps = {
  message: string
  isRetrying: boolean
  onRetry: () => void
}

function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

function ForecastErrorState({ message, isRetrying, onRetry }: ForecastErrorStateProps) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">
        We couldn&apos;t load the forecast right now.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={onRetry}
        disabled={isRetrying}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {isRetrying ? 'Retrying...' : 'Retry'}
      </Button>
    </div>
  )
}

function GraphPanelSkeleton() {
  const barHeights = [44, 70, 58, 86, 52, 92, 64, 76, 48, 88, 60, 72]

  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <div className="grid h-52 grid-cols-12 items-end gap-2">
        {barHeights.map((height, index) => (
          <Skeleton key={index} className="w-full" style={{ height }} />
        ))}
      </div>
    </div>
  )
}

export function Dashboard({
  currentLocation,
  locationStatus,
  favorites,
  showLocationControls,
  onToggleLocationControls,
  onFavoriteChange,
  locationQuery,
  onLocationQueryChange,
  onLocationSearchSubmit,
  locationSuggestions,
  isLocationSuggestionsLoading,
  locationSuggestionsError,
  onLocationSuggestionSelect,
  locationMessage,
  onRefreshForecast,
  canRefreshForecast,
  isRefreshingForecast,
  isForecastLoading,
  isForecastError,
  forecastErrorMessage,
  periods,
  generatedAt,
  healthMessage,
}: DashboardProps) {
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-w-0 flex-1 justify-start"
            onClick={onToggleLocationControls}
          >
            <span className="truncate">
              {currentLocation ? currentLocation.label : 'Select location'}
            </span>
          </Button>
          <Button
            type="button"
            onClick={onRefreshForecast}
            disabled={!canRefreshForecast || isRefreshingForecast}
          >
            {isRefreshingForecast ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {showLocationControls ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Location</CardTitle>
            <CardDescription>{locationStatus}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="favorite-location">
                Favorite locations
              </label>
              <select
                id="favorite-location"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) {
                    onFavoriteChange(event.target.value)
                  }
                }}
              >
                <option value="">Select a favorite location</option>
                {favorites.map((favorite) => (
                  <option key={favorite.label} value={favorite.label}>
                    {favorite.label}
                  </option>
                ))}
              </select>
            </div>

            <form className="space-y-2" onSubmit={onLocationSearchSubmit}>
              <label className="text-sm font-medium" htmlFor="location-input">
                City, state, or ZIP (USA only)
              </label>
              <div className="flex gap-2">
                <input
                  id="location-input"
                  value={locationQuery}
                  onChange={(event) => {
                    onLocationQueryChange(event.target.value)
                  }}
                  placeholder="e.g. 80401 or Golden, CO"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button disabled={isLocationSuggestionsLoading} type="submit">
                  {isLocationSuggestionsLoading ? 'Searching...' : 'Use'}
                </Button>
              </div>
              <p
                className={
                  locationSuggestionsError
                    ? 'text-xs text-red-600'
                    : 'text-xs text-muted-foreground'
                }
              >
                {locationSuggestionsError || locationMessage}
              </p>
              {locationQuery.trim().length >= 2 && locationSuggestions.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {locationSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.kind}-${suggestion.city}-${suggestion.state}-${suggestion.zip ?? 'none'}`}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        onLocationSuggestionSelect(suggestion)
                      }}
                    >
                      <span className="truncate">{suggestion.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {suggestion.zip
                          ? `ZIP ${suggestion.zip}`
                          : suggestion.kind === 'zip'
                            ? 'ZIP'
                            : 'City/State'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {locationQuery.trim().length >= 2 &&
              !isLocationSuggestionsLoading &&
              !locationSuggestionsError &&
              locationSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No location matches found.</p>
              ) : null}
            </form>

            {currentLocation ? (
              <p className="text-xs text-muted-foreground">
                Coordinates: {formatCoords(currentLocation.lat, currentLocation.lon)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isForecastError && !isForecastLoading ? (
        <ForecastErrorState
          message={forecastErrorMessage}
          isRetrying={isRefreshingForecast}
          onRetry={onRefreshForecast}
        />
      ) : null}

      <Card className="min-h-[220px]">
        <CardHeader>
          <CardTitle>Forecast Charts</CardTitle>
        </CardHeader>
        <CardContent>
          {isForecastLoading ? (
            <GraphPanelSkeleton />
          ) : isForecastError ? (
            <ForecastErrorState
              message={forecastErrorMessage}
              isRetrying={isRefreshingForecast}
              onRetry={onRefreshForecast}
            />
          ) : (
            <HourlyGraphPanel periods={periods} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-xs text-muted-foreground">
          <p>{healthMessage}</p>
          {generatedAt ? <p>Last updated: {new Date(generatedAt).toLocaleString()}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
