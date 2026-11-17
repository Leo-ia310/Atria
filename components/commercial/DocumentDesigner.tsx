"use client";
import { inputMessage } from "../../lib/document-display";
import "./documents.css";
import { useEffect, useState } from "react";
import {
  documentCommandSchema,
  documentDesignSchema,
  documentImageSize,
  type DocumentCommand,
  type DocumentResult,
  type DocumentDesign,
  type TemplateDto,
} from "../../lib/document-design";
import {
  renderCommercialPdf,
  type CommercialPdf,
  type PrintableDocument,
} from "../../lib/commercial-pdf";
import { commercialAmounts, commercialLegend } from "../../lib/commercial-core";
import { useDurableCommand } from "./useDurableCommand";
export type DocumentTransport = (c: DocumentCommand) => Promise<DocumentResult>;
export type DocumentOutput = (
  pdf: CommercialPdf,
  name: string,
  print: boolean,
) => Promise<void>;
const style = {
  border: "1px solid #8b7ca455",
  borderRadius: 8,
  padding: 10,
  background: "transparent",
  color: "inherit",
};
export function DocumentDesigner({
  contextId,
  branches,
  send,
}: {
  contextId: string;
  branches: Array<{ id: string; nombre: string }>;
  send: DocumentTransport;
}) {
  const [branch, setBranch] = useState(branches[0]?.id ?? ""),
    [templates, setTemplates] = useState<TemplateDto[]>([]),
    [permissions, setPermissions] = useState<string[]>([]);
  const [edit, setEdit] = useState<{
      id?: string;
      version?: number;
      name: string;
      design: DocumentDesign;
    }>({ name: "Plantilla comercial", design: documentDesignSchema.parse({}) }),
    [preview, setPreview] = useState<CommercialPdf | null>(null);
  const branchKey = branches.map((b) => b.id).join(",");
  useEffect(() => {
    if (!branches.some((b) => b.id === branch))
      setBranch(branches[0]?.id ?? "");
  }, [branchKey, branch]);
  const durable = useDurableCommand(
    `arca:document-attempt:${contextId}:${branch}`,
    send,
  );
  const command = (data: Partial<DocumentCommand>) =>
    documentCommandSchema.parse({
      action: "templates",
      requestId: crypto.randomUUID(),
      sucursalId: branch,
      ...data,
    });
  const load = async () => {
    if (!branch) return;
    try {
      const r = await send(command({ action: "templates" }));
      if (!r.ok) throw new Error(r.error);
      setTemplates(r.templates ?? []);
      setPermissions(r.permissions ?? []);
    } catch (e) {
      durable.setError(inputMessage(e, "No se pudo cargar."));
    }
  };
  useEffect(() => {
    void load();
  }, [branch, send]);
  const mutate = async (data: Partial<DocumentCommand>) => {
    try {
      const r = await durable.run(command(data));
      if (r?.template) {
        setEdit({
          id: r.template.id,
          version: r.template.version,
          name: r.template.name,
          design: r.template.versions.find(
            (v) => v.version === r.template!.version,
          )!.design!,
        });
        await load();
      }
      return r;
    } catch (e) {
      durable.setError(inputMessage(e, "Revisa el diseño."));
      return null;
    }
  };
  const change = (data: Partial<DocumentDesign>) => {
    setPreview(null);
    setEdit({ ...edit, design: { ...edit.design, ...data } });
  };
  const previewNow = async () => {
    try {
      const design = documentDesignSchema.parse(edit.design);
      setPreview(
        await renderCommercialPdf(
          sampleDocument(branch),
          design.format,
          design,
        ),
      );
    } catch (e) {
      durable.setError(inputMessage(e, "Revisa el diseño."));
    }
  };
  const image = async (file: File) => {
    try {
      if (file.size > 1000000)
        throw new Error("Selecciona un PNG/JPEG de hasta 1 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer()),
        size = documentImageSize(bytes);
      if (size.width > 4096 || size.height > 4096)
        throw new Error(
          "El logo original debe tener hasta 4096 × 4096 píxeles.",
        );
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const factor = Math.min(256 / img.width, 128 / img.height, 1),
          canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * factor));
        canvas.height = Math.max(1, Math.round(img.height * factor));
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        change({ logoData: canvas.toDataURL("image/png") });
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      durable.setError(inputMessage(e, "No se pudo cargar el logo."));
    }
  };
  const disabled =
    durable.busy ||
    !!durable.pending ||
    !permissions.includes("documento.disenar");
  return (
    <section
      className="arca-document-editor"
      style={{ display: "grid", gap: 16 }}
    >
      <h1>Diseñador de documentos internos</h1>
      <p>
        Plantillas de empresa compartidas por las sucursales. Los campos
        comerciales obligatorios y la leyenda no se pueden eliminar. Emisión
        fiscal deshabilitada.
      </p>
      <label>
        Sucursal de trabajo{" "}
        <select
          disabled={durable.busy}
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </label>
      {durable.error && <p role="alert">{durable.error}</p>}
      {durable.retry && (
        <button
          disabled={durable.busy}
          onClick={() => void durable.run(durable.retry!)}
        >
          Reintentar el mismo intento
        </button>
      )}
      {durable.pending && !durable.retry && (
        <button
          disabled={durable.busy}
          onClick={() =>
            void mutate({ action: "recover", attemptId: durable.pending! })
          }
        >
          Recuperar intento pendiente
        </button>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          style={style}
          disabled={durable.busy}
          onClick={() => void load()}
        >
          Actualizar
        </button>
        <button
          style={style}
          disabled={disabled}
          onClick={() => {
            setEdit({
              name: "Nueva plantilla",
              design: documentDesignSchema.parse({}),
            });
            setPreview(null);
          }}
        >
          Nueva plantilla
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Plantilla</th>
            <th>Versión actual</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.version}</td>
              <td>
                <button
                  disabled={disabled}
                  onClick={() => {
                    setEdit({
                      id: t.id,
                      version: t.version,
                      name: t.name,
                      design: t.versions.find((v) => v.version === t.version)!
                        .design!,
                    });
                    setPreview(null);
                  }}
                >
                  Editar como nueva versión
                </button>{" "}
                <button
                  disabled={disabled}
                  onClick={() =>
                    void mutate({ action: "duplicateTemplate", id: t.id })
                  }
                >
                  Duplicar
                </button>
                <span>
                  {" "}
                  · Versiones: {t.versions.map((v) => v.version).join(", ")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void mutate({
            action: edit.id ? "saveTemplate" : "createTemplate",
            id: edit.id,
            expectedVersion: edit.version,
            name: edit.name,
            design: edit.design,
          });
        }}
        style={{ ...style, display: "grid", gap: 12 }}
      >
        <label>
          Nombre{" "}
          <input
            required
            maxLength={120}
            value={edit.name}
            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          />
        </label>
        <label>
          Formato{" "}
          <select
            value={edit.design.format}
            onChange={(e) =>
              change({
                format: e.target.value as DocumentDesign["format"],
                margin:
                  e.target.value === "termico80"
                    ? Math.min(edit.design.margin, 45)
                    : edit.design.margin,
              })
            }
          >
            <option value="carta">Carta</option>
            <option value="media-carta">Media carta</option>
            <option value="termico80">Térmico de 80 mm</option>
          </select>
        </label>
        <label>
          Tipografía{" "}
          <select
            value={edit.design.font}
            onChange={(e) =>
              change({ font: e.target.value as DocumentDesign["font"] })
            }
          >
            {["Arial", "Times New Roman", "Courier New"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Tamaño de letra (pt){" "}
          <input
            type="number"
            min={8}
            max={18}
            value={edit.design.fontSize}
            onChange={(e) => change({ fontSize: Number(e.target.value) })}
          />
        </label>
        <label>
          Margen (mm){" "}
          <input
            type="number"
            min={3.2}
            max={31.7}
            step="0.1"
            value={Number(((edit.design.margin * 25.4) / 96).toFixed(1))}
            onChange={(e) =>
              change({
                margin: Math.round((Number(e.target.value) * 96) / 25.4),
              })
            }
          />
        </label>
        <label>
          Color{" "}
          <input
            type="color"
            value={edit.design.accent}
            onChange={(e) => change({ accent: e.target.value })}
          />
        </label>
        <label>
          Alineación del encabezado{" "}
          <select
            value={edit.design.alignment}
            onChange={(e) =>
              change({
                alignment: e.target.value as DocumentDesign["alignment"],
              })
            }
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </label>
        <label>
          Encabezado comercial{" "}
          <textarea
            maxLength={1000}
            value={edit.design.header}
            onChange={(e) => change({ header: e.target.value })}
          />
        </label>
        <label>
          Pie / mensajes / redes sociales{" "}
          <textarea
            maxLength={2000}
            value={edit.design.footer}
            onChange={(e) => change({ footer: e.target.value })}
          />
        </label>
        <label>
          Logo PNG/JPEG{" "}
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              if (e.target.files?.[0]) void image(e.target.files[0]);
            }}
          />
        </label>
        {edit.design.logoData && (
          <div>
            <img
              src={edit.design.logoData}
              alt="Logo guardado en la plantilla"
              style={{ maxWidth: 256, maxHeight: 128 }}
            />
            <button type="button" onClick={() => change({ logoData: null })}>
              Quitar logo
            </button>
          </div>
        )}
        <fieldset>
          <legend>
            Columnas obligatorias (anchos deben sumar 100 %; en térmico se
            apilan)
          </legend>
          {edit.design.columns.map((c, i) => (
            <div key={c}>
              <span>
                {
                  {
                    producto: "Producto / servicio",
                    cantidad: "Cantidad",
                    precio: "Precio unitario",
                    descuento: "Descuento",
                    impuesto: "Impuesto",
                    total: "Total",
                  }[c]
                }
              </span>
              <input
                aria-label={`Ancho ${c}`}
                type="number"
                min={5}
                max={70}
                step="0.1"
                value={edit.design.widths[i]}
                onChange={(e) =>
                  change({
                    widths: edit.design.widths.map((w, n) =>
                      i === n ? Number(e.target.value) : w,
                    ),
                  })
                }
              />
              <button
                type="button"
                disabled={!i}
                onClick={() => {
                  const columns = [...edit.design.columns],
                    widths = [...edit.design.widths];
                  [columns[i - 1], columns[i]] = [columns[i], columns[i - 1]];
                  [widths[i - 1], widths[i]] = [widths[i], widths[i - 1]];
                  change({ columns, widths });
                }}
              >
                Subir
              </button>
            </div>
          ))}
        </fieldset>
        <p>
          Los cambios crean otra versión; no modifican documentos ni plantillas
          anteriores.
        </p>
        <button disabled={disabled} type="submit">
          Guardar nueva versión
        </button>
        <button
          type="button"
          disabled={durable.busy}
          onClick={() => void previewNow()}
        >
          Vista previa de muestra
        </button>
      </form>
      {preview?.pages.map((p, i) => (
        <img
          key={i}
          src={p}
          alt={`Muestra sin efectos comerciales, página ${i + 1}`}
          style={{ width: 500, maxWidth: "100%" }}
        />
      ))}
    </section>
  );
}
function sampleDocument(branch: string): PrintableDocument {
  const data = {
    sucursalId: branch,
    clienteId: null,
    fecha: "2026-11-10",
    vigenteHasta: null,
    moneda: "NIO" as const,
    condicionesPago: "Condiciones de ejemplo",
    condicionesComerciales: "Muestra: no crea documentos ni ventas.",
    observaciones: "Vista previa sin efectos comerciales.",
    items: [
      {
        productoId: "00000000-0000-4000-8000-000000000001",
        cantidad: 2,
        precioUnitario: 100,
        descuento: 10,
        tasa: 0.15,
      },
    ],
  };
  const calculated = commercialAmounts(data),
    snapshot = {
      ...data,
      ...calculated,
      items: calculated.items.map((i) => ({
        ...i,
        nombre: "Producto / servicio de ejemplo",
      })),
      issuer: {
        nombre: "Empresa de ejemplo",
        nombreComercial: "Vista previa de muestra",
        direccion: "Dirección comercial",
        telefono: "Teléfono",
        email: "correo@example.invalid",
        logoUrl: null,
        ruc: null,
        perfilFiscal: "no_registrado",
      },
      cliente: { nombre: "Cliente de ejemplo", identificacion: null },
      vendedor: "Preparado por el comercio",
      documental: {
        schemaVersion: 1 as const,
        clase: "oferta_comercial" as const,
        fiscal: false as const,
        serie: null,
        autorizacion: null,
        ejemplar: "original" as const,
        pie: commercialLegend,
      },
    };
  return {
    id: "00000000-0000-4000-8000-000000000001",
    origenId: "00000000-0000-4000-8000-000000000001",
    kind: "cotizacion",
    numero: "MUESTRA-SIN-VALIDEZ",
    version: 1,
    estado: "borrador",
    snapshot,
    ventaId: null,
    events: [],
    revisions: [],
  };
}
