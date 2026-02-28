import { useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { HourlyPeriod } from "@/api/types"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type MetricKey = "temp" | "precip" | "wind" | "humidity"

type HourlyGraphPanelProps = {
  periods: HourlyPeriod[]
  windowStartIndex: number
  windowSize: number
}

type MetricConfig = {
  label: string
  color: string
  unitSuffix: string
  selector: (period: HourlyPeriod) => number | null
}

const METRIC_CONFIG: Record<MetricKey, MetricConfig> = {
  temp: {
    label: "Temp",
    color: "hsl(var(--chart-1, 222.2 84% 54.9%))",
    unitSuffix: "°",
    selector: (period) => period.temperature,
  },
  precip: {
    label: "Precip",
    color: "hsl(var(--chart-2, 199 89% 48%))",
    unitSuffix: "%",
    selector: (period) => period.probabilityOfPrecipitation,
  },
  wind: {
    label: "Wind",
    color: "hsl(var(--chart-3, 173 58% 39%))",
    unitSuffix: " mph",
    selector: (period) => period.windSpeedMph,
  },
  humidity: {
    label: "Humidity",
    color: "hsl(var(--chart-4, 43 96% 56%))",
    unitSuffix: "%",
    selector: (period) => period.relativeHumidity,
  },
}

type ChartPoint = {
  startTime: string
  hourLabel: string
  value: number | null
}

function toHourLabel(startTime: string): string {
  const date = new Date(startTime)
  return date.toLocaleTimeString([], { hour: "numeric" })
}

function toTooltipLabel(startTime: string): string {
  const date = new Date(startTime)
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
  })
}

export function HourlyGraphPanel({
  periods,
  windowStartIndex,
  windowSize,
}: HourlyGraphPanelProps) {
  const [metric, setMetric] = useState<MetricKey>("temp")
  const metricConfig = METRIC_CONFIG[metric]

  const chartData = useMemo<ChartPoint[]>(() => {
    const windowEndIndex = Math.min(windowStartIndex + windowSize, periods.length)
    const sliced = periods.slice(windowStartIndex, windowEndIndex)

    return sliced.map((period) => ({
      startTime: period.startTime,
      hourLabel: toHourLabel(period.startTime),
      value: metricConfig.selector(period),
    }))
  }, [metricConfig, periods, windowSize, windowStartIndex])

  const hasValues = chartData.some((point) => typeof point.value === "number")

  return (
    <div className="space-y-3">
      <Tabs
        value={metric}
        onValueChange={(nextMetric) => {
          if (
            nextMetric === "temp" ||
            nextMetric === "precip" ||
            nextMetric === "wind" ||
            nextMetric === "humidity"
          ) {
            setMetric(nextMetric)
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="temp">Temp</TabsTrigger>
          <TabsTrigger value="precip">Precip</TabsTrigger>
          <TabsTrigger value="wind">Wind</TabsTrigger>
          <TabsTrigger value="humidity">Humidity</TabsTrigger>
        </TabsList>
      </Tabs>

      {!hasValues ? (
        <p className="text-sm text-muted-foreground">
          No values available for {metricConfig.label.toLowerCase()} in this window.
        </p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
              <XAxis
                dataKey="startTime"
                tick={{ fontSize: 10 }}
                minTickGap={14}
                tickMargin={8}
                tickFormatter={toHourLabel}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickMargin={8}
                width={30}
                tickFormatter={(value: number) => `${value}`}
              />
              <Tooltip
                formatter={(value: unknown) => {
                  if (typeof value !== "number") {
                    return ["N/A", metricConfig.label]
                  }
                  return [`${value}${metricConfig.unitSuffix}`, metricConfig.label]
                }}
                labelFormatter={(label) =>
                  `Hour: ${typeof label === "string" ? toTooltipLabel(label) : label}`
                }
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={metricConfig.color}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
