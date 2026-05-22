import { useNotice } from "@/components/ui/notice-bar"
import * as React from "react"

export function DashboardNoticeBar() {
  const { notice, clearNotice } = useNotice()

  if (!notice) return null

  return (
    <div className="relative z-[120] flex justify-center pointer-events-none">
      <div
        role={notice.type === "error" ? "alert" : "status"}
        className={[
          "pointer-events-auto flex w-full items-center gap-3 border-b px-6 py-2 shadow-sm animate-in slide-in-from-top duration-300",
          notice.type === "error"
            ? "border-red-500 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
            : notice.type === "success"
              ? "border-green-500 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
              : "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200",
        ].join(" ")}
      >
        {notice.type === "error" && <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        {notice.type === "success" && <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        {notice.type === "info" && <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <p className="text-sm font-semibold">{notice.title}</p>
          {notice.message && (
            <p className="text-sm opacity-90">{notice.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => clearNotice()}
          className="rounded-md p-1 opacity-60 transition hover:opacity-100 focus-visible:outline-none hover:bg-black/10 dark:hover:bg-white/10"
          aria-label="Dismiss notice"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  )
}
