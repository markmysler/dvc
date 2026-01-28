import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Cybersecurity Training Platform</h1>
          <p className="text-xl text-muted-foreground">
            Practice real vulnerability exploitation on isolated, disposable containers
          </p>
          <div className="flex justify-center gap-2">
            <Badge variant="secondary">Local-only</Badge>
            <Badge variant="secondary">Secure Containers</Badge>
            <Badge variant="secondary">Auto-generated Flags</Badge>
          </div>
        </div>

        {/* Placeholder Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Challenge Discovery</CardTitle>
              <CardDescription>Browse and filter available security challenges</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Discovery interface will be built here with TanStack Query integration.
              </p>
              <Button className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Integration</CardTitle>
              <CardDescription>TanStack Query + Flask backend</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Complete API client with typed React Query hooks for challenge operations.
              </p>
              <Button variant="outline" className="w-full">
                ✓ Ready
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>shadcn/ui Components</CardTitle>
              <CardDescription>UI component library configured</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Button, Table, Card, Badge, Input, and Select components ready to use.
              </p>
              <Button variant="outline" className="w-full">
                ✓ Ready
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Status Section */}
        <Card>
          <CardHeader>
            <CardTitle>Foundation Status</CardTitle>
            <CardDescription>Next.js frontend setup progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Next.js 16 + TypeScript</span>
                <Badge>✓ Complete</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>shadcn/ui + Tailwind CSS</span>
                <Badge>✓ Complete</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>TanStack Query Integration</span>
                <Badge>✓ Complete</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>API Client Layer</span>
                <Badge>✓ Complete</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Reference */}
        <Card>
          <CardHeader>
            <CardTitle>API Integration Details</CardTitle>
            <CardDescription>Available API endpoints and React Query hooks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">API Endpoints</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• GET /api/challenges</li>
                  <li>• POST /api/challenges</li>
                  <li>• DELETE /api/challenges/:id</li>
                  <li>• POST /api/flags</li>
                  <li>• GET /api/challenges/running</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">React Query Hooks</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• useChallenges()</li>
                  <li>• useSpawnChallenge()</li>
                  <li>• useStopChallenge()</li>
                  <li>• useValidateFlag()</li>
                  <li>• useRunningChallenges()</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}