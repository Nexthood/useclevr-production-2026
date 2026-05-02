"use client"

import { debugLog, debugError } from "@/lib/debug"



import type React from "react"

import Link from "next/link"
import { Suspense, useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { useNotice } from "@/components/ui/notice-bar"
import { Loader2, ArrowRight, Sparkles, Mail, Lock, Rocket, Eye, EyeOff } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const { clearNotice, showNotice } = useNotice()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const getLoginErrorMessage = (code?: string | null) => {
    if (!code) {
      return "We could not sign you in. Please try again."
    }

    if (code === "CredentialsSignin") {
      return "The email or password does not match our records."
    }

    if (code === "Configuration") {
      return "Login is temporarily unavailable. Please contact support."
    }

    return "We could not sign you in. Please try again."
  }

  const showLoginError = (title: string, message?: string) => {
    showNotice({
      type: "error",
      title,
      message,
    })
  }

  const goToDashboard = () => {
    router.replace("/app")
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    clearNotice()

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo: "/app",
      })

      if (result?.error) {
        showLoginError(
          getLoginErrorMessage(result.error),
          result.error === "CredentialsSignin"
            ? "Check for typos, then try again. Password resets are not self-service yet."
            : "Your data is safe. This usually means the auth service needs attention.",
        )
      } else {
        goToDashboard()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      if (message.toLowerCase().includes("configuration")) {
        showLoginError(
          "Login service is not configured properly.",
          "Please contact support if this keeps happening.",
        )
      } else if (message.toLowerCase().includes("network")) {
        showLoginError("Network error.", "Please check your connection and try again.")
      } else {
        showLoginError("We could not sign you in.", "Please try again in a moment.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setIsLoading(true)
    clearNotice()

    try {
      debugLog("[LOGIN] Attempting demo login...")
      const result = await signIn("demo", {
        redirect: false,
        redirectTo: "/app",
      })
      debugLog("[LOGIN] Demo login result:", result)

      if (result?.error) {
        debugError("[LOGIN] Demo login error:", result.error)
        showLoginError(getLoginErrorMessage(result.error), "Please try again in a moment.")
      } else {
        debugLog("[LOGIN] Demo login successful, redirecting to /app")
        goToDashboard()
      }
    } catch (error) {
      debugError("[LOGIN] Demo login exception:", error)
      showLoginError("Demo access is temporarily unavailable.", "Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/70 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border border-border/80 bg-card/95 shadow-2xl backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex items-center justify-center mb-2">
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
            <CardDescription className="text-center">
              Sign in to continue to UseClevr
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 rounded-md border border-primary/30 bg-primary/10 p-4 text-sm">
              <div className="flex items-start gap-3">
                <Rocket className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">Demo account</p>
                  <div className="grid gap-1 text-sm">
                    <p className="break-all text-muted-foreground">
                      Email: <span className="font-medium text-foreground">demo@useclever.app</span>
                    </p>
                    <p className="text-muted-foreground">
                      Password: <span className="font-medium text-foreground">demo</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="#" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-11"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <Button 
                type="button" 
                variant="secondary" 
                className="w-full relative border border-secondary/30 shadow-sm" 
                disabled={isLoading}
                onClick={handleDemoLogin}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="mr-2 h-4 w-4" />
                )}
                Try Demo Account
                <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                  Demo
                </span>
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button variant="outline" className="w-full opacity-60" disabled>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="text-center text-sm mt-6">
              <span className="text-muted-foreground">Don't have an account? </span>
              <Link href="/signup" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-12 items-center justify-center px-4 text-sm text-muted-foreground">
          <span>Secure, private data analysis</span>
          <span className="mx-2">•</span>
          <span>Enterprise-ready</span>
        </div>
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
