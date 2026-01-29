"use client"

import * as React from "react"
import { Upload, FileText, Package, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingProgress } from "@/components/enhanced/progress-indicator"
import { cn } from "@/lib/utils"

interface ValidationError {
  path: string
  message: string
  suggestion: string
  severity: 'error' | 'warning' | 'suggestion'
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  suggestions: ValidationError[]
  summary: {
    totalChallenges: number
    validChallenges: number
    errorCount: number
    warningCount: number
  }
  challenges?: any[]
}

interface ChallengeImportFormProps {
  onImportSuccess: (challenges: any[]) => void
  onImportError: (error: string) => void
  className?: string
}

export function ChallengeImportForm({
  onImportSuccess,
  onImportError,
  className
}: ChallengeImportFormProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    const allowedTypes = ['application/json', 'text/plain', 'application/zip', 'application/x-zip-compressed']
    const allowedExtensions = ['.json', '.zip']
    const fileExtension = file.name.toLowerCase().match(/\.[^.]*$/)?.[0] || ''

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      onImportError(`Invalid file type: ${file.type}. Only JSON and ZIP files are supported.`)
      return
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB
      onImportError('File size exceeds 50MB limit.')
      return
    }

    setSelectedFile(file)
    setValidationResult(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = () => {
    setDragActive(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setValidationResult(null)

    try {
      const formData = new FormData()
      formData.append('challengeFile', selectedFile)

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setValidationResult(result.data.validationResult)
        if (result.data.validationResult.valid && result.data.challenges) {
          onImportSuccess(result.data.challenges)
        }
      } else {
        setValidationResult(result.data?.validationResult || {
          valid: false,
          errors: [{ path: 'api', message: result.message || 'Upload failed', suggestion: 'Please try again', severity: 'error' as const }],
          warnings: [],
          suggestions: [],
          summary: { totalChallenges: 0, validChallenges: 0, errorCount: 1, warningCount: 0 }
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      onImportError(error instanceof Error ? error.message : 'Network error occurred')
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setValidationResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getFileIcon = (fileName: string) => {
    if (fileName.toLowerCase().endsWith('.zip')) {
      return <Package className="w-6 h-6 text-orange-500" />
    }
    return <FileText className="w-6 h-6 text-blue-500" />
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Import Challenge
        </CardTitle>
        <CardDescription>
          Upload a JSON file with challenge definitions or a ZIP archive containing Dockerfile and config.json
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* File Upload Area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
            selectedFile ? "border-green-500 bg-green-50/50 dark:bg-green-950/20" : ""
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                {getFileIcon(selectedFile.name)}
              </div>
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={resetForm}>
                  Choose Different File
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  size="sm"
                >
                  {uploading ? (
                    <>
                      <LoadingProgress className="w-4 h-4 mr-2" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Validate
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
              <div>
                <p className="text-lg font-medium">Drop your file here</p>
                <p className="text-sm text-muted-foreground">
                  or click to browse
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Select File
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".json,.zip"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Format Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-sm">JSON Format</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Direct challenge definitions in JSON format
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-orange-500" />
              <span className="font-medium text-sm">ZIP Archive</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Contains Dockerfile + config.json for custom builds
            </p>
          </Card>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <LoadingProgress
              label="Validating challenge file..."
              description="Checking format, security, and completeness"
            />
          </div>
        )}

        {/* Validation Results */}
        {validationResult && (
          <div className="space-y-4">
            {validationResult.valid ? (
              <Alert>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <AlertTitle>Validation Successful</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2">
                    <p>
                      Successfully validated {validationResult.summary.totalChallenges} challenge(s).
                      All requirements met and ready for import.
                    </p>
                    {validationResult.warnings.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-medium text-sm">Warnings:</p>
                        {validationResult.warnings.slice(0, 3).map((warning, index) => (
                          <p key={index} className="text-xs text-yellow-600 dark:text-yellow-400">
                            • [{warning.path}] {warning.message}
                          </p>
                        ))}
                        {validationResult.warnings.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            ... and {validationResult.warnings.length - 3} more warnings
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <XCircle className="w-4 h-4" />
                <AlertTitle>Validation Failed</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2">
                    <p>
                      Found {validationResult.summary.errorCount} error(s) that must be fixed before import.
                    </p>
                    <div className="space-y-1">
                      {validationResult.errors.slice(0, 3).map((error, index) => (
                        <div key={index} className="space-y-1">
                          <p className="text-xs font-medium">
                            [{error.path}] {error.message}
                          </p>
                          {error.suggestion && (
                            <p className="text-xs text-muted-foreground ml-2">
                              💡 {error.suggestion}
                            </p>
                          )}
                        </div>
                      ))}
                      {validationResult.errors.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          ... and {validationResult.errors.length - 3} more errors
                        </p>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Summary Stats */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">
                {validationResult.summary.validChallenges}/{validationResult.summary.totalChallenges} valid
              </Badge>
              {validationResult.summary.errorCount > 0 && (
                <Badge variant="destructive">
                  {validationResult.summary.errorCount} errors
                </Badge>
              )}
              {validationResult.summary.warningCount > 0 && (
                <Badge variant="secondary">
                  {validationResult.summary.warningCount} warnings
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}