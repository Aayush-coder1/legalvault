"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CaseForm, type CaseFormValues } from "@/components/cases/case-form";
import type { LegalCase } from "@/lib/types";

export function EditCaseDialog({ legalCase, onSave }: { legalCase: LegalCase; onSave: (values: CaseFormValues) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil aria-hidden /> Edit
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit case" description={legalCase.caseNumber}>
        <CaseForm
          initial={{
            title: legalCase.title,
            caseNumber: legalCase.caseNumber,
            description: legalCase.description,
            status: legalCase.status,
          }}
          submitLabel="Save changes"
          onSubmit={(values) => {
            onSave(values);
            setOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}
