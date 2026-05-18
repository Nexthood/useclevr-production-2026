import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

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
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

interface TicketStoreFile {
  tickets: Record<string, SupportTicket>
}

const STORE_DIR = process.env.SUPPORT_TICKET_STORE_DIR || "/tmp/useclevr-support"
const STORE_PATH = path.join(STORE_DIR, "tickets.json")

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  return value.trim().replace(/\s+/g, " ").slice(0, 1000)
}

function normalizeStatus(value: unknown): TicketStatus {
  if (value === "in_progress" || value === "resolved") return value
  return "open"
}

function normalizePriority(value: unknown): TicketPriority {
  return value === "urgent" ? "urgent" : "normal"
}

async function readStore(): Promise<TicketStoreFile> {
  try {
    const raw = await readFile(STORE_PATH, "utf8")
    const parsed = JSON.parse(raw) as Partial<TicketStoreFile>
    return { tickets: parsed.tickets || {} }
  } catch {
    return { tickets: {} }
  }
}

async function writeStore(store: TicketStoreFile) {
  await mkdir(STORE_DIR, { recursive: true })
  const tmpPath = `${STORE_PATH}.${process.pid}.tmp`
  await writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8")
  await rename(tmpPath, STORE_PATH)
}

export async function listTickets(options: { userId?: string; includeAll?: boolean }) {
  const store = await readStore()
  return Object.values(store.tickets)
    .filter((ticket) => options.includeAll || ticket.userId === options.userId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export async function createTicket(input: {
  userId: string
  userEmail: string
  subject: unknown
  message: unknown
  category: unknown
  priority: unknown
}) {
  const subject = cleanText(input.subject)
  const message = cleanText(input.message)

  if (!subject || !message) {
    throw new Error("Subject and message are required.")
  }

  const now = new Date().toISOString()
  const ticket: SupportTicket = {
    id: `ticket-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    userId: input.userId,
    userEmail: input.userEmail,
    subject,
    message,
    category: cleanText(input.category, "General").slice(0, 80) || "General",
    priority: normalizePriority(input.priority),
    status: "open",
    adminNote: "",
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  }

  const store = await readStore()
  store.tickets[ticket.id] = ticket
  await writeStore(store)
  return ticket
}

export async function updateTicket(input: {
  id: unknown
  status: unknown
  adminNote?: unknown
  userId: string
  isSuperAdmin: boolean
}) {
  const id = cleanText(input.id)
  const store = await readStore()
  const ticket = store.tickets[id]

  if (!ticket) {
    throw new Error("Ticket not found.")
  }

  if (!input.isSuperAdmin && ticket.userId !== input.userId) {
    throw new Error("You do not have access to this ticket.")
  }

  if (input.isSuperAdmin) {
    ticket.status = normalizeStatus(input.status)
    ticket.adminNote = cleanText(input.adminNote)
  } else if (input.status === "resolved") {
    ticket.status = "resolved"
  }

  ticket.resolvedAt = ticket.status === "resolved" ? new Date().toISOString() : null
  ticket.updatedAt = new Date().toISOString()
  store.tickets[ticket.id] = ticket
  await writeStore(store)
  return ticket
}
