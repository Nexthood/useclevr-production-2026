import type { Metadata } from "next"
import { PreferencesPanel } from "./preferences-panel"

export const metadata: Metadata = { title: "Preferences" }

export default function PreferencesSettingsPage() {
  return <PreferencesPanel />
}

