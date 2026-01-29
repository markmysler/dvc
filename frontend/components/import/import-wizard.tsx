"use client"

import * as React from "react"
import { CheckCircle, Upload, FileCheck, Download } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ProgressIndicator } from "@/components/enhanced/progress-indicator"
import { ChallengeImportForm } from "./challenge-import-form"
import { ValidationFeedback } from "./validation-feedback"
import { cn } from "@/lib/utils"

interface WizardStep {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  status: 'pending' | 'active' | 'completed' | 'error'
}

interface ImportWizardProps {
  onComplete: (challenges: any[]) => void
  onCancel?: () => void
  className?: string
}

interface ValidationResult {
  valid: boolean
  errors: any[]
  warnings: any[]
  suggestions: any[]
  summary: {
    totalChallenges: number
    validChallenges: number
    errorCount: number
    warningCount: number
  }
}

export function ImportWizard({
  onComplete,
  onCancel,
  className
}: ImportWizardProps) {
  const [currentStep, setCurrentStep] = React.useState(0)
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null)
  const [importedChallenges, setImportedChallenges] = React.useState<any[]>([])
  const [error, setError] = React.useState<string | null>(null)

  const steps: WizardStep[] = [
    {
      id: 'upload',
      title: 'Select File',
      description: 'Choose your challenge file',
      icon: Upload,
      status: currentStep === 0 ? 'active' : currentStep > 0 ? 'completed' : 'pending'
    },
    {
      id: 'validate',
      title: 'Validation',
      description: 'Verify challenge format and security',
      icon: FileCheck,
      status: currentStep === 1 ? 'active' :
              currentStep > 1 ? 'completed' :
              validationResult && !validationResult.valid ? 'error' : 'pending'
    },
    {
      id: 'confirm',
      title: 'Confirm Import',
      description: 'Review and complete import',
      icon: Download,
      status: currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : 'pending'
    }
  ]

  const handleImportSuccess = (challenges: any[]) => {
    setImportedChallenges(challenges)
    setError(null)
    setCurrentStep(2)
  }

  const handleImportError = (errorMessage: string) => {
    setError(errorMessage)
    setValidationResult(null)
  }

  const handleValidationComplete = (result: ValidationResult) => {
    setValidationResult(result)
    if (result.valid) {
      setCurrentStep(1)
    }
  }

  const handleConfirmImport = () => {
    if (importedChallenges.length > 0) {
      onComplete(importedChallenges)
    }
  }

  const handleStartOver = () => {
    setCurrentStep(0)
    setValidationResult(null)
    setImportedChallenges([])
    setError(null)
  }

  const getStepIcon = (step: WizardStep) => {
    const IconComponent = step.icon
    const iconClass = cn(
      "w-5 h-5",
      step.status === 'completed' ? 'text-green-500' :
      step.status === 'active' ? 'text-primary' :
      step.status === 'error' ? 'text-red-500' :
      'text-muted-foreground'
    )

    if (step.status === 'completed') {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }

    return <IconComponent className={iconClass} />
  }

  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      {/* Progress Header */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Challenge Import</CardTitle>
          <CardDescription>
            Follow the steps below to import your challenge into the system
          </CardDescription>

          {/* Progress Bar */}
          <div className="pt-4">
            <ProgressIndicator
              value={currentStep * 33.33}
              max={100}
              showPercentage
              label="Import Progress"
              color={validationResult && !validationResult.valid ? "danger" : "default"}
            />
          </div>
        </CardHeader>

        <CardContent>
          {/* Step Navigation */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    step.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                    step.status === 'active' ? 'bg-primary/10' :
                    step.status === 'error' ? 'bg-red-100 dark:bg-red-900' :
                    'bg-muted'
                  )}>
                    {getStepIcon(step)}
                  </div>
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-sm font-medium",
                      step.status === 'completed' ? 'text-green-700 dark:text-green-300' :
                      step.status === 'active' ? 'text-primary' :
                      step.status === 'error' ? 'text-red-700 dark:text-red-300' :
                      'text-muted-foreground'
                    )}>
                      {step.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {step.description}
                    </span>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-px mx-4",
                    currentStep > index ? 'bg-green-500' : 'bg-muted'
                  )} />
                )}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="space-y-6">
        {/* Step 1: File Upload */}
        {currentStep === 0 && (
          <ChallengeImportForm
            onImportSuccess={handleImportSuccess}
            onImportError={handleImportError}
          />
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <Button variant="outline" size="sm" onClick={handleStartOver} className="mt-4">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Validation Results */}
        {validationResult && (
          <ValidationFeedback
            valid={validationResult.valid}
            errors={validationResult.errors}
            warnings={validationResult.warnings}
            suggestions={validationResult.suggestions}
            summary={validationResult.summary}
            showDetails={true}
          />
        )}

        {/* Step 3: Confirmation */}
        {currentStep === 2 && importedChallenges.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Ready to Import
              </CardTitle>
              <CardDescription>
                Review the challenge{importedChallenges.length !== 1 ? 's' : ''} below and confirm the import
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Challenge Preview */}
              <div className="space-y-3">
                <h4 className="font-medium">Challenges to Import:</h4>
                {importedChallenges.map((challenge, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium">{challenge.name}</h5>
                        <p className="text-sm text-muted-foreground">
                          {challenge.description}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">{challenge.difficulty}</Badge>
                          <Badge variant="outline">{challenge.category}</Badge>
                          <Badge variant="secondary">{challenge.points} pts</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={handleStartOver}>
                  Start Over
                </Button>
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
                <Button onClick={handleConfirmImport}>
                  <Download className="w-4 h-4 mr-2" />
                  Complete Import
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}