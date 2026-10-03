/**
 * AuditLogger (placeholder).
 *
 * Day-1 contract: services log security-relevant events
 * (case viewed/created/updated/deleted, evidence uploaded/deleted)
 * with tenant + actor + timestamp. Local impl writes to stdout;
 * later it appends to a durable store without changing callers.
 */

export type AuditAction =
  | "case.view"
  | "case.create"
  | "case.update"
  | "case.delete"
  | "evidence.upload"
  | "evidence.delete";

export interface AuditEvent {
  action: AuditAction;
  tenantId: string;
  actorId: string;
  resourceId: string;
  at: string;
}

export function logAudit(event: Omit<AuditEvent, "at">): void {
  // PLACEHOLDER: structured stdout until a durable sink lands.
  // TODO(audit): append to .data/audit.log (local) / CloudWatch (cloud).
  const full: AuditEvent = { ...event, at: new Date().toISOString() };
  console.info(`[audit] ${full.at} ${full.tenantId} ${full.action} ${full.resourceId}`);
}
