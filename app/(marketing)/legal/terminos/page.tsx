import Link from "next/link";
import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";
import { INFO_LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description:
    "Contrato que rige el uso de la plataforma ARCA: suscripción, pagos, garantías, responsabilidad, propiedad intelectual y terminación.",
};

export default function TerminosPage() {
  return (
    <LegalShell slug="terminos">
      <p>
        Estos Términos y Condiciones (los <strong>&ldquo;Términos&rdquo;</strong>) constituyen
        un contrato legalmente vinculante entre <strong>{INFO_LEGAL.proveedor}</strong>{" "}
        (<strong>&ldquo;{INFO_LEGAL.marca}&rdquo;</strong>, <strong>&ldquo;nosotros&rdquo;</strong>{" "}
        o el <strong>&ldquo;Proveedor&rdquo;</strong>) y la persona natural o jurídica que
        contrata o utiliza la plataforma {INFO_LEGAL.marca} (el{" "}
        <strong>&ldquo;Cliente&rdquo;</strong>, <strong>&ldquo;tú&rdquo;</strong> o{" "}
        <strong>&ldquo;usuario&rdquo;</strong>). Al crear una cuenta, contratar un plan o usar
        el servicio, declaras haber leído, entendido y aceptado estos Términos en su totalidad.
      </p>

      <div className="legal-nota">
        <strong>Aviso importante.</strong> {INFO_LEGAL.marca} es una herramienta de gestión y
        registro. No es un contador, un asesor fiscal, un banco ni una entidad de pago, y su
        salida —incluidos los asientos contables generados automáticamente— no sustituye el
        juicio de un profesional autorizado ni te exime de tus obligaciones legales y
        tributarias. Lee especialmente las secciones 8 (Naturaleza contable), 15 (Garantías) y
        16 (Limitación de responsabilidad).
      </div>

      <h2 id="definiciones">1. Definiciones</h2>
      <ul>
        <li>
          <strong>Plataforma / Servicio:</strong> el software como servicio (SaaS){" "}
          {INFO_LEGAL.marca}, accesible vía web, que integra punto de venta, inventario,
          facturación, contabilidad, reportes y funciones relacionadas.
        </li>
        <li>
          <strong>Cuenta / Tenant:</strong> el espacio aislado de datos de una empresa dentro de
          la Plataforma, identificado internamente por un identificador de empresa.
        </li>
        <li>
          <strong>Usuario autorizado:</strong> cada persona (empleado, socio o colaborador) a
          quien el Cliente da acceso a su Cuenta bajo un rol y permisos determinados.
        </li>
        <li>
          <strong>Datos del Cliente:</strong> toda información que el Cliente o sus Usuarios
          autorizados cargan, generan o procesan en la Plataforma, incluidos productos,
          inventarios, ventas, movimientos contables y datos de terceros (clientes finales,
          empleados, proveedores).
        </li>
        <li>
          <strong>Plan:</strong> el paquete de funciones y límites contratado (por ejemplo Demo,
          Pro o Enterprise), según se describa en la página de precios vigente.
        </li>
      </ul>

      <h2 id="servicio">2. Descripción del servicio</h2>
      <p>
        {INFO_LEGAL.marca} ofrece una plataforma multiempresa para la gestión comercial y
        contable de pequeñas y medianas empresas. El Servicio se presta &ldquo;en la nube&rdquo;
        y puede evolucionar con el tiempo: podemos agregar, modificar o retirar funciones para
        mejorar la Plataforma, corregir errores o cumplir requisitos legales. Cuando un cambio
        sea material y adverso para funciones esenciales de tu Plan, procuraremos avisarte con
        antelación razonable.
      </p>

      <h2 id="registro">3. Registro, cuenta y responsabilidad de acceso</h2>
      <ul>
        <li>
          Debes ser mayor de edad y tener capacidad legal para contratar. Si actúas en nombre de
          una empresa, declaras contar con facultades para obligarla.
        </li>
        <li>
          Te comprometes a proporcionar información veraz, completa y actualizada al registrarte
          y a mantenerla al día.
        </li>
        <li>
          Eres responsable de la confidencialidad de tus credenciales y de toda actividad
          realizada bajo tu Cuenta y la de tus Usuarios autorizados. Debes notificarnos de
          inmediato ante cualquier uso no autorizado a{" "}
          <a href={`mailto:${INFO_LEGAL.correoSoporte}`}>{INFO_LEGAL.correoSoporte}</a>.
        </li>
        <li>
          Eres el único responsable de administrar los roles y permisos de tus Usuarios
          autorizados y de las acciones que estos realicen.
        </li>
      </ul>

      <h2 id="planes">4. Planes, prueba y límites de uso</h2>
      <p>
        Los Planes, sus funciones, cupos y límites (por ejemplo número de sucursales, usuarios,
        productos o transacciones) son los descritos en la página de precios vigente al momento
        de la contratación. Podemos ofrecer un plan gratuito o de prueba con funciones y límites
        reducidos. Nos reservamos el derecho de aplicar controles técnicos para hacer cumplir
        los límites de cada Plan y de suspender funciones que excedan lo contratado.
      </p>

      <h2 id="pagos">5. Precios, pagos, impuestos y renovación</h2>
      <ul>
        <li>
          <strong>Precios y moneda.</strong> Los precios son los publicados para tu Plan y país.
          Salvo indicación en contrario, no incluyen los impuestos que correspondan, los cuales
          se agregarán según la legislación aplicable.
        </li>
        <li>
          <strong>Facturación y renovación automática.</strong> Las suscripciones se facturan por
          adelantado (mensual o anualmente, según elijas) y{" "}
          <strong>se renuevan automáticamente</strong> por períodos iguales hasta que las canceles
          conforme a la sección 13.
        </li>
        <li>
          <strong>Medios de pago.</strong> Autorizas el cobro recurrente en el medio de pago
          registrado. El procesamiento de pagos puede realizarse a través de proveedores externos;
          {INFO_LEGAL.marca} no almacena datos completos de tarjetas.
        </li>
        <li>
          <strong>Mora y suspensión.</strong> Si un pago no puede procesarse, podemos reintentar el
          cobro, suspender el acceso al Servicio y/o aplicar recargos por mora permitidos por la ley
          tras un aviso razonable.
        </li>
        <li>
          <strong>Cambios de precio.</strong> Podemos ajustar los precios; los cambios aplican al
          siguiente período de facturación y se te comunicarán con al menos treinta (30) días de
          anticipación.
        </li>
        <li>
          <strong>No reembolsable.</strong> Salvo que la ley imperativa disponga lo contrario o que
          lo acordemos por escrito, los importes pagados no son reembolsables, incluso en caso de
          cancelación anticipada o de uso parcial del período contratado.
        </li>
      </ul>

      <h2 id="uso-aceptable">6. Uso aceptable</h2>
      <p>
        El uso de la Plataforma está sujeto a nuestra{" "}
        <Link href="/legal/uso-aceptable">Política de Uso Aceptable</Link>, que forma parte
        integral de estos Términos. El incumplimiento de dicha política se considera un
        incumplimiento material de este contrato.
      </p>

      <h2 id="datos-cliente">7. Datos del Cliente y su tratamiento</h2>
      <ul>
        <li>
          <strong>Propiedad.</strong> Los Datos del Cliente son y seguirán siendo tuyos. Nos
          otorgas una licencia limitada, no exclusiva y mundial para alojarlos, procesarlos y
          transmitirlos con el único fin de prestarte el Servicio, mantenerlo, protegerlo y
          mejorarlo.
        </li>
        <li>
          <strong>Responsabilidad del contenido.</strong> Eres responsable de la exactitud,
          calidad, legalidad y del derecho a utilizar los Datos del Cliente, así como de contar con
          las bases legales para tratarlos, incluidos los datos de tus clientes finales, empleados
          y proveedores.
        </li>
        <li>
          <strong>Datos personales.</strong> Cuando {INFO_LEGAL.marca} trate datos personales por tu
          cuenta, lo hará como Encargado del tratamiento conforme al{" "}
          <Link href="/legal/tratamiento-datos">Acuerdo de Tratamiento de Datos</Link>. El
          tratamiento de datos que hacemos como Responsables se describe en la{" "}
          <Link href="/legal/privacidad">Política de Privacidad</Link>.
        </li>
        <li>
          <strong>Respaldos y exportación.</strong> Realizamos copias de seguridad periódicas como
          práctica operativa; ello no te exime de mantener tus propios respaldos. Mientras tu Cuenta
          esté activa y al día, podrás exportar tus datos en formatos de uso común.
        </li>
      </ul>

      <h2 id="naturaleza-contable">8. Naturaleza contable, fiscal y financiera del Servicio</h2>
      <p>
        {INFO_LEGAL.marca} automatiza registros —incluida la generación de asientos de partida
        doble— a partir de la información y la configuración que tú provees. <strong>No prestamos
        servicios de contaduría pública, auditoría, asesoría fiscal, legal ni financiera</strong>,
        y el Servicio no constituye asesoría profesional ni recomendación de inversión.
      </p>
      <ul>
        <li>
          Eres el único responsable de la correcta configuración (catálogo de cuentas, impuestos,
          secuencias fiscales, períodos) y de la veracidad de los datos que ingresas.
        </li>
        <li>
          Eres el único responsable del cumplimiento de tus obligaciones tributarias, contables,
          de facturación fiscal y regulatorias ante las autoridades de tu país.
        </li>
        <li>
          Los reportes, estados financieros, saldos y documentos generados deben ser revisados y
          validados por ti y, cuando corresponda, por un contador o asesor autorizado antes de su
          uso oficial, presentación o toma de decisiones.
        </li>
        <li>
          {INFO_LEGAL.marca} no interviene en la custodia ni movimiento real de fondos; el registro
          de caja, bancos, cobros o pagos refleja lo que tú declaras, no una transacción financiera
          efectuada por nosotros.
        </li>
      </ul>

      <h2 id="ia">9. Funciones asistidas por inteligencia artificial</h2>
      <p>
        La Plataforma puede incluir funciones asistidas por inteligencia artificial. Su uso se rige
        además por nuestra{" "}
        <Link href="/legal/inteligencia-artificial">Política de Inteligencia Artificial</Link>. La
        salida de estas funciones es orientativa, puede contener errores y debe ser verificada por
        ti antes de utilizarse.
      </p>

      <h2 id="disponibilidad">10. Disponibilidad, mantenimiento y soporte</h2>
      <p>
        Trabajamos para ofrecer un servicio disponible de forma continua, pero no garantizamos que
        el Servicio esté libre de interrupciones. Podemos realizar mantenimientos programados —con
        aviso razonable cuando sea previsible— y mantenimientos de emergencia sin previo aviso. El
        alcance del soporte y, en su caso, los compromisos de nivel de servicio (SLA), dependen de
        tu Plan.
      </p>

      <h2 id="pi">11. Propiedad intelectual</h2>
      <p>
        La Plataforma, su software, código, diseño, marcas, logotipos y documentación son
        propiedad de {INFO_LEGAL.marca} o de sus licenciantes y están protegidos por las leyes de
        propiedad intelectual. Te concedemos un derecho de uso limitado, revocable, no exclusivo e
        intransferible sobre el Servicio mientras cumplas estos Términos. No podrás copiar,
        modificar, descompilar, realizar ingeniería inversa, revender ni crear obras derivadas de
        la Plataforma, salvo en la medida permitida por ley imperativa. Si nos envías sugerencias o
        comentarios, podremos usarlos libremente sin obligación alguna hacia ti.
      </p>

      <h2 id="confidencialidad">12. Confidencialidad</h2>
      <p>
        Cada parte protegerá la información confidencial de la otra con al menos el mismo cuidado
        que aplica a la propia y no la usará ni divulgará salvo para cumplir este contrato o cuando
        lo exija la ley. Esta obligación no aplica a información que sea de dominio público sin
        culpa de la parte receptora o que deba revelarse por mandato de autoridad competente.
      </p>

      <h2 id="terminacion">13. Vigencia, suspensión y terminación</h2>
      <ul>
        <li>
          <strong>Cancelación por el Cliente.</strong> Puedes cancelar la renovación de tu
          suscripción en cualquier momento; la cancelación surte efecto al final del período ya
          pagado.
        </li>
        <li>
          <strong>Suspensión.</strong> Podemos suspender el acceso, total o parcialmente, ante falta
          de pago, riesgo de seguridad, requerimiento legal o incumplimiento de estos Términos o de
          la Política de Uso Aceptable.
        </li>
        <li>
          <strong>Terminación.</strong> Cualquiera de las partes puede terminar el contrato por
          incumplimiento material no subsanado dentro de un plazo razonable tras la notificación.
        </li>
        <li>
          <strong>Efectos.</strong> Al terminar, cesará tu derecho de uso. Durante un período de
          gracia de treinta (30) días podrás solicitar la exportación de tus Datos del Cliente;
          transcurrido dicho plazo podremos eliminarlos de forma segura, salvo obligación legal de
          conservación.
        </li>
      </ul>

      <h2 id="garantias">14. Garantías del Cliente</h2>
      <p>
        Declaras y garantizas que: (i) usarás el Servicio conforme a la ley y a estos Términos;
        (ii) cuentas con los derechos y bases legales sobre los Datos del Cliente; y (iii) no
        emplearás la Plataforma para actividades fraudulentas, ilícitas o que vulneren derechos de
        terceros.
      </p>

      <h2 id="descargo-garantias">15. Ausencia de garantías del Servicio</h2>
      <p>
        En la máxima medida permitida por la ley aplicable, el Servicio se ofrece{" "}
        <strong>&ldquo;tal cual&rdquo; y &ldquo;según disponibilidad&rdquo;</strong>, sin garantías
        de ningún tipo, expresas o implícitas, incluidas las de comerciabilidad, idoneidad para un
        fin particular, exactitud contable o fiscal, o no infracción. No garantizamos que el
        Servicio sea ininterrumpido, seguro o libre de errores, ni que los resultados obtenidos sean
        exactos o confiables para un propósito determinado. Ninguna información obtenida del Servicio
        crea garantías no expresadas en estos Términos.
      </p>

      <h2 id="responsabilidad">16. Limitación de responsabilidad</h2>
      <p>
        En la máxima medida permitida por la ley aplicable:
      </p>
      <ul>
        <li>
          {INFO_LEGAL.marca} no será responsable por daños indirectos, incidentales, especiales,
          punitivos o consecuentes, ni por lucro cesante, pérdida de ingresos, de datos, de
          clientela, de fondo de comercio, ni por sanciones, multas o contingencias fiscales,
          aun cuando se le hubiera advertido de su posibilidad.
        </li>
        <li>
          La responsabilidad total y acumulada de {INFO_LEGAL.marca} por cualquier reclamo
          relacionado con el Servicio no excederá el monto efectivamente pagado por el Cliente por
          el Servicio durante los doce (12) meses anteriores al hecho que originó la reclamación.
        </li>
        <li>
          Estas limitaciones aplican a cualquier teoría de responsabilidad (contractual,
          extracontractual u otra) y reflejan una asignación razonable de riesgos. Nada en estos
          Términos excluye responsabilidades que no puedan limitarse legalmente (por ejemplo, dolo
          o culpa grave).
        </li>
      </ul>

      <h2 id="indemnizacion">17. Indemnización</h2>
      <p>
        Te obligas a mantener indemne y a defender a {INFO_LEGAL.marca}, sus socios, directivos,
        empleados y colaboradores frente a cualquier reclamo, pérdida, daño, sanción o gasto
        (incluidos honorarios legales razonables) derivados de: (i) tu uso del Servicio; (ii) los
        Datos del Cliente; (iii) el incumplimiento de estos Términos o de la ley; o (iv) la
        infracción de derechos de terceros.
      </p>

      <h2 id="cambios">18. Modificaciones a los Términos</h2>
      <p>
        Podemos actualizar estos Términos para reflejar cambios en el Servicio, en la ley o en
        nuestras prácticas. Publicaremos la versión vigente en esta página con su fecha. Cuando los
        cambios sean materiales, procuraremos avisarte por un medio razonable con antelación. El
        uso continuado del Servicio tras la entrada en vigor implica tu aceptación de los Términos
        actualizados.
      </p>

      <h2 id="fuerza-mayor">19. Fuerza mayor</h2>
      <p>
        Ninguna parte será responsable por el incumplimiento causado por hechos fuera de su control
        razonable, incluidos desastres naturales, cortes de energía o de telecomunicaciones, fallas
        de proveedores de infraestructura, actos de autoridad, conflictos sociales o ciberataques.
      </p>

      <h2 id="ley">20. Ley aplicable y resolución de disputas (arbitraje)</h2>
      <p>
        El Servicio se ofrece a clientes de toda Centroamérica; no obstante, estos Términos se
        rigen por las leyes de {INFO_LEGAL.leyAplicable}, sin dar efecto a sus normas de conflicto
        de leyes. Esta elección de ley y de foro aplica con independencia del país centroamericano
        desde el cual el Cliente utilice el Servicio. Las partes procurarán resolver de buena fe
        cualquier
        controversia. De no lograrse un acuerdo dentro de treinta (30) días, la controversia se
        resolverá <strong>de forma definitiva mediante arbitraje</strong> administrado por{" "}
        {INFO_LEGAL.centroArbitraje}, conforme a {INFO_LEGAL.reglasArbitraje}. La sede del
        arbitraje será {INFO_LEGAL.sedeArbitraje} y el procedimiento se llevará en{" "}
        {INFO_LEGAL.idiomaArbitraje}. El laudo será vinculante y ejecutable ante cualquier tribunal
        competente. Nada de lo anterior impide a cualquier parte solicitar medidas cautelares
        urgentes ante la autoridad judicial competente.
      </p>

      <h2 id="miscelanea">21. Disposiciones generales</h2>
      <ul>
        <li>
          <strong>Cesión.</strong> No puedes ceder este contrato sin nuestro consentimiento previo
          por escrito. {INFO_LEGAL.marca} puede cederlo en el marco de una reorganización, fusión o
          venta de activos.
        </li>
        <li>
          <strong>Independencia de cláusulas.</strong> Si una disposición se declara inválida, el
          resto continuará en pleno vigor.
        </li>
        <li>
          <strong>Renuncia.</strong> El hecho de no exigir el cumplimiento de una cláusula no
          constituye renuncia a exigirlo después.
        </li>
        <li>
          <strong>Acuerdo íntegro.</strong> Estos Términos, junto con los documentos referenciados,
          constituyen el acuerdo completo entre las partes sobre el Servicio.
        </li>
        <li>
          <strong>Notificaciones.</strong> Las notificaciones se enviarán a los correos registrados
          o se publicarán en la Plataforma.
        </li>
      </ul>

      <h2 id="contacto">22. Contacto</h2>
      <p>
        {INFO_LEGAL.proveedor}
        <br />
        {INFO_LEGAL.direccion}
        <br />
        Correo legal:{" "}
        <a href={`mailto:${INFO_LEGAL.correoLegal}`}>{INFO_LEGAL.correoLegal}</a>
        <br />
        Soporte:{" "}
        <a href={`mailto:${INFO_LEGAL.correoSoporte}`}>{INFO_LEGAL.correoSoporte}</a>
      </p>
    </LegalShell>
  );
}
