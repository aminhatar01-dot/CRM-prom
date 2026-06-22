import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { KnowledgeForm } from "../_components/knowledge-form";

export default function NewKnowledgeDocumentPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Crear documento</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeForm />
        </CardContent>
      </Card>
    </section>
  );
}

