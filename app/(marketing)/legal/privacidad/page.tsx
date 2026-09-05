import Link from "next/link";
import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";
import { INFO_LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Cómo ARCA recopila, usa, comparte, protege y conserva los datos personales, y qué derechos tienes sobre ellos.",
};

export default function PrivacidadPage() {
  return (
    <LegalShell slug="privacidad">
      <p>
        En <strong>{INFO_LEGAL.marca}</strong> respetamos tu privacidad. Esta Política explica
        qué datos personales tratamos, con qué finalidad y base legal, con quién los compartimos,
        cuánto los conservamos, cómo los protegemos y qué derechos tienes. Aplica a nuestro sitio
        web y a la plataforma {INFO_LEGAL.marca}.
      </p>

      <div className="legal-nota">
        <strong>Dos roles distintos.</strong> Actuamos como{" "}
        <strong>Responsable del tratamiento</strong> respecto de los datos de nuestros clientes,
        prospectos y visitantes (los descritos aquí). Respecto de los datos personales de{" "}
        <em>tus</em> clientes, empleados o proveedores que cargas en la Plataforma, actuamos como{" "}
        <strong>Encargado</strong> que trata datos por tu cuenta: eso se rige por el{" "}
        <Link href="/legal/tratamiento-datos">Acuerdo de Tratamiento de Datos</Link>.
      </div>

      <h2 id="responsable">1. Responsable del tratamiento</h2>
      <p>
        {INFO_LEGAL.proveedor}, con domicilio en {INFO_LEGAL.direccion}, es responsable del
        tratamiento descrito en esta Política. Para asuntos de privacidad puedes escribirnos a{" "}
        <a href={`mailto:${INFO_LEGAL.correoPrivacidad}`}>{INFO_LEGAL.correoPrivacidad}</a>.
      </p>

      <h2 id="datos">2. Datos que tratamos</h2>
      <ul>
        <li>
          <strong>Datos de registro y cuenta:</strong> nombre, correo electrónico, teléfono,
          nombre y datos de la empresa, país, cargo y credenciales de acceso.
        </li>
        <li>
          <strong>Datos de facturación:</strong> plan contratado, historial de pagos y datos
          necesarios para emitir comprobantes. Los datos completos de tarjetas los procesa un
          proveedor de pagos; {INFO_LEGAL.marca} no los almacena.
        </li>
        <li>
          <strong>Datos de uso y técnicos:</strong> dirección IP, tipo de dispositivo y navegador,
          páginas visitadas, acciones dentro de la Plataforma, registros de eventos (logs) y datos
          recabados mediante cookies y tecnologías similares.
        </li>
        <li>
          <strong>Datos de soporte y comunicación:</strong> el contenido de tus consultas,
          solicitudes de soporte y comunicaciones con nosotros.
        </li>
        <li>
          <strong>Datos de prospectos:</strong> información que nos facilitas al solicitar una
          demostración, suscribirte a comunicaciones o contactarnos.
        </li>
      </ul>
      <p>
        No solicitamos datos sensibles para prestar el Servicio y te pedimos no cargarlos salvo
        que sea estrictamente necesario y cuentes con base legal para ello.
      </p>

      <h2 id="finalidades">3. Finalidades y bases legales</h2>
      <div className="legal-tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Finalidad</th>
              <th>Base legal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Crear y administrar tu cuenta y prestarte el Servicio</td>
              <td>Ejecución del contrato</td>
            </tr>
            <tr>
              <td>Procesar pagos, facturación y control de morosidad</td>
              <td>Ejecución del contrato / obligación legal</td>
            </tr>
            <tr>
              <td>Brindar soporte y responder tus consultas</td>
              <td>Ejecución del contrato / interés legítimo</td>
            </tr>
            <tr>
              <td>Seguridad, prevención de fraude y auditoría</td>
              <td>Interés legítimo / obligación legal</td>
            </tr>
            <tr>
              <td>Mejorar y desarrollar la Plataforma (métricas agregadas)</td>
              <td>Interés legítimo</td>
            </tr>
            <tr>
              <td>Enviarte comunicaciones comerciales o novedades</td>
              <td>Consentimiento (revocable en cualquier momento)</td>
            </tr>
            <tr>
              <td>Cumplir obligaciones contables, fiscales y regulatorias</td>
              <td>Obligación legal</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="ia">4. Tratamiento mediante inteligencia artificial</h2>
      <p>
        Algunas funciones utilizan procesamiento asistido por inteligencia artificial. Cuando así
        sea, los datos se tratan conforme a esta Política y a nuestra{" "}
        <Link href="/legal/inteligencia-artificial">Política de Inteligencia Artificial</Link>. No
        utilizamos tus datos personales ni los Datos del Cliente para entrenar modelos de terceros
        de acceso público sin una base legal y las salvaguardas adecuadas.
      </p>

      <h2 id="cookies">5. Cookies y tecnologías similares</h2>
      <p>
        Usamos cookies necesarias para operar el sitio y la Plataforma y, con tu consentimiento,
        cookies de medición. Los detalles y opciones de gestión están en el{" "}
        <Link href="/legal/cookies">Aviso de Cookies</Link>.
      </p>

      <h2 id="comparticion">6. Con quién compartimos datos</h2>
      <p>No vendemos tus datos personales. Podemos compartirlos con:</p>
      <ul>
        <li>
          <strong>Proveedores de infraestructura y servicios (encargados):</strong> alojamiento en
          la nube, base de datos, envío de correos transaccionales, analítica, atención al cliente
          y procesamiento de pagos, que tratan los datos por nuestra cuenta bajo obligaciones de
          confidencialidad y seguridad.
        </li>
        <li>
          <strong>Autoridades competentes:</strong> cuando lo exija la ley o un requerimiento
          válido, o para proteger derechos, seguridad y prevención de fraude.
        </li>
        <li>
          <strong>Operaciones corporativas:</strong> en el marco de una fusión, adquisición o venta
          de activos, informándote cuando corresponda.
        </li>
      </ul>
      <p>
        Puedes solicitar la lista vigente de nuestros principales proveedores (subencargados)
        escribiendo a <a href={`mailto:${INFO_LEGAL.correoPrivacidad}`}>{INFO_LEGAL.correoPrivacidad}</a>.
      </p>

      <h2 id="transferencias">7. Transferencias internacionales</h2>
      <p>
        La Plataforma opera en la nube y algunos proveedores pueden estar ubicados fuera de tu
        país. Cuando transferimos datos a otras jurisdicciones, adoptamos salvaguardas razonables
        —contractuales y técnicas— para que tus datos mantengan un nivel de protección adecuado,
        conforme a la legislación de protección de datos aplicable.
      </p>

      <h2 id="conservacion">8. Conservación</h2>
      <p>
        Conservamos los datos mientras tu cuenta esté activa y durante el tiempo necesario para
        cumplir las finalidades descritas, atender responsabilidades legales, contables y fiscales,
        y resolver disputas. Vencidos esos plazos, los eliminamos o anonimizamos de forma segura.
      </p>

      <h2 id="seguridad">9. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas razonables para proteger los datos, incluidas la
        segmentación por empresa, controles de acceso por roles, cifrado en tránsito, registros de
        auditoría y copias de seguridad. Ningún sistema es completamente infalible; en caso de un
        incidente de seguridad que te afecte, actuaremos conforme a la ley aplicable y te
        notificaremos cuando corresponda.
      </p>

      <h2 id="derechos">10. Tus derechos</h2>
      <p>
        Según la legislación aplicable, puedes ejercer los derechos de{" "}
        <strong>acceso, rectificación, cancelación/supresión y oposición</strong> (derechos ARCO),
        así como, cuando proceda, la <strong>portabilidad</strong>, la <strong>limitación</strong>{" "}
        del tratamiento y la <strong>revocación del consentimiento</strong>. Para ejercerlos,
        escríbenos a{" "}
        <a href={`mailto:${INFO_LEGAL.correoPrivacidad}`}>{INFO_LEGAL.correoPrivacidad}</a>{" "}
        indicando tu solicitud; podremos pedirte que acredites tu identidad. Responderemos en los
        plazos que fije la ley. También puedes acudir a la autoridad de protección de datos de tu
        país si consideras vulnerados tus derechos.
      </p>

      <h2 id="menores">11. Menores de edad</h2>
      <p>
        El Servicio está dirigido a empresas y a personas mayores de edad. No recopilamos
        conscientemente datos de menores. Si detectamos que hemos tratado datos de un menor sin
        base legal, los eliminaremos.
      </p>

      <h2 id="marco">12. Marco normativo</h2>
      <p>
        Cumplimos la legislación de protección de datos personales aplicable en los países donde
        operamos, incluidas las normas de Honduras, Nicaragua, Guatemala, Costa Rica, El Salvador,
        Estados Unidos y México.
        Cuando la ley local otorgue derechos adicionales, se aplicarán en tu favor.
      </p>

      <h2 id="cambios">13. Cambios a esta Política</h2>
      <p>
        Podemos actualizar esta Política. Publicaremos la versión vigente en esta página con su
        fecha y, ante cambios materiales, procuraremos avisarte por un medio razonable.
      </p>

      <h2 id="contacto">14. Contacto</h2>
      <p>
        Para cualquier asunto de privacidad:{" "}
        <a href={`mailto:${INFO_LEGAL.correoPrivacidad}`}>{INFO_LEGAL.correoPrivacidad}</a>
        <br />
        {INFO_LEGAL.proveedor} — {INFO_LEGAL.direccion}
      </p>
    </LegalShell>
  );
}
