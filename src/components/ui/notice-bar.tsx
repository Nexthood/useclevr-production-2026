"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

type NoticeType = "error" | "success" | "info"

type Notice = {
  id: number
  type: NoticeType
  title: string
  message?: string
}

type NoticeInput = Omit<Notice, "id">

type NoticeContextValue = {
  notice: Notice | null
  showNotice: (notice: NoticeInput) => void
  clearNotice: () => void
}

const NoticeContext = React.createContext<NoticeContextValue | null>(null)

const noticeEventName = "useclevr:notice"

const icons = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
}

const styles = {
  error: "border-red-400/60 bg-red-600 text-white shadow-red-950/30",
  success: "border-emerald-400/60 bg-emerald-600 text-white shadow-emerald-950/30",
  info: "border-cyan-300/70 bg-cyan-500 text-slate-950 shadow-cyan-950/30",
}

const getFailedInteractionMessage = (status: number) => {
  if (status === 401 || status === 403) {
    return "Your session may have expired. Sign in again and retry."
  }

  if (status === 429) {
    return "The service is busy or rate limited. Wait a moment, then retry."
  }

  if (status >= 500) {
    return "The server did not complete the request. Please try again in a moment."
  }

  return "The app could not complete that action. Check the form and try again."
}

const getFetchUrl = (input: Parameters<typeof window.fetch>[0]) => {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return input.url
}

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = React.useState<Notice | null>(null)
  const [isAppPath, setIsAppPath] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    setIsAppPath(window.location.pathname.startsWith("/app"))
  }, [])

  const clearNotice = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setNotice(null)
  }, [])

  const showNotice = React.useCallback((input: NoticeInput) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    setNotice({
      ...input,
      id: Date.now(),
    })

    timerRef.current = setTimeout(() => {
      setNotice(null)
      timerRef.current = null
    }, input.type === "error" ? 9000 : 5000)
  }, [])

  React.useEffect(() => {
    const handleNotice = (event: Event) => {
      const detail = (event as CustomEvent<NoticeInput>).detail
      if (detail?.title) {
        showNotice(detail)
      }
    }

    const handleError = () => {
      showNotice({
        type: "error",
        title: "Something went wrong.",
        message: "Refresh the page or try again in a moment.",
      })
    }

    const handleRejection = () => {
      showNotice({
        type: "error",
        title: "A request failed.",
        message: "Check your connection and try again.",
      })
    }

    window.addEventListener(noticeEventName, handleNotice)
    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)

    return () => {
      window.removeEventListener(noticeEventName, handleNotice)
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [showNotice])

  React.useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)
        const requestUrl = getFetchUrl(args[0])
        const isAuthRequest = requestUrl.includes("/api/auth/")

        if (!response.ok && !isAuthRequest) {
          showNotice({
            type: "error",
            title: "Action failed.",
            message: getFailedInteractionMessage(response.status),
          })
        }

        return response
      } catch (error) {
        showNotice({
          type: "error",
          title: "Connection failed.",
          message: "Check your connection and try again.",
        })
        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [showNotice])

  const Icon = notice ? icons[notice.type] : Info

  return (
    <NoticeContext.Provider value={{ notice, showNotice, clearNotice }}>
      {children}
      {notice && (
        <div
          className={[
            "fixed right-0 z-[100] flex justify-center px-4 pointer-events-none",
            isAppPath ? "left-[220px] top-12" : "left-0 top-3",
          ].join(" ")}
        >
          <div
            role={notice.type === "error" ? "alert" : "status"}
            className={[
              "pointer-events-auto flex w-full max-w-2xl items-start gap-3 rounded-lg border px-4 py-3 shadow-2xl",
              styles[notice.type],
            ].join(" ")}
          >
            <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5">{notice.title}</p>
              {notice.message && (
                <p className="mt-1 text-xs leading-5 opacity-90">{notice.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={clearNotice}
              className="rounded-md p-1 opacity-80 transition hover:bg-white/15 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label="Dismiss notice"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </NoticeContext.Provider>
  )
}

export function useNotice() {
  const context = React.useContext(NoticeContext)
  if (!context) {
    throw new Error("useNotice must be used inside NoticeProvider")
  }
  return context
}

export function showGlobalNotice(notice: NoticeInput) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(noticeEventName, { detail: notice }))
}
