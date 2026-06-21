"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Building2, CheckCircle2, Sparkles, ArrowLeft, ArrowRight } from "lucide-react"
import * as React from "react"

type Question = {
  id: string
  title: string
  helper: string
  optional?: boolean
}

const QUESTIONS: Question[] = [
  { id: "companyName", title: "What is your company name?", helper: "Use the legal or operating name you want analysis reports to use." },
  { id: "country", title: "Which country is your business registered in?", helper: "Country only loads suggestions. You confirm every value before analysis uses it." },
  { id: "legalStructure", title: "What is your legal structure?", helper: "Choose the closest option. You can change it later." },
  { id: "industry", title: "What industry are you in?", helper: "This helps the AI understand normal revenue, cost, and risk patterns." },
  { id: "currency", title: "What currency do you use?", helper: "Analysis uses this for KPIs, reports, tax estimates, and margin calculations." },
  { id: "employees", title: "Do you have employees?", helper: "Payroll assumptions are used only when employees or payroll data exist.", optional: true },
  { id: "revenueModel", title: "What is your revenue model?", helper: "Select the models that best describe how revenue is generated." },
  { id: "targetMargin", title: "What is your target margin?", helper: "Analysis compares uploaded margins against this target.", optional: true },
]

function getStoredAnswers(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem("businessProfileAnswers") || "{}")
  } catch {
    return {}
  }
}

function setStoredAnswers(answers: Record<string, string>) {
  localStorage.setItem("businessProfileAnswers", JSON.stringify(answers))
}

export default function BusinessPage() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [currentAnswer, setCurrentAnswer] = React.useState("")
  const [stepIndex, setStepIndex] = React.useState(0)
  const [completed, setCompleted] = React.useState(false)

  const progress = Math.round(((stepIndex + 1) / QUESTIONS.length) * 100)
  const currentQuestion = QUESTIONS[stepIndex]
  const isLastStep = stepIndex === QUESTIONS.length - 1

  React.useEffect(() => {
    setAnswers(getStoredAnswers())
  }, [])

  function handleNext() {
    const newAnswers = { ...answers, [currentQuestion.id]: currentAnswer }
    setAnswers(newAnswers)
    setStoredAnswers(newAnswers)

    if (isLastStep) {
      setCompleted(true)
    } else {
      const nextIndex = stepIndex + 1
      const nextQuestionId = QUESTIONS[nextIndex]?.id
      setStepIndex(nextIndex)
      setCurrentAnswer(newAnswers[nextQuestionId] || "")
    }
  }

  function handleBack() {
    if (stepIndex > 0) {
      const prevIndex = stepIndex - 1
      setStepIndex(prevIndex)
      setCurrentAnswer(answers[QUESTIONS[prevIndex].id] || "")
    }
  }

  function openModal() {
    const stored = getStoredAnswers()
    setAnswers(stored)
    setStepIndex(0)
    setCurrentAnswer(stored[QUESTIONS[0]?.id] || "")
    setCompleted(false)
    setIsOpen(true)
  }

  function closeModal() {
    setIsOpen(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-5">
      <div className="mx-auto max-w-md text-center">
        <Building2 className="mx-auto mb-4 h-12 w-12 text-primary" />
        <h1 className="mb-2 text-2xl font-bold">Business Overview</h1>
        <p className="mb-6 text-muted-foreground">
          Manage your business profiles and company data for better analysis.
        </p>
        <Button onClick={openModal} size="lg" className="min-w-56">
          <Sparkles className="mr-2 h-4 w-4" />
          Start Business Profile Setup
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-md overflow-y-auto p-0">
          <div className="border-b border-border p-5">
            <DialogHeader className="pr-8">
              <DialogTitle>Business Profile Assistant</DialogTitle>
              <DialogDescription>Step {stepIndex + 1} of {QUESTIONS.length}</DialogDescription>
            </DialogHeader>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="space-y-5 p-5">
            {completed ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="mb-3 h-14 w-14" />
                <h3 className="text-xl font-semibold">Business Profile completed</h3>
                <p className="mt-2 text-sm">Your profile is saved and ready to use.</p>
                <Button type="button" className="mt-5" onClick={closeModal}>
                  View saved profile summary
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{currentQuestion.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{currentQuestion.helper}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <Input
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Enter your answer"
                    className="h-12 text-base"
                    autoFocus
                  />
                </div>
              </>
            )}
          </div>

          {!completed && (
            <DialogFooter className="border-t border-border p-5 sm:justify-between">
              <Button type="button" variant="outline" onClick={handleBack} disabled={stepIndex === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                {currentQuestion.optional && (
                  <Button type="button" variant="ghost" onClick={() => setStepIndex(stepIndex + 1)}>Skip optional question</Button>
                )}
                <Button type="button" onClick={handleNext}>
                  {isLastStep ? "Finish" : "Next"}
                  {!isLastStep && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}