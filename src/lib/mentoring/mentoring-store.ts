import { getDb } from "@/lib/db"
import { mentoringSessions } from "@/lib/db/schema"
import type {
  MentoringSession,
  MentoringSessionStatus,
  MentoringSessionType,
} from "@/lib/mentoring/mentoring-catalog"
import { eq, desc, and } from "drizzle-orm"
import { v4 as uuidv4 } from "uuid"

export type { MentorExpert, MentoringSession } from "@/lib/mentoring/mentoring-catalog"
export { getExpertiseByType, getSessionTypeLabel, listExpertMentors } from "@/lib/mentoring/mentoring-catalog"

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
