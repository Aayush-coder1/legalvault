"use client";

import * as React from "react";
import { FileUp, StickyNote, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FILE_MB, ALLOWED_MIME_TYPES } from "@/lib/config/constants";
import { cn } from "@/lib/utils/cn";

type Tab = "file" | "note";

/** Real upload panel: passes File objects up (parent POSTs to file-service). */
export function EvidenceUpload({
  onFilesPicked,
  onNoteAdded,
}: {
  onFilesPicked: (files: File[]) => Promise<void> | void;
  onNoteAdded: (text: string) => Promise<void> | void;
}) {
  const [tab, setTab] = React.useState<Tab>("file");
  const [note, setNote] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [fileError, setFileError] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const ALLOWED = React.useMemo(() => new Set(Object.values(ALLOWED_MIME_TYPES).flat()), []);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || busy) return;
    const picked = Array.from(fileList);
    const bad = picked.find((f) => f.size === 0 || f.size > MAX_FILE_MB * 1024 * 1024 || !ALLOWED.has(f.type));
    if (bad) {
      setFileError(
        bad.size > MAX_FILE_MB * 1024 * 1024 ? `“${bad.name}” exceeds ${MAX_FILE_MB}MB` : `“${bad.name}” type not allowed`
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFileError("");
    setBusy(true);
    try {
      await onFilesPicked(picked);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleNote() {
    if (!note.trim() || busy) return;
    setBusy(true);
    try {
      await onNoteAdded(note.trim());
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-1 rounded-lg bg-white/5 p-1" role="tablist" aria-label="Upload type">
        {(
          [
            { id: "file", label: "File upload", icon: FileUp },
            { id: "note", label: "Text note", icon: StickyNote },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.id ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-200",
            )}
          >
            <t.icon className="size-3.5" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "file" ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop files or browse"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            dragOver
              ? "border-[#e3b341]/60 bg-[#e3b341]/5"
              : "border-white/15 bg-transparent hover:border-white/25 hover:bg-white/[0.02]",
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-white/5 text-zinc-300">
            <Upload className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-medium text-white">{busy ? "Uploading…" : "Drop files here or click to browse"}</p>
          <p className="mt-1 text-[13px] text-zinc-500">PDF, images, video · max {MAX_FILE_MB} MB per file</p>
          {fileError ? <p className="mt-1 text-[13px] text-red-400">{fileError}</p> : null}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp,video/mp4,video/webm"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write an observation, memo, or interview note…"
            rows={4}
            aria-label="Note text"
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={note.trim().length === 0 || busy} onClick={handleNote}>
              {busy ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
