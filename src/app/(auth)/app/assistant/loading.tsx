"use client"

import { LoadingScreen } from "@/components/ui/loading-screen"
import { Bot } from "lucide-react"

export default function AssistantLoading() {
  return <LoadingScreen icon={Bot} text="Loading assistant..." />
}
