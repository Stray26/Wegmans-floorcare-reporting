import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import type { StoreReport } from "@/types/reporting";

export interface PortfolioFilters {
  state: string | null;
  city: string | null;
  inspector: string | null;
}

export const EMPTY_FILTERS: PortfolioFilters = {
  state: null,
  city: null,
  inspector: null,
};

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterDrawer({
  stores,
  filters,
  onApply,
}: {
  stores: StoreReport[];
  filters: PortfolioFilters;
  onApply: (f: PortfolioFilters) => void;
}) {
  const { dateRange, setDateRange } = useSession();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<PortfolioFilters>(filters);

  React.useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const states = [...new Set(stores.map((s) => s.state))].sort();
  const cities = [...new Set(stores.map((s) => s.city))].sort();
  const inspectors = [
    ...new Set(stores.flatMap((s) => s.history.map((h) => h.inspector))),
  ].sort();

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-900 px-1.5 text-[11px] text-white">
              {activeCount}
            </span>
          )}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-card-hover">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <DialogPrimitive.Title className="text-base font-semibold">
              Filters
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Start date
                </span>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start: e.target.value })
                  }
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  End date
                </span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end: e.target.value })
                  }
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                />
              </label>
            </div>

            <Select
              label="State"
              value={draft.state}
              options={states}
              onChange={(v) => setDraft((d) => ({ ...d, state: v }))}
            />
            <Select
              label="City"
              value={draft.city}
              options={cities}
              onChange={(v) => setDraft((d) => ({ ...d, city: v }))}
            />
            <Select
              label="Inspector"
              value={draft.inspector}
              options={inspectors}
              onChange={(v) => setDraft((d) => ({ ...d, inspector: v }))}
            />
          </div>

          <div className="flex items-center gap-2 border-t border-border px-5 py-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                onApply(EMPTY_FILTERS);
              }}
            >
              Clear filters
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Apply filters
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
