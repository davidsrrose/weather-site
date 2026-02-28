import { useEffect, useState } from 'react'

import { fetchJson } from '@/api/client'

export type HealthState = 'idle' | 'loading' | 'ok' | 'error'

export function useHealthCheck() {
  const [healthState, setHealthState] = useState<HealthState>('idle')
  const [healthMessage, setHealthMessage] = useState('Not checked yet.')

  const checkHealth = async () => {
    setHealthState('loading')
    setHealthMessage('Checking /api/health ...')

    try {
      const data = await fetchJson<{ status?: string }>('/api/health')
      if (data.status !== 'ok') {
        throw new Error('Unexpected health payload.')
      }

      setHealthState('ok')
      setHealthMessage('Backend is healthy: status=ok')
    } catch (error) {
      setHealthState('error')
      setHealthMessage(error instanceof Error ? error.message : 'Unable to reach backend.')
    }
  }

  useEffect(() => {
    void checkHealth()
  }, [])

  return {
    healthState,
    healthMessage,
    checkHealth,
  }
}
