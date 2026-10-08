"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function DeleteCaseDialog({
  caseTitle,
  onConfirm,
}: {
  caseTitle: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete case"
        description={`“${caseTitle}” and its evidence list will be removed from this preview. This cannot be undone.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            Delete case
          </Button>
        </div>
      </Dialog>
    </>
  );
}
