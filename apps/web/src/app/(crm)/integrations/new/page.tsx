import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { CustomConnectForm } from "../_components/custom-connect-form";

export default function NewIntegrationPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo Custom Connect</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomConnectForm />
        </CardContent>
      </Card>
    </section>
  );
}
