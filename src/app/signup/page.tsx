"use client"

import type React from "react"

import { signup } from "@/app/actions/auth"
import { Logo } from "@/components/layout/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useNotice } from "@/components/ui/notice-bar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, Rocket, Sparkles, User } from "lucide-react"
import { getProviders, signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FaGithub } from "react-icons/fa6"
import { Suspense, useEffect, useState } from "react"

function SignupForm() {
  const router = useRouter()
  const { clearNotice, showNotice } = useNotice()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)
  const [availableProviders, setAvailableProviders] = useState<Record<string, unknown>>({})

  useEffect(() => {
    getProviders()
      .then((providers) => setAvailableProviders(providers ?? {}))
      .catch(() => setAvailableProviders({}))
  }, [])

  const showSignupError = (title: string, message?: string) => {
    showNotice({
      type: "error",
      title,
      message,
    })
  }

  const goToSignedInApp = () => {
    router.replace("/app")
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    clearNotice()

    if (password.length < 8) {
      showSignupError("Password is too short.", "Use at least 8 characters.")
      setIsLoading(false)
      return
    }

    const formData = new FormData()
    formData.append("name", name)
    formData.append("email", email)
    formData.append("password", password)

    const result = await signup(formData)

    if (result.error) {
      showSignupError(result.error)
      setIsLoading(false)
      return
    }

    // Sign in the user after successful signup
    const signInResult = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/app",
      redirect: false,
      redirectTo: "/app",
    })

    if (signInResult?.error) {
      showNotice({
        type: "info",
        title: "Account created.",
        message: "Please sign in to continue.",
      })
    } else {
      goToSignedInApp()
    }

    setIsLoading(false)
  }

  const handleDemoSignup = async () => {
    setIsLoading(true)
    clearNotice()

    const formData = new FormData()
    formData.append("demo", "true")

    const result = await signup(formData)

    if (result.error) {
      showSignupError(result.error)
    } else {
      // Sign in with demo credentials
      const signInResult = await signIn("demo", {
        callbackUrl: "/app",
        redirect: false,
        redirectTo: "/app",
      })

      if (signInResult?.error) {
        showSignupError("Demo login failed.", "Please try again.")
      } else {
        goToSignedInApp()
      }
    }

    setIsLoading(false)
  }

  const handleSocialSignup = async (provider: "google" | "github") => {
    if (!availableProviders[provider]) {
      showSignupError(
        "Social registration is not configured.",
        "Create an account with email for now, or ask support to connect this provider.",
      )
      return
    }

    setSocialLoading(provider)
    clearNotice()
    await signIn(provider, { callbackUrl: "/app" })
  }

  const features = [
    "Instant CSV analysis",
    "Natural language queries",
    "Enterprise-grade security",
    "No data stored externally",
  ]

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col">
        <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto flex h-24 items-center justify-between px-4 md:px-6">
            <Link href="/" className="flex h-20 items-center">
              <Logo className="h-16 w-auto" />
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
          <Card className="w-full max-w-md border-0 shadow-xl bg-card/50 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-6">
              <div className="flex items-center justify-center mb-2">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-center">Create your account</CardTitle>
              <CardDescription className="text-center">
                Get started with UseClevr today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input
                       id="name"
                       type="text"
                       placeholder="John Doe"
                       value={name}
                       onChange={(e) => setName(e.target.value)}
                       className="pl-10"
                       required
                       autoComplete="name"
                     />
                  </div>
                </div>

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
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input
                       id="password"
                       type={showPassword ? "text" : "password"}
                       placeholder="At least 8 characters"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="pl-10 pr-11"
                       required
                       autoComplete="new-password"
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
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  By signing up, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </p>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full relative border-primary/40 bg-background text-foreground hover:bg-primary/10"
                disabled={isLoading || socialLoading !== null}
                onClick={handleDemoSignup}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="mr-2 h-4 w-4" />
                )}
                Try Demo Account
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/15 text-primary dark:text-cyan-100">
                  Free
                </span>
              </Button>

              <div className="mt-3 grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading || socialLoading !== null}
                  onClick={() => handleSocialSignup("google")}
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
                  Sign up with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading || socialLoading !== null}
                  onClick={() => handleSocialSignup("github")}
                >
                  {socialLoading === "github" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FaGithub className="mr-2 h-4 w-4" />
                  )}
                  Sign up with GitHub
                </Button>
              </div>

              <div className="text-center text-sm mt-6">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign in
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

      {/* Right side - Features (hidden on mobile) */}
      <div className="hidden lg:flex lg:flex-1 bg-slate-950 items-center justify-center p-8 text-white dark:bg-slate-950">
        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Start analyzing data in seconds</h2>
            <p className="text-slate-200">
              Upload your CSV files and ask questions in plain English. No SQL, no dashboards, no BI tools required.
            </p>
          </div>
          
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-cyan-300 text-slate-950 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/20">
            <p className="text-sm text-slate-300">
              Trusted by professionals at leading companies worldwide
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
