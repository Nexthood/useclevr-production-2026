"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check for existing session (demo mode uses localStorage)
    try {
      if (typeof window !== "undefined") {
        const storedUser = localStorage.getItem("useclevr_user")
        if (storedUser) {
          setUser(JSON.parse(storedUser))
        }
      }
    } catch (e) {
      // localStorage not available
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    // Demo mode - accepts any credentials
    const demoUser: User = {
      id: "demo-user-1",
      email: email,
      name: email.split("@")[0],
    }
    try {
      localStorage.setItem("useclevr_user", JSON.stringify(demoUser))
    } catch (e) {}
    setUser(demoUser)
    router.push("/app")
  }

  const signup = async (email: string, password: string, name: string) => {
    // Demo mode - creates user
    const demoUser: User = {
      id: "demo-user-1",
      email: email,
      name: name,
    }
    try {
      localStorage.setItem("useclevr_user", JSON.stringify(demoUser))
    } catch (e) {}
    setUser(demoUser)
    router.push("/app")
  }

  const logout = () => {
    try {
      localStorage.removeItem("useclevr_user")
    } catch (e) {}
    setUser(null)
    router.push("/login")
  }

  return <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
