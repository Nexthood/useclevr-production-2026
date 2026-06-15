import { randomUUID } from "node:crypto"

import { getPayloadClient } from "@/lib/payload/get-payload"

export type TicketStatus = "open" | "in_progress" | "resolved"
export type TicketPriority = "normal" | "urgent"

export interface SupportTicket {
  id: string
  userId: string
  userEmail: string
  subject: string
  message: string
  category: string
  priority: TicketPriority
  status: TicketStatus
  adminNote: string
  adminName: string
  adminNoteUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

type SupportIssueDocument = {
  id: string
  userId: string
  userEmail: string
  subject: string
  message: string
  category: string
  priority: TicketPriority
  status: TicketStatus
  adminNote?: string | null
  adminName?: string | null
  adminNoteUpdatedAt?: string | null
  createdAt: string
  updatedAt: string
  resolvedAt?: string | null
}

function cleanText(value: unknown, fallback = "", maxLength = 1000) {
  if (typeof value !== "string") return fallback
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength)
}

function normalizeStatus(value: unknown): TicketStatus {
  if (value === "in_progress" || value === "resolved") return value
  return "open"
}

function normalizePriority(value: unknown): TicketPriority {
  return value === "urgent" ? "urgent" : "normal"
}

function toTicket(issue: SupportIssueDocument): SupportTicket {
  return {
    id: issue.id,
    userId: issue.userId,
    userEmail: issue.userEmail,
    subject: issue.subject,
    message: issue.message,
    category: issue.category,
    priority: normalizePriority(issue.priority),
    status: normalizeStatus(issue.status),
    adminNote: issue.adminNote || "",
    adminName: issue.adminName || "",
    adminNoteUpdatedAt: issue.adminNoteUpdatedAt || null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    resolvedAt: issue.resolvedAt || null,
  }
}

export async function listTickets(options: { userId?: string; includeAll?: boolean }) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: "support-issues",
    depth: 0,
    overrideAccess: true,
    pagination: false,
    sort: "-updatedAt",
    where: options.includeAll
      ? undefined
      : {
          userId: {
            equals: options.userId || "",
          },
        },
  })

  return result.docs.map((issue) => toTicket(issue as SupportIssueDocument))
}

export async function createTicket(input: {
  userId: string
  userEmail: string
  subject: unknown
  message: unknown
  category: unknown
  priority: unknown
}) {
  const subject = cleanText(input.subject, "", 250)
  const message = cleanText(input.message, "", 4000)

  if (!subject || !message) {
    throw new Error("Subject and message are required.")
  }

  const payload = await getPayloadClient()
  const issue = await payload.create({
    collection: "support-issues",
    overrideAccess: true,
    data: {
      id: `ticket-${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      userId: input.userId,
      userEmail: input.userEmail,
      subject,
      message,
      category: cleanText(input.category, "General", 80) || "General",
      priority: normalizePriority(input.priority),
      status: "open",
      adminNote: "",
      adminName: "",
    },
  })

  return toTicket(issue as SupportIssueDocument)
}

export async function updateTicket(input: {
  id: unknown
  status: unknown
  adminNote?: unknown
  adminName?: unknown
  userId: string
  isSuperAdmin: boolean
}) {
  const id = cleanText(input.id, "", 160)
  const payload = await getPayloadClient()
  const existing = await payload.findByID({
    collection: "support-issues",
    id,
    depth: 0,
    overrideAccess: true,
  })

  if (!input.isSuperAdmin && existing.userId !== input.userId) {
    throw new Error("You do not have access to this ticket.")
  }

  const nextStatus = input.isSuperAdmin
    ? normalizeStatus(input.status)
    : input.status === "resolved"
      ? "resolved"
      : normalizeStatus(existing.status)

  const issue = await payload.update({
    collection: "support-issues",
    id,
    depth: 0,
    overrideAccess: true,
    data: {
      status: nextStatus,
      ...(input.isSuperAdmin
        ? {
            adminNote: cleanText(input.adminNote, "", 4000),
            adminName: cleanText(input.adminName, "", 255),
          }
        : {}),
    },
  })

  return toTicket(issue as SupportIssueDocument)
}
