"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock3, GripVertical, Mail, Phone, Search, UserRound } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { leadStatuses } from "@crm-pro-ai/database/crm";
import { Button } from "@crm-pro-ai/ui/button";
import { Input } from "@crm-pro-ai/ui/input";
import { cn } from "@crm-pro-ai/ui/utils";
import { updateLeadPipelineStatus } from "@/app/actions/crm";

export type PipelineLead = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  lastActivityAt: string;
  tags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
};

export type PipelineOwnerOption = {
  id: string;
  label: string;
};

const statusLabels: Record<(typeof leadStatuses)[number], string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  interesado: "Interesado",
  propuesta: "Propuesta",
  ganado: "Ganado",
  perdido: "Perdido"
};

const statusStyles: Record<(typeof leadStatuses)[number], string> = {
  nuevo: "border-t-sky-500",
  contactado: "border-t-amber-500",
  interesado: "border-t-violet-500",
  propuesta: "border-t-cyan-600",
  ganado: "border-t-emerald-600",
  perdido: "border-t-rose-500"
};

export function PipelineBoard({
  initialLeads,
  owners
}: {
  initialLeads: PipelineLead[];
  owners: PipelineOwnerOption[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");
  const [source, setSource] = useState("all");
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 }
    }),
  );

  const sources = useMemo(
    () =>
      Array.from(new Set(leads.map((lead) => lead.source).filter((value): value is string => Boolean(value)))).sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    [leads],
  );

  const ownerLabels = useMemo(() => new Map(owners.map((item) => [item.id, item.label])), [owners]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return leads.filter((lead) => {
      const searchable = [lead.first_name, lead.last_name, lead.email, lead.phone]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesOwner =
        owner === "all" || (owner === "unassigned" ? !lead.owner_id : lead.owner_id === owner);
      const matchesSource = source === "all" || (source === "unassigned" ? !lead.source : lead.source === source);
      return matchesQuery && matchesOwner && matchesSource;
    });
  }, [leads, owner, query, source]);

  async function moveLead(leadId: string, nextStatus: (typeof leadStatuses)[number]) {
    const current = leads.find((lead) => lead.id === leadId);
    if (!current || current.status === nextStatus || pendingIds.includes(leadId)) return;

    const previousStatus = current.status;
    setNotice(null);
    setPendingIds((ids) => [...ids, leadId]);
    setLeads((items) =>
      items.map((lead) =>
        lead.id === leadId
          ? { ...lead, status: nextStatus, updated_at: new Date().toISOString() }
          : lead,
      ),
    );

    try {
      const result = await updateLeadPipelineStatus({ id: leadId, status: nextStatus });
      if (!result.ok) {
        setLeads((items) =>
          items.map((lead) => (lead.id === leadId ? { ...lead, status: previousStatus } : lead)),
        );
        setNotice({ kind: "error", message: result.error });
        return;
      }

      setLeads((items) =>
        items.map((lead) => (lead.id === leadId ? { ...lead, updated_at: result.updatedAt } : lead)),
      );
      setNotice({
        kind: "success",
        message: `${fullName(current)} ahora esta en ${statusLabels[nextStatus]}.`
      });
    } catch {
      setLeads((items) =>
        items.map((lead) => (lead.id === leadId ? { ...lead, status: previousStatus } : lead)),
      );
      setNotice({ kind: "error", message: "La conexion fallo y el cambio fue revertido." });
    } finally {
      setPendingIds((ids) => ids.filter((id) => id !== leadId));
      setActiveLeadId(null);
    }
  }

  function clearFilters() {
    setQuery("");
    setOwner("all");
    setSource("all");
  }

  const filtersActive = Boolean(query || owner !== "all" || source !== "all");

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-md border bg-card p-3 md:grid-cols-[minmax(240px,1fr)_220px_220px_auto]">
        <label className="relative">
          <span className="sr-only">Buscar leads</span>
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="Buscar nombre, email o telefono"
          />
        </label>
        <label>
          <span className="sr-only">Filtrar por responsable</span>
          <select
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Todos los responsables</option>
            <option value="unassigned">Sin responsable</option>
            {owners.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por origen</span>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Todos los origenes</option>
            <option value="unassigned">Sin origen</option>
            {sources.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="outline" onClick={clearFilters} disabled={!filtersActive}>
          Limpiar
        </Button>
      </div>

      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={cn(
            "mb-4 rounded-md border px-4 py-3 text-sm",
            notice.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          {notice.message}
        </p>
      ) : null}

      <p className="mb-3 text-xs text-muted-foreground">
        {filteredLeads.length} de {leads.length} leads visibles
      </p>

      <DndContext
        sensors={sensors}
        onDragStart={(event: DragStartEvent) => setActiveLeadId(String(event.active.id))}
        onDragCancel={() => setActiveLeadId(null)}
        onDragEnd={(event: DragEndEvent) => {
          setActiveLeadId(null);
          if (!event.over) return;
          const status = String(event.over.id);
          if (leadStatuses.includes(status as (typeof leadStatuses)[number])) {
            void moveLead(String(event.active.id), status as (typeof leadStatuses)[number]);
          }
        }}
      >
        <div className="flex min-h-[36rem] gap-3 overflow-x-auto pb-4" data-testid="pipeline-board">
          {leadStatuses.map((status) => (
            <PipelineColumn
              key={status}
              status={status}
              leads={filteredLeads.filter((lead) => lead.status === status)}
              ownerLabels={ownerLabels}
              pendingIds={pendingIds}
              activeLeadId={activeLeadId}
              filtersActive={filtersActive}
              onStatusChange={moveLead}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function PipelineColumn({
  status,
  leads,
  ownerLabels,
  pendingIds,
  activeLeadId,
  filtersActive,
  onStatusChange
}: {
  status: (typeof leadStatuses)[number];
  leads: PipelineLead[];
  ownerLabels: Map<string, string>;
  pendingIds: string[];
  activeLeadId: string | null;
  filtersActive: boolean;
  onStatusChange: (leadId: string, status: (typeof leadStatuses)[number]) => Promise<void>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      data-testid={`pipeline-column-${status}`}
      className={cn(
        "min-w-72 flex-1 basis-72 rounded-md border border-t-4 bg-muted/40 p-2 transition-colors",
        statusStyles[status],
        isOver && "bg-primary/10 ring-2 ring-primary/30",
      )}
    >
      <header className="mb-2 flex h-9 items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{statusLabels[status]}</h2>
        <span className="inline-flex min-w-6 justify-center rounded-full bg-background px-2 py-1 text-xs">
          {leads.length}
        </span>
      </header>

      <div className="space-y-2">
        {leads.map((lead) => (
          <PipelineLeadCard
            key={lead.id}
            lead={lead}
            ownerLabel={lead.owner_id ? ownerLabels.get(lead.owner_id) : undefined}
            pending={pendingIds.includes(lead.id)}
            active={activeLeadId === lead.id}
            onStatusChange={onStatusChange}
          />
        ))}

        {leads.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed bg-background/50 px-4 text-center text-xs text-muted-foreground">
            {filtersActive ? "Sin coincidencias en esta etapa." : "Arrastra un lead a esta etapa."}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PipelineLeadCard({
  lead,
  ownerLabel,
  pending,
  active,
  onStatusChange
}: {
  lead: PipelineLead;
  ownerLabel?: string;
  pending: boolean;
  active: boolean;
  onStatusChange: (leadId: string, status: (typeof leadStatuses)[number]) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: lead.id,
    disabled: pending
  });

  return (
    <article
      ref={setNodeRef}
      data-testid={`pipeline-lead-${lead.id}`}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "relative z-0 rounded-md border bg-card p-3 shadow-sm transition-opacity",
        pending && "pointer-events-none opacity-60",
        active && "z-20 opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 inline-flex size-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
          aria-label={`Mover ${fullName(lead)}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-semibold hover:underline">
            {fullName(lead)}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.source ?? "Sin origen"}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="flex min-w-0 items-center gap-2">
          <Phone className="size-3.5 shrink-0" />
          <span className="truncate">{lead.phone ?? "Sin telefono"}</span>
        </p>
        <p className="flex min-w-0 items-center gap-2">
          <Mail className="size-3.5 shrink-0" />
          <span className="truncate">{lead.email ?? "Sin email"}</span>
        </p>
        <p className="flex min-w-0 items-center gap-2">
          <UserRound className="size-3.5 shrink-0" />
          <span className="truncate">
            {lead.owner_id ? ownerLabel ?? lead.owner_id.slice(0, 8) : "Sin asignar"}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <Clock3 className="size-3.5 shrink-0" />
          <span>{formatActivity(lead.lastActivityAt)}</span>
        </p>
      </div>

      {lead.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((tag) => (
            <span key={tag.id} className="inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
              <span className="truncate">{tag.name}</span>
            </span>
          ))}
          {lead.tags.length > 3 ? (
            <span className="rounded-md border px-1.5 py-0.5 text-[11px]">+{lead.tags.length - 3}</span>
          ) : null}
        </div>
      ) : null}

      <label className="mt-3 block">
        <span className="sr-only">Cambiar estado de {fullName(lead)}</span>
        <select
          value={lead.status}
          disabled={pending}
          onChange={(event) =>
            void onStatusChange(lead.id, event.target.value as (typeof leadStatuses)[number])
          }
          className="h-8 w-full rounded-md border bg-background px-2 text-xs"
        >
          {leadStatuses.map((option) => (
            <option key={option} value={option}>
              {statusLabels[option]}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function fullName(lead: Pick<PipelineLead, "first_name" | "last_name">) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ");
}

function formatActivity(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
