"use client"

import { LoadingScreen } from "@/components/ui/loading-screen"
import { Shield } from "lucide-react"

export default function AdminLoading() {
  return <LoadingScreen icon={Shield} text="Loading admin panel..." />
}
