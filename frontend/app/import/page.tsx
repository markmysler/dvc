"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ImportWizard } from "@/components/import/import-wizard"
import { Button } from "@/components/ui/button"
import { ArrowLeft, HelpCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

export default function ImportPage() {
  const router = useRouter()
  const [showHelp, setShowHelp] = React.useState(false)

  const handleImportComplete = async (challenges: any[]) => {
    try {
      // Store imported challenges in localStorage for persistence
      const existingChallenges = JSON.parse(localStorage.getItem('importedChallenges') || '[]')
      const updatedChallenges = [...existingChallenges, ...challenges]
      localStorage.setItem('importedChallenges', JSON.stringify(updatedChallenges))

      // Show success message and redirect
      alert(`Successfully imported ${challenges.length} challenge${challenges.length !== 1 ? 's' : ''}!`)
      router.push('/')
    } catch (error) {
      console.error('Failed to save imported challenges:', error)
      alert('Import completed but failed to save challenges locally. Please try again.')
    }
  }

  const handleCancel = () => {
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Discovery
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Import Challenge</h1>
              <p className="text-muted-foreground mt-1">
                Add custom challenges to your local collection
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            Help
          </Button>
        </div>

        {/* Help Section */}
        {showHelp && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Import Guide</CardTitle>
              <CardDescription>
                Learn how to prepare and import your own challenges
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Badge variant="outline">JSON</Badge>
                    Challenge Definition Format
                  </h4>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>Create a JSON file with challenge metadata:</p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`{
  "challenges": [
    {
      "id": "my-custom-challenge",
      "name": "My Custom Challenge",
      "description": "A custom security challenge",
      "difficulty": "beginner",
      "category": "web",
      "points": 100,
      "tags": ["xss", "web"],
      "container_spec": {
        "image": "myregistry/challenge:latest",
        "ports": { "3000": null },
        "environment": {
          "FLAG": "FLAG{example_flag}"
        },
        "resource_limits": {
          "memory": "256m",
          "cpus": "0.5"
        },
        "security_profile": "challenge"
      },
      "metadata": {
        "author": "Your Name",
        "learning_objectives": ["Learn XSS"],
        "hints": ["Check user input"]
      }
    }
  ]
}`}
                    </pre>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Badge variant="outline">ZIP</Badge>
                    Custom Container Format
                  </h4>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>Create a ZIP archive containing:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li><code>config.json</code> - Challenge metadata (same as JSON format above)</li>
                      <li><code>Dockerfile</code> - Container build instructions</li>
                      <li><code>src/</code> - Your application source files (optional)</li>
                      <li><code>scripts/</code> - Setup scripts (optional)</li>
                    </ul>
                    <p className="mt-2">Example Dockerfile:</p>
                    <pre className="bg-muted p-3 rounded text-xs">
{`FROM node:18-alpine
WORKDIR /app
COPY src/ .
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]`}
                    </pre>
                  </div>
                </div>
              </div>

              <Alert>
                <HelpCircle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Security Requirements:</strong> All challenges are automatically validated for security.
                  Privileged containers and unsafe configurations will be rejected.
                </AlertDescription>
              </Alert>

              <div className="pt-2 border-t">
                <h4 className="font-medium mb-2">Required Fields</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <Badge variant="secondary">id</Badge>
                  <Badge variant="secondary">name</Badge>
                  <Badge variant="secondary">description</Badge>
                  <Badge variant="secondary">difficulty</Badge>
                  <Badge variant="secondary">category</Badge>
                  <Badge variant="secondary">container_spec</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Wizard */}
        <ImportWizard
          onComplete={handleImportComplete}
          onCancel={handleCancel}
        />

        {/* Footer Info */}
        <div className="mt-8 pt-6 border-t">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Imported challenges are stored locally and will appear in the discovery interface alongside built-in challenges.
            </p>
            <p className="mt-1">
              All challenges undergo security validation to ensure safe execution in containerized environments.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}