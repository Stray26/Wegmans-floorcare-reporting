import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ImageOff, X } from "lucide-react";
import { formatDate } from "@/utils/formatting";
import type { PhotoReport } from "@/types/reporting";

export function PhotoGallery({ photos }: { photos: PhotoReport[] }) {
  const [active, setActive] = React.useState<PhotoReport | null>(null);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <ImageOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No photos captured in the selected range.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p)}
            className="group relative overflow-hidden rounded-lg border border-border"
          >
            <img
              src={p.url}
              alt={p.caption ?? "Inspection photo"}
              loading="lazy"
              className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
              <p className="truncate text-[11px] font-medium text-white">
                {p.checkAreaName}
              </p>
              {p.caption && (
                <p className="truncate text-[10px] text-white/80">
                  {p.caption}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      <DialogPrimitive.Root
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/80" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[60] w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2">
            <DialogPrimitive.Title className="sr-only">
              Inspection photo
            </DialogPrimitive.Title>
            {active && (
              <div className="overflow-hidden rounded-lg bg-card">
                <img
                  src={active.url}
                  alt={active.caption ?? "Inspection photo"}
                  className="max-h-[70vh] w-full object-contain bg-black"
                />
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{active.checkAreaName}</p>
                    <p className="text-xs text-muted-foreground">
                      {active.caption} · {formatDate(active.capturedAt)}
                    </p>
                  </div>
                  <DialogPrimitive.Close className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                  </DialogPrimitive.Close>
                </div>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
