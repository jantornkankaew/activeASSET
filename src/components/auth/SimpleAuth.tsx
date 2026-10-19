'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

interface SimpleUser {
  id: string
  email: string
  name: string
  role: string
  tenantId?: string
}

interface SimpleAuthContextType {
  user: SimpleUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

const TOKEN_KEY = 'activeasset_token'
const USER_KEY = 'activeasset_user'

const SimpleAuthContext = createContext<SimpleAuthContextType>({
  user: null,
  loading: false,
  login: async () => ({ ok: false }),
  logout: () => {},
})

export function SimpleAuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode
  initialUser?: SimpleUser | null
}) {
  // === Synchronous initial state from initialUser or client localStorage ===
  const [user, setUser] = useState<SimpleUser | null>(() => {
    if (initialUser) return initialUser
    if (typeof window === 'undefined') return null
    try {
      const savedUser = localStorage.getItem(USER_KEY)
      return savedUser ? JSON.parse(savedUser) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState<boolean>(false)

  // Read/sync saved user from localStorage and keep cookies in sync for SSR
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(USER_KEY)
      if (savedUser) {
        setUser(JSON.parse(savedUser))
        document.cookie = `activeasset_auth=1; path=/; max-age=31536000; SameSite=Lax`
        document.cookie = `activeasset_user=${encodeURIComponent(savedUser)}; path=/; max-age=31536000; SameSite=Lax`
      }
    } catch {
      // ignore parse errors
    } finally {
      setLoading(false)
    }
  }, [])

  // Patch global fetch on mount to attach Bearer token
  useEffect(() => {
    try {
      if (!window.__activeassetFetchPatched) {
        window.__activeassetFetchPatched = true
        const originalFetch = window.fetch.bind(window)
        window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input as Request).url)
          if (url.startsWith('/api/') || url.includes('/api/auth/')) {
            const tok = localStorage.getItem(TOKEN_KEY)
            if (tok) {
              const headers = new Headers(init?.headers || {})
              if (!headers.has('Authorization')) {
                headers.set('Authorization', `Bearer ${tok}`)
              }
              init = { ...init, headers }
            }
          }
          return originalFetch(input, init)
        }
      }
    } catch (e) {
      // ignore
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/simple-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        return { ok: false, error: data.error || 'เข้าสู่ระบบไม่สำเร็จ' }
      }
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      try {
        document.cookie = `activeasset_auth=1; path=/; max-age=31536000; SameSite=Lax`
        document.cookie = `activeasset_user=${encodeURIComponent(JSON.stringify(data.user))}; path=/; max-age=31536000; SameSite=Lax`
      } catch {}
      setUser(data.user)
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    try {
      document.cookie = `activeasset_auth=; path=/; max-age=0; SameSite=Lax`
      document.cookie = `activeasset_user=; path=/; max-age=0; SameSite=Lax`
      document.cookie = `activeasset_page=; path=/; max-age=0; SameSite=Lax`
      document.cookie = `activeasset_create_loan=; path=/; max-age=0; SameSite=Lax`
    } catch {}
    setUser(null)
  }, [])

  return (
    <SimpleAuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </SimpleAuthContext.Provider>
  )
}

export function useSimpleAuth() {
  return useContext(SimpleAuthContext)
}

// Helper to get token for API calls
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

// Helper for authenticated fetch (also works without it because global fetch is patched)
export async function authFetch(url: string, options: RequestInit = {}) {
  const token = getAuthToken()
  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...options, headers })
}

// TypeScript: extend Window
declare global {
  interface Window {
    __activeassetFetchPatched?: boolean
  }
}
