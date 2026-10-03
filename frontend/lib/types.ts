/**
 * Shared domain types for LegalVault.
 *
 * These are UI-foundation shapes. Field names are chosen to match the
 * future API contracts so pages/components don't need rewrites when the
 * service layer lands.
 */

export type CaseStatus = "open" | "in-progress" | "closed";

export interface LegalCase {
  id: string;
  tenantId: string;
  title: string;
  caseNumber: string;
  description: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export type EvidenceKind = "pdf" | "image" | "video" | "note";

export interface Evidence {
  id: string;
  tenantId: string;
  caseId: string;
  fileName: string;
  /** MIME type, e.g. "application/pdf". Notes use "text/plain". */
  mimeType: string;
  kind: EvidenceKind;
  sizeBytes: number;
  uploadDate: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

/** Standard API envelope (used later by route handlers). */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** Tenant context resolved per request by the Proxy Engine. */
export interface TenantContext {
  tenantId: string;
  userId: string;
}
