import { LegalLayout } from "../_components/legal-layout";

export default function TermsPage() {
  return (
    <LegalLayout title="Terminos y Condiciones de Uso" lastUpdated="30 de junio de 2026">
      <section>
        <h2 className="text-lg font-semibold">1. Aceptacion de los terminos</h2>
        <p>Al acceder o utilizar CRM PRO AI (el &quot;Servicio&quot;), usted acepta estar vinculado por estos Terminos y Condiciones. Si no esta de acuerdo con alguna parte de estos terminos, no podra acceder al Servicio.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. Descripcion del servicio</h2>
        <p>CRM PRO AI es una plataforma de gestion de relaciones con clientes (CRM) con capacidades de inteligencia artificial. El Servicio permite a las organizaciones gestionar contactos, leads, conversaciones y automatizaciones comerciales.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">3. Cuentas y responsabilidad del usuario</h2>
        <p>Al crear una cuenta, el usuario es responsable de mantener la confidencialidad de sus credenciales. La organizacion es responsable de todas las actividades realizadas bajo su cuenta. Cada organizacion opera de forma aislada (multi-tenant) y no puede acceder a datos de otras organizaciones.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">4. Uso aceptable</h2>
        <p>El usuario se compromete a no utilizar el Servicio para:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Enviar comunicaciones no solicitadas (spam).</li>
          <li>Almacenar datos obtenidos de forma ilicita.</li>
          <li>Violar derechos de privacidad de terceros.</li>
          <li>Intentar acceder a datos de otras organizaciones.</li>
          <li>Reverse engineering o extraccion no autorizada de datos.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">5. Inteligencia artificial</h2>
        <p>El Servicio utiliza modelos de inteligencia artificial de terceros (incluyendo OpenAI) para procesar conversaciones y generar respuestas. El usuario acepta que el contenido puede ser procesado por dichos servicios de conformidad con sus propias politicas. CRM PRO AI no garantiza la precision, completitud o idoneidad de las respuestas generadas por IA.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">6. Datos y privacidad</h2>
        <p>El tratamiento de datos personales se rige por nuestra Politica de Privacidad y el Acuerdo de Tratamiento de Datos (DPA). El usuario es el responsable del tratamiento de los datos de sus clientes que ingresa al sistema.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">7. Propiedad intelectual</h2>
        <p>El Servicio, incluyendo su codigo, diseno y documentacion, es propiedad de CRM PRO AI y esta protegido por leyes de propiedad intelectual. Los datos ingresados por el usuario son propiedad del usuario.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">8. Limitacion de responsabilidad</h2>
        <p>En la maxima medida permitida por la ley aplicable, CRM PRO AI no sera responsable por danos indirectos, incidentales, especiales o consecuentes derivados del uso o imposibilidad de uso del Servicio.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">9. Modificaciones</h2>
        <p>Nos reservamos el derecho de modificar estos terminos en cualquier momento. Los cambios seran notificados con al menos 15 dias de anticipacion. El uso continuado del Servicio tras dicho periodo constituye aceptacion de los nuevos terminos.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">10. Ley aplicable</h2>
        <p>Estos terminos se rigen por las leyes de la Republica Argentina. Cualquier disputa sera sometida a la jurisdiccion de los tribunales ordinarios de la Ciudad Autonoma de Buenos Aires.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">11. Contacto</h2>
        <p>Para consultas sobre estos terminos: <strong>legal@crm-pro-ai.com</strong></p>
      </section>
    </LegalLayout>
  );
}
