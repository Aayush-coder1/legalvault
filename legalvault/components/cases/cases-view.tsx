"use client";

import * as React from "react";
import { Briefcase, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { CaseCard } from "@/components/cases/case-card";
import { CreateCaseDialog } from "@/components/cases/create-case-dialog";
import type { CaseFormValues } from "@/components/cases/case-form";
import { mockEvidence } from "@/lib/mock-data";
import type { CaseStatus, LegalCase } from "@/lib/types";

type StatusFilter = "all" | CaseStatus;

/** Dashboard case list: search + status filter + create (local state for now). */
export function CasesView({ initialCases }: { initialCases: LegalCase[] }) {
  const [cases, setCases] = React.useState<LegalCase[]>(initialCases);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  function handleCreate(values: CaseFormValues) {
    const now = new Date().toISOString();
    setCases((prev) => [
      {
        id: `case_preview_${Date.now()}`,
        tenantId: "tenant_01",
        ...values,
        createdAt: now,
        updatedAt: now,
      },
      ...prev,
    ]);
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
            <CaseCard
              key={c.id}
              legalCase={c}
              evidenceCount={mockEvidence.filter((e) => e.caseId === c.id).length}
            />
          ))}
        </div>
      )}
    </div>
  );
}
