/**
 * App-wide constants. Single source of truth for limits, labels and routes.
 * Future cloud work reads these too (e.g. upload limits map to S3 policy).
 */

export const APP_NAME = "LegalVault";
export const APP_TAGLINE = "Case files and evidence, organized.";

export const MAX_FILE_MB = 25;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

/** MIME allowlist for evidence uploads (MVP scope). */
export const ALLOWED_MIME_TYPES: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/webm"],
  note: ["text/plain"],
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  "in-progress": "In progress",
  closed: "Closed",
};

export const ROUTES = {
  landing: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  caseDetail: (id: string) => `/dashboard/cases/${id}`,
} as const;
