import Link from "next/link";
import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";
import { INFO_LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Uso Aceptable",
  description:
    "Conductas prohibidas al usar ARCA y consecuencias de infringirlas. Protege la plataforma, a los usuarios y a terceros.",
};

export default function UsoAceptablePage() {
  return (
    <LegalShell slug="uso-aceptable">
      <p>
        Esta Política de Uso Aceptable define lo que <strong>no</strong> está permitido al usar{" "}
        <strong>{INFO_LEGAL.marca}</strong>. Forma parte de los{" "}
        <Link href="/legal/terminos">Términos y Condiciones</Link> y aplica a todos los usuarios de
        la Cuenta. Su objetivo es mantener la Plataforma segura, disponible y confiable para todos.
      </p>

      <h2 id="prohibido">1. Conductas prohibidas</h2>
      <p>Te comprometes a no utilizar el Servicio para:</p>
      <ul>
        <li>
          Realizar actividades ilícitas, fraudulentas o engañosas, ni registrar operaciones falsas
          con el fin de evadir obligaciones fiscales, lavar activos o simular información contable.
        </li>
        <li>
          Infringir derechos de terceros, incluidos propiedad intelectual, privacidad, honor o
          secretos comerciales.
        </li>
        <li>
          Cargar o tratar datos personales sin contar con la base legal para hacerlo, o datos
          sensibles sin las garantías exigidas por la ley.
        </li>
        <li>
          Subir contenido ilegal, difamatorio, discriminatorio, violento o que constituya acoso.
        </li>
        <li>
          Introducir malware, virus o cualquier código dañino, o intentar comprometer la seguridad
          o integridad de la Plataforma.
        </li>
        <li>
          Acceder o intentar acceder a cuentas, datos o áreas de otros clientes o usuarios sin
          autorización, o eludir los mecanismos de aislamiento por empresa.
        </li>
        <li>
          Realizar ingeniería inversa, descompilar, extraer el código fuente o crear productos
          derivados de la Plataforma, salvo en la medida permitida por ley imperativa.
        </li>
        <li>
          Someter la Plataforma a cargas automatizadas abusivas, pruebas de estrés no autorizadas,
          scraping masivo o cualquier uso que degrade el Servicio para otros.
        </li>
        <li>
          Revender, sublicenciar o prestar el Servicio a terceros sin autorización, o exceder los
          límites de usuarios, sucursales o transacciones de tu Plan mediante artificios.
        </li>
        <li>
          Usar las funciones de inteligencia artificial en contra de nuestra{" "}
          <Link href="/legal/inteligencia-artificial">Política de Inteligencia Artificial</Link> o
          para generar contenido ilícito o engañoso.
        </li>
        <li>
          Intentar manipular, vulnerar o eludir las protecciones de las Funciones de IA mediante
          prompt injection, jailbreaks, cambios de rol, solicitudes de prompts internos, claves API,
          tokens, credenciales, variables de entorno o información de seguridad.
        </li>
      </ul>

      <h2 id="responsabilidad-cuenta">2. Responsabilidad sobre tu cuenta</h2>
      <p>
        Eres responsable de la conducta de tus Usuarios autorizados y del contenido que se cargue
        en tu Cuenta. Debes mantener la confidencialidad de las credenciales y configurar roles y
        permisos de forma prudente.
      </p>

      <h2 id="reportes">3. Cómo reportar abusos</h2>
      <p>
        Si detectas un uso indebido, una vulnerabilidad de seguridad o contenido que infrinja esta
        Política, repórtalo a{" "}
        <a href={`mailto:${INFO_LEGAL.correoAbuso}`}>{INFO_LEGAL.correoAbuso}</a>. Agradecemos la
        divulgación responsable de vulnerabilidades y nos comprometemos a no tomar acciones contra
        quien investigue de buena fe y sin causar daño.
      </p>

      <h2 id="consecuencias">4. Consecuencias del incumplimiento</h2>
      <p>
        Ante una infracción, y según su gravedad, podemos: solicitar la corrección, retirar
        contenido, limitar o suspender funciones, suspender o terminar la Cuenta y, cuando
        corresponda, notificar a las autoridades competentes. En casos de riesgo grave e inminente
        para la seguridad, podemos actuar de inmediato y notificar después.
      </p>

      <h2 id="cambios">5. Cambios a esta Política</h2>
      <p>
        Podemos actualizar esta Política para responder a nuevos riesgos o requisitos legales.
        Publicaremos la versión vigente en esta página con su fecha.
      </p>

      <h2 id="contacto">6. Contacto</h2>
      <p>
        Reporte de abusos:{" "}
        <a href={`mailto:${INFO_LEGAL.correoAbuso}`}>{INFO_LEGAL.correoAbuso}</a> · Soporte:{" "}
        <a href={`mailto:${INFO_LEGAL.correoSoporte}`}>{INFO_LEGAL.correoSoporte}</a>
      </p>
    </LegalShell>
  );
}
