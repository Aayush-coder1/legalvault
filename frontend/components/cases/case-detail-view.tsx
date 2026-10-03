"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileWarning } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EditCaseDialog } from "@/components/cases/edit-case-dialog";
import { DeleteCaseDialog } from "@/components/cases/delete-case-dialog";
import type { CaseFormValues } from "@/components/cases/case-form";
import {
  addNote,
  addUploads,
  deleteCase,
  deleteEvidence,
  updateCase,
  usePreviewStore,
} from "@/components/cases/preview-store";
import { EvidenceList } from "@/components/evidence/evidence-list";
import { EvidenceUpload, type PendingUpload } from "@/components/evidence/evidence-upload";
import { ROUTES } from "@/lib/config/constants";
import { formatDateTime } from "@/lib/utils/format";
import type { Evidence, LegalCase } from "@/lib/types";

/** Case detail: header + edit/delete + evidence section (preview store). */
export function CaseDetailView({ caseId }: { caseId: string }) {
  const { getCase, getEvidence } = usePreviewStore();
  const legalCase = getCase(caseId);

  if (!legalCase) {
    return (
      <EmptyState
        icon={<FileWarning className="size-5" aria-hidden />}
        title="Case not found"
        description="It may have been deleted. Pick another matter from the dashboard."
        action={
          <Link href={ROUTES.dashboard} className="text-sm font-medium text-white underline-offset-4 hover:underline">
            Back to cases
          </Link>
        }
      />
    );
  }

  return <CaseDetailContent legalCase={legalCase} evidence={getEvidence(caseId)} />;
}

function CaseDetailContent({
  legalCase,
  evidence,
}: {
  legalCase: LegalCase;
  evidence: Evidence[];
}) {
  const router = useRouter();

  function handleSave(values: CaseFormValues) {
    updateCase(legalCase.id, values);
  }

  function handleDeleteCase() {
    deleteCase(legalCase.id);
    router.push(ROUTES.dashboard);
  }

  function handleFilesPicked(files: PendingUpload[]) {
    addUploads(legalCase.id, legalCase.tenantId, files);
  }

  function handleNoteAdded(text: string) {
    addNote(legalCase.id, legalCase.tenantId, text);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-zinc-500">{legalCase.caseNumber}</p>
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
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">{legalCase.description}</p>
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
              <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-zinc-300">
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
              <EvidenceList items={evidence} onDelete={deleteEvidence} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
