import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { SmartTagForm } from "../_components/smart-tag-form";

export default function NewSmartTagPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Crear Smart Tag</CardTitle>
        </CardHeader>
        <CardContent>
          <SmartTagForm />
        </CardContent>
      </Card>
    </section>
  );
}
