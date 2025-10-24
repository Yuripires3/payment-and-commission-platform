"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

interface User {
  id: string
  cnpj: string
  username: string
  role: "admin" | "partner"
  name: string
  email: string
  partner_id?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("user")
    const storedToken = localStorage.getItem("token")

    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
      } catch (error) {
        console.error("[v0] Failed to parse user data:", error)
        localStorage.removeItem("user")
        localStorage.removeItem("token")
      }
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    // Redirect logic based on authentication state
    if (isLoading) return

    const isAdminRoute = pathname?.startsWith("/admin")
    const isPartnerRoute = pathname?.startsWith("/partner")
    const isLoginRoute = pathname === "/login"
    const isPublicRoute = pathname === "/"

    if (!user && (isAdminRoute || isPartnerRoute)) {
      // Not logged in, trying to access protected route
      console.log("[v0] Not authenticated, redirecting to login")
      router.push("/login")
    } else if (user && isLoginRoute) {
      // Already logged in, redirect to appropriate dashboard
      const redirectPath = user.role === "admin" ? "/admin" : "/partner"
      console.log("[v0] Already authenticated, redirecting to:", redirectPath)
      router.push(redirectPath)
    } else if (user && isAdminRoute && user.role !== "admin") {
      // Partner trying to access admin area
      console.log("[v0] Partner trying to access admin area, redirecting")
      router.push("/partner")
    } else if (user && isPartnerRoute && user.role !== "partner") {
      // Admin trying to access partner area
      console.log("[v0] Admin trying to access partner area, redirecting")
      router.push("/admin")
    }
  }, [user, isLoading, pathname, router])

  const logout = () => {
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    setUser(null)
    router.push("/login")
  }

  return <AuthContext.Provider value={{ user, isLoading, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
