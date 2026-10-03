/**
 * Multi-Tenant Encrypted DB Proxy Engine — public surface.
 * Services import from here, never from the modules directly.
 */
export { resolveTenant } from "@/lib/proxy/tenant-resolver";
export {
  assertAccess,
  canAccess,
  AccessDeniedError,
} from "@/lib/proxy/access-control";
export { EncryptionService, type CryptoPort } from "@/lib/proxy/encryption.service";
export { DecryptionService } from "@/lib/proxy/decryption.service";
export { logAudit, type AuditAction, type AuditEvent } from "@/lib/proxy/audit-logger";
