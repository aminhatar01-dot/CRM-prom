import { LegalLayout } from "../_components/legal-layout";

export default function DataProcessingPage() {
  return (
    <LegalLayout title="Acuerdo de Tratamiento de Datos (DPA)" lastUpdated="30 de junio de 2026">
      <section>
        <h2 className="text-lg font-semibold">1. Objeto del acuerdo</h2>
        <p>Este Acuerdo de Tratamiento de Datos (DPA) complementa los Terminos y Condiciones y regula el tratamiento de datos personales de clientes finales que las organizaciones usuarias (el &quot;Responsable&quot;) ingresan en CRM PRO AI (el &quot;Encargado&quot;). Este acuerdo es necesario cuando el Responsable trata datos personales de ciudadanos de jurisdicciones con legislacion de proteccion de datos (LGPD, GDPR, LPDP Argentina, etc.).</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. Roles y responsabilidades</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Responsable:</strong> La organizacion usuaria que determina los fines y medios del tratamiento de datos de sus clientes.</li>
          <li><strong>Encargado:</strong> CRM PRO AI, que trata los datos en nombre y siguiendo las instrucciones del Responsable.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">3. Datos tratados</h2>
        <p>Los datos tratados en nombre del Responsable incluyen: nombres, emails, telefonos, companias, contenido de conversaciones, documentos y cualquier otro dato que el Responsable ingrese al sistema. CRM PRO AI no trata estos datos para fines propios distintos a la prestacion del Servicio.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">4. Subencargados</h2>
        <p>CRM PRO AI utiliza los siguientes subencargados principales:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Supabase Inc.</strong> — Base de datos e infraestructura.</li>
          <li><strong>OpenAI, L.L.C.</strong> — Procesamiento de IA (cuando el usuario ha otorgado consentimiento de IA).</li>
          <li><strong>Vercel Inc.</strong> — Hosting de la aplicacion.</li>
          <li><strong>Meta Platforms, Inc.</strong> — API de WhatsApp Cloud (cuando el canal esta activo).</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">5. Medidas de seguridad</h2>
        <p>CRM PRO AI implementa las siguientes medidas tecnicas y organizativas:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Cifrado en transito (TLS 1.2+) y en reposo.</li>
          <li>Aislamiento multi-tenant con Row Level Security (RLS) en PostgreSQL.</li>
          <li>Autenticacion segura con Supabase Auth.</li>
          <li>Logs de auditoria inmutables para acciones criticas.</li>
          <li>Tokens OAuth cifrados con AES-256-GCM.</li>
          <li>Rate limiting distribuido para prevenir abuso.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">6. Derechos del interesado</h2>
        <p>El Responsable es responsable de atender las solicitudes de los interesados (titulares de datos). CRM PRO AI proporciona herramientas para facilitar el cumplimiento:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Exportacion de datos del titular desde la plataforma.</li>
          <li>Anonimizacion de contactos especificos.</li>
          <li>Eliminacion de datos con auditoria.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">7. Violaciones de seguridad</h2>
        <p>En caso de violacion de seguridad que afecte datos tratados en nombre del Responsable, CRM PRO AI notificara al Responsable sin demora injustificada, en un plazo maximo de 72 horas desde que tenga conocimiento de la misma.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">8. Transferencias internacionales</h2>
        <p>Los datos pueden ser transferidos a paises fuera del Espacio Economico Europeo o Argentina. CRM PRO AI garantiza que dichas transferencias se realizan con salvaguardas adecuadas (Clausulas Contractuales Estandar u otros mecanismos aprobados).</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">9. Duracion y terminacion</h2>
        <p>Este DPA es valido durante la vigencia de la relacion contractual. Tras la terminacion, los datos seran eliminados o devueltos segun lo solicitado, conservando unicamente lo requerido por ley.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">10. Contacto DPA</h2>
        <p>Para consultas sobre el tratamiento de datos: <strong>dpa@crm-pro-ai.com</strong></p>
      </section>
    </LegalLayout>
  );
}
