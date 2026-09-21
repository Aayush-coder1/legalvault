"use client";

import * as React from "react";
import { FileUp, StickyNote, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FILE_MB } from "@/lib/config/constants";
import { cn } from "@/lib/utils/cn";
import type { EvidenceKind } from "@/lib/types";

export interface PendingUpload {
  kind: Exclude<EvidenceKind, "note">;
  fileName: string;
  sizeBytes: number;
}

type Tab = "file" | "note";

/**
 * UI-only upload panel. Parent owns the evidence list; this reports
 * picked files / composed notes via callbacks (API wiring comes later).
 */
export function EvidenceUpload({
  onFilesPicked,
  onNoteAdded,
}: {
  onFilesPicked: (files: PendingUpload[]) => void;
  onNoteAdded: (text: string) => void;
}) {
  const [tab, setTab] = React.useState<Tab>("file");
  const [note, setNote] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function kindFor(mime: string): PendingUpload["kind"] {
    if (mime === "application/pdf") return "pdf";
    if (mime.startsWith("image/")) return "image";
    return "video";
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    onFilesPicked(
      Array.from(fileList).map((f) => ({ kind: kindFor(f.type), fileName: f.name, sizeBytes: f.size })),
    );
  }

  return (
    <div>
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Upload type">
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
              tab === t.id ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-800",
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
            "mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
            dragOver ? "border-gray-950 bg-gray-50" : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50/50",
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            <Upload className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-medium text-gray-950">Drop files here or click to browse</p>
          <p className="mt-1 text-[13px] text-gray-500">PDF, images, video · max {MAX_FILE_MB} MB per file</p>
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
            <Button
              size="sm"
              disabled={note.trim().length === 0}
              onClick={() => {
                onNoteAdded(note.trim());
                setNote("");
              }}
            >
              Add note
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
