"use client"

import { LoadingScreen } from "@/components/ui/loading-screen"
import { Settings2 } from "lucide-react"

export default function SettingsLoading() {
  return <LoadingScreen icon={Settings2} text="Loading settings..." />
}
