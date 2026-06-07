"use client"

import type React from "react"

import { signup } from "@/app/actions/auth"
import { PublicFooter } from "@/components/layout/public-footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BUILTIN_BASE_USER, BUILTIN_SUPER_ADMIN_USER, DEMO_PASS } from "@/lib/auth/builtin-users"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { getPasswordPolicyChecks, validatePasswordPolicy } from "@/lib/auth/password-policy"
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Rocket, User } from "lucide-react"
import { getSession, signIn } from "next-auth/react"
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
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)
  const [showBuiltInPasswords, setShowBuiltInPasswords] = useState(false)
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

        const authenticatedSession = result && !result.error ? await getSession() : null
        const signInSucceeded = Boolean(authenticatedSession?.user?.id)
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

      const blockedStatus = result?.status === 401 || result?.status === 403
      const authenticatedSession =
        result && !result.error && !blockedStatus ? await getSession() : null
      const signInSucceeded = Boolean(authenticatedSession?.user?.id)

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

    const passwordPolicy = validatePasswordPolicy(signUpPassword, {
      email: signUpEmail,
      name: signUpName,
    })
    if (!passwordPolicy.passed) {
      setAuthError(passwordPolicy.message)
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

      setAuthError("Account created successfully. Please sign in with your credentials.")
      setSignInEmail(signUpEmail)
      router.push("/login?tab=signin")
    } catch {
      setAuthError("Account setup failed. Please try again.")
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

  const builtInAccounts = [
    {
      label: "Base role",
      email: BUILTIN_BASE_USER.email,
      password: DEMO_PASS,
    },
    {
      label: "Superadmin role",
      email: BUILTIN_SUPER_ADMIN_USER.email,
      password: DEMO_PASS,
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border border-border/80 bg-card/95 shadow-2xl backdrop-blur-sm">
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

              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Built-in accounts</p>
                    <p className="text-xs text-muted-foreground">
                      Use the same username and password for app sign-in and the CMS admin at <code>/admin</code>.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowBuiltInPasswords(!showBuiltInPasswords)}
                  >
                    {showBuiltInPasswords ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
                <div className="space-y-3">
                  {builtInAccounts.map((account) => (
                    <div
                      key={account.email}
                      className="rounded-md border border-border/60 bg-background px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-foreground">{account.label}</p>
                          <p className="font-mono text-xs text-muted-foreground">{account.email}</p>
                          {showBuiltInPasswords && (
                            <p className="font-mono text-xs text-muted-foreground">{account.password}</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => {
                            setSignInEmail(account.email)
                            setSignInPassword(account.password)
                            setAuthError(null)
                          }}
                        >
                          Use
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <TabsContent value="signin" className="mt-0">
                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  <InnerLabelInput
                    id="signin-email"
                    type="email"
                    label="Email"
                    icon={Mail}
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />

                  <div>
                    <InnerLabelInput
                      id="signin-password"
                      type={showSignInPassword ? "text" : "password"}
                      label="Password"
                      icon={Lock}
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      className="pr-11"
                      required
                      autoComplete="current-password"
                      trailing={
                        <PasswordToggle showPassword={showSignInPassword} setShowPassword={setShowSignInPassword} />
                      }
                    />
                    <Link href="#" className="mt-1 block text-sm text-primary hover:underline">
                      Forgot password?
                    </Link>
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
                  <InnerLabelInput
                    id="signup-name"
                    type="text"
                    label="Full name"
                    icon={User}
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    required
                    autoComplete="name"
                  />

                  <InnerLabelInput
                    id="signup-email"
                    type="email"
                    label="Email"
                    icon={Mail}
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />

                  <div>
                    <InnerLabelInput
                      id="signup-password"
                      type={showSignUpPassword ? "text" : "password"}
                      label="Password"
                      icon={Lock}
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="pr-11"
                      required
                      autoComplete="new-password"
                      trailing={
                        <PasswordToggle showPassword={showSignUpPassword} setShowPassword={setShowSignUpPassword} />
                      }
                    />
                    {signUpPassword && (
                      <PasswordStrengthIndicator password={signUpPassword} email={signUpEmail} name={signUpName} />
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      isLoading ||
                      !validatePasswordPolicy(signUpPassword, {
                        email: signUpEmail,
                        name: signUpName,
                      }).passed
                    }
                  >
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

      <PublicFooter />
    </div>
  )
}

function InnerLabelInput({
  id,
  label,
  icon: Icon,
  className,
  trailing,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  trailing?: React.ReactNode
}) {
  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-10 top-1.5 z-10 text-[10px] font-medium uppercase leading-none tracking-normal text-muted-foreground"
      >
        {label}
      </label>
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        aria-label={label}
        placeholder=" "
        className={["h-14 pl-10 pt-5 text-sm", className].filter(Boolean).join(" ")}
        {...props}
      />
      {trailing}
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
      tabIndex={-1}
    >
      {showPassword ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </button>
  )
}

function PasswordStrengthIndicator({
  password,
  email,
  name,
}: {
  password: string
  email: string
  name: string
}) {
  const criteria = getPasswordPolicyChecks(password, { email, name })
  const passed = criteria.filter((c) => c.passed).length
  const strength = Math.min(Math.ceil((passed / criteria.length) * 4), 4)
  const isComplete = passed === criteria.length

  const labels = ["Weak", "Fair", "Good", "Strong"]
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"]

  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < strength ? colors[Math.min(strength - 1, colors.length - 1)] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${
        passed < 3 ? "text-red-500" : passed < 5 ? "text-yellow-500" : "text-green-500"
      }`}>
        {isComplete ? labels[3] : passed < 3 ? labels[0] : passed < 5 ? labels[1] : labels[2]}
      </p>
      <ul className="space-y-1">
        {criteria.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-xs">
            <span className={c.passed ? "text-green-500" : "text-muted-foreground"}>
              {c.passed ? "✓" : "○"}
            </span>
            <span className={c.passed ? "text-foreground" : "text-muted-foreground"}>
              {c.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
