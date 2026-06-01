import { useCallback, useEffect, useRef, useState } from "react"

export type ApiStatus = "idle" | "loading" | "success" | "error"

export interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  status: ApiStatus
}

export interface UseApiReturn<T, TArgs extends unknown[]> extends UseApiState<T> {
  execute: (...args: TArgs) => Promise<T | null>
  reset: () => void
  abort: () => void
}

export interface UseApiOptions<T> {
  immediate?: boolean
  args?: unknown[]
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
}

export function useApi<T, TArgs extends unknown[] = unknown[]>(
  fn: (...args: TArgs) => Promise<T>,
  options?: UseApiOptions<T>,
): UseApiReturn<T, TArgs> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<ApiStatus>("idle")

  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const fnRef = useRef(fn)
  const onSuccessRef = useRef(options?.onSuccess)
  const onErrorRef = useRef(options?.onError)
  fnRef.current = fn
  onSuccessRef.current = options?.onSuccess
  onErrorRef.current = options?.onError

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const execute = useCallback(async (...args: TArgs): Promise<T | null> => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setStatus("loading")

    try {
      const result = await fnRef.current(...args)

      if (controller.signal.aborted || !mountedRef.current) return null

      setData(result)
      setStatus("success")
      onSuccessRef.current?.(result)
      return result
    } catch (err: unknown) {
      if (controller.signal.aborted || !mountedRef.current) return null

      const message =
        err instanceof Error && err.name !== "AbortError"
          ? err.message
          : "An unexpected error occurred"
      setError(message)
      setStatus("error")
      onErrorRef.current?.(message)
      return null
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (options?.immediate) {
      execute(...(options.args as TArgs ?? [] as unknown as TArgs))
    }
  }, [options?.immediate])

  const reset = useCallback(() => {
    setData(null)
    setLoading(false)
    setError(null)
    setStatus("idle")
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { data, loading, error, status, execute, reset, abort }
}
