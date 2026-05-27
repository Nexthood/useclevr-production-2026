"use client";

import * as React from "react";

type NoticeType = "error" | "success" | "info";

type Notice = {
  id: number;
  type: NoticeType;
  title: string;
  message?: string;
};

type NoticeInput = Omit<Notice, "id">;

type NoticeContextValue = {
  notice: Notice | null;
  notices: Notice[];
  showNotice: (notice: NoticeInput) => void;
  clearNotice: (id?: number) => void;
  clearAllNotices: () => void;
};

const NoticeContext = React.createContext<NoticeContextValue | null>(null);

export type NoticeErrorType = "Configuration" | "CredentialsSignin" | string;

export function useNoticeAutoOpen(errorCode?: string | null) {
  const context = React.useContext(NoticeContext)
  React.useEffect(() => {
    if (!errorCode || !context) return
    const title = getLoginErrorMessage(errorCode)
    context.showNotice({
      type: "error",
      title,
      message: errorCode === "Configuration"
        ? "The login page is still available, but the auth service needs attention."
        : "Please check your details and try again.",
    })
    window.history.replaceState(null, "", "/login")
  }, [errorCode, context])
}

export function getLoginErrorMessage(code?: string | null) {
  if (!code) {
    return "We could not sign you in. Please try again."
  }

  if (code === "CredentialsSignin") {
    return "The email or password does not match our records."
  }

  if (code === "Configuration") {
    return "Login is temporarily unavailable. Please contact support."
  }

  return "We could not sign you in. Please try again."
}

const noticeEventName = "useclevr:notice";
let noticeIdCounter = 0;

const getFailedInteractionMessage = (status: number) => {
  if (status === 401 || status === 403) {
    return "Your session may have expired. Sign in again and retry.";
  }

  if (status === 429) {
    return "The service is busy or rate limited. Wait a moment, then retry.";
  }

  if (status >= 500) {
    return "The server did not complete the request. Please try again in a moment.";
  }

  return "The app could not complete that action. Check the form and try again.";
};

const formatRequestLabel = (method: string, url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    return `${method} ${parsed.pathname}`;
  } catch {
    return `${method} request`;
  }
};

const getFetchUrl = (input: Parameters<typeof window.fetch>[0]) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const getFetchMethod = (input: Parameters<typeof window.fetch>[0], init?: RequestInit) => {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== "string" && !(input instanceof URL) && input.method) {
    return input.method.toUpperCase();
  }
  return "GET";
};

export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = React.useState<Notice[]>([]);
  const [isMutedPath, setIsMutedPath] = React.useState(false);
  const notice = notices[0] ?? null;

  React.useEffect(() => {
    setIsMutedPath(false);
  }, []);

  const clearNotice = React.useCallback((id?: number) => {
    setNotices((current) => {
      if (id === undefined) return current.slice(1);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const showNotice = React.useCallback(
    (input: NoticeInput) => {
      if (isMutedPath) return;

      const nextNotice = {
        ...input,
        id: Date.now() + noticeIdCounter++,
      };
      setNotices((current) => {
        const duplicate = current.some(
          (item) =>
            item.type === input.type &&
            item.title === input.title &&
            item.message === input.message,
        );
        if (duplicate) return current;
        return [nextNotice, ...current].slice(0, 5);
      });
    },
    [isMutedPath],
  );

  const clearAllNotices = React.useCallback(() => {
    setNotices([]);
  }, []);

  React.useEffect(() => {
    const handleNotice = (event: Event) => {
      const detail = (event as CustomEvent<NoticeInput>).detail;
      if (detail?.title) {
        showNotice(detail);
      }
    };

    const handleError = () => {
      showNotice({
        type: "error",
        title: "Page script error.",
        message: "Refresh the page. If it repeats, contact support with the current page name.",
      });
    };

    const handleRejection = () => {
      showNotice({
        type: "error",
        title: "Background request failed.",
        message: "The app could not finish an automatic request. Retry the action or refresh the page.",
      });
    };

    window.addEventListener(noticeEventName, handleNotice);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener(noticeEventName, handleNotice);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [showNotice]);

  React.useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        const requestUrl = getFetchUrl(args[0]);
        const requestMethod = getFetchMethod(args[0], args[1]);
        const requestLabel = formatRequestLabel(requestMethod, requestUrl);
        const isAuthRequest = requestUrl.includes("/api/auth/");
        const shouldSurfaceFailure =
          !response.ok &&
          !isAuthRequest &&
          !isMutedPath &&
          (requestMethod !== "GET" || response.status === 401 || response.status === 403);

        if (shouldSurfaceFailure) {
          showNotice({
            type: "error",
            title: `${requestLabel} failed (${response.status}).`,
            message: getFailedInteractionMessage(response.status),
          });
          // Auto-open notice sidebar for error notices
          document.dispatchEvent(new CustomEvent("useclevr:open-notice-sidebar"));
        }

        return response;
      } catch (error) {
        if (!isMutedPath && !(error instanceof DOMException && error.name === "AbortError")) {
          showNotice({
            type: "error",
            title: `${formatRequestLabel(getFetchMethod(args[0], args[1]), getFetchUrl(args[0]))} could not connect.`,
            message: "Check your connection, then retry the action.",
          });
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isMutedPath, showNotice]);

  return (
    <NoticeContext.Provider value={{ notice, notices, showNotice, clearNotice, clearAllNotices }}>
      {children}
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  const context = React.useContext(NoticeContext);
  if (!context) {
    throw new Error("useNotice must be used inside NoticeProvider");
  }
  return context;
}

export function showGlobalNotice(notice: NoticeInput) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(noticeEventName, { detail: notice }));
}
