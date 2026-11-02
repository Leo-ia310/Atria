"use client";

export default function ApplicationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const reference = `ARCA: error al cargar la página\nReferencia: ${error.digest ?? "sin referencia"}`;
  async function support() {
    const report = `${reference}\nRuta: ${window.location.pathname}`;
    try { await navigator.clipboard.writeText(report); } catch { /* Email also includes the reference. */ }
    window.location.href = `mailto:valtrak.contact@gmail.com?subject=${encodeURIComponent("Error en ARCA")}&body=${encodeURIComponent(report)}`;
  }
  return <section className="mx-auto max-w-xl space-y-5 py-16 text-center">
    <h1 className="text-2xl font-semibold">No pudimos cargar esta página</h1>
    <p>Tus datos se conservan. Puedes volver a ARCA o intentar de nuevo.</p>
    {error.digest && <p className="text-small">Referencia: {error.digest}</p>}
    <div className="flex flex-wrap justify-center gap-3">
      <a href="/dashboard" className="arca-btn arca-btn-primary">Regresar a ARCA</a>
      <button className="arca-btn arca-btn-secondary" onClick={reset}>Reintentar</button>
      <button className="arca-btn arca-btn-secondary" onClick={support}>Copiar error y enviar a soporte</button>
    </div>
  </section>;
}
