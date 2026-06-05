"use client"

import { LoadingScreen } from "@/components/ui/loading-screen"
import { Building2 } from "lucide-react"

export default function BusinessLoading() {
  return <LoadingScreen icon={Building2} text="Loading business data..." />
}
