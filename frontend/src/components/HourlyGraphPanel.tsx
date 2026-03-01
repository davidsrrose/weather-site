import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { HourlyPeriod } from '@/api/types'
import {
  type ForecastDayPhase,
  formatForecastDayMarkerLabel,
  formatForecastHourLabel,
  formatForecastRangeEndpointParts,
  formatForecastRangeLabel,
  inferForecastDayPhase,
  isForecastMidnight,
} from '@/lib/forecastTime'
import { cn } from '@/lib/utils'

type MetricKey = 'temp' | 'precip' | 'wind' | 'humidity'

type HourlyGraphPanelProps = {
  periods: HourlyPeriod[]
}

type MetricConfig = {
  label: string
  color: string
  selector: (period: HourlyPeriod) => number | null
}

const METRIC_CONFIG: Record<MetricKey, MetricConfig> = {
  temp: {
    label: 'Temp',
    color: 'hsl(0 84% 58%)',
    selector: (period) => period.temperature,
  },
  precip: {
    label: 'Precip',
    color: 'hsl(var(--chart-2, 199 89% 48%))',
    selector: (period) => period.probabilityOfPrecipitation,
  },
  wind: {
    label: 'Wind',
    color: 'hsl(var(--chart-3, 173 58% 39%))',
    selector: (period) => period.windSpeedMph,
  },
  humidity: {
    label: 'Humidity',
    color: 'hsl(var(--chart-4, 43 96% 56%))',
    selector: (period) => period.relativeHumidity,
  },
}

const METRIC_ORDER: MetricKey[] = ['temp', 'precip', 'wind', 'humidity']

const TEMP_SERIES = {
  temperature: {
    label: 'Temp (°F)',
    color: 'hsl(0 84% 58%)',
  },
  windChill: {
    label: 'Wind Chill (°F)',
    color: 'hsl(221 83% 57%)',
  },
  dewPoint: {
    label: 'Dew Point (°F)',
    color: 'hsl(142 72% 42%)',
  },
} as const

const PRECIP_SERIES = {
  precipPotential: {
    label: 'Precip. Potential (%)',
    color: 'hsl(221 83% 57%)',
  },
  skyCover: {
    label: 'Sky Cover (%)',
    color: 'hsl(142 72% 42%)',
  },
  relativeHumidity: {
    label: 'Relative Humidity (%)',
    color: 'hsl(289 70% 52%)',
  },
} as const

type MetricChartPoint = {
  startTime: string
  value: number | null
  dayPhase: ForecastDayPhase
  windDirection: string | null
}

type TempChartPoint = {
  startTime: string
  temperature: number | null
  windChill: number | null
  dewPoint: number | null
  dayPhase: ForecastDayPhase
}

type PrecipChartPoint = {
  startTime: string
  precipPotential: number | null
  skyCover: number | null
  relativeHumidity: number | null
  dayPhase: ForecastDayPhase
}

type DayMarker = {
  startTime: string
  label: string
}

type DayPhaseBand = {
  x1: string
  x2: string
  phase: ForecastDayPhase
}

type BaseChartPoint = {
  startTime: string
  dayPhase: ForecastDayPhase
}

type ChartPeriod = {
  period: HourlyPeriod
  startTime: string
  dayPhase: ForecastDayPhase
  temperatureF: number | null
}

const X_AXIS_LABEL_INTERVAL_HOURS = 3
const WINDOW_SIZE_HOURS = 48
const MIN_SCROLL_CHART_WIDTH_PX = 1200
const STICKY_HEADER_CLASS =
  'sticky left-0 inline-block bg-background/95 pr-2 backdrop-blur supports-[backdrop-filter]:bg-background/80'

type ActiveDotRendererProps = {
  cx?: number
  cy?: number
  value?: number | string
}

type WindDirectionTickProps = {
  cx?: number
  cy?: number
  index?: number
  payload?: {
    windDirection?: string | null
  }
}

const WIND_DIRECTION_MARKER_INTERVAL_HOURS = 2
const WIND_DIRECTION_DEGREES: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
}

function getWindDirectionDegrees(direction: string | null | undefined): number | null {
  if (!direction) {
    return null
  }
  const normalizedDirection = direction.trim().toUpperCase()
  return WIND_DIRECTION_DEGREES[normalizedDirection] ?? null
}

function renderWindDirectionTick(props: WindDirectionTickProps) {
  if (
    typeof props.cx !== 'number' ||
    typeof props.cy !== 'number' ||
    typeof props.index !== 'number' ||
    props.index % WIND_DIRECTION_MARKER_INTERVAL_HOURS !== 0
  ) {
    return null
  }

  const directionDegrees = getWindDirectionDegrees(props.payload?.windDirection)
  if (directionDegrees === null) {
    return null
  }

  return (
    <g
      transform={`translate(${props.cx},${props.cy}) rotate(${directionDegrees})`}
      stroke="hsl(var(--foreground) / 0.7)"
      strokeWidth={1.2}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1={0} y1={0} x2={11} y2={0} />
      <polyline points="8,-2.8 11,0 8,2.8" />
    </g>
  )
}

function createActiveDotLabelRenderer(
  color: string,
  formatValue: (value: number) => string,
  offsetY: number = 0,
) {
  return function renderActiveDotLabel(props: ActiveDotRendererProps) {
    if (
      typeof props.cx !== 'number' ||
      typeof props.cy !== 'number' ||
      typeof props.value !== 'number'
    ) {
      return null
    }

    return (
      <g>
        <circle
          cx={props.cx}
          cy={props.cy}
          r={5}
          fill={color}
          stroke="hsl(var(--background))"
          strokeWidth={2}
        />
        <text
          x={props.cx + 8}
          y={props.cy - 8 + offsetY}
          fill={color}
          fontSize={11}
          fontWeight={600}
          textAnchor="start"
          dominantBaseline="middle"
          paintOrder="stroke"
          stroke="hsl(var(--background))"
          strokeWidth={3}
          strokeOpacity={0.9}
        >
          {formatValue(props.value)}
        </text>
      </g>
    )
  }
}

function formatDegrees(value: number): string {
  return `${Math.round(value)}°`
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

function formatMph(value: number): string {
  return `${Math.round(value)} mph`
}

function clampWindowStart(nextStart: number, periodCount: number, windowSize: number): number {
  const maxStart = Math.max(0, periodCount - windowSize)
  return Math.min(Math.max(nextStart, 0), maxStart)
}

function findCurrentHourIndex(periods: HourlyPeriod[]): number {
  if (periods.length === 0) {
    return 0
  }

  const now = Date.now()
  let bestIndex = 0
  let bestDiff = Number.POSITIVE_INFINITY

  periods.forEach((period, index) => {
    const timestamp = Date.parse(period.startTime)
    if (Number.isNaN(timestamp)) {
      return
    }

    const diff = Math.abs(timestamp - now)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIndex = index
    }
  })

  return bestIndex
}

function toNumericValues(points: MetricChartPoint[]): number[] {
  return points
    .map((point) => point.value)
    .filter((value): value is number => typeof value === 'number')
}

function toMetricChartPoints(
  chartPeriods: ChartPeriod[],
  selector: (period: HourlyPeriod) => number | null,
): MetricChartPoint[] {
  return chartPeriods.map((chartPeriod) => ({
    startTime: chartPeriod.startTime,
    value: selector(chartPeriod.period),
    dayPhase: chartPeriod.dayPhase,
    windDirection: chartPeriod.period.windDirection ?? null,
  }))
}

function toFahrenheit(temperature: number | null, temperatureUnit: string | null): number | null {
  if (temperature === null) {
    return null
  }

  if (temperatureUnit === 'C') {
    return (temperature * 9) / 5 + 32
  }

  return temperature
}

function computeWindChillF(
  temperatureF: number | null,
  windSpeedMph: number | null,
): number | null {
  if (temperatureF === null || windSpeedMph === null) {
    return null
  }

  if (temperatureF > 50 || windSpeedMph <= 3) {
    return Math.round(temperatureF)
  }

  const windFactor = windSpeedMph ** 0.16
  const windChill =
    35.74 + 0.6215 * temperatureF - 35.75 * windFactor + 0.4275 * temperatureF * windFactor

  return Math.round(windChill)
}

function computeDewPointF(
  temperatureF: number | null,
  relativeHumidity: number | null,
): number | null {
  if (temperatureF === null || relativeHumidity === null) {
    return null
  }

  if (relativeHumidity <= 0 || relativeHumidity > 100) {
    return null
  }

  const temperatureC = ((temperatureF - 32) * 5) / 9
  const a = 17.625
  const b = 243.04
  const gamma = Math.log(relativeHumidity / 100) + (a * temperatureC) / (b + temperatureC)
  const dewPointC = (b * gamma) / (a - gamma)
  const dewPointF = (dewPointC * 9) / 5 + 32

  return Math.round(dewPointF)
}

function resolveYAxisDomain(metric: MetricKey, values: number[]): [number, number] {
  if (metric === 'precip') {
    return [0, 100]
  }

  if (metric === 'temp') {
    if (values.length === 0) {
      return [0, 10]
    }
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    return [Math.floor(minValue - 5), Math.ceil(maxValue + 10)]
  }

  if (metric === 'humidity') {
    return [0, 100]
  }

  if (metric === 'wind') {
    const maxWind = values.length > 0 ? Math.max(...values) : 0
    const upperBound = maxWind > 15 ? Math.ceil(maxWind + 5) : 20
    return [0, upperBound]
  }

  const maxValue = values.length > 0 ? Math.max(...values) : 0
  return [0, Math.max(10, maxValue + 5)]
}

function buildYAxisTicks(domain: [number, number], tickCount = 5): number[] {
  const [min, max] = domain
  if (tickCount <= 1 || max === min) {
    return [max]
  }

  const step = (max - min) / (tickCount - 1)
  return Array.from({ length: tickCount }, (_, index) => max - index * step).map((value) =>
    Math.round(value),
  )
}

export function HourlyGraphPanel({ periods }: HourlyGraphPanelProps) {
  const [visibleStartIndex, setVisibleStartIndex] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastLoadedKeyRef = useRef('')
  const visibleStartIndexRef = useRef(0)
  const scrollRafRef = useRef<number | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)
  const dragStartXRef = useRef(0)
  const dragStartScrollLeftRef = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const updateWidth = () => {
      setViewportWidth(container.clientWidth)
    }

    updateWidth()

    const observer = new ResizeObserver(() => {
      updateWidth()
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  const baselineHourPixelWidth = viewportWidth > 0 ? viewportWidth / WINDOW_SIZE_HOURS : 16
  const chartWidth =
    periods.length > 0
      ? Math.max(viewportWidth, MIN_SCROLL_CHART_WIDTH_PX, periods.length * baselineHourPixelWidth)
      : Math.max(viewportWidth, MIN_SCROLL_CHART_WIDTH_PX)
  const hourPixelWidth = periods.length > 0 ? chartWidth / periods.length : baselineHourPixelWidth
  const visibleHourCount =
    viewportWidth > 0 ? Math.max(1, Math.floor(viewportWidth / hourPixelWidth)) : WINDOW_SIZE_HOURS
  const visibleEndIndex = Math.min(visibleStartIndex + visibleHourCount, periods.length)

  const updateVisibleStartFromScroll = useCallback(
    (nextScrollLeft: number) => {
      const nextStartIndex = clampWindowStart(
        Math.floor(nextScrollLeft / hourPixelWidth),
        periods.length,
        visibleHourCount,
      )
      if (nextStartIndex === visibleStartIndexRef.current) {
        return
      }
      visibleStartIndexRef.current = nextStartIndex
      setVisibleStartIndex(nextStartIndex)
    },
    [hourPixelWidth, periods.length, visibleHourCount],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container || viewportWidth <= 0 || periods.length === 0) {
      return
    }

    const dataKey = `${periods[0].startTime}|${periods.length}`
    if (lastLoadedKeyRef.current === dataKey) {
      return
    }
    lastLoadedKeyRef.current = dataKey

    const currentHourIndex = findCurrentHourIndex(periods)
    const initialStart = clampWindowStart(currentHourIndex, periods.length, visibleHourCount)
    const nextScrollLeft = initialStart * hourPixelWidth
    container.scrollLeft = nextScrollLeft
    updateVisibleStartFromScroll(nextScrollLeft)
  }, [periods, viewportWidth, hourPixelWidth, visibleHourCount, updateVisibleStartFromScroll])

  useEffect(() => {
    const container = containerRef.current
    if (!container || viewportWidth <= 0 || periods.length === 0) {
      return
    }
    updateVisibleStartFromScroll(container.scrollLeft)
  }, [
    periods.length,
    viewportWidth,
    hourPixelWidth,
    visibleHourCount,
    updateVisibleStartFromScroll,
  ])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current)
      }
    }
  }, [])

  const handleScroll = () => {
    if (scrollRafRef.current !== null) {
      return
    }
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null
      const container = containerRef.current
      if (!container) {
        return
      }
      updateVisibleStartFromScroll(container.scrollLeft)
    })
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    dragPointerIdRef.current = event.pointerId
    dragStartXRef.current = event.clientX
    dragStartScrollLeftRef.current = container.scrollLeft
    setIsDragging(true)
    container.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    const delta = event.clientX - dragStartXRef.current
    container.scrollLeft = dragStartScrollLeftRef.current - delta
  }

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) {
      return
    }

    const container = containerRef.current
    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId)
    }

    dragPointerIdRef.current = null
    setIsDragging(false)
  }

  const chartPeriods = useMemo<ChartPeriod[]>(() => {
    return periods.map((period) => {
      const dayPhase = inferForecastDayPhase(period.icon, period.isDaytime)
      return {
        period,
        startTime: period.startTime,
        dayPhase,
        temperatureF: toFahrenheit(period.temperature, period.temperatureUnit),
      }
    })
  }, [periods])

  const tempChartData = useMemo<TempChartPoint[]>(() => {
    return chartPeriods.map((chartPeriod) => {
      const temperature =
        chartPeriod.temperatureF !== null ? Math.round(chartPeriod.temperatureF) : null
      const windChill = computeWindChillF(chartPeriod.temperatureF, chartPeriod.period.windSpeedMph)
      return {
        startTime: chartPeriod.startTime,
        temperature,
        windChill,
        dewPoint: computeDewPointF(chartPeriod.temperatureF, chartPeriod.period.relativeHumidity),
        dayPhase: chartPeriod.dayPhase,
      }
    })
  }, [chartPeriods])

  const precipChartData = useMemo<PrecipChartPoint[]>(() => {
    return chartPeriods.map((chartPeriod) => {
      return {
        startTime: chartPeriod.startTime,
        precipPotential: chartPeriod.period.probabilityOfPrecipitation ?? null,
        skyCover: chartPeriod.period.skyCover ?? null,
        relativeHumidity: chartPeriod.period.relativeHumidity ?? null,
        dayPhase: chartPeriod.dayPhase,
      }
    })
  }, [chartPeriods])

  const pointsByMetric = useMemo<
    Record<Exclude<MetricKey, 'temp' | 'precip'>, MetricChartPoint[]>
  >(() => {
    return {
      wind: toMetricChartPoints(chartPeriods, METRIC_CONFIG.wind.selector),
      humidity: toMetricChartPoints(chartPeriods, METRIC_CONFIG.humidity.selector),
    }
  }, [chartPeriods])

  const basePoints = useMemo<BaseChartPoint[]>(
    () =>
      chartPeriods.map((chartPeriod) => ({
        startTime: chartPeriod.startTime,
        dayPhase: chartPeriod.dayPhase,
      })),
    [chartPeriods],
  )

  const dayMarkers = useMemo<DayMarker[]>(() => {
    return basePoints
      .filter((point) => isForecastMidnight(point.startTime))
      .map((point) => ({
        startTime: point.startTime,
        label: formatForecastDayMarkerLabel(point.startTime),
      }))
  }, [basePoints])

  const majorHourLines = useMemo<string[]>(() => {
    return periods
      .filter((_, index) => index % X_AXIS_LABEL_INTERVAL_HOURS === 0)
      .map((period) => period.startTime)
  }, [periods])

  const dayPhaseBands = useMemo<DayPhaseBand[]>(() => {
    if (basePoints.length === 0) {
      return []
    }

    const bands: DayPhaseBand[] = []
    let segmentStart = 0

    for (let index = 1; index <= basePoints.length; index += 1) {
      const atEnd = index === basePoints.length
      const phaseChanged =
        !atEnd && basePoints[index].dayPhase !== basePoints[segmentStart].dayPhase

      if (!atEnd && !phaseChanged) {
        continue
      }

      bands.push({
        x1: basePoints[segmentStart].startTime,
        x2: basePoints[index - 1].startTime,
        phase: basePoints[segmentStart].dayPhase,
      })
      segmentStart = index
    }

    return bands.filter((band) => band.phase !== 'unknown')
  }, [basePoints])

  const hasTempValues = tempChartData.some(
    (point) =>
      typeof point.temperature === 'number' ||
      typeof point.windChill === 'number' ||
      typeof point.dewPoint === 'number',
  )
  const hasAnyValues =
    hasTempValues ||
    precipChartData.some(
      (point) =>
        typeof point.precipPotential === 'number' ||
        typeof point.skyCover === 'number' ||
        typeof point.relativeHumidity === 'number',
    ) ||
    pointsByMetric.wind.some((point) => typeof point.value === 'number') ||
    pointsByMetric.humidity.some((point) => typeof point.value === 'number')

  const visibleRangeLabel = useMemo(() => {
    const start = periods[visibleStartIndex]?.startTime
    const endIndex = Math.max(visibleStartIndex, visibleEndIndex - 1)
    const end = periods[endIndex]?.startTime
    if (!start || !end) {
      return '--'
    }
    return formatForecastRangeLabel(start, end)
  }, [periods, visibleStartIndex, visibleEndIndex])

  const visibleRangeParts = useMemo(() => {
    const start = periods[visibleStartIndex]?.startTime
    const endIndex = Math.max(visibleStartIndex, visibleEndIndex - 1)
    const end = periods[endIndex]?.startTime
    if (!start || !end) {
      return null
    }
    return {
      start: formatForecastRangeEndpointParts(start),
      end: formatForecastRangeEndpointParts(end),
    }
  }, [periods, visibleStartIndex, visibleEndIndex])

  if (!hasAnyValues) {
    return <p className="text-sm text-muted-foreground">No chart data available.</p>
  }

  return (
    <div className="space-y-2">
      <div className="text-left text-xs">
        {visibleRangeParts ? (
          <span className="inline-flex flex-col items-start gap-y-0.5">
            <span className="text-zinc-900 dark:text-zinc-100">
              {visibleRangeParts.start.dayLabel}{' '}
              <span className="text-zinc-600 dark:text-zinc-400">
                ({visibleRangeParts.start.timeLabel}) -
              </span>
            </span>
            <span className="text-zinc-900 dark:text-zinc-100">
              {visibleRangeParts.end.dayLabel}{' '}
              <span className="text-zinc-600 dark:text-zinc-400">
                ({visibleRangeParts.end.timeLabel})
              </span>
            </span>
          </span>
        ) : (
          <span className="text-zinc-600 dark:text-zinc-400">{visibleRangeLabel}</span>
        )}
      </div>
      <div
        ref={containerRef}
        className={cn(
          'overflow-x-auto pb-1',
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab',
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className="min-w-full space-y-2" style={{ width: chartWidth }}>
          {METRIC_ORDER.map((metric, metricIndex) => {
            const metricConfig = METRIC_CONFIG[metric]
            const chartData =
              metric === 'temp'
                ? tempChartData
                : metric === 'precip'
                  ? precipChartData
                  : pointsByMetric[metric]
            const yAxisDomain =
              metric === 'temp'
                ? resolveYAxisDomain(
                    'temp',
                    tempChartData
                      .slice(visibleStartIndex, visibleEndIndex)
                      .flatMap((point) => [point.temperature, point.windChill, point.dewPoint])
                      .filter((value): value is number => typeof value === 'number'),
                  )
                : metric === 'precip'
                  ? resolveYAxisDomain(
                      'precip',
                      precipChartData
                        .slice(visibleStartIndex, visibleEndIndex)
                        .flatMap((point) => [
                          point.precipPotential,
                          point.skyCover,
                          point.relativeHumidity,
                        ])
                        .filter((value): value is number => typeof value === 'number'),
                    )
                  : resolveYAxisDomain(
                      metric,
                      toNumericValues(
                        pointsByMetric[metric].slice(visibleStartIndex, visibleEndIndex),
                      ),
                    )
            return (
              <div key={metric} className="rounded-md border">
                <div className="border-b px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  {metric === 'temp' ? (
                    <div
                      className={`${STICKY_HEADER_CLASS} inline-flex flex-wrap items-center gap-x-3 gap-y-1`}
                    >
                      <span style={{ color: TEMP_SERIES.temperature.color }}>
                        {TEMP_SERIES.temperature.label}
                      </span>
                      <span style={{ color: TEMP_SERIES.windChill.color }}>
                        {TEMP_SERIES.windChill.label}
                      </span>
                      <span style={{ color: TEMP_SERIES.dewPoint.color }}>
                        {TEMP_SERIES.dewPoint.label}
                      </span>
                    </div>
                  ) : metric === 'precip' ? (
                    <div
                      className={`${STICKY_HEADER_CLASS} inline-flex flex-wrap items-center gap-x-3 gap-y-1`}
                    >
                      <span style={{ color: PRECIP_SERIES.precipPotential.color }}>
                        {PRECIP_SERIES.precipPotential.label}
                      </span>
                      <span style={{ color: PRECIP_SERIES.skyCover.color }}>
                        {PRECIP_SERIES.skyCover.label}
                      </span>
                      <span style={{ color: PRECIP_SERIES.relativeHumidity.color }}>
                        {PRECIP_SERIES.relativeHumidity.label}
                      </span>
                    </div>
                  ) : (
                    <span className={STICKY_HEADER_CLASS}>{metricConfig.label}</span>
                  )}
                </div>
                <div className="flex h-80 w-full">
                  <div className="sticky left-0 z-20 flex w-10 shrink-0 flex-col justify-between border-r bg-background/95 pr-1 pt-2 pb-9 text-right text-[10px] text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    {buildYAxisTicks(yAxisDomain).map((tickValue, tickIndex) => (
                      <span key={`${metric}-y-tick-${tickIndex}`}>{tickValue}</span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <ResponsiveContainer>
                      <LineChart
                        syncId="hourly-48h-stack"
                        data={chartData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                      >
                      <XAxis
                        dataKey="startTime"
                        interval={0}
                        tickMargin={8}
                        tickFormatter={(value: string, index: number) =>
                          index % X_AXIS_LABEL_INTERVAL_HOURS === 0
                            ? formatForecastHourLabel(value)
                            : ''
                        }
                        angle={-35}
                        textAnchor="end"
                        tick={{ fontSize: 10 }}
                        axisLine
                        tickLine
                        height={48}
                      />
                      {dayPhaseBands.map((band, index) => (
                        <ReferenceArea
                          key={`${metric}-phase-band-${band.x1}-${index}`}
                          x1={band.x1}
                          x2={band.x2}
                          ifOverflow="extendDomain"
                          strokeOpacity={0}
                          fill={
                            band.phase === 'day'
                              ? 'hsl(var(--forecast-day-surface))'
                              : 'hsl(var(--forecast-night-surface))'
                          }
                          fillOpacity={0.55}
                        />
                      ))}
                      <CartesianGrid
                        strokeDasharray="0"
                        stroke="hsl(var(--forecast-grid-line-minor))"
                        strokeWidth={1}
                        vertical
                        horizontal
                      />
                      {majorHourLines.map((startTime) => (
                        <ReferenceLine
                          key={`${metric}-major-hour-${startTime}`}
                          x={startTime}
                          stroke="hsl(var(--forecast-grid-line-major))"
                          strokeDasharray="0"
                          ifOverflow="extendDomain"
                        />
                      ))}
                      <YAxis domain={yAxisDomain} tickCount={5} allowDecimals={false} hide width={0} />
                      {dayMarkers.map((marker) => (
                        <ReferenceLine
                          key={`${metric}-day-start-${marker.startTime}`}
                          x={marker.startTime}
                          stroke="hsl(var(--foreground) / 0.45)"
                          strokeDasharray="4 4"
                          ifOverflow="extendDomain"
                          label={
                            metricIndex === 0
                              ? {
                                  value: marker.label,
                                  position: 'insideTopLeft',
                                  fill: 'hsl(var(--muted-foreground))',
                                  fontSize: 10,
                                }
                              : undefined
                          }
                        />
                      ))}
                      <Tooltip
                        content={() => null}
                        cursor={{
                          stroke: 'hsl(var(--foreground) / 0.45)',
                          strokeDasharray: '2 2',
                        }}
                      />
                      {metric === 'temp' ? (
                        <>
                          <Line
                            type="monotone"
                            dataKey="windChill"
                            name={TEMP_SERIES.windChill.label}
                            stroke={TEMP_SERIES.windChill.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={false}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="temperature"
                            name={TEMP_SERIES.temperature.label}
                            stroke={TEMP_SERIES.temperature.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={createActiveDotLabelRenderer(
                              TEMP_SERIES.temperature.color,
                              formatDegrees,
                              -14,
                            )}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="dewPoint"
                            name={TEMP_SERIES.dewPoint.label}
                            stroke={TEMP_SERIES.dewPoint.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={createActiveDotLabelRenderer(
                              TEMP_SERIES.dewPoint.color,
                              formatDegrees,
                              14,
                            )}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        </>
                      ) : metric === 'precip' ? (
                        <>
                          <Line
                            type="monotone"
                            dataKey="precipPotential"
                            name={PRECIP_SERIES.precipPotential.label}
                            stroke={PRECIP_SERIES.precipPotential.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={createActiveDotLabelRenderer(
                              PRECIP_SERIES.precipPotential.color,
                              formatPercent,
                              -14,
                            )}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="skyCover"
                            name={PRECIP_SERIES.skyCover.label}
                            stroke={PRECIP_SERIES.skyCover.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={createActiveDotLabelRenderer(
                              PRECIP_SERIES.skyCover.color,
                              formatPercent,
                            )}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="relativeHumidity"
                            name={PRECIP_SERIES.relativeHumidity.label}
                            stroke={PRECIP_SERIES.relativeHumidity.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={createActiveDotLabelRenderer(
                              PRECIP_SERIES.relativeHumidity.color,
                              formatPercent,
                              14,
                            )}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        </>
                      ) : (
                        <>
                          <Line
                            type="monotone"
                            dataKey="value"
                            name={metricConfig.label}
                            stroke={metricConfig.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={
                              metric === 'wind'
                                ? createActiveDotLabelRenderer(metricConfig.color, formatMph)
                                : createActiveDotLabelRenderer(metricConfig.color, formatPercent)
                            }
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                          {metric === 'wind' ? (
                            <Line
                              type="linear"
                              dataKey="value"
                              stroke="transparent"
                              strokeWidth={0}
                              dot={renderWindDirectionTick}
                              activeDot={false}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                          ) : null}
                        </>
                      )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
