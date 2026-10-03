"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CaseForm, type CaseFormValues } from "@/components/cases/case-form";

export function CreateCaseDialog({ onCreate }: { onCreate: (values: CaseFormValues) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> New case
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Create case"
        description="Add a new matter to your workspace."
      >
        <CaseForm
          submitLabel="Create case"
          onSubmit={(values) => {
            onCreate(values);
            setOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}
