"use client";

import Link from "next/link";
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
import { EvidenceUpload } from "@/components/evidence/evidence-upload";
import { ROUTES } from "@/lib/config/constants";
import { formatDateTime } from "@/lib/utils/format";
import type { Evidence, LegalCase } from "@/lib/types";
import { getCase, updateCase as apiUpdate, deleteCase as apiDelete, listNotes, createNote as apiCreateNote } from "@/lib/api/cases";
import { listFiles, uploadFile, uploadNote, deleteFile, downloadFile } from "@/lib/api/files";

/** Case detail: live from case-service (case+notes) and file-service (files). */
export function CaseDetailView({ caseId }: { caseId: string }) {
  const [legalCase, setLegalCase] = React.useState<LegalCase | null>(null);
  const [evidence, setEvidence] = React.useState<Evidence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const c = await getCase(caseId);
      setLegalCase(c);
      const [files, notes] = await Promise.all([
        listFiles(caseId).catch(() => [] as Evidence[]),
        listNotes(caseId).catch(() => []),
      ]);
      const noteEvidence: Evidence[] = notes.map((n) => ({
        id: n.id,
        tenantId: n.tenantId,
        caseId,
        fileName: `${(n.title || "note").slice(0, 40)}.txt`,
        mimeType: "text/plain",
        kind: "note" as const,
        sizeBytes: n.text.length,
        uploadDate: n.createdAt,
      }));
      setEvidence([...files, ...noteEvidence]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load case");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  React.useEffect(() => {
    // fetch-once per caseId: legitimate data fetch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-zinc-500">Loading case…</p>;
  if (error || !legalCase) {
    return (
      <EmptyState
        icon={<FileWarning className="size-5" aria-hidden />}
        title="Case not found"
        description={error || "It may have been deleted. Pick another matter from the dashboard."}
        action={
          <Link href={ROUTES.dashboard} className="text-sm font-medium text-white underline-offset-4 hover:underline">
            Back to cases
          </Link>
        }
      />
    );
  }

  return <CaseDetailContent legalCase={legalCase} evidence={evidence} reload={load} />;
}

function CaseDetailContent({
  legalCase,
  evidence,
  reload,
}: {
  legalCase: LegalCase;
  evidence: Evidence[];
  reload: () => Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState("");

  async function handleSave(values: CaseFormValues) {
    await apiUpdate(legalCase.id, values);
    await reload();
  }

  async function handleDeleteCase() {
    try {
      await apiDelete(legalCase.id);
      router.push(ROUTES.dashboard);
    } catch (err) {
      // Case row is gone but some bucket files survived (see error detail).
      // Metadata was kept for those, so deleting again retries them.
      alert(err instanceof Error ? `Case deleted, but file cleanup failed: ${err.message}` : "Case deleted, but file cleanup failed.");
      router.push(ROUTES.dashboard);
    }
  }

  async function handleFilesPicked(files: File[]) {
    setBusy("Uploading…");
    try {
      for (const f of files) await uploadFile(legalCase.id, f);
      await reload();
    } finally {
      setBusy("");
    }
  }

  async function handleNoteAdded(text: string) {
    // notes go to case-service (encrypted in MongoDB via crypto-proxy)
    await apiCreateNote(legalCase.id, text).catch(() => uploadNote(legalCase.id, text));
    await reload();
  }

  async function handleDelete(id: string, kind: string) {
    if (kind === "note") {
      const { deleteNote } = await import("@/lib/api/cases");
      await deleteNote(legalCase.id, id).catch(() => deleteFile(id));
    } else {
      await deleteFile(id);
    }
    await reload();
  }

  async function handleDownload(item: Evidence) {
    if (item.kind === "note") return; // notes render inline; no bytes to download
    await downloadFile(item.id, item.fileName);
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
            <CardDescription>{busy || "Files go to S3 (encrypted), notes to MongoDB (encrypted)."}</CardDescription>
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
              <EvidenceList items={evidence} onDelete={(id) => {
                const item = evidence.find((e) => e.id === id);
                if (item) handleDelete(id, item.kind);
              }} onDownload={handleDownload} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
