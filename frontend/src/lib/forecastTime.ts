type ForecastTimeParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const FORECAST_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function parseForecastTimeParts(startTime: string): ForecastTimeParts | null {
  const match = FORECAST_TIME_PATTERN.exec(startTime)
  if (!match) {
    return null
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  }
}

function formatHour(hour24: number): string {
  const meridiem = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12} ${meridiem}`
}

function formatHourCompact(hour24: number): string {
  const meridiem = hour24 >= 12 ? 'pm' : 'am'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}${meridiem}`
}

function toUtcDate(parts: ForecastTimeParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

function fallbackHourLabel(startTime: string): string {
  const date = new Date(startTime)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }
  return date.toLocaleTimeString([], { hour: 'numeric' })
}

function fallbackDateLabel(startTime: string): string {
  const date = new Date(startTime)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatForecastHourLabel(startTime: string): string {
  const parts = parseForecastTimeParts(startTime)
  if (!parts) {
    return fallbackHourLabel(startTime)
  }
  return formatHour(parts.hour)
}

export function isForecastMidnight(startTime: string): boolean {
  const parts = parseForecastTimeParts(startTime)
  if (!parts) {
    return startTime.includes('T00:00')
  }
  return parts.hour === 0 && parts.minute === 0
}

export function formatForecastDayMarkerLabel(startTime: string): string {
  const parts = parseForecastTimeParts(startTime)
  if (!parts) {
    return fallbackDateLabel(startTime)
  }

  return toUtcDate(parts).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function fallbackRangeEndpointLabel(startTime: string): string {
  const date = new Date(startTime)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  const day = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  const hour = date
    .toLocaleTimeString('en-US', { hour: 'numeric' })
    .toLowerCase()
    .replace(/\s+/g, '')
  return `${day} (${hour})`
}

export type ForecastRangeEndpointParts = {
  dayLabel: string
  timeLabel: string
}

export function formatForecastRangeEndpointParts(startTime: string): ForecastRangeEndpointParts {
  const parts = parseForecastTimeParts(startTime)
  if (!parts) {
    const fallbackLabel = fallbackRangeEndpointLabel(startTime)
    const match = /^(.*)\s\(([^)]+)\)$/.exec(fallbackLabel)
    if (!match) {
      return { dayLabel: fallbackLabel, timeLabel: '--' }
    }
    return { dayLabel: match[1], timeLabel: match[2] }
  }

  const dayLabel = toUtcDate(parts).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return { dayLabel, timeLabel: formatHourCompact(parts.hour) }
}

export function formatForecastRangeEndpointLabel(startTime: string): string {
  const parts = formatForecastRangeEndpointParts(startTime)
  return `${parts.dayLabel} (${parts.timeLabel})`
}

export function formatForecastRangeLabel(startTime: string, endTime: string): string {
  return `${formatForecastRangeEndpointLabel(startTime)} - ${formatForecastRangeEndpointLabel(endTime)}`
}

export type ForecastDayPhase = 'day' | 'night' | 'unknown'

export function inferForecastDayPhase(
  iconUrl: string | null,
  isDaytime: boolean | null = null,
): ForecastDayPhase {
  if (isDaytime === true) {
    return 'day'
  }
  if (isDaytime === false) {
    return 'night'
  }
  if (!iconUrl) {
    return 'unknown'
  }
  if (iconUrl.includes('/day/')) {
    return 'day'
  }
  if (iconUrl.includes('/night/')) {
    return 'night'
  }
  return 'unknown'
}
