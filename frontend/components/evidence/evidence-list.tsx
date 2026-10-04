import { FileText, FileImage, FileVideo, Download, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDateTime } from "@/lib/utils/format";
import type { Evidence, EvidenceKind } from "@/lib/types";

const KIND_ICON: Record<EvidenceKind, typeof FileText> = {
  pdf: FileText,
  image: FileImage,
  video: FileVideo,
  note: StickyNote,
};

export function EvidenceList({
  items,
  onDelete,
  onDownload,
}: {
  items: Evidence[];
  onDelete: (id: string) => void;
  onDownload?: (item: Evidence) => void;
}) {
  return (
    <ul className="divide-y divide-white/5">
      {items.map((item) => {
        // Fall back to a generic icon so one bad record can never crash the list.
        const Icon = KIND_ICON[item.kind] ?? FileText;
        return (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-300">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{item.fileName}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                {item.mimeType} · {formatBytes(item.sizeBytes)} · {formatDateTime(item.uploadDate)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {item.kind !== "note" ? (
                <Button variant="ghost" size="icon" aria-label={`Download ${item.fileName}`} onClick={() => onDownload?.(item)}>
                  <Download aria-hidden />
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" aria-label={`Delete ${item.fileName}`} onClick={() => onDelete(item.id)}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
