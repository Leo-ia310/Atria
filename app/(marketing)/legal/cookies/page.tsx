import Link from "next/link";
import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";
import { INFO_LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Aviso de Cookies",
  description:
    "Qué cookies y tecnologías similares usa ARCA, para qué sirven y cómo puedes gestionarlas.",
};

export default function CookiesPage() {
  return (
    <LegalShell slug="cookies">
      <p>
        Este Aviso explica qué son las cookies, cuáles utiliza <strong>{INFO_LEGAL.marca}</strong>{" "}
        en su sitio web y en la plataforma, con qué finalidad y cómo puedes gestionarlas. Forma
        parte de nuestra <Link href="/legal/privacidad">Política de Privacidad</Link>.
      </p>

      <h2 id="que-son">1. Qué son las cookies</h2>
      <p>
        Las cookies son pequeños archivos que se almacenan en tu dispositivo al visitar un sitio.
        Sirven para que el sitio funcione, recordar preferencias y entender cómo se usa. Usamos
        también tecnologías similares como el almacenamiento local del navegador (por ejemplo, para
        recordar tu preferencia sobre este mismo aviso).
      </p>

      <h2 id="tipos">2. Tipos de cookies que usamos</h2>
      <div className="legal-tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Para qué sirve</th>
              <th>¿Requiere consentimiento?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Necesarias</td>
              <td>
                Inicio de sesión, seguridad, mantenimiento de la sesión y funcionamiento básico del
                sitio y la Plataforma.
              </td>
              <td>No (son imprescindibles)</td>
            </tr>
            <tr>
              <td>Preferencias</td>
              <td>Recordar ajustes como idioma o el estado de avisos que ya cerraste.</td>
              <td>No, cuando son estrictamente funcionales</td>
            </tr>
            <tr>
              <td>Medición / analítica</td>
              <td>
                Entender de forma agregada qué contenido es útil y mejorar la experiencia. No las
                usamos para publicidad de terceros.
              </td>
              <td>Sí</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Actualmente <strong>no utilizamos cookies de publicidad ni de rastreo entre sitios</strong>.
        Si esto cambiara, actualizaríamos este Aviso y solicitaríamos tu consentimiento cuando la
        ley lo exija.
      </p>

      <h2 id="consentimiento">3. Tu consentimiento</h2>
      <p>
        Al ingresar al sitio te mostramos un aviso donde puedes aceptar todas las cookies o
        conservar solo las necesarias. Las cookies no esenciales solo se activan con tu
        consentimiento, que puedes cambiar o retirar en cualquier momento.
      </p>

      <h2 id="gestion">4. Cómo gestionarlas</h2>
      <ul>
        <li>
          Puedes ajustar tu elección desde el propio aviso de cookies del sitio.
        </li>
        <li>
          Puedes bloquear o eliminar cookies desde la configuración de tu navegador. Ten en cuenta
          que deshabilitar las cookies necesarias puede afectar el funcionamiento del Servicio (por
          ejemplo, no poder mantener la sesión iniciada).
        </li>
      </ul>

      <h2 id="cambios">5. Cambios a este Aviso</h2>
      <p>
        Podemos actualizar este Aviso para reflejar cambios en las tecnologías que usamos o en la
        normativa aplicable. Publicaremos la versión vigente en esta página con su fecha.
      </p>

      <h2 id="contacto">6. Contacto</h2>
      <p>
        Dudas sobre cookies:{" "}
        <a href={`mailto:${INFO_LEGAL.correoPrivacidad}`}>{INFO_LEGAL.correoPrivacidad}</a>.
      </p>
    </LegalShell>
  );
}
