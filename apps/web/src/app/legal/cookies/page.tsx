import { LegalLayout } from "../_components/legal-layout";

export default function CookiesPage() {
  return (
    <LegalLayout title="Politica de Cookies" lastUpdated="30 de junio de 2026">
      <section>
        <h2 className="text-lg font-semibold">1. Que son las cookies</h2>
        <p>Las cookies son pequeños archivos de texto que se almacenan en su navegador cuando visita un sitio web. Nos permiten recordar sus preferencias y mantener su sesion activa.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. Cookies que utilizamos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium">Cookie</th>
                <th className="text-left py-2 pr-4 font-medium">Tipo</th>
                <th className="text-left py-2 font-medium">Proposito</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 pr-4 font-mono text-xs">sb-*</td>
                <td className="py-2 pr-4">Esencial</td>
                <td className="py-2">Sesion de autenticacion (Supabase)</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 font-mono text-xs">cookie_consent</td>
                <td className="py-2 pr-4">Esencial</td>
                <td className="py-2">Registro de consentimiento de cookies</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 font-mono text-xs">__next_*</td>
                <td className="py-2 pr-4">Esencial</td>
                <td className="py-2">Funcionamiento de la aplicacion (Next.js)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3">No utilizamos cookies de seguimiento publicitario ni de analytics de terceros sin su consentimiento explicito.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">3. Cookies de terceros</h2>
        <p>El Servicio puede cargar recursos de terceros (Meta/Facebook para el Widget de WhatsApp Embedded Signup) que pueden establecer sus propias cookies. Consulte las politicas de dichos terceros.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">4. Gestion de cookies</h2>
        <p>Puede gestionar o eliminar cookies desde la configuracion de su navegador. La desactivacion de cookies esenciales puede impedir el correcto funcionamiento del Servicio.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">5. Analytics futuro</h2>
        <p>En el futuro podemos incorporar herramientas de analytics (como Plausible o similares). Solo se activaran con su consentimiento explicito y seran notificadas con actualizacion de esta politica.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">6. Contacto</h2>
        <p>Consultas sobre cookies: <strong>privacidad@crm-pro-ai.com</strong></p>
      </section>
    </LegalLayout>
  );
}
