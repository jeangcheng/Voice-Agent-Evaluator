import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PassFailBadge({
  pass,
  label,
}: {
  pass: boolean;
  label?: string;
}) {
  return (
    <Badge
      className={cn(
        "border-0 font-medium",
        pass
          ? "bg-[color:rgba(31,122,108,0.15)] text-[var(--sea-deep)]"
          : "bg-[color:rgba(196,92,58,0.14)] text-[var(--coral)]"
      )}
    >
      {label ?? (pass ? "Pass" : "Fail")}
    </Badge>
  );
}

export function VersionBadge({ version }: { version: string }) {
  const v2 = version === "policy_v2";
  return (
    <Badge
      variant="secondary"
      className={cn(
        "mono text-[11px]",
        v2
          ? "bg-[color:rgba(31,122,108,0.12)] text-[var(--sea-deep)]"
          : "bg-[color:rgba(18,37,46,0.08)] text-[var(--ink)]"
      )}
    >
      {v2 ? "policy_v2" : "baseline"}
    </Badge>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    ordinary: "bg-[color:rgba(31,122,108,0.12)] text-[var(--sea-deep)]",
    difficult: "bg-[color:rgba(184,135,44,0.16)] text-[var(--amber)]",
    safety: "bg-[color:rgba(196,92,58,0.14)] text-[var(--coral)]",
    control: "bg-[color:rgba(18,37,46,0.08)] text-[var(--mute)]",
  };
  return (
    <Badge className={cn("border-0 capitalize", colors[difficulty] ?? colors.ordinary)}>
      {difficulty}
    </Badge>
  );
}
