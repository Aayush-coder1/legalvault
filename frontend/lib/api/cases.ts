import { CASE_URL, api, apiJson } from "@/lib/api/client";
import type { LegalCase } from "@/lib/types";
import type { CaseFormValues } from "@/components/cases/case-form";

export interface Note {
  id: string;
  tenantId: string;
  caseId: string;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export function listCases() {
  return api<LegalCase[]>(`${CASE_URL}/cases`);
}

export function getCase(id: string) {
  return api<LegalCase>(`${CASE_URL}/cases/${id}`);
}

export function createCase(values: CaseFormValues) {
  return apiJson<LegalCase>(`${CASE_URL}/cases`, "POST", values);
}

export function updateCase(id: string, values: CaseFormValues) {
  return apiJson<LegalCase>(`${CASE_URL}/cases/${id}`, "PUT", values);
}

export function deleteCase(id: string) {
  return apiJson<{ ok: boolean }>(`${CASE_URL}/cases/${id}`, "DELETE");
}

export function listNotes(caseId: string) {
  return api<Note[]>(`${CASE_URL}/cases/${caseId}/notes`);
}

export function createNote(caseId: string, text: string) {
  return apiJson<Note>(`${CASE_URL}/cases/${caseId}/notes`, "POST", { text });
}

export function deleteNote(caseId: string, noteId: string) {
  return apiJson<{ ok: boolean }>(`${CASE_URL}/cases/${caseId}/notes/${noteId}`, "DELETE");
}
