"use client"

import { useEffect, useMemo, useRef, useState } from "react"

function resolveInitial<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value
}

export function usePersistentState<T>(key: string, initialValue: T | (() => T)) {
  const initialRef = useRef(initialValue)
  const defaultValue = useMemo(() => resolveInitial(initialRef.current), [])

  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") {
      return defaultValue
    }
    try {
      const stored = window.localStorage.getItem(key)
      if (stored !== null) {
        return JSON.parse(stored) as T
      }
    } catch (error) {
      console.error(`[usePersistentState] Failed to parse localStorage value for key "${key}":`, error)
      try {
        window.localStorage.removeItem(key)
      } catch {
        // ignore
      }
    }
    return defaultValue
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.error(`[usePersistentState] Failed to persist value for key "${key}":`, error)
    }
  }, [key, state])

  return [state, setState] as const
}

