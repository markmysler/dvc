import { Suspense } from "react";
import { ChallengeDiscovery } from "@/components/discovery/ChallengeDiscovery";

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChallengeDiscovery />
    </Suspense>
  );
}