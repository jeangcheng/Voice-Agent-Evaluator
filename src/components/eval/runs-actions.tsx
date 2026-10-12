"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FlaskConical, Play } from "lucide-react";

export function RunsActions() {
  const router = useRouter();
  const [agentVersion, setAgentVersion] = useState("policy_v2");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const seedExperiment = () => {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/experiment/seed", { method: "POST" });
      if (!res.ok) {
        setError("Seed failed");
        return;
      }
      router.refresh();
    });
  };

  const runEval = () => {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentVersion }),
      });
      if (!res.ok) {
        setError("Run failed");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={seedExperiment} disabled={pending}>
          <FlaskConical className="mr-2 h-4 w-4" />
          Seed experiment
        </Button>
        <div className="flex items-center gap-2">
          <select
            className="h-9 w-[140px] rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm"
            value={agentVersion}
            onChange={(e) => setAgentVersion(e.target.value)}
          >
            <option value="baseline">baseline</option>
            <option value="policy_v2">policy_v2</option>
          </select>
          <Button onClick={runEval} disabled={pending}>
            <Play className="mr-2 h-4 w-4" />
            Run eval
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-[var(--coral)]">{error}</p> : null}
    </div>
  );
}
