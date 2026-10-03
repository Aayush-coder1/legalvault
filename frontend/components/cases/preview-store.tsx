"use client";

import * as React from "react";
import { mockCases, mockEvidence } from "@/lib/mock-data";
import type { CaseFormValues } from "@/components/cases/case-form";
import type { PendingUpload } from "@/components/evidence/evidence-upload";
import type { Evidence, LegalCase } from "@/lib/types";

/**
 * Preview database for the UI foundation.
 *
 * Problem it solves: component-local useState is wiped on navigation, so
 * created/edited/deleted cases and uploaded evidence "came back". This store
 * keeps cases + evidence for the whole session (and in localStorage across
 * reloads), seeded from mock-data.
 *
 * Replacement path (no UI rewrites): when the service/API layer lands, each
 * action below becomes a fetch() call (POST/PATCH/DELETE /api/...) and the
 * selectors read server state. Component call-sites stay identical.
 */

export interface PreviewDb {
  cases: LegalCase[];
  evidence: Evidence[];
}

const STORAGE_KEY = "legalvault.preview-db.v1";

const SEED: PreviewDb = { cases: mockCases, evidence: mockEvidence };

type Listener = () => void;

const listeners = new Set<Listener>();
let current: PreviewDb | null = null;
let initialized = false;

function clone(db: PreviewDb): PreviewDb {
  return {
    cases: db.cases.map((c) => ({ ...c })),
    evidence: db.evidence.map((e) => ({ ...e })),
  };
}

function readStored(): PreviewDb | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PreviewDb>;
    if (Array.isArray(parsed.cases) && Array.isArray(parsed.evidence)) {
      return { cases: parsed.cases, evidence: parsed.evidence };
    }
    return null;
  } catch {
    return null;
  }
}

function ensureInit(): void {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    current = readStored();
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = readStored();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): PreviewDb | null {
  ensureInit();
  return current;
}

function getServerSnapshot(): PreviewDb | null {
  return null;
}

function setState(next: PreviewDb): void {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Preview only — quota failure shouldn't break the UI.
  }
  emit();
}

function base(): PreviewDb {
  return current ?? clone(SEED);
}

function mimeFor(kind: PendingUpload["kind"]): string {
  if (kind === "pdf") return "application/pdf";
  if (kind === "image") return "image/png";
  return "video/mp4";
}

/* ------------------------------- actions ------------------------------- */

export function createCase(values: CaseFormValues, tenantId: string): string {
  const now = new Date().toISOString();
  const id = `case_${Date.now()}`;
  const db = base();
  setState({ ...db, cases: [{ id, tenantId, ...values, createdAt: now, updatedAt: now }, ...db.cases] });
  return id;
}

export function updateCase(id: string, values: CaseFormValues): void {
  const db = base();
  setState({
    ...db,
    cases: db.cases.map((c) => (c.id === id ? { ...c, ...values, updatedAt: new Date().toISOString() } : c)),
  });
}

export function deleteCase(id: string): void {
  const db = base();
  setState({
    cases: db.cases.filter((c) => c.id !== id),
    evidence: db.evidence.filter((e) => e.caseId !== id),
  });
}

export function addUploads(caseId: string, tenantId: string, files: PendingUpload[]): void {
  const now = new Date().toISOString();
  const db = base();
  const stamp = Date.now();
  const items: Evidence[] = files.map((f, i) => ({
    id: `ev_${stamp}_${i}`,
    tenantId,
    caseId,
    fileName: f.fileName,
    mimeType: mimeFor(f.kind),
    kind: f.kind,
    sizeBytes: f.sizeBytes,
    uploadDate: now,
  }));
  setState({ ...db, evidence: [...items, ...db.evidence] });
}

export function addNote(caseId: string, tenantId: string, text: string): void {
  const slug =
    text.split(/\s+/).slice(0, 5).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "note";
  const db = base();
  setState({
    ...db,
    evidence: [
      {
        id: `ev_${Date.now()}`,
        tenantId,
        caseId,
        fileName: `${slug}.txt`,
        mimeType: "text/plain",
        kind: "note",
        sizeBytes: new Blob([text]).size,
        uploadDate: new Date().toISOString(),
      },
      ...db.evidence,
    ],
  });
}

export function deleteEvidence(id: string): void {
  const db = base();
  setState({ ...db, evidence: db.evidence.filter((e) => e.id !== id) });
}

/** Reset the preview DB back to seed data (used after logout). */
export function resetPreviewDb(): void {
  setState(clone(SEED));
}

/* --------------------------------- hook --------------------------------- */

export interface PreviewStore extends PreviewDb {
  getCase: (id: string) => LegalCase | undefined;
  getEvidence: (caseId: string) => Evidence[];
}

export function usePreviewStore(): PreviewStore {
  const stored = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const db = stored ?? SEED;
  return React.useMemo<PreviewStore>(
    () => ({
      cases: db.cases,
      evidence: db.evidence,
      getCase: (id) => db.cases.find((c) => c.id === id),
      getEvidence: (caseId) => db.evidence.filter((e) => e.caseId === caseId),
    }),
    [db],
  );
}
