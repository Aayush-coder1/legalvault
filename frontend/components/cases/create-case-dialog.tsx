"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CaseForm, type CaseFormValues } from "@/components/cases/case-form";

export function CreateCaseDialog({ onCreate }: { onCreate: (values: CaseFormValues) => Promise<void> | void }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
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
        {error ? <p className="mb-3 text-[13px] text-red-400">{error}</p> : null}
        <CaseForm
          submitLabel="Create case"
          pending={pending}
          onSubmit={async (values) => {
            setPending(true);
            setError("");
            try {
              await onCreate(values);
              setOpen(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Create failed");
            } finally {
              setPending(false);
            }
          }}
        />
      </Dialog>
    </>
  );
}
