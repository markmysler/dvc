/**
 * ImportGuide - Step-by-step guide for importing challenges
 * 
 * Provides comprehensive instructions for using the import wizard
 * with examples, validation rules, and troubleshooting tips
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileArchive, 
  CheckCircle, 
  AlertCircle, 
  Code, 
  Layers,
  FileJson,
  Package,
  Shield,
  Info
} from 'lucide-react';

export function ImportGuide() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Challenge Import Guide</h2>
        <p className="text-muted-foreground">
          Learn how to import custom challenges into the platform
        </p>
      </div>

      {/* Quick Start */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Quick Start:</strong> Create a ZIP file containing your challenge files and config.json, 
          then use the import wizard above to upload it.
        </AlertDescription>
      </Alert>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5" />
                What is Challenge Import?
              </CardTitle>
              <CardDescription>
                The import wizard allows you to add custom challenges without modifying the codebase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold">Benefits of Importing</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Add challenges without rebuilding the platform</li>
                  <li>Share challenges easily with team members</li>
                  <li>Test challenges in isolated environments</li>
                  <li>Version control your challenge collections</li>
                  <li>Quick iteration and updates</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">Import Process</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex flex-col items-center text-center p-4 border rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-2">
                      <span className="text-blue-600 dark:text-blue-300 font-bold">1</span>
                    </div>
                    <p className="text-sm font-medium">Prepare Files</p>
                    <p className="text-xs text-muted-foreground mt-1">Create challenge structure</p>
                  </div>
                  <div className="flex flex-col items-center text-center p-4 border rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-2">
                      <span className="text-green-600 dark:text-green-300 font-bold">2</span>
                    </div>
                    <p className="text-sm font-medium">Upload ZIP</p>
                    <p className="text-xs text-muted-foreground mt-1">Select your archive</p>
                  </div>
                  <div className="flex flex-col items-center text-center p-4 border rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center mb-2">
                      <span className="text-yellow-600 dark:text-yellow-300 font-bold">3</span>
                    </div>
                    <p className="text-sm font-medium">Validate</p>
                    <p className="text-xs text-muted-foreground mt-1">Automatic checks</p>
                  </div>
                  <div className="flex flex-col items-center text-center p-4 border rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-2">
                      <span className="text-purple-600 dark:text-purple-300 font-bold">4</span>
                    </div>
                    <p className="text-sm font-medium">Import</p>
                    <p className="text-xs text-muted-foreground mt-1">Ready to play!</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Structure Tab */}
        <TabsContent value="structure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Challenge File Structure
              </CardTitle>
              <CardDescription>
                Required files and folders for a valid challenge
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Required Files
                </h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    <span className="text-green-600">config.json</span>
                    <span className="text-muted-foreground">- Challenge metadata and configuration</span>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <Package className="h-4 w-4" />
                    <span className="text-blue-600">Dockerfile</span>
                    <span className="text-muted-foreground">- Container build instructions</span>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <Code className="h-4 w-4" />
                    <span className="text-blue-600">app.py / app.js</span>
                    <span className="text-muted-foreground">- Challenge application</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  Optional Files
                </h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
                  <div className="text-muted-foreground">requirements.txt - Python dependencies</div>
                  <div className="text-muted-foreground">package.json - Node.js dependencies</div>
                  <div className="text-muted-foreground">static/ - CSS, JS, images</div>
                  <div className="text-muted-foreground">templates/ - HTML templates</div>
                  <div className="text-muted-foreground">README.md - Challenge documentation</div>
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security Note:</strong> All uploaded files are scanned and validated. 
                  Malicious content will be rejected.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                config.json Format
              </CardTitle>
              <CardDescription>
                Complete configuration file specification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold">Minimal Example</h4>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
{`{
  "name": "My Challenge",
  "id": "my-unique-id",
  "category": "web",
  "difficulty": "beginner",
  "description": "Learn about XSS vulnerabilities",
  "points": 100,
  "tags": ["web", "xss"],
  "estimated_time": "20-30 minutes",
  "container_spec": {
    "image": "your-org/challenge:latest",
    "ports": {
      "5000": null
    },
    "environment": {},
    "resource_limits": {
      "cpus": "0.5",
      "memory": "256m",
      "pids_limit": 128
    },
    "security_profile": "challenge"
  },
  "metadata": {
    "author": "Your Name",
    "version": "1.0",
    "hints": [
      "Look for user input fields",
      "Try injecting JavaScript code"
    ],
    "learning_objectives": [
      "Identify XSS vulnerabilities",
      "Craft basic XSS payloads"
    ]
  }
}`}
                </pre>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">Field Reference</h4>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 p-2 border-b">
                    <span className="font-mono text-sm font-medium">Field</span>
                    <span className="font-mono text-sm font-medium">Type</span>
                    <span className="font-mono text-sm font-medium">Required</span>
                  </div>
                  {[
                    ['name', 'string', true],
                    ['id', 'string', true],
                    ['category', 'string', true],
                    ['difficulty', 'string', true],
                    ['description', 'string', true],
                    ['points', 'integer', true],
                    ['tags', 'array', true],
                    ['container_spec', 'object', true],
                    ['metadata', 'object', true],
                  ].map(([field, type, required], index) => (
                    <div key={`${field}-${index}`} className="grid grid-cols-3 gap-2 p-2 text-sm">
                      <code className="text-blue-600">{field}</code>
                      <span className="text-muted-foreground">{type}</span>
                      <Badge variant={required ? 'default' : 'secondary'} className="w-fit">
                        {required ? 'Required' : 'Optional'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">Valid Values</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">category:</span>
                    <span className="ml-2 text-muted-foreground">web, crypto, binary, forensics, pwn, misc</span>
                  </div>
                  <div>
                    <span className="font-medium">difficulty:</span>
                    <span className="ml-2 text-muted-foreground">beginner, intermediate, advanced, expert</span>
                  </div>
                  <div>
                    <span className="font-medium">points:</span>
                    <span className="ml-2 text-muted-foreground">50-500 (based on difficulty)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Examples Tab */}
        <TabsContent value="examples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Example Challenges</CardTitle>
              <CardDescription>
                Reference implementations you can use as templates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">XSS Challenge</CardTitle>
                    <CardDescription>Reflected XSS vulnerability</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Flask application</li>
                      <li>• User input reflection</li>
                      <li>• Progressive hints</li>
                      <li>• Points: 100</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Path Traversal</CardTitle>
                    <CardDescription>File inclusion vulnerability</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Python Flask app</li>
                      <li>• Directory traversal</li>
                      <li>• Dynamic flag generation</li>
                      <li>• Points: 150</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Tip:</strong> Check the platform&apos;s built-in challenges for more examples. 
                  View their configuration in the challenge details modal.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Common Pitfalls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Hardcoded Flags</p>
                    <p className="text-sm text-muted-foreground">
                      Never hardcode flags in your application. Use environment variables passed at runtime.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Missing Dependencies</p>
                    <p className="text-sm text-muted-foreground">
                      Include all dependencies in requirements.txt or package.json. Don&apos;t rely on system packages.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Running as Root</p>
                    <p className="text-sm text-muted-foreground">
                      Always create and use a non-privileged user in your Dockerfile for security.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Invalid JSON</p>
                    <p className="text-sm text-muted-foreground">
                      Validate your config.json syntax before zipping. Use a JSON validator or linter.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            For detailed developer documentation, see <code className="text-foreground">CHALLENGE_DEVELOPMENT.md</code> in the project root.
          </p>
          <p>
            The validation script can help debug issues: <code className="text-foreground">python scripts/validate-challenge.py config.json</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
