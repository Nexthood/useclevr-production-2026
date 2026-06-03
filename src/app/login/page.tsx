"use client"

import type React from "react"

import { signup } from "@/app/actions/auth"
import { Logo } from "@/components/layout/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Rocket, Sparkles, User } from "lucide-react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { FaGoogle, FaLinkedin } from "react-icons/fa6"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "signin"
  const [signInEmail, setSignInEmail] = useState("")
  const [signInPassword, setSignInPassword] = useState("")
  const [signUpName, setSignUpName] = useState("")
  const [signUpEmail, setSignUpEmail] = useState("")
  const [signUpPassword, setSignUpPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [authAction, setAuthAction] = useState<"signin" | "signup" | "demo" | "google" | "linkedin" | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const goToDashboard = () => {
    router.replace("/app")
    router.refresh()
  }

  const dashboardCallbackUrl = () => new URL("/app", window.location.origin).toString()

  const startProviderSignIn = async (provider: "demo" | "google" | "linkedin") => {
    setIsLoading(true)
    setAuthAction(provider)
    setAuthError(null)

    try {
      if (provider === "demo") {
        const result = await signIn("demo", {
          redirect: false,
          callbackUrl: dashboardCallbackUrl(),
        })

        const signInSucceeded = Boolean(result && !result.error && result.status !== 401 && result.status !== 403)
        if (!signInSucceeded) {
          setAuthError("Demo sign-in failed. Please try again.")
          return
        }

        goToDashboard()
        return
      }

      await signIn(provider, {
        callbackUrl: dashboardCallbackUrl(),
        redirect: true,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      setAuthError(message || "Social sign-in failed. Please try again.")
    } finally {
      setIsLoading(false)
      setAuthAction(null)
    }
  }

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAuthAction("signin")
    setAuthError(null)

    try {
      const result = await signIn("credentials", {
        email: signInEmail,
        password: signInPassword,
        redirect: false,
        callbackUrl: dashboardCallbackUrl(),
      })

      const returnedToLogin =
        typeof result?.url === "string" &&
        (result.url.includes("/login") || result.url.includes("error="))
      const blockedStatus = result?.status === 401 || result?.status === 403
      const signInSucceeded = Boolean(result && !result.error && !blockedStatus && !returnedToLogin)

      if (!signInSucceeded) {
        setAuthError("Sign-in failed. Check your email and password.")
        return
      }

      goToDashboard()
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      if (message.toLowerCase().includes("configuration")) {
        setAuthError("Authentication is not configured correctly.")
      } else if (message.toLowerCase().includes("network")) {
        setAuthError("Network error during sign-in. Please try again.")
      } else {
        setAuthError("Sign-in failed. Please try again.")
      }
    } finally {
      setIsLoading(false)
      setAuthAction(null)
    }
  }

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAuthAction("signup")
    setAuthError(null)

    if (signUpPassword.length < 8) {
      setAuthError("Use at least 8 characters for your password.")
      setIsLoading(false)
      setAuthAction(null)
      return
    }

    const formData = new FormData()
    formData.append("name", signUpName)
    formData.append("email", signUpEmail)
    formData.append("password", signUpPassword)

    try {
      const result = await signup(formData)

      if (result.error) {
        setAuthError(result.error)
        return
      }

      // Sign in after successful signup
      const signInResult = await signIn("credentials", {
        email: signUpEmail,
        password: signUpPassword,
        redirect: false,
        callbackUrl: dashboardCallbackUrl(),
      })

      if (signInResult?.error) {
        setAuthError("Account created, but automatic sign-in failed. Please use the Sign in tab.")
        return
      }

      goToDashboard()
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Account creation failed. Please try again.")
    } finally {
      setIsLoading(false)
      setAuthAction(null)
    }
  }

  const providerButtons = (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full border-primary/40 bg-background text-foreground hover:bg-primary/10"
        disabled={isLoading}
        onClick={() => startProviderSignIn("demo")}
      >
        {authAction === "demo" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="mr-2 h-4 w-4" />
        )}
        Demo account
        <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary dark:text-cyan-100">
          Free
        </span>
      </Button>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isLoading}
          onClick={() => startProviderSignIn("google")}
        >
          {authAction === "google" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FaGoogle className="mr-2 h-4 w-4" />
          )}
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isLoading}
          onClick={() => startProviderSignIn("linkedin")}
        >
          {authAction === "linkedin" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FaLinkedin className="mr-2 h-4 w-4" />
          )}
          LinkedIn
        </Button>
      </div>
    </div>
  )

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
          <CardHeader className="space-y-2 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold">Access UseClevr</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={defaultTab} className="space-y-5">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              {authError && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {authError}
                </div>
              )}

              <TabsContent value="signin" className="mt-0">
                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        className="pl-10"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <Link href="#" className="text-sm text-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        className="pl-10 pr-11"
                        required
                        autoComplete="current-password"
                      />
                      <PasswordToggle showPassword={showPassword} setShowPassword={setShowPassword} />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && authAction === "signin" ? (
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
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignUpSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                        className="pl-10"
                        required
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        className="pl-10"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 8 characters"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        className="pl-10 pr-11"
                        required
                        autoComplete="new-password"
                      />
                      <PasswordToggle showPassword={showPassword} setShowPassword={setShowPassword} />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && authAction === "signup" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create account
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    By signing up, you agree to our{" "}
                    <Link href="/terms" className="text-primary hover:underline">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                      Privacy
                    </Link>
                    .
                  </p>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {providerButtons}
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

function PasswordToggle({
  showPassword,
  setShowPassword,
}: {
  showPassword: boolean
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
}) {
  return (
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
  )
}
