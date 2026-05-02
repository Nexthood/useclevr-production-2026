"use client"

import type React from "react"

import Link from "next/link"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { useNotice } from "@/components/ui/notice-bar"
import { signup } from "@/app/actions/auth"
import { Loader2, ArrowRight, Sparkles, Mail, Lock, User, CheckCircle2, Rocket } from "lucide-react"

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { clearNotice, showNotice } = useNotice()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const showSignupError = (title: string, message?: string) => {
    showNotice({
      type: "error",
      title,
      message,
    })
  }

  const getSafeCallbackUrl = () => {
    const callbackUrl = searchParams.get("callbackUrl")
    if (!callbackUrl) return "/app"

    const nextUrl = new URL(callbackUrl, window.location.origin)
    if (nextUrl.origin !== window.location.origin) {
      return "/app"
    }

    if (!nextUrl.pathname.startsWith("/app")) {
      return "/app"
    }

    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
  }

  const goToSignedInApp = () => {
    router.replace(getSafeCallbackUrl())
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
      redirect: false,
      redirectTo: getSafeCallbackUrl(),
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
        redirect: false,
        redirectTo: getSafeCallbackUrl(),
      })

      if (signInResult?.error) {
        showSignupError("Demo login failed.", "Please try again.")
      } else {
        goToSignedInApp()
      }
    }

    setIsLoading(false)
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
          <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
            <Link href="/" className="flex items-center">
              <Logo />
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
                  <Label htmlFor="name" className="text-brand-purple">Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-purple" />
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
                  <Label htmlFor="email" className="text-brand-purple">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-purple" />
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
                  <Label htmlFor="password" className="text-brand-purple">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-purple" />
                     <Input
                       id="password"
                       type="password"
                       placeholder="At least 8 characters"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="pl-10"
                       required
                       autoComplete="new-password"
                     />
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
                className="w-full relative border-brand-purple/30 text-brand-purple hover:bg-brand-purple/10"
                disabled={isLoading}
                onClick={handleDemoSignup}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="mr-2 h-4 w-4" />
                )}
                Try Demo Account
                <span className="ml-2 px-2 py-0.5 text-xs bg-brand-purple/20 text-brand-purple dark:text-brand-purple rounded-full">
                  Free
                </span>
              </Button>

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
          <div className="container mx-auto flex h-12 items-center justify-center px-4 text-sm text-muted-foreground">
            <span>Secure, private data analysis</span>
            <span className="mx-2">•</span>
            <span>Enterprise-ready</span>
          </div>
        </footer>
      </div>

      {/* Right side - Features (hidden on mobile) */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-primary items-center justify-center p-8">
        <div className="max-w-md text-white space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Start analyzing data in seconds</h2>
            <p className="text-white/80">
              Upload your CSV files and ask questions in plain English. No SQL, no dashboards, no BI tools required.
            </p>
          </div>
          
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/20">
            <p className="text-sm text-white/60">
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
