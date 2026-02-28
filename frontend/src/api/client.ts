export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function normalizeErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const detail = (payload as { detail?: unknown }).detail
  if (typeof detail === 'string') {
    return detail
  }

  if (detail && typeof detail === 'object') {
    const detailMessage = (detail as { message?: unknown }).message
    if (typeof detailMessage === 'string') {
      return detailMessage
    }
  }

  const message = (payload as { message?: unknown }).message
  if (typeof message === 'string') {
    return message
  }

  return fallback
}

function buildFallbackMessage(url: string, response: Response): string {
  const endpoint = (() => {
    try {
      return new URL(url, window.location.origin).pathname
    } catch {
      return url
    }
  })()

  if (response.status >= 500) {
    return `Server error (${response.status}) from ${endpoint}. Check backend logs and try again.`
  }

  return `Request to ${endpoint} failed with HTTP ${response.status}`
}

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const fallbackMessage = buildFallbackMessage(url, response)
    const message = normalizeErrorMessage(payload, fallbackMessage)
    throw new ApiError(message, response.status)
  }

  return payload as T
}
