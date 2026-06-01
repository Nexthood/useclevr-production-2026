"use client"

import { LoadingScreen } from "@/components/ui/loading-screen"
import { Database } from "lucide-react"

export default function DatasetsLoading() {
  return <LoadingScreen icon={Database} text="Loading datasets..." />
}
