import { FILE_URL, api, ApiError, authedFetch } from "@/lib/api/client";
import type { Evidence } from "@/lib/types";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "@/lib/config/constants";

const ALLOWED = new Set(Object.values(ALLOWED_MIME_TYPES).flat());

export function validateClientFile(file: File): string | null {
  if (file.size === 0) return "Empty file";
  if (file.size > MAX_FILE_BYTES) return "File too big (max 25MB)";
  if (!ALLOWED.has(file.type)) return "File type not allowed";
  return null;
}

export function listFiles(caseId: string) {
  return api<Evidence[]>(`${FILE_URL}/files?caseId=${encodeURIComponent(caseId)}`);
}

export function fileCounts(caseIds: string[]) {
  if (!caseIds.length) return Promise.resolve({} as Record<string, number>);
  return api<Record<string, number>>(`${FILE_URL}/files/counts?caseIds=${encodeURIComponent(caseIds.join(","))}`);
}

export async function uploadFile(caseId: string, file: File) {
  const err = validateClientFile(file);
  if (err) throw new ApiError("BAD_FILE", err, 400);
  const form = new FormData();
  form.append("caseId", caseId);
  form.append("file", file);
  let res: Response;
  try {
    // authedFetch attaches cookies + Bearer and refreshes once on 401.
    res = await authedFetch(`${FILE_URL}/files/upload`, { method: "POST", body: form }, 60000);
  } catch {
    throw new Error("Upload timed out, try again");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || "Upload failed");
  }
  return json.data as Evidence;
}

export async function uploadNote(caseId: string, text: string) {
  const res = await authedFetch(`${FILE_URL}/files/note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, text }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || "Note save failed");
  }
  return json.data as Evidence;
}

export async function downloadFile(fileId: string, fileName: string) {
  let res: Response;
  try {
    res = await authedFetch(`${FILE_URL}/files/${fileId}/download`, {}, 60000);
  } catch {
    throw new Error("Download timed out, try again");
  }
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function deleteFile(fileId: string) {
  const res = await authedFetch(`${FILE_URL}/files/${fileId}`, { method: "DELETE" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message || "Delete failed");
}
