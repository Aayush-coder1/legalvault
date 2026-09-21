/**
 * Realistic mock data for the UI foundation.
 * Replaced by API calls once the service layer lands.
 */

import type { CurrentUser, Evidence, LegalCase } from "@/lib/types";

export const mockUser: CurrentUser = {
  id: "tenant_01",
  name: "Aarav Sharma",
  email: "aarav.sharma@chambers.in",
};

export const mockCases: LegalCase[] = [
  {
    id: "case_001",
    tenantId: "tenant_01",
    title: "Mehta Property Partition Suit",
    caseNumber: "CS/2026/0142",
    description:
      "Partition suit for ancestral property at Andheri West. Plaintiffs seek equal division among four legal heirs. Title documents and survey records under collection.",
    status: "open",
    createdAt: "2026-07-04T10:30:00.000Z",
    updatedAt: "2026-09-12T14:20:00.000Z",
  },
  {
    id: "case_002",
    tenantId: "tenant_01",
    title: "Nexus Labs Employment Dispute",
    caseNumber: "LC/2026/0087",
    description:
      "Wrongful termination claim by a former senior engineer. Notice period, pending bonuses and ESOP vesting contested. Mediation scheduled for next month.",
    status: "in-progress",
    createdAt: "2026-06-18T09:00:00.000Z",
    updatedAt: "2026-09-18T11:05:00.000Z",
  },
  {
    id: "case_003",
    tenantId: "tenant_01",
    title: "State v. Kapoor — Bail Application",
    caseNumber: "BA/2026/0311",
    description:
      "Anticipatory bail application in a financial fraud matter. Charge sheet filed; custody interrogation opposed on grounds of full cooperation.",
    status: "in-progress",
    createdAt: "2026-08-02T16:45:00.000Z",
    updatedAt: "2026-09-15T09:30:00.000Z",
  },
  {
    id: "case_004",
    tenantId: "tenant_01",
    title: "Iyer Consumer Complaint",
    caseNumber: "CC/2025/1290",
    description:
      "Deficiency of service claim against a home appliance manufacturer. District commission ruled in favour; compensation of ₹2.4 lakh awarded and received.",
    status: "closed",
    createdAt: "2025-11-20T12:00:00.000Z",
    updatedAt: "2026-05-30T17:10:00.000Z",
  },
  {
    id: "case_005",
    tenantId: "tenant_01",
    title: "BluePeak Trademark Opposition",
    caseNumber: "TM/2026/0054",
    description:
      "Opposition against a deceptively similar mark in class 35. Evidence affidavit due before the Registry; prior-use documents being compiled.",
    status: "open",
    createdAt: "2026-09-01T08:15:00.000Z",
    updatedAt: "2026-09-19T13:40:00.000Z",
  },
];

export const mockEvidence: Evidence[] = [
  {
    id: "ev_001",
    tenantId: "tenant_01",
    caseId: "case_001",
    fileName: "sale-deed-1998.pdf",
    mimeType: "application/pdf",
    kind: "pdf",
    sizeBytes: 2_412_544,
    uploadDate: "2026-07-06T11:00:00.000Z",
  },
  {
    id: "ev_002",
    tenantId: "tenant_01",
    caseId: "case_001",
    fileName: "site-photographs.png",
    mimeType: "image/png",
    kind: "image",
    sizeBytes: 1_184_320,
    uploadDate: "2026-07-20T15:30:00.000Z",
  },
  {
    id: "ev_003",
    tenantId: "tenant_01",
    caseId: "case_002",
    fileName: "termination-letter.pdf",
    mimeType: "application/pdf",
    kind: "pdf",
    sizeBytes: 184_320,
    uploadDate: "2026-06-22T10:10:00.000Z",
  },
  {
    id: "ev_004",
    tenantId: "tenant_01",
    caseId: "case_002",
    fileName: "exit-interview-recording.mp4",
    mimeType: "video/mp4",
    kind: "video",
    sizeBytes: 18_874_368,
    uploadDate: "2026-08-11T09:45:00.000Z",
  },
  {
    id: "ev_005",
    tenantId: "tenant_01",
    caseId: "case_003",
    fileName: "cooperation-memo.txt",
    mimeType: "text/plain",
    kind: "note",
    sizeBytes: 4_096,
    uploadDate: "2026-09-10T18:00:00.000Z",
  },
];

export function getMockCase(id: string): LegalCase | undefined {
  return mockCases.find((c) => c.id === id);
}

export function getMockEvidence(caseId: string): Evidence[] {
  return mockEvidence.filter((e) => e.caseId === caseId);
}
