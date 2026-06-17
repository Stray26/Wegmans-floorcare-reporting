import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { useSmartInspectPermissions } from "@/hooks/useSmartInspectPermissions";
import type { StoreReport } from "@/types/reporting";

/**
 * Corporate filter hierarchy mirrors Smart Inspect: Config (inspection
 * program) -> Store. Config is a SCOPE — one or more configs can be selected
 * (multi-select); applying rescopes the whole dashboard via the session's
 * configFilter (data is refetched for the union of those configs). Store and
 * Inspector narrow the visible rows client-side.
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
  const { configs, selectedConfigNames } = useSmartInspectPermissions();
  // useSmartInspectPermissions rebuilds `selectedConfigNames` as a NEW array
  // every render, so derive a stable primitive (a JSON key) to drive the
  // re-sync effect. Depending on the array reset the in-drawer selection on
  // every render, so the Config checkboxes couldn't be changed.
  const selectedKey = JSON.stringify(selectedConfigNames);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<PortfolioFilters>(filters);
  const [draftConfigs, setDraftConfigs] = React.useState<string[]>(
    () => JSON.parse(selectedKey) as string[]
  );

  React.useEffect(() => {
    // Re-sync the draft only when the drawer OPENS (or the applied configs /
    // filters change) — never on every render, or it clobbers the user's
    // in-drawer selection before they can apply it.
    if (open) {
      setDraft(filters);
      setDraftConfigs(JSON.parse(selectedKey) as string[]);
    }
  }, [open, filters, selectedKey]);

  const configNames = configs.map((c) => c.configName);
  const multiConfig = configNames.length > 1;
  const allChecked =
    configNames.length > 0 &&
    configNames.every((n) => draftConfigs.includes(n));
  const someChecked = draftConfigs.length > 0 && !allChecked;
  // Store options cascade from the union of the DRAFT-selected configs' stores
  // (dedupe store names shared across programs).
  const draftConfigStores = configs
    .filter((c) => draftConfigs.includes(c.configName))
    .flatMap((c) => c.stores);
  const storeNames = [
    ...new Set(draftConfigStores.map((s) => s.storeName)),
  ].sort();
  const inspectors = [
    ...new Set(stores.flatMap((s) => s.history.map((h) => h.inspector))),
  ].sort();

  const activeCount = Object.values(filters).filter(Boolean).length;

  function apply(next: PortfolioFilters, nextConfigs: string[]) {
    setConfigFilter(nextConfigs);
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

            <div className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {multiConfig ? "Configs" : "Config"}
              </span>
              <div className="space-y-2 rounded-md border border-input bg-card p-3">
                {multiConfig && (
                  <label className="flex items-center gap-2 border-b border-border pb-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-900"
                      checked={allChecked}
                      ref={(el) => {
                        // Indeterminate when only some configs are checked.
                        if (el) el.indeterminate = someChecked;
                      }}
                      onChange={(e) => {
                        // Toggling "All configs" selects/clears every program;
                        // changing the scope resets the store filter.
                        setDraftConfigs(
                          e.target.checked ? [...configNames] : []
                        );
                        setDraft((d) => ({ ...d, store: null }));
                      }}
                    />
                    All configs
                  </label>
                )}
                {configNames.map((name) => (
                  <label key={name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-900"
                      checked={draftConfigs.includes(name)}
                      // A single permitted config is always in scope (nothing
                      // to multi-select), so lock it on.
                      disabled={!multiConfig}
                      onChange={(e) => {
                        // Changing the config scope resets the store filter —
                        // the store list cascades from the checked configs.
                        setDraftConfigs((cur) =>
                          e.target.checked
                            ? [...cur, name]
                            : cur.filter((n) => n !== name)
                        );
                        setDraft((d) => ({ ...d, store: null }));
                      }}
                    />
                    {name}
                  </label>
                ))}
                {configNames.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    No configs available.
                  </span>
                )}
              </div>
              {draftConfigs.length === 0 && configNames.length > 0 && (
                <span className="mt-1 block text-xs text-status-failed">
                  Select at least one config.
                </span>
              )}
            </div>
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
                // Reset filters and the config scope back to the default
                // single (first) program.
                const def = configNames.slice(0, 1);
                setDraft(EMPTY_FILTERS);
                setDraftConfigs(def);
                apply(EMPTY_FILTERS, def);
              }}
            >
              Clear filters
            </Button>
            <Button
              className="flex-1"
              disabled={draftConfigs.length === 0}
              onClick={() => {
                apply(draft, draftConfigs);
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
