import Link from "next/link";
import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";
import { INFO_LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Inteligencia Artificial",
  description:
    "Cómo funcionan las funciones asistidas por IA de ARCA, qué datos usan, sus limitaciones y por qué no sustituyen el criterio profesional.",
};

export default function IaPage() {
  return (
    <LegalShell slug="inteligencia-artificial">
      <p>
        <strong>{INFO_LEGAL.marca}</strong> puede ofrecer funciones asistidas por inteligencia
        artificial (las <strong>&ldquo;Funciones de IA&rdquo;</strong>) para ayudarte a trabajar
        más rápido: por ejemplo, sugerencias, resúmenes, clasificación de información, apoyo a la
        redacción o respuestas a preguntas sobre tus datos. Esta Política explica cómo operan, qué
        datos usan y qué limitaciones tienen. Complementa los{" "}
        <Link href="/legal/terminos">Términos y Condiciones</Link> y la{" "}
        <Link href="/legal/privacidad">Política de Privacidad</Link>.
      </p>

      <div className="legal-nota">
        <strong>La IA asiste, no decide por ti.</strong> La salida de las Funciones de IA es
        orientativa, puede ser incorrecta o incompleta y <strong>no constituye asesoría contable,
        fiscal, legal ni financiera</strong>. Antes de usarla para registros oficiales, reportes,
        decisiones o presentaciones ante autoridades, debes revisarla y validarla —y, cuando
        corresponda, consultarlo con un profesional autorizado.
      </div>

      <h2 id="como-funciona">1. Cómo funcionan las Funciones de IA</h2>
      <p>
        Las Funciones de IA procesan la información que tú les proporcionas o que está en tu Cuenta
        para generar un resultado. Pueden apoyarse en modelos propios o en proveedores externos de
        modelos de lenguaje, siempre bajo obligaciones de confidencialidad y seguridad. Su
        disponibilidad depende de tu Plan y puede cambiar con el tiempo.
      </p>

      <h2 id="datos">2. Qué datos usan y cómo</h2>
      <ul>
        <li>
          Las Funciones de IA usan tus datos <strong>únicamente para generarte el resultado</strong>{" "}
          que solicitas dentro del Servicio.
        </li>
        <li>
          <strong>No utilizamos tus datos personales ni los Datos del Cliente para entrenar modelos
          de terceros de acceso público</strong> sin una base legal y las salvaguardas adecuadas.
        </li>
        <li>
          Cuando intervengan proveedores externos de IA, seleccionamos aquellos que ofrecen
          compromisos de no reutilización de tus datos para entrenar sus modelos, en la medida
          contractualmente disponible.
        </li>
        <li>
          El tratamiento de datos personales por estas funciones se rige por la{" "}
          <Link href="/legal/privacidad">Política de Privacidad</Link> y, cuando actuamos como
          Encargado, por el{" "}
          <Link href="/legal/tratamiento-datos">Acuerdo de Tratamiento de Datos</Link>.
        </li>
      </ul>

      <h2 id="limitaciones">3. Limitaciones que debes conocer</h2>
      <ul>
        <li>
          Los modelos de IA pueden <strong>&ldquo;alucinar&rdquo;</strong>: producir información que
          parece correcta pero es inexacta o inventada.
        </li>
        <li>
          Los resultados pueden estar desactualizados, ser incompletos o no ajustarse a la
          normativa contable o fiscal específica de tu país o situación.
        </li>
        <li>
          Un mismo pedido puede producir resultados distintos en momentos diferentes.
        </li>
        <li>
          Las Funciones de IA no reemplazan el motor contable ni las validaciones del Servicio: los
          registros siguen dependiendo de tu configuración y de los controles de la Plataforma.
        </li>
      </ul>

      <h2 id="supervision">4. Supervisión humana y decisiones</h2>
      <p>
        Mantienes el control: las Funciones de IA están diseñadas para asistir, no para ejecutar
        acciones irreversibles por sí solas. <strong>No debes basar decisiones significativas
        —contables, fiscales, financieras o laborales— únicamente en la salida de la IA sin revisión
        humana.</strong> Eres responsable de verificar los resultados antes de utilizarlos.
      </p>

      <h2 id="uso-responsable">5. Uso responsable</h2>
      <p>
        Al usar las Funciones de IA aceptas no emplearlas para fines prohibidos por nuestra{" "}
        <Link href="/legal/uso-aceptable">Política de Uso Aceptable</Link>, incluyendo generar
        contenido ilícito, engañoso o que vulnere derechos de terceros, ni ingresar datos sobre los
        que no tengas base legal para tratarlos.
      </p>

      <h2 id="responsabilidad">6. Responsabilidad</h2>
      <p>
        En la medida permitida por la ley, {INFO_LEGAL.marca} no responde por decisiones tomadas ni
        por daños derivados del uso de la salida de las Funciones de IA sin la debida verificación.
        Aplican las garantías y limitaciones de responsabilidad de los{" "}
        <Link href="/legal/terminos">Términos y Condiciones</Link>.
      </p>

      <h2 id="cambios">7. Cambios a esta Política</h2>
      <p>
        La tecnología de IA evoluciona rápido. Podemos actualizar esta Política y las Funciones de
        IA; publicaremos la versión vigente en esta página con su fecha y, ante cambios materiales,
        procuraremos avisarte.
      </p>

      <h2 id="contacto">8. Contacto</h2>
      <p>
        Preguntas sobre las Funciones de IA:{" "}
        <a href={`mailto:${INFO_LEGAL.correoSoporte}`}>{INFO_LEGAL.correoSoporte}</a> · Privacidad:{" "}
        <a href={`mailto:${INFO_LEGAL.correoPrivacidad}`}>{INFO_LEGAL.correoPrivacidad}</a>
      </p>
    </LegalShell>
  );
}
