"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CaseStatus } from "@/lib/types";

export interface CaseFormValues {
  title: string;
  caseNumber: string;
  description: string;
  status: CaseStatus;
}

/** Shared create/edit form. Parent owns persistence (API later, local state now). */
export function CaseForm({
  initial,
  submitLabel,
  pending = false,
  onSubmit,
}: {
  initial?: CaseFormValues;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: CaseFormValues) => void;
}) {
  const [values, setValues] = React.useState<CaseFormValues>(
    initial ?? { title: "", caseNumber: "", description: "", status: "open" },
  );

  function set<K extends keyof CaseFormValues>(key: K, value: CaseFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <Field label="Case title" htmlFor="cf-title">
        <Input
          id="cf-title"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Mehta Property Partition Suit"
          minLength={3}
          maxLength={120}
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Case number" htmlFor="cf-number" hint="Unique within your workspace.">
          <Input
            id="cf-number"
            value={values.caseNumber}
            onChange={(e) => set("caseNumber", e.target.value)}
            placeholder="CS/2026/0142"
            required
          />
        </Field>
        <Field label="Status" htmlFor="cf-status">
          <Select id="cf-status" value={values.status} onChange={(e) => set("status", e.target.value as CaseStatus)}>
            <option value="open">Open</option>
            <option value="in-progress">In progress</option>
            <option value="closed">Closed</option>
          </Select>
        </Field>
      </div>
      <Field label="Description" htmlFor="cf-description">
        <Textarea
          id="cf-description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Brief background, parties involved, current stage…"
          rows={4}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
