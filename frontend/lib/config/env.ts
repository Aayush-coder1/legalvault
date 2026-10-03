/**
 * Typed environment access.
 *
 * Placeholders for now: values are only consumed once auth/storage land.
 * `getServerEnv()` must only be called in server code (route handlers,
 * services) — never imported by client components.
 */

export interface ServerEnv {
  jwtSecret: string;
  encryptionKey: string;
  uploadDir: string;
  maxFileMb: number;
}

export function getServerEnv(): ServerEnv {
  return {
    jwtSecret: process.env.JWT_SECRET ?? "dev-only-jwt-secret",
    encryptionKey: process.env.ENCRYPTION_KEY ?? "dev-only-encryption-key",
    uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
    maxFileMb: Number(process.env.MAX_FILE_MB ?? 25),
  };
}
