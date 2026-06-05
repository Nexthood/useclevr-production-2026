export const mentoringSessionTypes = ["fundraising", "growth", "operations", "financial", "product"] as const

export type MentoringSessionType = (typeof mentoringSessionTypes)[number]
export type MentoringSessionStatus = "scheduled" | "completed" | "cancelled"

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

export function listExpertMentors(): MentorExpert[] {
  return defaultExperts
}
