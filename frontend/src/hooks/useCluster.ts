import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useApiData<T>(path: string, interval = 60000) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasData = useRef(false)

  const fetchData = useCallback(async () => {
    // Only show full-page spinner on first load; background refreshes keep existing data visible
    if (!hasData.current) setLoading(true)
    setError(null)

    try {
      const response = await api.get<T>(path)
      setData(response.data)
      hasData.current = true
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    hasData.current = false
    void fetchData()
    const timer = window.setInterval(() => {
      void fetchData()
    }, interval)

    return () => window.clearInterval(timer)
  }, [fetchData, interval])

  return { data, loading, error, refresh: fetchData } as ApiState<T> & {
    refresh: () => Promise<void>
  }
}
