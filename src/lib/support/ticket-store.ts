import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { getDb } from "@/lib/db"
import { supportTickets } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
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
  adminName: string
  adminNoteUpdatedAt: string | null
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

function toTicket(row: typeof supportTickets.$inferSelect): SupportTicket {
  return {
    id: row.id,
    userId: row.userId,
    userEmail: row.userEmail,
    subject: row.subject,
    message: row.message,
    category: row.category,
    priority: row.priority === "urgent" ? "urgent" : "normal",
    status: normalizeStatus(row.status),
    adminNote: row.adminNote,
    adminName: row.adminName || "",
    adminNoteUpdatedAt: row.adminNoteUpdatedAt ? row.adminNoteUpdatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  }
}

function getDbClient() {
  try {
    return getDb()
  } catch {
    return null
  }
}

export async function listTickets(options: { userId?: string; includeAll?: boolean }) {
  const db = getDbClient()
  if (db) {
    try {
      const rows = options.includeAll
        ? await db.select().from(supportTickets).orderBy(desc(supportTickets.updatedAt))
        : await db.select().from(supportTickets).where(eq(supportTickets.userId, options.userId || "")).orderBy(desc(supportTickets.updatedAt))
      return rows.map(toTicket)
    } catch {
      // Fall back to local file storage for local/offline development.
    }
  }

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
  const id = `ticket-${randomUUID().replace(/-/g, "").slice(0, 12)}`
  const ticket: SupportTicket = {
    id,
    userId: input.userId,
    userEmail: input.userEmail,
    subject,
    message,
    category: cleanText(input.category, "General").slice(0, 80) || "General",
    priority: normalizePriority(input.priority),
    status: "open",
    adminNote: "",
    adminName: "",
    adminNoteUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  }

  const db = getDbClient()
  if (db) {
    try {
      const [row] = await db.insert(supportTickets).values({
        id,
        userId: ticket.userId,
        userEmail: ticket.userEmail,
        subject,
        message,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        adminNote: ticket.adminNote,
        createdAt: new Date(now),
        updatedAt: new Date(now),
        resolvedAt: null,
      }).returning()
      return toTicket(row)
    } catch {
      // Fall back to local file storage for local/offline development.
    }
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
  const db = getDbClient()
  if (db) {
    try {
      const [existing] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1)

      if (!existing) {
        throw new Error("Ticket not found.")
      }

      if (!input.isSuperAdmin && existing.userId !== input.userId) {
        throw new Error("You do not have access to this ticket.")
      }

      const nextStatus = input.isSuperAdmin
        ? normalizeStatus(input.status)
        : input.status === "resolved"
          ? "resolved"
          : existing.status
      const now = new Date()
      const [row] = await db.update(supportTickets).set({
        status: nextStatus,
        adminNote: input.isSuperAdmin ? cleanText(input.adminNote) : existing.adminNote,
        resolvedAt: nextStatus === "resolved" ? now : null,
        updatedAt: now,
      }).where(eq(supportTickets.id, id)).returning()

      return toTicket(row)
    } catch (error) {
      if (error instanceof Error && /not found|access/.test(error.message.toLowerCase())) {
        throw error
      }
      // Fall back to local file storage for local/offline development.
    }
  }

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
