/**
 * DecryptionService (placeholder).
 *
 * Kept as a separate module from encryption on purpose: read-path
 * decryption gets its own audit + error semantics, and a future KMS
 * `Decrypt` call has different IAM/throughput characteristics than
 * `Encrypt`. Both delegate to the same `CryptoPort` for now.
 */

import { EncryptionService } from "@/lib/proxy/encryption.service";

export const DecryptionService = {
  decryptField(ciphertext: string): string {
    // PLACEHOLDER: delegates to the shared port until KMS lands.
    // TODO(crypto): call KMS Decrypt here; keep this signature.
    return EncryptionService.decryptField(ciphertext);
  },
};
