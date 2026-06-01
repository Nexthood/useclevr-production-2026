"use client"

import { LoadingScreen } from "@/components/ui/loading-screen"
import { Ticket } from "lucide-react"

export default function TicketsLoading() {
  return <LoadingScreen icon={Ticket} text="Loading tickets..." />
}
