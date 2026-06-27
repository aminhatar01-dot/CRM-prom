import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { AssistantForm } from "../_components/assistant-form";

export default function NewAssistantPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuracion del Agente</CardTitle>
        </CardHeader>
        <CardContent>
          <AssistantForm />
        </CardContent>
      </Card>
    </section>
  );
}
