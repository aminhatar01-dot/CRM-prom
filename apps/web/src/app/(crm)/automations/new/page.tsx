import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { AutomationForm } from "../_components/automation-form";

export default function NewAutomationPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Nueva automatizacion</CardTitle>
        </CardHeader>
        <CardContent>
          <AutomationForm />
        </CardContent>
      </Card>
    </section>
  );
}
