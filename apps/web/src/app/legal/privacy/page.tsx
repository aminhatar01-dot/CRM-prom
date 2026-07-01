import { LegalLayout } from "../_components/legal-layout";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Politica de Privacidad" lastUpdated="30 de junio de 2026">
      <section>
        <h2 className="text-lg font-semibold">1. Responsable del tratamiento</h2>
        <p>CRM PRO AI es el responsable del tratamiento de los datos personales de sus usuarios. Los datos de los clientes finales ingresados por las organizaciones usuarias son responsabilidad de dichas organizaciones (responsables independientes del tratamiento).</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. Datos que recopilamos</h2>
        <p>Recopilamos los siguientes tipos de datos:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Datos de cuenta:</strong> nombre, email, organizacion, rol.</li>
          <li><strong>Datos de uso:</strong> acciones en la plataforma, conversaciones gestionadas, metricas de uso de IA.</li>
          <li><strong>Datos tecnicos:</strong> direccion IP, agente de usuario, logs de acceso.</li>
          <li><strong>Datos ingresados por el usuario:</strong> contactos, leads, conversaciones, documentos de conocimiento.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">3. Finalidades del tratamiento</h2>
        <p>Tratamos sus datos para:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Prestar y mejorar el Servicio.</li>
          <li>Autenticar usuarios y gestionar cuentas.</li>
          <li>Procesar pagos y facturacion.</li>
          <li>Detectar y prevenir fraudes o usos indebidos.</li>
          <li>Cumplir obligaciones legales.</li>
          <li>Enviar comunicaciones operativas (no publicitarias sin consentimiento).</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">4. Procesamiento con IA</h2>
        <p>El Servicio utiliza modelos de inteligencia artificial para procesar el contenido de conversaciones. Los datos pueden ser enviados a proveedores de IA (OpenAI) como parte del procesamiento. Consulte la politica de privacidad de dichos proveedores para entender como gestionan los datos. El usuario puede revocar el consentimiento de IA desde <strong>Configuracion &gt; Privacidad y datos</strong>.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">5. Transferencia de datos</h2>
        <p>Sus datos pueden ser procesados en servidores ubicados fuera de su pais de residencia. Tomamos medidas para garantizar un nivel adecuado de proteccion, incluyendo el uso de clausulas contractuales estandar cuando corresponde.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">6. Conservacion de datos</h2>
        <p>Conservamos sus datos mientras mantenga una cuenta activa y por el periodo necesario para cumplir obligaciones legales. Los logs de auditoría y registros financieros se conservan por el minimo legal aplicable aun tras la cancelacion de la cuenta.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">7. Sus derechos</h2>
        <p>Tiene derecho a:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Acceder, rectificar y suprimir sus datos.</li>
          <li>Portabilidad de datos (exportacion).</li>
          <li>Oposicion al tratamiento.</li>
          <li>Limitacion del tratamiento.</li>
        </ul>
        <p>Puede ejercer estos derechos desde <strong>Configuracion &gt; Privacidad y datos</strong> o escribiendo a <strong>privacidad@crm-pro-ai.com</strong>.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">8. Cookies</h2>
        <p>Utilizamos cookies esenciales para el funcionamiento del Servicio. Consulte nuestra Politica de Cookies para mas detalle.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">9. Contacto y reclamaciones</h2>
        <p>Para ejercer sus derechos o presentar reclamaciones: <strong>privacidad@crm-pro-ai.com</strong>. Si no recibe respuesta satisfactoria, puede acudir a la autoridad de proteccion de datos de su pais.</p>
      </section>
    </LegalLayout>
  );
}
