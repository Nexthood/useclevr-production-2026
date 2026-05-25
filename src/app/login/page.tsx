"use client"

import type React from "react"

import { Logo } from "@/components/layout/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { BUILTIN_DEMO_USER, BUILTIN_SUPER_ADMIN_USER } from "@/lib/auth/builtin-users"
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Rocket, Sparkles } from "lucide-react"
import { getProviders, signIn } from "next-auth/react"
import Link from "next/link"
import { FaGithub } from "react-icons/fa6"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useState } from "react"

const loginPresets = [
  {
    label: "Demo account",
    email: BUILTIN_DEMO_USER.email,
    password: BUILTIN_DEMO_USER.password,
    iconClassName: "text-primary",
  },
  {
    label: "Super admin",
    email: BUILTIN_SUPER_ADMIN_USER.email,
    password: BUILTIN_SUPER_ADMIN_USER.password,
    iconClassName: "text-amber-500",
  },
]

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

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)
  const [availableProviders, setAvailableProviders] = useState<Record<string, unknown>>({})
  const [loginError, setLoginError] = useState<{ title: string; message?: string; details?: string } | null>(null)

  const showLoginError = useCallback(
    (title: string, message?: string) => {
      setLoginError({
        title,
        message,
        details: "If you are running the generated dist server locally, start it with the local start command so Auth.js uses localhost instead of the server bind address.",
      })
    },
    [],
  )

  useEffect(() => {
    getProviders()
      .then((providers) => setAvailableProviders(providers ?? {}))
      .catch(() => setAvailableProviders({}))
  }, [])

  useEffect(() => {
    const errorCode = searchParams.get("error")
    if (!errorCode) return

    showLoginError(
      getLoginErrorMessage(errorCode),
      errorCode === "Configuration"
        ? "The login page is still available, but the auth service needs attention."
        : "Please check your details and try again.",
    )

    window.history.replaceState(null, "", "/login")
  }, [searchParams, showLoginError])

  const goToDashboard = () => {
    router.replace("/app")
    router.refresh()
  }

  const fillCredentials = (preset: (typeof loginPresets)[number]) => {
    setEmail(preset.email)
    setPassword(preset.password)
    setShowPassword(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLoginError(null)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/app",
      })

      const returnedToLogin =
        typeof result?.url === "string" &&
        (result.url.includes("/login") || result.url.includes("error="))
      const blockedStatus = result?.status === 401 || result?.status === 403
      const signInSucceeded = Boolean(result && !result.error && !blockedStatus && !returnedToLogin)

      if (!signInSucceeded) {
        showLoginError(
          getLoginErrorMessage(result?.error),
          result?.error === "CredentialsSignin" || blockedStatus
            ? "Check for typos, then try again. Password resets are not self-service yet."
            : "Your data is safe. This usually means the auth service needs attention.",
        )
        return
      }

      goToDashboard()
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

  const handleSocialSignIn = async (provider: "google" | "github") => {
    if (!availableProviders[provider]) {
      showLoginError(
        "Social login is not configured.",
        "Use email login for now, or ask support to connect this provider.",
      )
      return
    }

    setSocialLoading(provider)
    setLoginError(null)
    await signIn(provider, { callbackUrl: "/app" })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/70 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-24 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex h-20 items-center">
            <Logo className="h-16 w-auto" />
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
            {loginError && (
              <div className="mb-5 rounded-lg border border-red-500/40 bg-red-50 p-4 text-red-900 dark:bg-red-950/40 dark:text-red-100">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-semibold">{loginError.title}</p>
                    {loginError.message && <p className="text-sm opacity-90">{loginError.message}</p>}
                    {loginError.details && (
                      <details className="text-xs opacity-90">
                        <summary className="cursor-pointer font-medium">Details</summary>
                        <p className="mt-2 leading-relaxed">{loginError.details}</p>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-5 grid gap-2">
              {loginPresets.map((preset) => (
                <button
                  key={preset.email}
                  type="button"
                  onClick={() => fillCredentials(preset)}
                  className="w-full rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-left text-sm transition hover:border-primary/60 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Rocket className={`h-4 w-4 flex-shrink-0 ${preset.iconClassName}`} />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{preset.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {preset.email} / {preset.password}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
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
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading || socialLoading !== null}
              onClick={() => handleSocialSignIn("google")}
            >
              {socialLoading === "google" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
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
              )}
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading || socialLoading !== null}
              onClick={() => handleSocialSignIn("github")}
            >
              {socialLoading === "github" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FaGithub className="mr-2 h-4 w-4" />
              )}
              Continue with GitHub
            </Button>
            </div>

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
        <div className="container mx-auto flex min-h-12 flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-3 text-sm text-muted-foreground">
          <span>Secure, private data analysis</span>
          <span className="mx-2">•</span>
          <span>Enterprise-ready</span>
          <span className="mx-2">•</span>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <span className="mx-2">•</span>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
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
