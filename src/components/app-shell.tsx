import Link from "next/link";
import { Activity, FlaskConical, GitCompare, LayoutList, Scale, FileText } from "lucide-react";

const NAV = [
  { href: "/", label: "Runs", icon: Activity },
  { href: "/scenarios", label: "Scenarios", icon: LayoutList },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/metrics", label: "Metrics", icon: Scale },
  { href: "/findings", label: "Findings", icon: FileText },
];

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-atmosphere" />
      <header className="border-b border-[var(--line)] bg-[color:var(--panel)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--ink)] text-[var(--foam)] shadow-sm">
              <FlaskConical className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="font-[family-name:var(--font-display)] text-lg tracking-tight text-[var(--ink)]">
                Kyron Eval
              </div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--mute)]">
                Voice agent evaluation
              </div>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-[var(--mute)] transition hover:bg-[var(--wash)] hover:text-[var(--ink)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)] sm:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--mute)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[color:var(--panel)]/95 backdrop-blur md:hidden">
        <div className="flex justify-around px-2 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] text-[var(--mute)]"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="h-16 md:hidden" />
    </div>
  );
}
