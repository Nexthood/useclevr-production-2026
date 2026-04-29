"use client"

import { debugLog, debugError, debugWarn } from "@/lib/debug"



import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrokChatPanel } from "./grok-chat-panel"

export function AiChatButton() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [datasetId, setDatasetId] = useState<string | undefined>()
  const [datasetName, setDatasetName] = useState<string | undefined>()
  const [rowCount, setRowCount] = useState<number | undefined>()
  const [columnCount, setColumnCount] = useState<number | undefined>()
  const pathname = usePathname()

  useEffect(() => {
    // Extract datasetId from URL like /app/datasets/ds_xxx/analyze
    if (pathname) {
      const match = pathname.match(/\/app\/datasets\/([^/]+)/)
      if (match) {
        const id = match[1]
        setDatasetId(id)
        debugLog("[CHAT-BUTTON] Detected datasetId from URL:", id)
        
        // Fetch dataset info
        fetch(`/api/datasets/${id}`)
          .then(res => res.json())
          .then(data => {
            if (data.dataset?.name) {
              setDatasetName(data.dataset.name)
              debugLog("[CHAT-BUTTON] Detected datasetName:", data.dataset.name)
            }
            if (data.dataset?.rowCount) {
              setRowCount(data.dataset.rowCount)
            }
            if (data.dataset?.columns) {
              setColumnCount(data.dataset.columns.length)
            }
          })
          .catch(err => debugLog("[CHAT-BUTTON] Error fetching dataset:", err))
      } else {
        setDatasetId(undefined)
        setDatasetName(undefined)
        setRowCount(undefined)
        setColumnCount(undefined)
      }
    }
  }, [pathname])

  return (
    <>
      <Button
        variant="default"
        size="icon"
        className="fixed bottom-7 right-7 h-14 w-14 rounded-full shadow-lg z-50 bg-gradient-primary hover:opacity-90"
        onClick={() => setIsChatOpen(true)}
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
      <GrokChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        datasetId={datasetId}
        datasetName={datasetName}
        rowCount={rowCount}
        columnCount={columnCount}
      />
    </>
  )
}
