"use client"

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import * as React from "react"

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
  error: "border-red-500 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200",
  success: "border-green-500 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200",
  info: "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200",
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

    // Remove auto-dismiss for permanent bar
    // timerRef.current = setTimeout(() => {
    //   setNotice(null)
    //   timerRef.current = null
    // }, input.type === "error" ? 9000 : 5000)
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
            "fixed z-[100] flex justify-center pointer-events-none",
            isAppPath ? "left-[240px] right-0 top-[84px]" : "left-4 right-4 top-4",
          ].join(" ")}
        >
          <div
            role={notice.type === "error" ? "alert" : "status"}
            className={[
              "pointer-events-auto flex w-full max-w-2xl items-center gap-3 border px-4 py-3 shadow-sm rounded-md",
              styles[notice.type],
            ].join(" ")}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <p className="text-sm font-semibold">{notice.title}</p>
              {notice.message && (
                <p className="text-sm opacity-90">{notice.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={clearNotice}
              className="rounded-md p-1 opacity-60 transition hover:opacity-100 focus-visible:outline-none hover:bg-black/10 dark:hover:bg-white/10"
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
