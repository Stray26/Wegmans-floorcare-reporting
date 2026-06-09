import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createTicket, getTicketTags, MOCK_MODE } from "@/api/smartInspectClient";
import { CHECK_AREAS, DEFICIENCY_ATTRIBUTES } from "@/config/wegmans";
import type { StoreMeta } from "@/api/reportingTransforms";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const selectCls =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CreateTicketDialog({
  stores,
  defaultStore,
}: {
  stores: StoreMeta[];
  defaultStore?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const [storeName, setStoreName] = React.useState(
    defaultStore ?? stores[0]?.storeName ?? ""
  );
  const [areaName, setAreaName] = React.useState(CHECK_AREAS[0].label);
  const [deficiency, setDeficiency] = React.useState(
    DEFICIENCY_ATTRIBUTES[0].label
  );
  const [priorityId, setPriorityId] = React.useState<number | undefined>();
  const [note, setNote] = React.useState("");

  const { data: tags } = useQuery({
    queryKey: ["ticket-tags"],
    queryFn: getTicketTags,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createTicket({ storeName, areaName, deficiency, note, priorityId }),
    onSuccess: (res) => {
      toast({
        title: "Ticket created",
        description: `${res.ticketId} · ${deficiency} in ${areaName} @ ${storeName}`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setOpen(false);
      setNote("");
    },
    onError: (err) => {
      toast({
        title: "Couldn’t create ticket",
        description: (err as Error)?.message ?? "Unknown error",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Create Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>Create Ticket</DialogTitle>
            <DialogDescription>
              {MOCK_MODE
                ? "Mock mode — this won’t write to Smart Inspect."
                : "This creates a ticket in Smart Inspect."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <Field label="Store">
              <select
                className={selectCls}
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              >
                {stores.map((s) => (
                  <option key={s.buildingId} value={s.storeName}>
                    {s.storeName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Check Area">
              <select
                className={selectCls}
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
              >
                {CHECK_AREAS.map((ca) => (
                  <option key={ca.id} value={ca.label}>
                    {ca.label.split("/")[0].trim()}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Deficiency">
              <select
                className={selectCls}
                value={deficiency}
                onChange={(e) => setDeficiency(e.target.value)}
              >
                {DEFICIENCY_ATTRIBUTES.map((d) => (
                  <option key={d.id} value={d.label}>
                    {d.label.split("/")[0].trim()}
                  </option>
                ))}
              </select>
            </Field>

            {tags?.priorities && tags.priorities.length > 0 && (
              <Field label="Priority">
                <select
                  className={selectCls}
                  value={priorityId ?? ""}
                  onChange={(e) =>
                    setPriorityId(
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                >
                  <option value="">Default</option>
                  {tags.priorities.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.description}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Note (optional)">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context for the assignee…"
              />
            </Field>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !storeName}
            >
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create Ticket
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
