import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import {
  createKnowledgeDocument,
  updateKnowledgeDocument
} from "@/app/actions/knowledge";
import { SubmitButton } from "../../_components/submit-button";

type KnowledgeDocument = {
  id: string;
  title: string;
  content: string;
  category: string;
  active: boolean;
};

export function KnowledgeForm({ document }: { document?: KnowledgeDocument }) {
  return (
    <form action={document ? updateKnowledgeDocument : createKnowledgeDocument} className="grid gap-5">
      {document ? <input type="hidden" name="id" value={document.id} /> : null}
      <div className="grid gap-4 md:grid-cols-[1fr_240px]">
        <div className="space-y-2">
          <Label htmlFor="title">Titulo</Label>
          <Input id="title" name="title" defaultValue={document?.title ?? ""} required minLength={2} maxLength={160} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
          <Input id="category" name="category" defaultValue={document?.category ?? "general"} required minLength={2} maxLength={80} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="content">Contenido</Label>
        <textarea
          id="content"
          name="content"
          defaultValue={document?.content ?? ""}
          required
          minLength={20}
          maxLength={100000}
          className="min-h-[360px] w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Productos, servicios, precios, politicas, preguntas frecuentes y cualquier dato que el asistente pueda citar."
        />
        <p className="text-xs text-muted-foreground">
          El contenido se divide e indexa en el servidor. La carga PDF, DOCX y TXT queda preparada en el esquema para una fase futura.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={document?.active ?? true} />
        Disponible para respuestas IA
      </label>
      <SubmitButton>{document ? "Guardar e indexar" : "Crear e indexar"}</SubmitButton>
    </form>
  );
}

