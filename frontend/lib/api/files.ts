import { FILE_URL, api } from "@/lib/api/client";
import type { Evidence } from "@/lib/types";

export function listFiles(caseId: string) {
  return api<Evidence[]>(`${FILE_URL}/files?caseId=${encodeURIComponent(caseId)}`);
}

export async function uploadFile(caseId: string, file: File) {
  const form = new FormData();
  form.append("caseId", caseId);
  form.append("file", file);
  const res = await fetch(`${FILE_URL}/files/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message || "Upload failed");
  }
  return json.data as Evidence;
}

export async function uploadNote(caseId: string, text: string) {
  const res = await fetch(`${FILE_URL}/files/note`, {
    method: "POST",
    credentials: "include",
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
  const res = await fetch(`${FILE_URL}/files/${fileId}/download`, { credentials: "include" });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteFile(fileId: string) {
  const res = await fetch(`${FILE_URL}/files/${fileId}`, { method: "DELETE", credentials: "include" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message || "Delete failed");
}
