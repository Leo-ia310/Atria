import Link from "next/link";
import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";
import { INFO_LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Acuerdo de Tratamiento de Datos (DPA)",
  description:
    "Cómo ARCA trata, como Encargado y por cuenta del Cliente, los datos personales de sus clientes, empleados y proveedores.",
};

export default function DpaPage() {
  return (
    <LegalShell slug="tratamiento-datos">
      <p>
        Este Acuerdo de Tratamiento de Datos (el <strong>&ldquo;DPA&rdquo;</strong>) forma parte de
        los <Link href="/legal/terminos">Términos y Condiciones</Link> y regula el tratamiento de
        datos personales que <strong>{INFO_LEGAL.marca}</strong> realiza <strong>por cuenta del
        Cliente</strong> al prestar el Servicio. Aplica cuando el Cliente carga en la Plataforma
        datos personales de terceros (sus clientes finales, empleados, proveedores o contactos).
      </p>

      <div className="legal-nota">
        <strong>Roles.</strong> El <strong>Cliente</strong> es el <strong>Responsable</strong> del
        tratamiento y determina las finalidades y medios. <strong>{INFO_LEGAL.marca}</strong> actúa
        como <strong>Encargado</strong> y trata esos datos únicamente para prestar el Servicio y
        siguiendo las instrucciones del Cliente.
      </div>

      <h2 id="objeto">1. Objeto y duración</h2>
      <p>
        {INFO_LEGAL.marca} tratará datos personales por cuenta del Cliente durante la vigencia de
        los Términos y por el tiempo necesario para prestar el Servicio. El objeto, naturaleza y
        finalidad del tratamiento es la operación de la plataforma de gestión comercial y contable
        contratada.
      </p>

      <h2 id="alcance">2. Alcance del tratamiento</h2>
      <ul>
        <li>
          <strong>Categorías de titulares:</strong> clientes finales, empleados, proveedores y
          contactos del Cliente.
        </li>
        <li>
          <strong>Categorías de datos:</strong> datos de identificación y contacto, datos fiscales
          (identificación tributaria), datos comerciales (compras, ventas, cuentas por cobrar/pagar)
          y aquellos que el Cliente decida registrar en la Plataforma.
        </li>
        <li>
          <strong>Operaciones:</strong> recolección, almacenamiento, organización, consulta, uso,
          respaldo, transmisión y supresión, según las funciones del Servicio.
        </li>
      </ul>

      <h2 id="instrucciones">3. Instrucciones del Responsable</h2>
      <p>
        {INFO_LEGAL.marca} tratará los datos personales únicamente conforme a las instrucciones
        documentadas del Cliente —incluidas las inherentes al uso de las funciones del Servicio— y
        no los usará para fines propios, salvo obligación legal, en cuyo caso lo informará al
        Cliente cuando esté permitido. El Cliente garantiza contar con base legal para el
        tratamiento y para instruir a {INFO_LEGAL.marca}.
      </p>

      <h2 id="confidencialidad">4. Confidencialidad del personal</h2>
      <p>
        {INFO_LEGAL.marca} garantiza que las personas autorizadas para tratar los datos están
        sujetas a un deber de confidencialidad y reciben la formación adecuada.
      </p>

      <h2 id="seguridad">5. Medidas de seguridad</h2>
      <p>
        {INFO_LEGAL.marca} aplica medidas técnicas y organizativas apropiadas, entre ellas:
        aislamiento lógico de datos por empresa (multi-tenant), control de acceso basado en roles y
        permisos, cifrado de la información en tránsito, registros de auditoría, respaldos
        periódicos y prácticas de desarrollo seguro. Estas medidas pueden evolucionar sin reducir
        el nivel de protección.
      </p>

      <h2 id="subencargados">6. Subencargados</h2>
      <p>
        El Cliente autoriza a {INFO_LEGAL.marca} a apoyarse en subencargados (por ejemplo,
        proveedores de infraestructura en la nube, base de datos, correo transaccional y
        procesamiento de pagos) para prestar el Servicio. {INFO_LEGAL.marca} impone a cada
        subencargado obligaciones de protección equivalentes y responde por su actuación. Podemos
        actualizar la lista de subencargados; ante nuevas incorporaciones que afecten materialmente
        el tratamiento, informaremos al Cliente por un medio razonable. La lista vigente puede
        solicitarse a{" "}
        <a href={`mailto:${INFO_LEGAL.correoPrivacidad}`}>{INFO_LEGAL.correoPrivacidad}</a>.
      </p>

      <h2 id="asistencia">7. Asistencia al Responsable</h2>
      <ul>
        <li>
          <strong>Derechos de los titulares.</strong> {INFO_LEGAL.marca} pondrá a disposición del
          Cliente funciones y asistencia razonable para atender solicitudes de acceso, rectificación,
          cancelación, oposición, portabilidad o limitación. Si un titular contacta directamente a
          {INFO_LEGAL.marca}, lo derivaremos al Cliente.
        </li>
        <li>
          <strong>Seguridad y evaluaciones.</strong> {INFO_LEGAL.marca} asistirá razonablemente al
          Cliente en el cumplimiento de sus obligaciones de seguridad y, cuando aplique, en
          evaluaciones de impacto.
        </li>
      </ul>

      <h2 id="brechas">8. Notificación de incidentes</h2>
      <p>
        Ante un incidente de seguridad que afecte datos personales tratados por cuenta del Cliente,
        {INFO_LEGAL.marca} lo notificará sin dilación indebida tras tener conocimiento, con la
        información razonablemente disponible para que el Cliente cumpla sus obligaciones de
        notificación ante autoridades y titulares.
      </p>

      <h2 id="devolucion">9. Devolución y supresión</h2>
      <p>
        Al terminar el Servicio, y a elección del Cliente, {INFO_LEGAL.marca} devolverá o eliminará
        de forma segura los datos personales tratados por su cuenta, salvo obligación legal de
        conservación. El Cliente dispone de un período de gracia de treinta (30) días para exportar
        sus datos, conforme a los Términos.
      </p>

      <h2 id="auditoria">10. Auditoría</h2>
      <p>
        {INFO_LEGAL.marca} pondrá a disposición del Cliente la información razonablemente necesaria
        para demostrar el cumplimiento de este DPA. Las auditorías, cuando procedan, se realizarán
        previa solicitud razonable, con aviso anticipado, en horario laboral, sin afectar la
        operación ni la seguridad de otros clientes y bajo confidencialidad.
      </p>

      <h2 id="transferencias">11. Transferencias internacionales</h2>
      <p>
        Cuando el tratamiento implique transferir datos a otra jurisdicción, {INFO_LEGAL.marca}
        adoptará salvaguardas adecuadas para mantener un nivel de protección conforme a la
        legislación de protección de datos aplicable. Consulta la{" "}
        <Link href="/legal/privacidad">Política de Privacidad</Link> para más detalle.
      </p>

      <h2 id="responsabilidad">12. Responsabilidad</h2>
      <p>
        Cada parte responde por el incumplimiento de las obligaciones que le corresponden bajo la
        normativa de protección de datos. Las limitaciones de responsabilidad de los{" "}
        <Link href="/legal/terminos">Términos y Condiciones</Link> aplican también a este DPA en la
        medida permitida por la ley.
      </p>

      <h2 id="contacto">13. Contacto</h2>
      <p>
        Asuntos de tratamiento de datos:{" "}
        <a href={`mailto:${INFO_LEGAL.correoPrivacidad}`}>{INFO_LEGAL.correoPrivacidad}</a>
        <br />
        {INFO_LEGAL.proveedor} — {INFO_LEGAL.direccion}
      </p>
    </LegalShell>
  );
}
