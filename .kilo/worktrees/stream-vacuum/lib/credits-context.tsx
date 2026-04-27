"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { FREE_UPLOADS_LIMIT } from "@/lib/products"

interface CreditsContextType {
  credits: number
  freeUploadsUsed: number
  isFreeTier: boolean
  addCredits: (amount: number) => void
  useCredits: (amount: number) => boolean
  useFreeUpload: () => boolean
  showUpgradeModal: boolean
  setShowUpgradeModal: (show: boolean) => void
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined)

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState(0)
  const [freeUploadsUsed, setFreeUploadsUsed] = useState(0)
  const [isFreeTier, setIsFreeTier] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  useEffect(() => {
    // Load from localStorage (demo mode)
    try {
      if (typeof window !== "undefined") {
        const storedCredits = localStorage.getItem("useclevr_credits")
        const storedUploads = localStorage.getItem("useclevr_free_uploads")
        const storedTier = localStorage.getItem("useclevr_tier")
        
        if (storedCredits) setCredits(Number.parseInt(storedCredits))
        if (storedUploads) setFreeUploadsUsed(Number.parseInt(storedUploads))
        if (storedTier) setIsFreeTier(storedTier === "free")
      }
    } catch (e) {
      // localStorage not available
    }
  }, [])

  const addCredits = (amount: number) => {
    const newCredits = credits + amount
    setCredits(newCredits)
    setIsFreeTier(false)
    try {
      localStorage.setItem("useclevr_credits", newCredits.toString())
      localStorage.setItem("useclevr_tier", "paid")
    } catch (e) {}
  }

  const useCredits = (amount: number): boolean => {
    if (credits >= amount) {
      const newCredits = credits - amount
      setCredits(newCredits)
      try {
        localStorage.setItem("useclevr_credits", newCredits.toString())
      } catch (e) {}
      return true
    }
    setShowUpgradeModal(true)
    return false
  }

  const useFreeUpload = (): boolean => {
    if (freeUploadsUsed < FREE_UPLOADS_LIMIT) {
      const newCount = freeUploadsUsed + 1
      setFreeUploadsUsed(newCount)
      try {
        localStorage.setItem("useclevr_free_uploads", newCount.toString())
      } catch (e) {}
      
      // Show upgrade modal after using all free uploads
      if (newCount >= FREE_UPLOADS_LIMIT) {
        setShowUpgradeModal(true)
      }
      return true
    }
    setShowUpgradeModal(true)
    return false
  }

  return (
    <CreditsContext.Provider
      value={{
        credits,
        freeUploadsUsed,
        isFreeTier,
        addCredits,
        useCredits,
        useFreeUpload,
        showUpgradeModal,
        setShowUpgradeModal,
      }}
    >
      {children}
    </CreditsContext.Provider>
  )
}

export function useCredits() {
  const context = useContext(CreditsContext)
  if (context === undefined) {
    throw new Error("useCredits must be used within a CreditsProvider")
  }
  return context
}
