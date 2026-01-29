import { Suspense } from "react";
import { ChallengeDiscovery } from "@/components/discovery/ChallengeDiscovery";
import { Loader2 } from "lucide-react";

export default function Home() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground text-lg">Loading challenges...</p>
          </div>
        </div>
      </div>
    }>
      <ChallengeDiscovery />
    </Suspense>
  );
}