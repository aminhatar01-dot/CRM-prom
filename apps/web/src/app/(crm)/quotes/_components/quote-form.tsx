"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { createQuote, updateQuote } from "@/app/actions/quotes";
import { SubmitButton } from "../../_components/submit-button";

type Item = { name: string; description: string; sku: string; quantity: number; unit_price: number; currency: string; discount_amount: number; stock: string; availability: string };
type QuoteData = { id: string; customer_name: string; customer_phone: string | null; status: string; currency: string; tax_total: number; expires_at: string | null; internal_notes: string | null; commercial_terms: string | null; lead_id: string | null; contact_id: string | null; conversation_id: string | null; items: Item[] };
const emptyItem = (currency: string): Item => ({ name: "", description: "", sku: "", quantity: 1, unit_price: 0, currency, discount_amount: 0, stock: "", availability: "" });

export function QuoteForm({ quote }: { quote?: QuoteData }) {
  const [currency, setCurrency] = useState(quote?.currency ?? "ARS");
  const [items, setItems] = useState<Item[]>(quote?.items?.length ? quote.items : [emptyItem(currency)]);
  const updateItem = (index: number, field: keyof Item, value: string) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: ["quantity", "unit_price", "discount_amount"].includes(field) ? Number(value) : value } : item));
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price - item.discount_amount, 0);
  return (
    <form action={quote ? updateQuote : createQuote} className="space-y-6">
      {quote ? <input type="hidden" name="id" value={quote.id} /> : null}
      <input type="hidden" name="lead_id" value={quote?.lead_id ?? ""} /><input type="hidden" name="contact_id" value={quote?.contact_id ?? ""} /><input type="hidden" name="conversation_id" value={quote?.conversation_id ?? ""} />
      <input type="hidden" name="items_json" value={JSON.stringify(items.map((item) => ({ ...item, currency })))} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Cliente" name="customer_name" defaultValue={quote?.customer_name} required />
        <Field label="Telefono" name="customer_phone" defaultValue={quote?.customer_phone ?? ""} />
        <div className="space-y-2"><Label htmlFor="status">Estado</Label><select id="status" name="status" defaultValue={quote?.status ?? "draft"} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="draft">Borrador</option><option value="pending_approval">Pendiente de aprobacion</option><option value="sent">Enviada</option><option value="accepted">Aceptada</option><option value="rejected">Rechazada</option><option value="expired">Vencida</option><option value="cancelled">Cancelada</option></select></div>
        <div className="space-y-2"><Label htmlFor="currency">Moneda</Label><Input id="currency" name="currency" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase().slice(0, 3))} pattern="[A-Z]{3}" required /></div>
        <Field label="Impuestos" name="tax_total" type="number" defaultValue={String(quote?.tax_total ?? 0)} min="0" step="0.01" />
        <Field label="Vencimiento" name="expires_at" type="datetime-local" defaultValue={quote?.expires_at?.slice(0, 16) ?? ""} />
      </div>
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Items</h2><Button type="button" size="sm" variant="outline" onClick={() => setItems((current) => [...current, emptyItem(currency)])}><Plus className="size-4" />Agregar</Button></div>
        {items.map((item, index) => <div key={index} className="grid gap-3 rounded-md border p-4 lg:grid-cols-12">
          <div className="space-y-1 lg:col-span-4"><Label>Producto o servicio</Label><Input value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} required /></div>
          <div className="space-y-1 lg:col-span-2"><Label>SKU</Label><Input value={item.sku} onChange={(event) => updateItem(index, "sku", event.target.value)} /></div>
          <div className="space-y-1 lg:col-span-2"><Label>Cantidad</Label><Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} required /></div>
          <div className="space-y-1 lg:col-span-2"><Label>Precio unitario</Label><Input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(index, "unit_price", event.target.value)} required /></div>
          <div className="space-y-1 lg:col-span-1"><Label>Desc.</Label><Input type="number" min="0" step="0.01" value={item.discount_amount} onChange={(event) => updateItem(index, "discount_amount", event.target.value)} /></div>
          <div className="flex items-end lg:col-span-1"><Button type="button" variant="outline" size="sm" title="Quitar item" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button></div>
          <div className="space-y-1 lg:col-span-5"><Label>Descripcion</Label><Input value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} /></div>
          <div className="space-y-1 lg:col-span-3"><Label>Stock</Label><Input value={item.stock} onChange={(event) => updateItem(index, "stock", event.target.value)} /></div>
          <div className="space-y-1 lg:col-span-4"><Label>Disponibilidad</Label><Input value={item.availability} onChange={(event) => updateItem(index, "availability", event.target.value)} /></div>
        </div>)}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <Area label="Condiciones comerciales" name="commercial_terms" defaultValue={quote?.commercial_terms ?? ""} />
        <Area label="Notas internas" name="internal_notes" defaultValue={quote?.internal_notes ?? ""} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-lg font-semibold">Total estimado: {new Intl.NumberFormat("es-AR", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "ARS" }).format(Math.max(0, subtotal))}</p><SubmitButton>{quote ? "Guardar cotizacion" : "Crear cotizacion"}</SubmitButton></div>
    </form>
  );
}

function Field({ label, name, defaultValue = "", ...props }: { label: string; name: string; defaultValue?: string; [key: string]: unknown }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} defaultValue={defaultValue} {...props} /></div>; }
function Area({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><textarea id={name} name={name} defaultValue={defaultValue} maxLength={4000} className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm" /></div>; }
