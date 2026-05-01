"use client"

import * as React from "react"
import { DataProcessingFlow } from "@/components/data-processing-flow"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DataProcessingFlowDemo() {
  const [currentStep, setCurrentStep] = React.useState(0)
  const [isRunning, setIsRunning] = React.useState(false)

  const runFlow = () => {
    if (isRunning) return
    
    setIsRunning(true)
    setCurrentStep(1)
    
    // Sequential transitions with timing as per spec
    setTimeout(() => setCurrentStep(2), 600)
    setTimeout(() => setCurrentStep(3), 1500)   // 600 + 900
    setTimeout(() => setCurrentStep(4), 2400)   // 1500 + 900
    setTimeout(() => setCurrentStep(5), 3300)   // 2400 + 900
    setTimeout(() => setIsRunning(false), 4000)
  }

  const resetFlow = () => {
    setCurrentStep(0)
    setIsRunning(false)
  }

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col items-center justify-center gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Data Processing Flow</h1>
        <p className="text-muted-foreground">
          Minimal Creative CSV → Verified → Report Flow Animation
        </p>
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Processing Pipeline</CardTitle>
          <CardDescription>
            Visual representation of CSV upload and analysis flow
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 py-8">
          <DataProcessingFlow currentStep={currentStep} />
          
          <div className="flex gap-4 mt-4">
            {!isRunning && currentStep === 0 && (
              <Button onClick={runFlow}>
                Start Upload Flow
              </Button>
            )}
            
            {(currentStep === 5 || (!isRunning && currentStep > 0)) && (
              <Button variant="outline" onClick={resetFlow}>
                Reset
              </Button>
            )}
          </div>

          {currentStep > 0 && (
            <div className="text-sm text-muted-foreground">
              Current step: {currentStep} / 5
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import { DataProcessingFlow } from "@/components/data-processing-flow"

// Basic usage
<DataProcessingFlow currentStep={1} />

// With SQL snippet disabled
<DataProcessingFlow currentStep={3} showSqlSnippet={false} />

// Step values:
// 0 = Idle
// 1 = CSV Uploaded
// 2 = Parsing
// 3 = Verified SQL
// 4 = AI Analysis
// 5 = Report Ready`}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
