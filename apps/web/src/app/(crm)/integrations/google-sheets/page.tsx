import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { setupGoogleSheets } from "@/app/actions/integrations";

export default function GoogleSheetsSetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  void searchParams;

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Google Sheets MVP</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={setupGoogleSheets} className="grid gap-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" defaultValue="Google Sheets Demo" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripcion</Label>
              <Input id="description" name="description" defaultValue="Busqueda simple de filas publicas." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spreadsheet_url">URL publica o demo</Label>
              <Input id="spreadsheet_url" name="spreadsheet_url" defaultValue="demo://leads" required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sheet_name">Sheet name</Label>
                <Input id="sheet_name" name="sheet_name" placeholder="Hoja 1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_key_ref">API key ref</Label>
                <Input id="api_key_ref" name="api_key_ref" placeholder="env:GOOGLE_SHEETS_API_KEY" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="active" type="checkbox" defaultChecked />
              Activa
            </label>
            <Button type="submit">Guardar Google Sheets</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
