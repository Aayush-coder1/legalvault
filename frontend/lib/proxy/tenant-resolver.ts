/**
 * TenantResolver (placeholder).
 *
 * Day-1 contract: derive the tenant scope for a request from the
 * authenticated user. Real implementation will parse the verified JWT
 * and return `{ tenantId, userId }`. All repository/service calls take
 * the resolved tenant — never a raw user id.
 */

import type { TenantContext } from "@/lib/types";

export function resolveTenant(userId: string): TenantContext {
  // PLACEHOLDER: single-tenant-per-user mapping until auth lands.
  // TODO(auth): derive from verified JWT claims instead of a raw id.
  return { tenantId: userId, userId };
}
