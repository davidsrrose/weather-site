import type { FormEvent } from "react"
import { RotateCcw } from "lucide-react"

import type { CitySuggestion, HourlyPeriod } from "@/api/types"
import { HourlyGraphPanel } from "@/components/HourlyGraphPanel"
import {
  HourlyTimeline,
  type TimelineWindow,
} from "@/components/HourlyTimeline"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

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
  zipInput: string
  onZipInputChange: (value: string) => void
  onZipSubmit: (event: FormEvent<HTMLFormElement>) => void
  cityQuery: string
  onCityQueryChange: (value: string) => void
  citySuggestions: CitySuggestion[]
  isCitySuggestionsLoading: boolean
  citySuggestionsError: string
  onCitySuggestionSelect: (suggestion: CitySuggestion) => void
  zipMessage: string
  isZipLoading: boolean
  isZipError: boolean
  onRefreshForecast: () => void
  canRefreshForecast: boolean
  isRefreshingForecast: boolean
  isForecastLoading: boolean
  isForecastError: boolean
  forecastErrorMessage: string
  periods: HourlyPeriod[]
  nowPeriod: HourlyPeriod | null
  generatedAt: string | null
  healthMessage: string
  timelineWindowStartIndex: number
  timelineWindowSize: number
  onTimelineWindowChange: (window: TimelineWindow) => void
}

type ForecastErrorStateProps = {
  message: string
  isRetrying: boolean
  onRetry: () => void
}

function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

function ForecastErrorState({
  message,
  isRetrying,
  onRetry,
}: ForecastErrorStateProps) {
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
        {isRetrying ? "Retrying..." : "Retry"}
      </Button>
    </div>
  )
}

function NowCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="min-h-[170px]">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-24" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
      <Card className="min-h-[170px]">
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </CardContent>
      </Card>
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
          <Skeleton
            key={index}
            className="w-full"
            style={{ height }}
          />
        ))}
      </div>
    </div>
  )
}

function TimelineRowsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-md border p-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-3 w-36" />
          <Skeleton className="mt-3 h-3 w-full" />
        </div>
      ))}
    </div>
  )
}

function renderNowPrimary(nowPeriod: HourlyPeriod | null) {
  if (!nowPeriod) {
    return <p className="text-sm text-muted-foreground">No current period available.</p>
  }

  return (
    <div className="space-y-1">
      <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {nowPeriod.temperature ?? "--"}
        {nowPeriod.temperatureUnit ?? ""}
      </p>
      <p className="text-sm text-muted-foreground">
        {nowPeriod.shortForecast ?? "Forecast unavailable"}
      </p>
    </div>
  )
}

function renderNowSecondary(nowPeriod: HourlyPeriod | null) {
  if (!nowPeriod) {
    return <p className="text-sm text-muted-foreground">No weather details available.</p>
  }

  const windText =
    nowPeriod.windSpeedMph !== null
      ? `${nowPeriod.windSpeedMph} mph ${nowPeriod.windDirection ?? ""}`.trim()
      : "--"

  const precipText =
    nowPeriod.probabilityOfPrecipitation !== null
      ? `${nowPeriod.probabilityOfPrecipitation}%`
      : "--"

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Wind</span>
        <span className="font-medium">{windText}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Precip</span>
        <span className="font-medium">{precipText}</span>
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
  zipInput,
  onZipInputChange,
  onZipSubmit,
  cityQuery,
  onCityQueryChange,
  citySuggestions,
  isCitySuggestionsLoading,
  citySuggestionsError,
  onCitySuggestionSelect,
  zipMessage,
  isZipLoading,
  isZipError,
  onRefreshForecast,
  canRefreshForecast,
  isRefreshingForecast,
  isForecastLoading,
  isForecastError,
  forecastErrorMessage,
  periods,
  nowPeriod,
  generatedAt,
  healthMessage,
  timelineWindowStartIndex,
  timelineWindowSize,
  onTimelineWindowChange,
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
              {currentLocation ? currentLocation.label : "Select location"}
            </span>
          </Button>
          <Button
            type="button"
            onClick={onRefreshForecast}
            disabled={!canRefreshForecast || isRefreshingForecast}
          >
            {isRefreshingForecast ? "Refreshing..." : "Refresh"}
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

            <form className="space-y-2" onSubmit={onZipSubmit}>
              <label className="text-sm font-medium" htmlFor="zip-input">
                ZIP code
              </label>
              <div className="flex gap-2">
                <input
                  id="zip-input"
                  value={zipInput}
                  onChange={(event) => {
                    onZipInputChange(event.target.value)
                  }}
                  placeholder="e.g. 80401"
                  inputMode="numeric"
                  maxLength={5}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button disabled={isZipLoading} type="submit">
                  {isZipLoading ? "Looking..." : "Use ZIP"}
                </Button>
              </div>
              <p
                className={
                  isZipError ? "text-xs text-red-600" : "text-xs text-muted-foreground"
                }
              >
                {zipMessage}
              </p>
            </form>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="city-input">
                City, state (USA only)
              </label>
              <input
                id="city-input"
                value={cityQuery}
                onChange={(event) => {
                  onCityQueryChange(event.target.value)
                }}
                placeholder="Start typing a city..."
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              {isCitySuggestionsLoading ? (
                <p className="text-xs text-muted-foreground">Searching cities...</p>
              ) : null}
              {citySuggestionsError ? (
                <p className="text-xs text-red-600">{citySuggestionsError}</p>
              ) : null}
              {cityQuery.trim().length >= 2 && citySuggestions.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {citySuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.city}-${suggestion.state}`}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        onCitySuggestionSelect(suggestion)
                      }}
                    >
                      <span>{suggestion.label}</span>
                      <span className="text-xs text-muted-foreground">Use</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {cityQuery.trim().length >= 2 &&
              !isCitySuggestionsLoading &&
              !citySuggestionsError &&
              citySuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No city matches found.
                </p>
              ) : null}
            </div>

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

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Now
        </h2>
        {isForecastLoading ? (
          <NowCardsSkeleton />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="min-h-[170px]">
              <CardHeader>
                <CardTitle className="text-base">Current Temperature</CardTitle>
              </CardHeader>
              <CardContent>{renderNowPrimary(nowPeriod)}</CardContent>
            </Card>

            <Card className="min-h-[170px]">
              <CardHeader>
                <CardTitle className="text-base">Conditions</CardTitle>
              </CardHeader>
              <CardContent>{renderNowSecondary(nowPeriod)}</CardContent>
            </Card>
          </div>
        )}
      </section>

      <Card className="min-h-[220px]">
        <CardHeader>
          <CardTitle>Graph</CardTitle>
          <CardDescription>48-hour chart view synchronized with timeline.</CardDescription>
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
            <HourlyGraphPanel
              periods={periods}
              windowStartIndex={timelineWindowStartIndex}
              windowSize={timelineWindowSize}
            />
          )}
        </CardContent>
      </Card>

      <Card className="min-h-[220px]">
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            Swipe horizontally or jump forward in 24/48 hour increments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForecastLoading ? (
            <TimelineRowsSkeleton />
          ) : isForecastError ? (
            <ForecastErrorState
              message={forecastErrorMessage}
              isRetrying={isRefreshingForecast}
              onRetry={onRefreshForecast}
            />
          ) : (
            <HourlyTimeline
              periods={periods}
              windowSize={48}
              onWindowChange={onTimelineWindowChange}
            />
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
