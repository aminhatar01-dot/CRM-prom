import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { VariableForm } from "../_components/variable-form";

export default function NewVariablePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Crear variable</CardTitle>
        </CardHeader>
        <CardContent>
          <VariableForm />
        </CardContent>
      </Card>
    </section>
  );
}
