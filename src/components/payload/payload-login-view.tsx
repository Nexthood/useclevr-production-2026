"use client";

import type React from "react";

import useclevrWordmarkDark from "@/assets/images/logos/useclevr-wordmark-dark.png";
import useclevrWordmarkLight from "@/assets/images/logos/useclevr-wordmark-light.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BUILTIN_BASE_USER, BUILTIN_SUPER_ADMIN_USER, DEMO_PASS } from "@/lib/auth/builtin-users";
import { getPasswordPolicyChecks, validatePasswordPolicy } from "@/lib/auth/password-policy";
import {
  ArrowRight,
  BrainCircuit,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Rocket,
  Sparkles,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PayloadThemeToggle } from "./payload-theme-toggle";

export function PayloadLoginView() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authAction, setAuthAction] = useState<"signin" | "signup" | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showBuiltInAccounts, setShowBuiltInAccounts] = useState(false);
  const [showTestControls, setShowTestControls] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    setShowTestControls(
      hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "test.useclevr.com" ||
        hostname.startsWith("test."),
    );
  }, []);

  const builtInAccounts = [
    {
      label: "Base CMS",
      email: BUILTIN_BASE_USER.email,
      password: DEMO_PASS,
    },
    {
      label: "Superadmin CMS",
      email: BUILTIN_SUPER_ADMIN_USER.email,
      password: DEMO_PASS,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthAction("signin");
    setAuthError(null);

    try {
      const response = await fetch("/api/payload/cms-users/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setAuthError("Sign-in failed. Check your CMS email and password.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setAuthError("Sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
      setAuthAction(null);
    }
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setAuthAction("signup");
    setAuthError(null);

    const policy = validatePasswordPolicy(signUpPassword, {
      email: signUpEmail,
      name: signUpName,
    });
    if (!policy.passed) {
      setAuthError(policy.message);
      setIsLoading(false);
      setAuthAction(null);
      return;
    }

    try {
      const response = await fetch("/api/payload/admin-auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signUpName,
          email: signUpEmail,
          password: signUpPassword,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setAuthError(body.error || "Account setup failed. Please try again.");
        return;
      }

      setEmail(signUpEmail);
      setPassword(signUpPassword);
      setActiveTab("signin");
      setAuthError("Operator account created. Sign in with your credentials.");
    } catch {
      setAuthError("Account setup failed. Please try again.");
    } finally {
      setIsLoading(false);
      setAuthAction(null);
    }
  };

  return (
    <div className="payload-login-page relative flex min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(6,182,212,0.22),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(168,85,247,0.22),transparent_32%),radial-gradient(circle_at_55%_85%,rgba(236,72,153,0.16),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      <header className="absolute right-4 top-4 z-20">
        <PayloadThemeToggle />
      </header>

      <main className="relative z-10 grid min-h-screen w-full grid-cols-1 lg:grid-cols-[minmax(320px,480px)_minmax(0,1fr)]">
        <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10 xl:px-16">
          <Card className="w-full max-w-md border border-cyan-500/20 bg-card/90 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
            <CardContent className="pt-8">
              <div className="mb-7 flex items-center gap-3">
                <img
                  src={useclevrWordmarkDark.src}
                  alt="UseClevr"
                  className="block h-10 w-auto dark:hidden"
                />
                <img
                  src={useclevrWordmarkLight.src}
                  alt="UseClevr"
                  className="hidden h-10 w-auto dark:block"
                />
              </div>

              <div className="mb-7">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                  Operator admin
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
                  Welcome back
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Sign in to manage UseClevr content and product operations.
                </p>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
                <TabsList className="grid w-full grid-cols-2 bg-muted/70 p-1">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>

                {authError && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                    {authError}
                  </div>
                )}

                <TabsContent value="signin" className="mt-0">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <InnerLabelInput
                      id="payload-admin-email"
                      type="email"
                      label="Email"
                      icon={Mail}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="username"
                    />

                    <div>
                      <InnerLabelInput
                        id="payload-admin-password"
                        type={showPassword ? "text" : "password"}
                        label="Password"
                        icon={Lock}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-11"
                        required
                        autoComplete="current-password"
                        trailing={
                          <PasswordToggle
                            showPassword={showPassword}
                            setShowPassword={setShowPassword}
                          />
                        }
                      />
                      <a href="/login" className="mt-1 block text-xs text-primary hover:underline">
                        Open dashboard sign-in
                      </a>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 font-bold text-white hover:opacity-95"
                      disabled={isLoading}
                    >
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
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <InnerLabelInput
                      id="payload-admin-signup-name"
                      type="text"
                      label="Full name"
                      icon={User}
                      value={signUpName}
                      onChange={(event) => setSignUpName(event.target.value)}
                      required
                      autoComplete="name"
                    />
                    <InnerLabelInput
                      id="payload-admin-signup-email"
                      type="email"
                      label="Email"
                      icon={Mail}
                      value={signUpEmail}
                      onChange={(event) => setSignUpEmail(event.target.value)}
                      required
                      autoComplete="email"
                    />
                  <InnerLabelInput
                    id="payload-admin-signup-password"
                    type={showSignUpPassword ? "text" : "password"}
                    label="Password"
                    icon={Lock}
                    value={signUpPassword}
                    onChange={(event) => setSignUpPassword(event.target.value)}
                    className="pr-11"
                    required
                    autoComplete="new-password"
                    trailing={
                      <PasswordToggle
                        showPassword={showSignUpPassword}
                        setShowPassword={setShowSignUpPassword}
                      />
                    }
                  />
                    {signUpPassword && (
                      <PayloadPasswordStrength
                        password={signUpPassword}
                        email={signUpEmail}
                        name={signUpName}
                      />
                    )}
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 font-bold text-white hover:opacity-95"
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
                          Create operator account
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

              </Tabs>

              {showTestControls && showBuiltInAccounts ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">Test accounts</p>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setShowBuiltInAccounts(false)}
                    >
                      Hide
                    </button>
                  </div>
                  <div className="space-y-1">
                    {builtInAccounts.map((account) => (
                      <button
                        key={account.email}
                        type="button"
                        onClick={() => {
                          setEmail(account.email);
                          setPassword(account.password);
                          setAuthError(null);
                        }}
                        disabled={isLoading}
                        className="w-full rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-left text-xs transition hover:bg-muted disabled:opacity-50"
                      >
                        <span className="font-medium text-foreground">{account.label}:</span>{" "}
                        <span className="font-mono text-muted-foreground">{account.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : showTestControls ? (
                <button
                  type="button"
                  onClick={() => setShowBuiltInAccounts(true)}
                  className="mt-4 w-full text-xs text-primary hover:underline"
                >
                  Show CMS test accounts
                </button>
              ) : null}

              {showTestControls && (
                <>
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or use</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-primary/40 bg-background text-foreground hover:bg-primary/10"
                    disabled={isLoading}
                    onClick={() => {
                      setEmail(BUILTIN_SUPER_ADMIN_USER.email);
                      setPassword(DEMO_PASS);
                      setAuthError(null);
                    }}
                  >
                    <Rocket className="mr-2 h-4 w-4 text-pink-500" />
                    Superadmin demo
                    <span className="ml-2 rounded-full bg-pink-500/15 px-2 py-0.5 text-xs text-pink-600 dark:text-pink-300">
                      Test
                    </span>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="relative hidden min-h-[720px] overflow-hidden lg:flex lg:items-center lg:justify-center lg:px-8 xl:px-16">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(6,182,212,0.28),transparent_28%),radial-gradient(circle_at_70%_40%,rgba(168,85,247,0.24),transparent_30%),radial-gradient(circle_at_50%_70%,rgba(236,72,153,0.18),transparent_32%)]" />
          <div className="absolute left-10 top-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-40 w-40 rounded-full bg-pink-500/20 blur-3xl" />

          <div className="relative mx-auto w-full max-w-xl px-4 text-center">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 shadow-2xl shadow-purple-500/25">
              <Sparkles className="h-10 w-10 text-white" />
            </div>

            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                Operator workspace
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                Publish. Review. Decide.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
                Manage news, FAQs, legal pages, media, and product-operation views from one admin
                surface.
              </p>
            </div>

            <div className="relative mx-auto max-w-lg rounded-[2rem] border border-white/20 bg-background/45 p-5 shadow-2xl shadow-purple-500/10 backdrop-blur-xl">
              <div className="absolute -left-8 top-10 rounded-2xl border border-pink-500/20 bg-pink-500/15 p-4 shadow-xl backdrop-blur-xl">
                <BrainCircuit className="h-7 w-7 text-pink-500" />
                <p className="mt-2 text-xs font-bold text-pink-600 dark:text-pink-300">
                  Editorial AI
                </p>
              </div>
              <div className="absolute -right-6 bottom-12 rounded-2xl border border-cyan-500/20 bg-cyan-500/15 p-4 shadow-xl backdrop-blur-xl">
                <Cpu className="h-7 w-7 text-cyan-500" />
                <p className="mt-2 text-xs font-bold text-cyan-600 dark:text-cyan-300">
                  Live content
                </p>
              </div>

              <div className="rounded-3xl border border-cyan-500/20 bg-card/70 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 p-2">
                      <BrainCircuit className="h-full w-full text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">Admin operations</p>
                      <p className="text-xs text-muted-foreground">Content and product workflows</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                    Ready
                  </span>
                </div>

                <div className="space-y-3">
                  <InsightRow
                    label="Public content"
                    value="Managed"
                    color="from-cyan-500 to-sky-500"
                  />
                  <InsightRow
                    label="Support issues"
                    value="Tracked"
                    color="from-purple-500 to-pink-500"
                  />
                  <InsightRow
                    label="Dataset uploads"
                    value="Owner-scoped"
                    color="from-orange-500 to-amber-500"
                  />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <MetricCard value="CMS" label="Content" color="from-cyan-400 to-sky-500" />
                  <MetricCard value="CSV" label="Uploads" color="from-purple-500 to-pink-500" />
                  <MetricCard value="AI" label="Handoff" color="from-emerald-400 to-cyan-500" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function InsightRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/45 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold text-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
          style={{ width: value === "Low" ? "34%" : value.includes("+") ? "78%" : "92%" }}
        />
      </div>
    </div>
  );
}

function MetricCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/45 p-3 text-center">
      <p className={`text-xl font-black bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function InnerLabelInput({
  id,
  label,
  icon: Icon,
  className,
  trailing,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  trailing?: React.ReactNode;
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
  );
}

function PasswordToggle({
  showPassword,
  setShowPassword,
}: {
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
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
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

function PayloadPasswordStrength({
  password,
  email,
  name,
}: {
  password: string;
  email: string;
  name: string;
}) {
  const criteria = getPasswordPolicyChecks(password, { email, name });
  const passed = criteria.filter((criterion) => criterion.passed).length;
  const strength = Math.min(Math.ceil((passed / criteria.length) * 4), 4);
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];

  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full ${
              index < strength
                ? colors[Math.min(strength - 1, colors.length - 1)]
                : "bg-muted"
            }`}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {criteria.map((criterion) => (
          <li key={criterion.label} className="flex items-center gap-2 text-xs">
            <span className={criterion.passed ? "text-green-500" : "text-muted-foreground"}>
              {criterion.passed ? "✓" : "○"}
            </span>
            <span className={criterion.passed ? "text-foreground" : "text-muted-foreground"}>
              {criterion.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
