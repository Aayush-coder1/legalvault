/**
 * EncryptionService (placeholder).
 *
 * Day-1 contract: `encryptField` / `decryptField` wrap sensitive values
 * (case descriptions, note bodies) before they reach storage. The local
 * implementation uses AES-256-GCM; swapping to KMS later means replacing
 * this file's internals only — the interface stays identical.
 */

export interface CryptoPort {
  encryptField(plaintext: string): string;
  decryptField(ciphertext: string): string;
}

export const EncryptionService: CryptoPort = {
  encryptField(_plaintext: string): string {
    // PLACEHOLDER: returns input until AES lands with the service layer.
    // TODO(crypto): implement AES-256-GCM via getServerEnv().encryptionKey.
    return _plaintext;
  },
  decryptField(_ciphertext: string): string {
    // PLACEHOLDER: see above.
    return _ciphertext;
  },
};
