import type React from "react"
import { AppPageHeader } from "@/components/layout/app-page-header"

type Breadcrumb = {
  label: string
  href?: string
}

export function DashboardSubpageLayout({
  title,
  description,
  breadcrumbs = [],
  actions,
  icon,
  subpageNav,
  leftSidebar,
  rightSidebar,
  children,
}: {
  title: string
  description?: string
  breadcrumbs?: Breadcrumb[]
  actions?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  subpageNav?: React.ReactNode
  leftSidebar?: React.ReactNode
  rightSidebar?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <AppPageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        actions={actions}
        icon={icon}
      />
      {subpageNav && (
        <div className="border-b border-border/70 bg-background">{subpageNav}</div>
      )}

      <DashboardPageBody leftSidebar={leftSidebar} rightSidebar={rightSidebar}>
        {children}
      </DashboardPageBody>
    </div>
  )
}

export function DashboardPageBody({
  leftSidebar,
  rightSidebar,
  children,
}: {
  leftSidebar?: React.ReactNode
  rightSidebar?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1">
      {leftSidebar}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      {rightSidebar}
    </div>
  )
}

export function DashboardContent({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex-1 overflow-y-auto p-5 ${className}`.trim()}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  )
}
