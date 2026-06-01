"use client"

import { LoadingScreen } from "@/components/ui/loading-screen"
import { Calculator } from "lucide-react"

export default function AccountancyLoading() {
  return <LoadingScreen icon={Calculator} text="Loading accountancy..." />
}
