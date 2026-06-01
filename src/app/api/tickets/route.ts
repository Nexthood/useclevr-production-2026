import { auth } from "@/lib/auth/auth";
import { createTicket, listTickets, updateTicket } from "@/lib/support/ticket-store";
import { ticketCreateSchema, ticketUpdateSchema, validateOrError } from "@/lib/validation";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function getUser(session: any) {
  const userId = session?.user?.id
  const userEmail = session?.user?.email || ""
  const userName = session?.user?.name || userEmail

  if (!userId || !userEmail) {
    return null
  }

  return {
    id: userId,
    email: userEmail,
    name: userName,
    isSuperAdmin: session.user.role === "superadmin",
  }
}

export async function GET() {
  const user = getUser(await auth())

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tickets = await listTickets({
    userId: user.id,
    includeAll: user.isSuperAdmin,
  })

  return NextResponse.json({ tickets })
}

export async function POST(request: NextRequest) {
  const user = getUser(await auth())

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validation = validateOrError(ticketCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const ticket = await createTicket({
      userId: user.id,
      userEmail: user.email,
      subject: validation.data.subject,
      message: validation.data.message,
      category: validation.data.category,
      priority: validation.data.priority,
    })

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create ticket." },
      { status: 400 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const user = getUser(await auth())

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validation = validateOrError(ticketUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const ticket = await updateTicket({
      id: validation.data.id,
      status: validation.data.status,
      adminNote: validation.data.adminNote,
      adminName: user.name,
      userId: user.id,
      isSuperAdmin: user.isSuperAdmin,
    })

    return NextResponse.json({ ticket })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update ticket." },
      { status: 400 }
    )
  }
}
