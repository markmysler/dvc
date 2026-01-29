"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ImportWizard } from "@/components/import/import-wizard"
import { ImportGuide } from "@/components/import/ImportGuide"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package } from "lucide-react"

export default function ImportPage() {
  const router = useRouter()

  const handleImportComplete = async (challenges: any[]) => {
    try {
      // Challenges are now persisted server-side, no need for localStorage
      // Show success message and redirect
      alert(`Successfully imported ${challenges.length} challenge${challenges.length !== 1 ? 's' : ''}!`)
      router.push('/')
    } catch (error) {
      console.error('Failed to complete import:', error)
      alert('Import completed but navigation failed. Please refresh the page.')
    }
  }

  const handleCancel = () => {
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Challenge Import</h1>
            <p className="text-muted-foreground mt-1">
              Import custom challenges or learn how to create your own
            </p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="import" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Import Challenge
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Guide
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>Import Challenge Archive</CardTitle>
                <CardDescription>
                  Upload a ZIP file or JSON containing your challenge definition
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImportWizard
                  onComplete={handleImportComplete}
                  onCancel={handleCancel}
                />
              </CardContent>
            </Card>

            {/* Footer Info */}
            <div className="mt-6 pt-6 border-t">
              <div className="text-center text-sm text-muted-foreground">
                <p>
                  Imported challenges are stored locally and will appear in the discovery interface alongside built-in challenges.
                </p>
                <p className="mt-1">
                  All challenges undergo security validation to ensure safe execution in containerized environments.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="guide">
            <ImportGuide />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}