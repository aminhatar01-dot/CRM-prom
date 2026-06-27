import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { createKnowledgeImport } from "@/app/actions/knowledge";
import { SubmitButton } from "../../_components/submit-button";

export default async function KnowledgeImportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-4">
        <Button asChild variant="outline" size="sm"><Link href="/knowledge"><ArrowLeft className="size-4" />Volver</Link></Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Importar conocimiento</CardTitle></CardHeader>
        <CardContent>
          <form action={createKnowledgeImport} encType="multipart/form-data" className="space-y-6">
            {query.error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">No se pudo importar la fuente. Revisa tipo, acceso, tamaño y columnas.</p> : null}
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Nombre de la fuente" name="name" required />
              <div className="space-y-2"><Label htmlFor="source_type">Tipo</Label><select id="source_type" name="source_type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="csv"><option value="csv">CSV</option><option value="xlsx">Excel XLSX</option><option value="pdf">PDF</option><option value="docx">Word DOCX</option><option value="txt">Texto TXT</option><option value="google_sheets">Google Sheets publico</option><option value="url">URL publica</option></select></div>
              <Field label="Categoria" name="category" defaultValue="general" required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="file">Archivo</Label><Input id="file" name="file" type="file" accept=".csv,.xlsx,.pdf,.docx,.txt" /><p className="text-xs text-muted-foreground">Maximo 10 MB. No se permiten macros ni ejecutables.</p></div>
              <Field label="URL publica o Google Sheets" name="source_url" placeholder="https://..." />
            </div>
            <div className="space-y-3 border-t pt-5">
              <div><h2 className="text-sm font-semibold">Mapeo opcional para CSV/Excel</h2><p className="text-xs text-muted-foreground">Dejalo vacio para detectar columnas automaticamente. Escribe el encabezado exacto cuando necesites corregir el mapeo.</p></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[['product','Producto'],['service','Servicio'],['price','Precio'],['stock','Stock'],['category','Categoria'],['description','Descripcion'],['code','Codigo'],['sku','SKU'],['currency','Moneda'],['availability','Disponibilidad']].map(([name,label]) => <Field key={name} label={label} name={`column_${name}`} />)}
              </div>
            </div>
            <SubmitButton><Upload className="mr-2 size-4" />Importar e indexar</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

function Field({ label, name, defaultValue, placeholder, required = false }: { label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} required={required} /></div>;
}
