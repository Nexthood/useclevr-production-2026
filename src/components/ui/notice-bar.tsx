"use client"

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
  const [isMutedPath, setIsMutedPath] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    setIsMutedPath(window.location.pathname.startsWith("/login"))
  }, [])

  const clearNotice = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setNotice(null)
  }, [])

  const showNotice = React.useCallback((input: NoticeInput) => {
    if (isMutedPath) return

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
  }, [isMutedPath])

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

        if (!response.ok && !isAuthRequest && !isMutedPath) {
          showNotice({
            type: "error",
            title: "Action failed.",
            message: getFailedInteractionMessage(response.status),
          })
        }

        return response
      } catch (error) {
        if (!isMutedPath) {
          showNotice({
            type: "error",
            title: "Connection failed.",
            message: "Check your connection and try again.",
          })
        }
        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
   }, [isMutedPath, showNotice])

   return (
    <NoticeContext.Provider value={{ notice, showNotice, clearNotice }}>
      {children}
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
