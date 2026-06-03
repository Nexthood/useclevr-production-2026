import { getDb } from "@/lib/db"
import { mentoringSessions, type MentoringSessionType, type MentoringSessionStatus } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

export interface MentoringSession {
  id: string
  userId: string
  mentorId: string | null
  type: MentoringSessionType
  status: MentoringSessionStatus
  scheduledAt: string | null
  duration: number | null
  notes: string | null
  recordingUrl: string | null
  mentorName: string | null
  mentorExpertise: string | null
  price: number | null
  createdAt: string
  updatedAt: string
}

export interface MentorExpert {
  id: string
  name: string
  expertise: string
  bio: string
  sessionTypes: MentoringSessionType[]
  pricePerSession: number
  available: boolean
}

const defaultExperts: MentorExpert[] = [
  {
    id: "mentor-001",
    name: "Alex Chen",
    expertise: "Startup Fundraising & Pitch Strategy",
    bio: "Former VC associate with 10+ years advising pre-seed to Series-A founders. Raised $200M+ collectively for portfolio companies.",
    sessionTypes: ["fundraising", "growth"],
    pricePerSession: 29900,
    available: true,
  },
  {
    id: "mentor-002",
    name: "Sarah Mitchell",
    expertise: "Growth Strategy & Market Expansion",
    bio: "Scaled three SaaS businesses from $0 to $10M+ ARR. Expert in go-to-market strategy, channel partnerships, and international expansion.",
    sessionTypes: ["growth", "operations"],
    pricePerSession: 24900,
    available: true,
  },
  {
    id: "mentor-003",
    name: "James Rodriguez",
    expertise: "Financial Planning & Operations",
    bio: "CFO-turned-consultant for SMEs. Specializes in cash flow management, unit economics, and operational efficiency for growing businesses.",
    sessionTypes: ["financial", "operations"],
    pricePerSession: 34900,
    available: true,
  },
  {
    id: "mentor-004",
    name: "Priya Patel",
    expertise: "Product Development & Innovation",
    bio: "Led product at two YC startups. Expert in product-market fit, roadmap prioritization, and building data-driven product teams.",
    sessionTypes: ["product", "growth"],
    pricePerSession: 27900,
    available: true,
  },
  {
    id: "mentor-005",
    name: "Marcus Thompson",
    expertise: "Fundraising & Financial Strategy",
    bio: "Investment banker turned entrepreneur. Helps founders prepare financial models, pitch decks, and valuation narratives for investor meetings.",
    sessionTypes: ["fundraising", "financial"],
    pricePerSession: 39900,
    available: true,
  },
]

const sessionTypeLabels: Record<MentoringSessionType, string> = {
  fundraising: "Fundraising",
  growth: "Growth Strategy",
  operations: "Operations",
  financial: "Financial Planning",
  product: "Product Development",
}

export function getSessionTypeLabel(type: MentoringSessionType): string {
  return sessionTypeLabels[type]
}

export function getExpertiseByType(type: MentoringSessionType): string {
  const map: Record<MentoringSessionType, string> = {
    fundraising: "Fundraising, pitch deck review, investor relations, valuation",
    growth: "Market expansion, go-to-market strategy, customer acquisition, partnerships",
    operations: "Operational efficiency, process optimization, team structure, supply chain",
    financial: "Cash flow management, budgeting, unit economics, financial modeling",
    product: "Product-market fit, roadmap planning, feature prioritization, UX strategy",
  }
  return map[type]
}

function rowToSession(row: any): MentoringSession {
  return {
    id: row.id,
    userId: row.userId,
    mentorId: row.mentorId ?? null,
    type: row.type as MentoringSessionType,
    status: row.status as MentoringSessionStatus,
    scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
    duration: row.duration ?? null,
    notes: row.notes ?? null,
    recordingUrl: row.recordingUrl ?? null,
    mentorName: row.mentorName ?? null,
    mentorExpertise: row.mentorExpertise ?? null,
    price: row.price ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }
}

function getDbClient() {
  try {
    return getDb()
  } catch {
    return null
  }
}

export async function listMentoringSessions(userId: string): Promise<MentoringSession[]> {
  const db = getDbClient()
  if (db) {
    try {
      const rows = await db
        .select()
        .from(mentoringSessions)
        .where(eq(mentoringSessions.userId, userId))
        .orderBy(desc(mentoringSessions.scheduledAt))
      return rows.map(rowToSession)
    } catch {
      // fallback
    }
  }
  return []
}

export async function createMentoringSession(input: {
  userId: string
  type: MentoringSessionType
  scheduledAt?: string
  mentorId?: string
  mentorName?: string
  mentorExpertise?: string
  price?: number
}): Promise<MentoringSession> {
  const id = `ms_${uuidv4().slice(0, 12)}`
  const now = new Date()

  const db = getDbClient()
  if (db) {
    try {
      const [row] = await db
        .insert(mentoringSessions)
        .values({
          id,
          userId: input.userId,
          type: input.type,
          status: "scheduled",
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          mentorId: input.mentorId ?? null,
          mentorName: input.mentorName ?? null,
          mentorExpertise: input.mentorExpertise ?? null,
          price: input.price ?? null,
          duration: 60,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      return rowToSession(row)
    } catch {
      throw new Error("Could not create session.")
    }
  }

  throw new Error("Database not available.")
}

export async function updateMentoringSession(input: {
  id: string
  userId: string
  status?: MentoringSessionStatus
  notes?: string
}): Promise<MentoringSession> {
  const db = getDbClient()
  if (db) {
    try {
      const [existing] = await db
        .select()
        .from(mentoringSessions)
        .where(and(eq(mentoringSessions.id, input.id), eq(mentoringSessions.userId, input.userId)))
        .limit(1)

      if (!existing) {
        throw new Error("Session not found.")
      }

      const [row] = await db
        .update(mentoringSessions)
        .set({
          status: input.status ?? existing.status,
          notes: input.notes ?? existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(mentoringSessions.id, input.id))
        .returning()
      return rowToSession(row)
    } catch (error) {
      if (error instanceof Error && /not found/.test(error.message)) {
        throw error
      }
      throw new Error("Could not update session.")
    }
  }

  throw new Error("Database not available.")
}

export function listExpertMentors(): MentorExpert[] {
  return defaultExperts
}
