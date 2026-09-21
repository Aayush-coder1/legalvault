"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { FileWarning } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EditCaseDialog } from "@/components/cases/edit-case-dialog";
import { DeleteCaseDialog } from "@/components/cases/delete-case-dialog";
import type { CaseFormValues } from "@/components/cases/case-form";
import { EvidenceList } from "@/components/evidence/evidence-list";
import { EvidenceUpload, type PendingUpload } from "@/components/evidence/evidence-upload";
import { ROUTES } from "@/lib/config/constants";
import { formatDateTime } from "@/lib/utils/format";
import type { Evidence, LegalCase } from "@/lib/types";

function mimeFor(kind: PendingUpload["kind"]): string {
  if (kind === "pdf") return "application/pdf";
  if (kind === "image") return "image/png";
  return "video/mp4";
}

/** Case detail: header + edit/delete + evidence section (local state for now). */
export function CaseDetailView({ initialCase, initialEvidence }: { initialCase: LegalCase; initialEvidence: Evidence[] }) {
  const router = useRouter();
  const [legalCase, setLegalCase] = React.useState<LegalCase>(initialCase);
  const [evidence, setEvidence] = React.useState<Evidence[]>(initialEvidence);

  function handleSave(values: CaseFormValues) {
    setLegalCase((c) => ({ ...c, ...values, updatedAt: new Date().toISOString() }));
  }

  function handleDeleteCase() {
    // UI foundation: return to the dashboard preview.
    router.push(ROUTES.dashboard);
  }

  function handleFilesPicked(files: PendingUpload[]) {
    const now = new Date().toISOString();
    setEvidence((prev) => [
      ...files.map((f, i) => ({
        id: `ev_preview_${Date.now()}_${i}`,
        tenantId: legalCase.tenantId,
        caseId: legalCase.id,
        fileName: f.fileName,
        mimeType: mimeFor(f.kind),
        kind: f.kind,
        sizeBytes: f.sizeBytes,
        uploadDate: now,
      })),
      ...prev,
    ]);
  }

  function handleNoteAdded(text: string) {
    const words = text.split(/\s+/).slice(0, 5).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    setEvidence((prev) => [
      {
        id: `ev_preview_${Date.now()}`,
        tenantId: legalCase.tenantId,
        caseId: legalCase.id,
        fileName: `${words || "note"}.txt`,
        mimeType: "text/plain",
        kind: "note",
        sizeBytes: new Blob([text]).size,
        uploadDate: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-gray-500">{legalCase.caseNumber}</p>
              <CardTitle className="mt-1 text-xl">{legalCase.title}</CardTitle>
              <CardDescription>Last updated {formatDateTime(legalCase.updatedAt)}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={legalCase.status} />
              <EditCaseDialog legalCase={legalCase} onSave={handleSave} />
              <DeleteCaseDialog caseTitle={legalCase.title} onConfirm={handleDeleteCase} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm leading-relaxed text-gray-700">{legalCase.description}</p>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Add evidence</CardTitle>
            <CardDescription>Files and notes are preview-only until upload APIs land.</CardDescription>
          </CardHeader>
          <CardContent>
            <EvidenceUpload onFilesPicked={handleFilesPicked} onNoteAdded={handleNoteAdded} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>
              Evidence{" "}
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {evidence.length}
              </span>
            </CardTitle>
            <CardDescription>PDFs, images, video and notes attached to this case.</CardDescription>
          </CardHeader>
          <CardContent>
            {evidence.length === 0 ? (
              <EmptyState
                icon={<FileWarning className="size-5" aria-hidden />}
                title="No evidence yet"
                description="Upload a file or write a note to start building the record."
              />
            ) : (
              <EvidenceList items={evidence} onDelete={(id) => setEvidence((prev) => prev.filter((e) => e.id !== id))} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
