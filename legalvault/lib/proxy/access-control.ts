/**
 * AccessControlService (placeholder).
 *
 * Day-1 contract: every record carries a `tenantId`; access is granted
 * only when it matches the request's tenant. Services call `assertAccess`
 * before any read/write. Real implementation adds role checks
 * (owner / member / viewer) on top of the same function signature.
 */

import type { TenantContext } from "@/lib/types";

export class AccessDeniedError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "Access denied for this tenant.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export function assertAccess(
  ctx: TenantContext,
  recordTenantId: string,
): void {
  // PLACEHOLDER: strict tenant isolation; roles arrive with auth.
  // TODO(auth): extend with role-based rules without changing callers.
  if (ctx.tenantId !== recordTenantId) {
    throw new AccessDeniedError();
  }
}

export function canAccess(
  ctx: TenantContext,
  recordTenantId: string,
): boolean {
  return ctx.tenantId === recordTenantId;
}
