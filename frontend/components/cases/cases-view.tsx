"use client";

import * as React from "react";
import { Briefcase, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { CaseCard } from "@/components/cases/case-card";
import { CreateCaseDialog } from "@/components/cases/create-case-dialog";
import { listCases, createCase as apiCreateCase } from "@/lib/api/cases";
import { listFiles } from "@/lib/api/files";
import type { CaseFormValues } from "@/components/cases/case-form";
import type { CaseStatus, LegalCase } from "@/lib/types";

type StatusFilter = "all" | CaseStatus;

/** Dashboard case list: live from case-service + file counts from file-service. */
export function CasesView() {
  const [cases, setCases] = React.useState<LegalCase[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await listCases();
      setCases(rows);
      // evidence counts per case (best-effort)
      const entries = await Promise.all(
        rows.map(async (c) => {
          try {
            const files = await listFiles(c.id);
            return [c.id, files.length] as const;
          } catch {
            return [c.id, 0] as const;
          }
        })
      );
      setCounts(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // fetch-once on mount: legitimate data fetch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleCreate(values: CaseFormValues) {
    const created = await apiCreateCase(values);
    setCases((prev) => [created, ...prev]);
  }

  const filtered = cases.filter((c) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      q.length === 0 ||
      c.title.toLowerCase().includes(q) ||
      c.caseNumber.toLowerCase().includes(q);
    const matchesStatus = status === "all" || c.status === status;
    return matchesQuery && matchesStatus;
  });

  const openCount = cases.filter((c) => c.status === "open").length;
  const activeCount = cases.filter((c) => c.status === "in-progress").length;

  if (loading) return <p className="text-sm text-zinc-500">Loading cases…</p>;
  if (error) {
    return (
      <EmptyState
        icon={<Briefcase className="size-5" aria-hidden />}
        title="Cannot reach backend"
        description={`${error}. Check services are running and .env.local is set.`}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total cases", value: cases.length },
          { label: "Open", value: openCount },
          { label: "In progress", value: activeCount },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
            <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-600" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or case number…"
              aria-label="Search cases"
              className="pl-9"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status" className="sm:w-40">
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in-progress">In progress</option>
            <option value="closed">Closed</option>
          </Select>
        </div>
        <CreateCaseDialog onCreate={handleCreate} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="size-5" aria-hidden />}
          title={cases.length === 0 ? "No cases yet" : "No cases match your search"}
          description={
            cases.length === 0
              ? "Create your first case to start organizing evidence."
              : "Try a different keyword or status filter."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((c) => (
            <CaseCard key={c.id} legalCase={c} evidenceCount={counts[c.id] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}
