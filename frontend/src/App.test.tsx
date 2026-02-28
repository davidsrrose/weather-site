import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '@/App'

vi.mock('@/api/hooks', () => ({
  useHourlyForecast: () => ({
    data: { generated_at: null, periods: [] },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useLocationSuggestions: () => ({
    data: [],
    isFetching: false,
    error: null,
  }),
}))

vi.mock('@/hooks/useHealthCheck', () => ({
  useHealthCheck: () => ({
    healthState: 'ok' as const,
    healthMessage: 'Backend is healthy: status=ok',
  }),
}))

vi.mock('@/hooks/useThemePreference', () => ({
  useThemePreference: () => ({
    isDarkMode: false,
    toggleThemeMode: vi.fn(),
  }),
}))

vi.mock('@/hooks/useLocationState', () => ({
  useLocationState: () => ({
    favorites: [],
    currentLocation: null,
    locationStatus: 'Select a location.',
    showLocationControls: false,
    setShowLocationControls: vi.fn(),
    locationQuery: '',
    setLocationQuery: vi.fn(),
    locationMessage: '',
    setLocationMessage: vi.fn(),
    selectFavorite: vi.fn(),
    applySearchSuggestion: vi.fn(),
  }),
}))

vi.mock('@/components/Dashboard', () => ({
  Dashboard: () => <div>Dashboard mock</div>,
}))

describe('App', () => {
  it('renders the app shell and dashboard', () => {
    render(<App />)

    expect(screen.getByText('Weather Site')).toBeInTheDocument()
    expect(screen.getByText('Dashboard mock')).toBeInTheDocument()
  })
})
