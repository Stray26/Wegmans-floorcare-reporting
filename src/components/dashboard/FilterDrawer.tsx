import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession, ALL_CONFIGS } from "@/context/SessionContext";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import type { StoreReport } from "@/types/reporting";

/**
 * Corporate filter hierarchy mirrors Smart Inspect: Config (inspection
 * program) -> Store. Config is a SCOPE — applying it rescopes the whole
 * dashboard via the session's configFilter (data is refetched for that
 * config). Store and Inspector narrow the visible rows client-side.
 */
export interface PortfolioFilters {
  store: string | null;
  inspector: string | null;
}

export const EMPTY_FILTERS: PortfolioFilters = {
  store: null,
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
  const { dateRange, setDateRange, setConfigFilter } = useSession();
  const { configs, activeConfig } = useSmartInspectPermissions();
  // useSmartInspectPermissions rebuilds `activeConfig` as a NEW object every
  // render, so derive a stable primitive (the config name) to drive the re-sync
  // effect. Depending on the object reset the in-drawer selection on every
  // render, so the Config dropdown couldn't be changed.
  const activeConfigName = activeConfig?.configName ?? null;
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<PortfolioFilters>(filters);
  const [draftConfig, setDraftConfig] = React.useState<string | null>(
    activeConfigName
  );

  React.useEffect(() => {
    // Re-sync the draft only when the drawer OPENS (or the applied config /
    // filters change) — never on every render, or it clobbers the user's
    // in-drawer selection before they can apply it.
    if (open) {
      setDraft(filters);
      setDraftConfig(activeConfigName);
    }
  }, [open, filters, activeConfigName]);

  const configNames = configs.map((c) => c.configName);
  const multiConfig = configNames.length > 1;
  // Store options cascade from the DRAFT config's permitted stores ("All
  // configs" unions every program's stores; dedupe shared store names).
  const draftConfigStores =
    draftConfig === ALL_CONFIGS
      ? configs.flatMap((c) => c.stores)
      : (configs.find((c) => c.configName === draftConfig)?.stores ?? []);
  const storeNames = [
    ...new Set(draftConfigStores.map((s) => s.storeName)),
  ].sort();
  const inspectors = [
    ...new Set(stores.flatMap((s) => s.history.map((h) => h.inspector))),
  ].sort();

  const activeCount = Object.values(filters).filter(Boolean).length;

  function apply(next: PortfolioFilters, config: string | null) {
    setConfigFilter(config);
    onApply(next);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-900 px-1.5 text-[11px] text-white">
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

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Config
              </span>
              <select
                value={draftConfig ?? ""}
                onChange={(e) => {
                  // Changing config resets the store filter — the store list
                  // cascades from the selected config.
                  setDraftConfig(e.target.value || null);
                  setDraft((d) => ({ ...d, store: null }));
                }}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {multiConfig && <option value={ALL_CONFIGS}>All Configs</option>}
                {configNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <Select
              label="Store"
              value={draft.store}
              options={storeNames}
              onChange={(v) => setDraft((d) => ({ ...d, store: v }))}
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
                setDraftConfig(configNames[0] ?? null);
                apply(EMPTY_FILTERS, null);
              }}
            >
              Clear filters
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                apply(draft, draftConfig);
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
