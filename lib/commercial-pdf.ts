import { commercialLegend, type CommercialDocument, type CommercialSnapshot } from "./commercial-core";
import {defaultDocumentDesign,type DocumentDesign} from './document-design';
export type PrintableKind='cotizacion'|'proforma'|'comprobante_interno'|'nota_credito'|'recibo_pago'|'estado_cuenta';
export type PrintableDocument=Omit<CommercialDocument,'kind'|'snapshot'|'estado'> & {kind:PrintableKind;estado:string;snapshot:Omit<CommercialSnapshot,'items'|'moneda'|'documental'> & {moneda:string;documental:Omit<CommercialSnapshot['documental'],'clase'> & {clase:string};items:Array<Omit<CommercialSnapshot['items'][number],'productoId'> & {productoId?:string}>}};
export type CommercialPdf = { bytes: Uint8Array; pages: string[];format:DocumentDesign['format'] };
/** Rasterized local canvas: Unicode text, bounded images, no HTML/JS templates or PDF library. */
export async function renderCommercialPdf(
  d: PrintableDocument,
  format: DocumentDesign["format"],
  design?:DocumentDesign,
  ejemplar:"original"|"duplicado"="original",
): Promise<CommercialPdf> {
  const settings={...defaultDocumentDesign,...design,format};
  const width = format==='termico80'?302:816,
    height = format === "carta" ? 1056 : format==='media-carta'?528:1123,
    pages: string[] = [];
  let canvas!: HTMLCanvasElement,
    ctx!: CanvasRenderingContext2D,
    y = 0;
  let headerMode=true;
  const fontPx=design?settings.fontSize*4/3:15;
  const margin=Math.min(settings.margin,width/5),usable=width-margin*2,lineHeight=fontPx+6;
  const newPage = () => {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#171323";
    ctx.font = `${fontPx}px ${settings.font}`;
    y = margin+4;
  };
  const finish = () => {
    ctx.font = `${Math.min(fontPx,11)}px ${settings.font}`;ctx.textAlign="left";
    ctx.fillText(
      `${d.numero} · revisión ${d.version} · página ${pages.length + 1}`,
      margin,
      height - 18,
      usable,
    );
    pages.push(canvas.toDataURL("image/jpeg", 0.94));
  };
  const line = (text: string, bold = false) => {
    const flush = (row: string) => {
      if (y > height - 54) {
        finish();
        newPage();
      }
      ctx.font = `${bold ? "bold " : ""}${fontPx}px ${settings.font}`;
      ctx.textAlign=headerMode?settings.alignment:"left";ctx.fillStyle=bold?settings.accent:"#171323";
      const x=ctx.textAlign==="center"?width/2:ctx.textAlign==="right"?width-margin:margin;ctx.fillText(row,x,y);
      y += lineHeight;
    };
    for (const paragraph of text.split("\n")) {
      let row = "";
      ctx.font = `${bold ? "bold " : ""}${fontPx}px ${settings.font}`;
      for (const char of paragraph) {
        if (ctx.measureText(row + char).width > usable && row) {
          flush(row);
          row = "";
        }
        row += char;
      }
      flush(row);
    }
  };
  newPage();
  const s = d.snapshot;
  const logoSource=design?settings.logoData:s.issuer.logoUrl;
  if (logoSource) {
    const url = new URL(logoSource, window.location.href);
    if (!["https:", "http:"].includes(url.protocol)&&!(design&&url.protocol==="data:"))
      throw new Error("URL del logo no permitida.");
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("No se pudo cargar el logo de la empresa.")),
        8000,
      );
      image.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new Error("El logo debe permitir acceso para generar el PDF."));
      };
      image.src = url.href;
    });
    const ratio = Math.min(140 / image.width, 65 / image.height);
    const logoW=image.width*ratio;const logoX=settings.alignment==='center'?(width-logoW)/2:settings.alignment==='right'?width-margin-logoW:margin;
    ctx.drawImage(image, logoX, y, logoW, image.height * ratio);
    y += 75;
  }
  if(settings.header)line(settings.header,true);
  line(s.issuer.nombreComercial || s.issuer.nombre, true);
  if (s.issuer.perfilFiscal === "registrado" && s.issuer.ruc)
    line("RUC: " + s.issuer.ruc);
  line(
    [s.issuer.direccion, s.issuer.telefono, s.issuer.email]
      .filter(Boolean)
      .join(" · "),
  );
  const titles:Record<PrintableKind,string>={cotizacion:'COTIZACIÓN',proforma:'PROFORMA',comprobante_interno:'COMPROBANTE INTERNO / RECIBO DE VENTA',nota_credito:'NOTA DE CRÉDITO INTERNA',recibo_pago:'RECIBO DE PAGO',estado_cuenta:'ESTADO DE CUENTA'};
  line(titles[d.kind],true);line(ejemplar==='original'?'ORIGINAL':'DUPLICADO',true);
  line(
    `${d.numero} · revisión ${d.version} · ${design?'estado al emitir':'estado actual del origen'}: ${d.estado}`,
  );
  line(
    `Fecha: ${s.fecha.split("-").reverse().join("/")} · Vigente hasta: ${s.vigenteHasta?.split("-").reverse().join("/") || "Sin fecha"} · Moneda: ${s.moneda}`,
  );
  line(
    `Cliente: ${s.cliente?.nombre || "Cotización genérica"}${s.cliente?.identificacion ? " · " + s.cliente.identificacion : ""}`,
  );
  headerMode=false;
  const labels={producto:'Producto / servicio',cantidad:'Cantidad',precio:'Precio',descuento:'Descuento',impuesto:'Impuesto',total:'Total'};
  if(design&&format!=='termico80'){
    const values=(i:typeof s.items[number])=>({producto:i.nombre,cantidad:String(i.cantidad),precio:i.precioUnitario.toFixed(4),descuento:i.descuento.toFixed(2),impuesto:i.impuesto.toFixed(2),total:i.total.toFixed(2)});
    const row=(cells:string[],bold=false)=>{
      ctx.font=`${bold?'bold ':''}${fontPx}px ${settings.font}`;
      const wrapped=cells.map((text,index)=>{const result:string[]=[];let current='';const max=usable*settings.widths[index]/100-8;for(const char of text){if(current&&ctx.measureText(current+char).width>max){result.push(current);current='';}current+=char;}result.push(current);return result;});
      for(let part=0;part<Math.max(...wrapped.map(x=>x.length));part++){
        if(y>height-54){finish();newPage();}ctx.font=`${bold?'bold ':''}${fontPx}px ${settings.font}`;ctx.textAlign='left';ctx.fillStyle=bold?settings.accent:'#171323';let x=margin;
        wrapped.forEach((text,index)=>{ctx.fillText(text[part]??'',x,y);x+=usable*settings.widths[index]/100;});y+=lineHeight;
      }
      y+=4;
    };
    row(settings.columns.map(c=>labels[c]),true);for(const item of s.items)row(settings.columns.map(c=>values(item)[c]));
  }else{
    line('Producto / servicio · Cantidad × precio · Descuento · Impuesto · Total',true);
    for(const item of s.items){const values={producto:item.nombre,cantidad:String(item.cantidad),precio:item.precioUnitario.toFixed(4),descuento:item.descuento.toFixed(2),impuesto:item.impuesto.toFixed(2),total:item.total.toFixed(2)};line(settings.columns.map(c=>`${labels[c]}: ${values[c]}`).join(' · '));}
  }
  line(
    `Subtotal neto: ${s.amounts.subtotal.toFixed(2)} · Descuentos: ${s.amounts.descuentoTotal.toFixed(2)}`,
  );
  line(
    `Impuestos estimados: ${s.amounts.impuesto.toFixed(2)} · TOTAL: ${s.moneda} ${s.amounts.total.toFixed(2)}`,
    true,
  );
  if (s.condicionesPago) line("Condiciones de pago: " + s.condicionesPago);
  if (s.condicionesComerciales)
    line("Condiciones comerciales: " + s.condicionesComerciales);
  if (s.observaciones) line("Observaciones: " + s.observaciones);
  line("Preparado por: " + s.vendedor);
  line(['cotizacion','proforma'].includes(d.kind)?commercialLegend:'Comprobante interno: no constituye un documento fiscal autorizado.',true);
  if(settings.footer)line(settings.footer);
  finish();
  return {
    bytes: jpegPagesPdf(pages, width * 0.75, height * 0.75, width, height),
    pages,format,
  };
}
export function jpegPagesPdf(
  images: string[],
  w: number,
  h: number,
  pixelW: number,
  pixelH: number,
) {
  const encoder = new TextEncoder(),
    chunks: Uint8Array[] = [],
    offsets: number[] = [0];
  let size = 0;
  const push = (value: string | Uint8Array) => {
    const b = typeof value === "string" ? encoder.encode(value) : value;
    chunks.push(b);
    size += b.length;
  };
  const obj = (id: number, body: string | Uint8Array) => {
    offsets[id] = size;
    push(`${id} 0 obj\n`);
    push(body);
    push("\nendobj\n");
  };
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(
    2,
    `<< /Type /Pages /Count ${images.length} /Kids [${images.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`,
  );
  images.forEach((image, i) => {
    const id = 3 + i * 3;
    obj(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`,
    );
    const bytes = Uint8Array.from(atob(image.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    offsets[id + 1] = size;
    push(
      `${id + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelW} /Height ${pixelH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`,
    );
    push(bytes);
    push("\nendstream\nendobj\n");
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(
      id + 2,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });
  const xref = size;
  push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i++)
    push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
  );
  const result = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  return result;
}
