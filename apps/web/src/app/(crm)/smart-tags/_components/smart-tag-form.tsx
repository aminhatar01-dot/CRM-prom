import { Button } from "@crm-pro-ai/ui/button";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { createSmartTag, updateSmartTag } from "@/app/actions/smart-tags";

type SmartTag = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  classification_prompt: string | null;
  active: boolean;
  auto_pause_assistant: boolean;
  notify_team: boolean;
};

export function SmartTagForm({ tag }: { tag?: SmartTag }) {
  const action = tag ? updateSmartTag : createSmartTag;

  return (
    <form action={action} className="grid gap-5">
      {tag ? <input type="hidden" name="id" value={tag.id} /> : null}
      <div className="grid gap-4 md:grid-cols-[1fr_120px]">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" defaultValue={tag?.name ?? ""} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input id="color" name="color" type="color" defaultValue={tag?.color ?? "#0f766e"} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripcion</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={tag?.description ?? ""}
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="classification_prompt">Prompt de clasificacion</Label>
        <textarea
          id="classification_prompt"
          name="classification_prompt"
          defaultValue={tag?.classification_prompt ?? ""}
          required
          className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-3 text-sm md:grid-cols-3">
        <label className="flex items-center gap-2">
          <input name="active" type="checkbox" defaultChecked={tag?.active ?? true} />
          Activo
        </label>
        <label className="flex items-center gap-2">
          <input name="auto_pause_assistant" type="checkbox" defaultChecked={tag?.auto_pause_assistant ?? false} />
          Pausar IA
        </label>
        <label className="flex items-center gap-2">
          <input name="notify_team" type="checkbox" defaultChecked={tag?.notify_team ?? false} />
          Notificar equipo
        </label>
      </div>
      <Button type="submit">{tag ? "Guardar cambios" : "Crear Smart Tag"}</Button>
    </form>
  );
}
