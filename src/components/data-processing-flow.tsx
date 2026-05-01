"use client"

import * as React from "react"
import { 
  FileSpreadsheet, 
  Settings, 
  ShieldCheck, 
  Sparkles, 
  FileText,
  Check
} from "lucide-react"

interface DataProcessingFlowProps {
  currentStep: number
  showSqlSnippet?: boolean
  variant?: 'default' | 'hero'
}

const steps = [
  { id: 1, label: "Upload", icon: FileSpreadsheet },
  { id: 2, label: "Understand", icon: Settings },
  { id: 3, label: "Analyze", icon: ShieldCheck },
  { id: 4, label: "Explain", icon: Sparkles },
  { id: 5, label: "Export", icon: FileText },
]

const sqlSnippets = [
  "SELECT product_category, SUM(revenue) FROM dataset GROUP BY product_category",
  "SELECT region, COUNT(*) as orders, AVG(amount) FROM dataset GROUP BY region",
  "SELECT DATE_TRUNC('month', date), SUM(amount) FROM dataset GROUP BY 1",
]

export function DataProcessingFlow({ currentStep, showSqlSnippet = true, variant = 'default' }: DataProcessingFlowProps) {
  const [displayedStep, setDisplayedStep] = React.useState(0)
  const [sqlIndex, setSqlIndex] = React.useState(0)
  const [autoPlayStep, setAutoPlayStep] = React.useState(0)

  // Determine if we're in hero mode
  const isHero = variant === 'hero'

  // Reset when step goes back to 0
  React.useEffect(() => {
    if (currentStep === 0) {
      setDisplayedStep(0)
      setAutoPlayStep(0)
    }
  }, [currentStep])

  // For hero variant: auto-play animation once on page load
  React.useEffect(() => {
    if (isHero && autoPlayStep === 0 && currentStep === 0) {
      const timers = [
        setTimeout(() => setAutoPlayStep(1), 500),
        setTimeout(() => setAutoPlayStep(2), 1100),
        setTimeout(() => setAutoPlayStep(3), 1700),
        setTimeout(() => setAutoPlayStep(4), 2300),
        setTimeout(() => setAutoPlayStep(5), 2900),
      ]
      return () => timers.forEach(clearTimeout)
    }
  }, [isHero, autoPlayStep, currentStep])

  // Animate through steps when currentStep increases
  React.useEffect(() => {
    if (currentStep > 0 && currentStep > displayedStep) {
      const timeout = setTimeout(() => {
        setDisplayedStep(currentStep)
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [currentStep, displayedStep])

  // Rotate SQL snippets during verification/analysis
  React.useEffect(() => {
    if ((currentStep === 3 || currentStep === 4) && showSqlSnippet) {
      const interval = setInterval(() => {
        setSqlIndex((prev) => (prev + 1) % sqlSnippets.length)
      }, 800)
      return () => clearInterval(interval)
    }
  }, [currentStep, showSqlSnippet])

  // Determine effective step (auto-play for hero, direct for default)
  const effectiveStep = isHero && currentStep === 0 ? autoPlayStep : displayedStep

  const isActive = (stepId: number) => effectiveStep === stepId && effectiveStep > 0
  const isCompleted = (stepId: number) => effectiveStep > stepId
  const isPending = (stepId: number) => effectiveStep < stepId || effectiveStep === 0

  // Hero-specific size classes
  const circleSize = isHero ? "w-8 h-8 md:w-9 md:h-9" : "w-11 h-11 md:w-12 md:h-12"
  const iconSize = isHero ? "w-4 h-4 md:w-4 md:h-4" : "w-5 h-5 md:w-6 md:h-6"
  const labelSize = isHero ? "text-xs" : "text-xs"
  const gap = isHero ? "gap-1 md:gap-0.5" : "gap-2 md:gap-1"
  const connectorWidth = isHero ? "w-4 md:w-5" : "w-8 md:w-8"

  return (
    <div className="flex flex-col items-center justify-center w-full">
      {/* Main flow */}
      <div className={`flex flex-col md:flex-row items-center justify-center ${gap}`}>
        {steps.map((step, index) => {
          const Icon = step.icon
          const active = isActive(step.id)
          const completed = isCompleted(step.id)
          const pending = isPending(step.id)

          return (
            <React.Fragment key={step.id}>
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    relative flex items-center justify-center ${circleSize} rounded-full
                    transition-all duration-500 ease-out
                    ${active 
                      ? isHero 
                        ? "opacity-100 scale-105 shadow-lg shadow-[#7C3AED]/20 ring-1 ring-[#A78BFA]/50" 
                        : "opacity-100 scale-105 shadow-lg shadow-primary/25 ring-2 ring-primary/50" 
                      : completed 
                        ? "opacity-100" 
                        : "opacity-40"
                    }
                    ${active ? "bg-gradient-to-br from-[#7C3AED] to-[#A78BFA]" : "bg-muted border border-border"}
                  `}
                >
                  {/* Subtle pulse animation for hero active step */}
                  {active && isHero && (
                    <div className="absolute inset-0 rounded-full animate-pulse bg-[#A78BFA]/20 opacity-40" />
                  )}
                  {/* Full pulse for default */}
                  {active && !isHero && (
                    <div className="absolute inset-0 rounded-full animate-ping bg-primary/30 opacity-75" />
                  )}
                  
                  {/* Icon */}
                  <Icon 
                    className={`
                      ${iconSize} transition-colors duration-300
                      ${active || completed ? "text-white" : "text-muted-foreground"}
                    `}
                  />
                  
                  {/* Check overlay for completed */}
                  {completed && (
                    <div className={`absolute -bottom-0.5 -right-0.5 rounded-full bg-green-500 flex items-center justify-center ${isHero ? "w-3 h-3" : "w-4 h-4"}`}>
                      <Check className={isHero ? "w-2 h-2" : "w-2.5 h-2.5"} strokeWidth={3} />
                    </div>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`
                    mt-1.5 md:mt-2 ${labelSize} font-medium transition-all duration-300
                    ${active ? (isHero ? "text-[#A78BFA]" : "text-primary") : completed ? "text-foreground" : "text-muted-foreground"}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line with soft light wave - hero mode */}
              {index < steps.length - 1 && (
                <div 
                  className={`
                    hidden md:block ${connectorWidth} h-0.5 mx-0.5 md:mx-1 transition-all duration-300 relative overflow-hidden
                    ${completed ? "bg-primary" : "bg-border"}
                  `}
                >
                  {/* Soft light wave animation - only in hero mode when active or completed */}
                  {isHero && (active || completed) && (
                    <div className="absolute inset-0 wave-glow" />
                  )}
                </div>
              )}
              
              {/* Mobile vertical connector */}
              {index < steps.length - 1 && (
                <div 
                  className={`
                    md:hidden w-0.5 h-3 md:h-4 transition-all duration-300 relative overflow-hidden
                    ${completed ? "bg-primary" : "bg-border"}
                  `}
                >
                  {/* Soft light wave animation - mobile hero mode */}
                  {isHero && (active || completed) && (
                    <div className="absolute inset-0 wave-glow" />
                  )}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Trust element text during verification - hide in hero */}
      {!isHero && (
        <div 
          className={`
            mt-4 text-sm text-muted-foreground transition-all duration-300
            ${currentStep === 3 ? "opacity-100" : "opacity-0"}
          `}
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Running verified SQL computation...
          </span>
        </div>
      )}

      {/* SQL snippet display - hide in hero */}
      {!isHero && (currentStep === 3 || currentStep === 4) && showSqlSnippet && (
        <div 
          className={`
            mt-3 px-4 py-2 rounded-md bg-muted/50 border border-border/50
            font-mono text-xs text-muted-foreground
            transition-all duration-300
            ${(currentStep === 3 || currentStep === 4) ? "opacity-100" : "opacity-0"}
          `}
        >
          <span className="text-primary">SELECT</span> {sqlSnippets[sqlIndex].replace(/^SELECT/i, "").split("FROM")[0]}
          <span className="text-muted-foreground/60">FROM...</span>
        </div>
      )}
    </div>
  )
}

export default DataProcessingFlow
