import { auth } from "@/lib/auth";
import { createTicket, listTickets, updateTicket } from "@/lib/support/ticket-store";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function getUser(session: any) {
  const userId = session?.user?.id
  const userEmail = session?.user?.email || ""

  if (!userId || !userEmail) {
    return null
  }

  return {
    id: userId,
    email: userEmail,
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
    const ticket = await createTicket({
      userId: user.id,
      userEmail: user.email,
      subject: body.subject,
      message: body.message,
      category: body.category,
      priority: body.priority,
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
    const ticket = await updateTicket({
      id: body.id,
      status: body.status,
      adminNote: body.adminNote,
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
