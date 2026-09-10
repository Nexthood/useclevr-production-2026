"use client";

import usyAvatar from "@/assets/images/avatar.png";
import { AiAccuracyDisclaimer } from "@/components/chat/ai-accuracy-disclaimer";
import { Button } from "@/components/ui/button";
import type {
  HelpChatboxAudience,
  SupportedUsyLanguage,
  UsyChatResponse,
  UsyContactDraft,
  UsyUsageContext,
} from "@/lib/usy/types";
import { ArrowUp, Bot, Loader2, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

const placeholderMap = {
  english: "Ask Usy about UseClevr or get help...",
  german: "Frag Usy zu UseClevr oder hol dir Hilfe...",
  dutch: "Vraag Usy over UseClevr of krijg hulp...",
  spanish: "Pregunta a Usy sobre UseClevr o pide ayuda...",
  hungarian: "Kérdezd Usyt a UseClevrről, vagy kérj segítséget...",
  romanian: "Întreabă Usy despre UseClevr sau cere ajutor..."
};

const quickActionMap = {
  english: "Open AI Assistant",
  german: "KI-Assistent öffnen",
  dutch: "AI-assistent openen",
  spanish: "Abrir asistente de IA",
  hungarian: "AI-asszisztens megnyitása",
  romanian: "Deschide asistentul AI"
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  source?: "knowledge";
  followUps?: string[];
};

const starterSuggestions = [
  "What can you do?",
  "Explain AI credits",
  "Why is my upload blocked?",
  "Which plan do I need?",
  quickActionMap[currentUsyLanguage] || quickActionMap.english,
];

const capabilities = [
  "Uploads",
  "Datasets",
  "Dashboards",
  "AI Analysis",
  "Forecasting",
  "Reports",
  "Business Intelligence",
  "KPIs",
  "CSV imports",
  "Retail Analytics",
  "Inventory",
  "Billing",
  "Credits",
  "Settings",
  "Integrations",
  "Troubleshooting",
];

const usyLanguageBadges = {
  english: { flag: "🇬🇧", label: "English" },
  german: { flag: "🇩🇪", label: "Deutsch" },
  dutch: { flag: "🇳🇱", label: "Nederlands" },
  spanish: { flag: "🇪🇸", label: "Español" },
  hungarian: { flag: "🇭🇺", label: "Magyar" },
  romanian: { flag: "🇷🇴", label: "Română" },
} as const satisfies Record<SupportedUsyLanguage, { flag: string; label: string }>;

function SuggestionChip({
  label,
  index,
  onClick,
  compact = false,
}: {
  label: string;
  index: number;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group rounded-2xl border text-left font-semibold text-white transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200",
        "bg-[linear-gradient(135deg,rgba(34,211,238,0.15),rgba(216,180,254,0.12))] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
        "hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(34,211,238,0.16),0_0_20px_rgba(216,180,254,0.1)]",
        compact ? "px-3 py-1.5 text-xs" : "px-3.5 py-2.5 text-sm",
        index % 2 === 0
          ? "border-cyan-200/35 hover:border-cyan-100/75 hover:bg-cyan-200/[0.16]"
          : "border-fuchsia-200/30 hover:border-fuchsia-100/70 hover:bg-fuchsia-200/[0.14]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function UsyLanguageBadge({
  language,
  visible,
  showHint,
  onHintChange,
}: {
  language: (typeof usyLanguageBadges)[SupportedUsyLanguage];
  visible: boolean;
  showHint: boolean;
  onHintChange: (show: boolean) => void;
}) {
  return (
    <div className="relative mt-2 inline-flex">
      <button
        type="button"
        onClick={() => onHintChange(!showHint)}
        onMouseEnter={() => onHintChange(true)}
        onMouseLeave={() => onHintChange(false)}
        onFocus={() => onHintChange(true)}
        onBlur={() => onHintChange(false)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-200/25 bg-cyan-200/[0.08] px-2.5 py-1 text-[11px] font-medium leading-none text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_18px_rgba(34,211,238,0.08)] transition hover:border-cyan-100/55 hover:bg-cyan-100/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        aria-label="Usy multilingual support"
      >
        <span aria-hidden="true">🌍</span>
        <span>Multilingual</span>
        <span className="text-cyan-200/70" aria-hidden="true">
          •
        </span>
        <span
          key={language.label}
          className={[
            "inline-flex min-w-[6.25rem] items-center gap-1 transition duration-300 ease-out motion-reduce:transition-none",
            visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          ].join(" ")}
        >
          <span aria-hidden="true">{language.flag}</span>
          <span>{language.label}</span>
        </span>
      </button>
      {showHint && (
        <div className="absolute left-0 top-[calc(100%+0.45rem)] z-20 w-56 rounded-2xl border border-cyan-100/20 bg-slate-950/95 px-3 py-2 text-xs leading-5 text-slate-100 shadow-[0_18px_48px_rgba(2,6,23,0.42),0_0_22px_rgba(34,211,238,0.12)] backdrop-blur-xl">
          Usy automatically replies in the language you use.
        </div>
      )}
    </div>
  );
}

function UsyAvatar({
  size = "lg",
  interactive = false,
}: {
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
}) {
  const dimensions = size === "sm" ? "h-14 w-14" : size === "md" ? "h-16 w-16" : "h-24 w-24";
  const imageSize = size === "sm" ? 56 : size === "md" ? 64 : 96;

  return (
    <div
      className={[
        "usy-avatar-glow relative isolate shrink-0 rounded-full",
        dimensions,
        interactive
          ? "transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.03]"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <div className="absolute inset-0 z-[1] rounded-full bg-gradient-to-br from-cyan-200 via-sky-300 to-fuchsia-300 p-[2px] shadow-[0_0_26px_rgba(34,211,238,0.3),0_0_34px_rgba(168,85,247,0.18)]">
        <div className="relative h-full w-full overflow-hidden rounded-full bg-slate-950">
          <Image
            src={usyAvatar}
            alt=""
            width={imageSize}
            height={imageSize}
            className="h-full w-full scale-110 object-cover object-top"
            priority={false}
          />
          <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_15%,rgba(255,255,255,0.28),transparent_34%),linear-gradient(145deg,transparent_45%,rgba(34,211,238,0.16))]" />
        </div>
      </div>
    </div>
  );
}

export function HelpChatbox({
  audience = "public",
  hideOnApp = false,
  userRole,
}: {
  audience?: HelpChatboxAudience;
  hideOnApp?: boolean;
  userRole?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [usage, setUsage] = useState<UsyUsageContext | null>(null);
  const [contactDraft, setContactDraft] = useState<UsyContactDraft | null>(null);
  const [currentUsyLanguage, setCurrentUsyLanguage] = useState<SupportedUsyLanguage>("english");
  const [showLanguageHint, setShowLanguageHint] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("toggle-help-chat", openChat);
    return () => window.removeEventListener("toggle-help-chat", openChat);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isAsking]);

  useEffect(() => {
    if (!open) setShowLanguageHint(false);
  }, [open]);

  useEffect(() => {
    if (!open || audience === "public") return;
    let cancelled = false;

    fetch("/api/usage")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: UsyUsageContext | null) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [audience, open]);

  if (hideOnApp && pathname.startsWith("/app")) {
    return null;
  }

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;

    setQuery("");
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setIsAsking(true);

    try {
      const response = await fetch("/api/usy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          context: {
            audience,
            route: pathname,
            plan:
              usage?.subscriptionTier ||
              (userRole === "superadmin" ? "superadmin" : userRole === "admin" ? "admin" : undefined),
            usage,
          },
          contactDraft,
        }),
      });
      const body = response.ok ? ((await response.json()) as UsyChatResponse) : null;
      const result =
        body ??
        ({
          answer: "Usy could not answer right now. Please try again shortly.",
          source: "knowledge",
          followUps: ["What can you do?", "Contact support"],
          language: "english",
        } satisfies UsyChatResponse);

      setCurrentUsyLanguage(result.language);
      setContactDraft(result.contactDraft ?? null);

      if (result.action === "submit_contact" && result.contactDraft) {
        await submitContactRequest(result.contactDraft);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.answer,
          source: result.source,
          followUps: result.followUps,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Usy could not answer right now. Please try again shortly.",
          source: "knowledge",
          followUps: ["What can you do?", "Contact support"],
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  async function submitContactRequest(draft: UsyContactDraft) {
    const response = await fetch("/api/usy/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, confirmed: true }),
    });
    const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    const text = response.ok
      ? body?.message || "Your contact request has been submitted."
      : body?.error || "The contact request could not be submitted. Please try again shortly.";

    setContactDraft(null);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        text,
        source: "knowledge",
        followUps: response.ok ? ["What can you do?", "Open dashboard"] : ["Contact support", "Try again"],
      },
    ]);
  }

  function handleQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(query);
  }

  const containerClassName =
    "fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] right-3 z-[139] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3 sm:bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)] sm:right-6 sm:max-w-[calc(100vw-2rem)]";
  const panelClassName = [
    "usy-panel-open fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] top-[calc(env(safe-area-inset-top,0px)+0.75rem)] flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-[24px] border border-cyan-200/25 bg-slate-950/[0.95] text-white shadow-[0_34px_100px_rgba(8,13,30,0.6),0_0_52px_rgba(34,211,238,0.16)] backdrop-blur-2xl sm:absolute sm:bottom-24 sm:top-auto sm:inset-x-auto sm:h-auto sm:max-h-[min(760px,calc(100dvh-8rem))] sm:w-[min(calc(100vw-2rem),520px)] sm:rounded-[30px]",
    "sm:right-0",
  ].join(" ");

  return (
    <div className={containerClassName}>
      {open && (
        <section className={panelClassName} aria-label="Usy chat assistant">
          <header className="relative shrink-0 overflow-visible border-b border-cyan-200/18 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.24),transparent_34%),radial-gradient(circle_at_86%_0%,rgba(216,180,254,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.99),rgba(17,24,39,0.94))] px-5 py-4 sm:px-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200 to-fuchsia-200/80" />
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold leading-tight tracking-tight">Usy</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/[0.12] px-2.5 py-1 text-[11px] font-medium leading-none text-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                    Online
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-cyan-50/[0.82]">
                  UseClevr AI Business Assistant
                </p>
                <UsyLanguageBadge
                  language={usyLanguageBadges[currentUsyLanguage]}
                  visible
                  showHint={showLanguageHint}
                  onHintChange={setShowLanguageHint}
                />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.08] p-2 text-white/70 transition hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                aria-label="Close Usy chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <main
            ref={transcriptRef}
            className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-4 sm:px-5 sm:py-5"
          >
            {messages.length === 0 ? (
              <div className="flex min-h-full flex-col gap-4">
                <div className="relative overflow-hidden rounded-[28px] border border-cyan-200/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.048))] px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_60px_rgba(2,6,23,0.22)] sm:px-6">
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent" />
                  <div className="flex justify-center">
                    <UsyAvatar />
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-200/10 px-3 py-1 text-xs font-medium text-cyan-50">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
                    Always here to help
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
                    Hi, I'm Usy 👋
                  </h3>
                  <p className="mt-1.5 text-sm font-medium text-cyan-50">
                    Your AI Business Intelligence Assistant.
                  </p>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-200/[0.88]">
                    I'm here to help you understand your data, analyze your business, discover
                    opportunities, explain dashboards, generate insights, and answer anything about
                    UseClevr.
                  </p>
                </div>

                <div>
                  <p className="mb-2.5 text-sm font-semibold text-slate-100">
                    What can I help you with today?
                  </p>
                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                    {starterSuggestions.map((suggestion, index) => (
                      <SuggestionChip
                        key={suggestion}
                        label={suggestion}
                        index={index}
                        onClick={() => submitQuestion(suggestion)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.052] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/[0.85]">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                    Usy can help with
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full border border-cyan-100/10 bg-slate-900/75 px-2.5 py-1 text-[11px] text-slate-200"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-1">
                {messages.map((message, index) => {
                  const showFollowUps =
                    message.role === "assistant" &&
                    index === messages.length - 1 &&
                    Array.isArray(message.followUps) &&
                    message.followUps.length > 0 &&
                    !isAsking;

                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-[90%] space-y-2 sm:max-w-[86%]">
                        <div
                          className={`whitespace-pre-line rounded-3xl px-4 py-3 text-sm leading-6 ${
                            message.role === "user"
                              ? "rounded-br-lg bg-gradient-to-br from-cyan-200 via-sky-200 to-fuchsia-200 text-slate-950 shadow-[0_16px_38px_rgba(34,211,238,0.18)]"
                              : "rounded-bl-lg border border-cyan-100/15 bg-white/[0.086] text-slate-50 shadow-[inset_3px_0_0_rgba(34,211,238,0.58),0_16px_38px_rgba(2,6,23,0.18)] backdrop-blur"
                          }`}
                        >
                          {message.role === "assistant" && (
                            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/80">
                              <Bot className="h-3 w-3" />
                              Usy
                            </div>
                          )}
                          {message.text}
                        </div>
                        {showFollowUps && (
                          <div className="flex flex-wrap gap-2 pl-1">
                            {message.followUps?.map((followUp, followUpIndex) => (
                              <SuggestionChip
                                key={followUp}
                                label={followUp}
                                index={followUpIndex}
                                onClick={() => submitQuestion(followUp)}
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-3xl border border-cyan-100/15 bg-white/[0.085] px-4 py-3 text-sm text-slate-100 shadow-[inset_3px_0_0_rgba(34,211,238,0.62)]">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
                      Usy is thinking...
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          <form
            className="shrink-0 border-t border-cyan-100/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(8,13,30,0.98))] p-3 sm:p-4"
            onSubmit={handleQuestion}
          >
            <div className="rounded-[22px] border border-cyan-200/[0.2] bg-white/[0.08] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_46px_rgba(2,6,23,0.2)] focus-within:border-cyan-200/70 focus-within:shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_20px_56px_rgba(34,211,238,0.13)]">
              <textarea
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitQuestion(query);
                  }
                }}
                placeholder={placeholderMap[currentUsyLanguage] || placeholderMap.english}
                rows={1}
                className="max-h-24 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-5 text-white placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-3 px-1 pb-0.5">
                <span className="text-[11px] text-slate-400">Powered by UseClevr AI</span>
                <Button
                  type="submit"
                  size="icon"
                  disabled={!query.trim() || isAsking}
                  className="h-11 w-11 shrink-0 rounded-full border border-cyan-100/35 bg-gradient-to-br from-cyan-300 via-sky-400 to-fuchsia-400 text-white shadow-[0_12px_30px_rgba(34,211,238,0.28),0_0_22px_rgba(216,180,254,0.16),inset_0_1px_0_rgba(255,255,255,0.34)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-50/70 hover:shadow-[0_16px_36px_rgba(34,211,238,0.36),0_0_28px_rgba(216,180,254,0.24),inset_0_1px_0_rgba(255,255,255,0.42)] active:translate-y-0 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:border-white/10 disabled:bg-none disabled:bg-slate-700/75 disabled:text-slate-300/70 disabled:opacity-100 disabled:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_22px_rgba(2,6,23,0.22)]"
                  aria-label="Send message to Usy"
                >
                  {isAsking ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowUp className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
            <AiAccuracyDisclaimer
              className="mt-2 px-1 text-slate-300/80"
              iconClassName="text-cyan-200/80"
            />
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="usy-launcher group relative inline-flex h-14 w-14 items-center justify-center rounded-full text-white transition duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:h-16 sm:w-16"
        aria-label={open ? "Close Usy chat" : "Ask Usy"}
        aria-expanded={open}
        title="Ask Usy"
      >
        <span className="usy-launcher-bubble pointer-events-none absolute bottom-full right-0 mb-4 hidden w-56 rounded-2xl border border-cyan-200/25 bg-slate-950/[0.88] px-4 py-3 text-left text-sm font-semibold leading-5 text-cyan-50 opacity-0 shadow-[0_20px_54px_rgba(8,13,30,0.42),0_0_30px_rgba(34,211,238,0.16)] backdrop-blur-xl transition duration-200 ease-out before:absolute before:-bottom-1.5 before:right-6 before:h-3 before:w-3 before:rotate-45 before:border-b before:border-r before:border-cyan-200/25 before:bg-slate-950/[0.88] group-hover:pointer-events-auto group-hover:translate-y-[-4px] group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-[-4px] group-focus-visible:opacity-100 sm:block">
          How can I help you today!?
        </span>
        <UsyAvatar size="sm" interactive />
      </button>
    </div>
  );
}
