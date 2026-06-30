"use client";

import type React from "react";

import {
  beginEmailPasswordLogin,
  resendEmailOtp,
  signup,
  verifyAdminAuthBypass,
  verifyEmailOtp,
} from "@/app/actions/auth";
import { Logo } from "@/components/layout/logo";
import { UseClevrHeroDemo } from "@/components/public/useclevr-hero-demo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BUILTIN_BASE_USER, BUILTIN_SUPER_ADMIN_USER, DEMO_PASS } from "@/lib/auth/builtin-users";
import { getPasswordPolicyChecks, validatePasswordPolicy } from "@/lib/auth/password-policy";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  RefreshCw,
  Rocket,
  User,
} from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FaGoogle, FaLinkedin } from "react-icons/fa6";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const authText = {
  errors: {
    verifyFirst: "Please verify your email first. We sent you a confirmation code.",
    verifyFailed: "Email verification failed. Please try again.",
    resendFailed: "We could not resend the confirmation code. Please try again.",
  },
  verification: {
    title: "Check your email and enter the 6-digit code",
    description: "We sent a 6-digit code to your email.",
    sent: "We sent a 6-digit code to your email.",
    signInResent: "We sent a new confirmation code to your email.",
    resent: "A new confirmation code is on its way.",
    codeLabel: "6-digit code",
    verifyButton: "Verify email",
    verifyingButton: "Verifying...",
    resendButton: "Resend code",
    resendingButton: "Sending...",
    changeEmailButton: "Use another email",
  },
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "signin";
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authAction, setAuthAction] = useState<
    "signin" | "signup" | "demo" | "google" | "linkedin" | "admin-bypass" | null
  >(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [pendingVerificationPurpose, setPendingVerificationPurpose] = useState<"signup" | "login">(
    "signup",
  );
  const [otpPw, setOtpPw] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [adminBypassAvailable, setAdminBypassAvailable] = useState(false);
  const [adminBypassCode, setAdminBypassCode] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [revealPassword, setRevealPassword] = useState("");
  const [showBuiltInAccounts, setShowBuiltInAccounts] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<{
    googleEnabled: boolean;
    linkedInEnabled: boolean;
  } | null>(null);
  const authQueryError = searchParams.get("error");

  const REVEAL_PASSWORD = "edely";

  const goToDashboard = () => {
    router.replace("/app/dashboard");
    router.refresh();
  };

  const dashboardCallbackUrl = () => "/app/dashboard";
  const visibleAuthError = authError || getReadableAuthError(authQueryError);
  const isVerificationOpen = Boolean(pendingVerificationEmail);
  const resendSecondsRemaining = Math.max(0, Math.ceil((resendAvailableAt - nowMs) / 1000));

  useEffect(() => {
    if (!resendAvailableAt) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [resendAvailableAt]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/oauth-status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((status) => {
        if (cancelled || !status) return;
        setOauthStatus({
          googleEnabled: Boolean(status.googleEnabled),
          linkedInEnabled: Boolean(status.linkedInEnabled),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setOauthStatus({ googleEnabled: false, linkedInEnabled: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const showVerificationStep = (
    email: string,
    password: string,
    purpose: "signup" | "login",
    message = authText.verification.sent,
    allowAdminBypass = false,
  ) => {
    setPendingVerificationEmail(email.trim().toLowerCase());
    setPendingVerificationPurpose(purpose);
    setOtpPw(password);
    setOtpCode("");
    setAdminBypassCode("");
    setAdminBypassAvailable(allowAdminBypass);
    setVerificationError(null);
    setVerificationMessage(message);
    setResendAvailableAt(Date.now() + 60_000);
    setNowMs(Date.now());
  };

  const startProviderSignIn = async (provider: "demo" | "google" | "linkedin") => {
    setIsLoading(true);
    setAuthAction(provider);
    setAuthError(null);

    try {
      if (provider === "demo") {
        const result = await signIn("demo", {
          redirect: false,
          callbackUrl: dashboardCallbackUrl(),
        });

        if (!result?.ok) {
          setAuthError("Demo sign-in failed. Please try again.");
          return;
        }

        goToDashboard();
        return;
      }

      if (provider === "google" && oauthStatus && !oauthStatus.googleEnabled) {
        setAuthError("Google sign-in is not configured yet. Use email sign-in or try again later.");
        return;
      }

      if (provider === "linkedin" && oauthStatus && !oauthStatus.linkedInEnabled) {
        setAuthError("LinkedIn sign-in is not configured yet. Use email sign-in or try again later.");
        return;
      }

      await signIn(provider, {
        callbackUrl: dashboardCallbackUrl(),
        redirect: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setAuthError(message || "Social sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
      setAuthAction(null);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthAction("signin");
    setAuthError(null);

    try {
      const result = await beginEmailPasswordLogin(signInEmail, signInPassword);

      if ("error" in result && result.error) {
        setAuthError(result.error);
        return;
      }

      showVerificationStep(
        signInEmail,
        signInPassword,
        result.purpose || "login",
        "message" in result ? result.message : authText.verification.sent,
        "adminBypassAvailable" in result && Boolean(result.adminBypassAvailable),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.toLowerCase().includes("configuration")) {
        setAuthError("Authentication is not configured correctly.");
      } else if (message.toLowerCase().includes("network")) {
        setAuthError("Network error during sign-in. Please try again.");
      } else {
        setAuthError("Sign-in failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
      setAuthAction(null);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthAction("signup");
    setAuthError(null);

    const passwordPolicy = validatePasswordPolicy(signUpPassword, {
      email: signUpEmail,
      name: signUpName,
    });
    if (!passwordPolicy.passed) {
      setAuthError(passwordPolicy.message);
      setIsLoading(false);
      setAuthAction(null);
      return;
    }

    const formData = new FormData();
    formData.append("name", signUpName);
    formData.append("email", signUpEmail);
    formData.append("password", signUpPassword);

    try {
      const result = await signup(formData);

      if ("error" in result && result.error) {
        setAuthError(result.error);
        return;
      }

      showVerificationStep(
        signUpEmail,
        signUpPassword,
        "signup",
        "message" in result ? result.message : authText.verification.sent,
        "adminBypassAvailable" in result && Boolean(result.adminBypassAvailable),
      );
    } catch {
      setAuthError("Account setup failed. Please try again.");
    } finally {
      setIsLoading(false);
      setAuthAction(null);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthAction("signup");
    setVerificationError(null);
    setVerificationMessage(null);
    setAuthError(null);

    const formData = new FormData();
    formData.append("email", pendingVerificationEmail);
    formData.append("token", otpCode);
    formData.append("purpose", pendingVerificationPurpose);

    try {
      const result = await verifyEmailOtp(formData);
      if (result.error) {
        setVerificationError(result.error);
        return;
      }

      const signInResult = await signIn("credentials", {
        email: pendingVerificationEmail,
        password: otpPw,
        verificationProof: result.proof,
        verificationPurpose: result.purpose,
        redirect: false,
        callbackUrl: dashboardCallbackUrl(),
      });

      if (!signInResult?.ok) {
        setSignInEmail(pendingVerificationEmail);
        setPendingVerificationEmail("");
        setPendingVerificationPurpose("signup");
        setOtpPw("");
        setAuthError("Verification passed, but sign-in failed. Please try again.");
        router.push("/login?tab=signin");
        return;
      }

      goToDashboard();
    } catch {
      setVerificationError(authText.errors.verifyFailed);
    } finally {
      setIsLoading(false);
      setAuthAction(null);
    }
  };

  const handleAdminBypassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminBypassAvailable) return;

    setIsLoading(true);
    setAuthAction("admin-bypass");
    setVerificationError(null);
    setVerificationMessage(null);
    setAuthError(null);

    const formData = new FormData();
    formData.append("email", pendingVerificationEmail);
    formData.append("password", otpPw);
    formData.append("code", adminBypassCode);
    formData.append("purpose", pendingVerificationPurpose);

    try {
      const result = await verifyAdminAuthBypass(formData);
      if (result.error) {
        setVerificationError(result.error);
        return;
      }

      const signInResult = await signIn("credentials", {
        email: pendingVerificationEmail,
        password: otpPw,
        verificationProof: result.proof,
        verificationPurpose: result.purpose,
        redirect: false,
        callbackUrl: dashboardCallbackUrl(),
      });

      if (!signInResult?.ok) {
        setSignInEmail(pendingVerificationEmail);
        setPendingVerificationEmail("");
        setPendingVerificationPurpose("signup");
        setOtpPw("");
        setAdminBypassCode("");
        setAdminBypassAvailable(false);
        setAuthError("Admin fallback passed, but sign-in failed. Please try again.");
        router.push("/login?tab=signin");
        return;
      }

      goToDashboard();
    } catch {
      setVerificationError("Admin fallback failed. Please try again.");
    } finally {
      setIsLoading(false);
      setAuthAction(null);
    }
  };

  const handleResendCode = async () => {
    if (resendSecondsRemaining > 0) return;

    setIsResendingCode(true);
    setVerificationError(null);
    setVerificationMessage(null);

    try {
      const result = await resendEmailOtp(pendingVerificationEmail, pendingVerificationPurpose);
      if (result.error) {
        setVerificationError(result.error);
        return;
      }

      setVerificationMessage(authText.verification.resent);
      setResendAvailableAt(Date.now() + 60_000);
      setNowMs(Date.now());
    } catch {
      setVerificationError(authText.errors.resendFailed);
    } finally {
      setIsResendingCode(false);
    }
  };

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
          <Rocket className="mr-2 h-4 w-4 text-pink-500" />
        )}
        Demo account
        <span className="ml-2 rounded-full bg-pink-500/15 px-2 py-0.5 text-xs text-pink-600 dark:text-pink-300">
          Free
        </span>
      </Button>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isLoading || oauthStatus?.googleEnabled !== true}
          onClick={() => startProviderSignIn("google")}
        >
          {authAction === "google" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FaGoogle className="mr-2 h-4 w-4 text-red-500" />
          )}
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isLoading || oauthStatus?.linkedInEnabled !== true}
          onClick={() => startProviderSignIn("linkedin")}
        >
          {authAction === "linkedin" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FaLinkedin className="mr-2 h-4 w-4 text-sky-600" />
          )}
          LinkedIn
        </Button>
      </div>
    </div>
  );

  const builtInAccounts = [
    {
      label: "Base role",
      email: BUILTIN_BASE_USER.email,
      password: DEMO_PASS,
    },
    {
      label: "Superadmin",
      email: BUILTIN_SUPER_ADMIN_USER.email,
      password: DEMO_PASS,
    },
  ];

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(6,182,212,0.22),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(168,85,247,0.22),transparent_32%),radial-gradient(circle_at_55%_85%,rgba(236,72,153,0.16),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      <header className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </header>

      <main className="relative z-10 grid min-h-screen w-full grid-cols-1 lg:grid-cols-[minmax(320px,480px)_minmax(0,1fr)]">
        <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10 xl:px-16">
          <Card className="w-full max-w-md border border-cyan-500/20 bg-card/90 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
            <CardContent className="pt-8">
              <div className="mb-7 flex items-center gap-3">
                <Logo className="h-10 w-auto md:h-12" />
              </div>

              <div className="mb-7">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                  AI business intelligence
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
                  Welcome back
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Sign in to turn CSV data into clear decisions.
                </p>
              </div>

              {isVerificationOpen ? (
                <div className="space-y-5">
                  <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                        <MailCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-bold leading-tight text-foreground">
                          {authText.verification.title}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {authText.verification.description}
                        </p>
                        <p className="mt-2 break-words text-xs font-medium text-cyan-700 dark:text-cyan-200">
                          {pendingVerificationEmail}
                        </p>
                      </div>
                    </div>
                  </div>

                  {authError && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                      {authError}
                    </div>
                  )}

                  {verificationError && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                      {verificationError}
                    </div>
                  )}

                  {verificationMessage && (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                      {verificationMessage}
                    </div>
                  )}

                  <form onSubmit={handleVerifySubmit} className="space-y-4">
                    <InnerLabelInput
                      id="signup-otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      label={authText.verification.codeLabel}
                      icon={KeyRound}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      autoComplete="one-time-code"
                    />

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 font-bold text-white hover:opacity-95"
                      disabled={isLoading || otpCode.length !== 6}
                    >
                      {isLoading && authAction === "signup" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {authText.verification.verifyingButton}
                        </>
                      ) : (
                        <>
                          {authText.verification.verifyButton}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  {adminBypassAvailable && (
                    <form
                      onSubmit={handleAdminBypassSubmit}
                      className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"
                    >
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Superadmin fallback
                      </p>
                      <InnerLabelInput
                        id="admin-bypass-code"
                        type="password"
                        label="Fallback code"
                        icon={KeyRound}
                        value={adminBypassCode}
                        onChange={(e) => setAdminBypassCode(e.target.value)}
                        required
                        autoComplete="off"
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        className="w-full border-amber-500/40 bg-background/80"
                        disabled={isLoading || !adminBypassCode}
                      >
                        {isLoading && authAction === "admin-bypass" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          "Use fallback code"
                        )}
                      </Button>
                    </form>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={isLoading || isResendingCode || resendSecondsRemaining > 0}
                      onClick={handleResendCode}
                    >
                      {isResendingCode ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      {isResendingCode
                        ? authText.verification.resendingButton
                        : resendSecondsRemaining > 0
                          ? `Resend in ${resendSecondsRemaining}s`
                          : authText.verification.resendButton}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      disabled={isLoading || isResendingCode}
                      onClick={() => {
                        setPendingVerificationEmail("");
                        setPendingVerificationPurpose("signup");
                        setOtpPw("");
                        setOtpCode("");
                        setAdminBypassCode("");
                        setAdminBypassAvailable(false);
                        setVerificationError(null);
                        setVerificationMessage(null);
                        setAuthError(null);
                      }}
                    >
                      {authText.verification.changeEmailButton}
                    </Button>
                  </div>
                </div>
              ) : (
                <Tabs defaultValue={defaultTab} className="space-y-5">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/70 p-1">
                    <TabsTrigger value="signin">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Sign up</TabsTrigger>
                  </TabsList>

                  {visibleAuthError && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                      {visibleAuthError}
                    </div>
                  )}

                  <TabsContent value="signin" className="mt-0 space-y-4">
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
                            <PasswordToggle
                              showPassword={showSignInPassword}
                              setShowPassword={setShowSignInPassword}
                            />
                          }
                        />
                        <Link href="#" className="mt-1 block text-xs text-primary hover:underline">
                          Forgot password?
                        </Link>
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

                    {showBuiltInAccounts ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="password"
                            placeholder="Password to reveal accounts"
                            value={revealPassword}
                            onChange={(e) => setRevealPassword(e.target.value)}
                            className="h-8 flex-1 text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setShowBuiltInAccounts(false)}
                          >
                            Hide
                          </Button>
                        </div>
                        {revealPassword === REVEAL_PASSWORD && (
                          <div className="space-y-1 pt-1">
                            {builtInAccounts.map((account) => (
                              <button
                                key={account.email}
                                type="button"
                                onClick={() => {
                                  setSignInEmail(account.email);
                                  setSignInPassword(account.password);
                                  setAuthError(null);
                                }}
                                disabled={isLoading}
                                className="w-full rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-left text-xs transition hover:bg-muted disabled:opacity-50"
                              >
                                <span className="font-medium text-foreground">
                                  {account.label}:
                                </span>{" "}
                                <span className="font-mono text-muted-foreground">
                                  {account.email}
                                </span>
                                {" / "}
                                <span className="font-mono text-muted-foreground">
                                  {account.password}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowBuiltInAccounts(true)}
                        className="mt-2 w-full text-xs text-primary hover:underline"
                      >
                        Show built-in accounts
                      </button>
                    )}
                  </TabsContent>

                  <TabsContent value="signup" className="mt-0 space-y-4">
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
                            <PasswordToggle
                              showPassword={showSignUpPassword}
                              setShowPassword={setShowSignUpPassword}
                            />
                          }
                        />
                        {signUpPassword && (
                          <PasswordStrengthIndicator
                            password={signUpPassword}
                            email={signUpEmail}
                            name={signUpName}
                          />
                        )}
                      </div>

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

                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  {providerButtons}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="relative hidden min-h-[720px] overflow-hidden lg:flex lg:items-center lg:justify-center lg:px-6 xl:px-12">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(6,182,212,0.28),transparent_28%),radial-gradient(circle_at_70%_40%,rgba(124,58,237,0.24),transparent_30%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.12),transparent_32%)]" />
          <div className="absolute left-10 top-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-40 w-40 rounded-full bg-[#7C3AED]/20 blur-3xl" />

          <div className="relative mx-auto w-full max-w-4xl px-2">
            <UseClevrHeroDemo layout="auth" className="shadow-purple-950/30" />
          </div>
        </section>
      </main>
    </div>
  );
}

function getReadableAuthError(error: string | null) {
  if (!error) return null;

  const messages: Record<string, string> = {
    Configuration:
      "OAuth sign-in is not configured correctly. Check the provider client ID, client secret, auth secret, and callback URL.",
    AccessDenied:
      "OAuth sign-in was denied. Choose an allowed account or try another sign-in method.",
    OAuthSignin: "OAuth sign-in could not start. Check the provider configuration and try again.",
    OAuthCallback:
      "OAuth sign-in could not complete. Check that the provider callback URL matches this app.",
    OAuthCreateAccount:
      "OAuth sign-in succeeded, but the account could not be created. Try again or use email sign-in.",
    EmailCreateAccount: "The account could not be created for this email address.",
    Callback: "The sign-in callback failed. Try again or use another sign-in method.",
    OAuthAccountNotLinked:
      "This email is already linked to another sign-in method. Sign in with the original method first.",
    SessionRequired: "Sign in to continue.",
    Default: "Sign-in failed. Try again or use another sign-in method.",
  };

  return messages[error] || messages.Default;
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

function PasswordStrengthIndicator({
  password,
  email,
  name,
}: {
  password: string;
  email: string;
  name: string;
}) {
  const criteria = getPasswordPolicyChecks(password, { email, name });
  const passed = criteria.filter((c) => c.passed).length;
  const strength = Math.min(Math.ceil((passed / criteria.length) * 4), 4);
  const isComplete = passed === criteria.length;

  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];

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
      <p
        className={`text-xs font-medium ${passed < 3 ? "text-red-500" : passed < 5 ? "text-yellow-500" : "text-green-500"}`}
      >
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
  );
}
