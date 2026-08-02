"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Barcode,
  Cable,
  Keyboard,
  Printer,
  RefreshCw,
  Store,
  Usb,
} from "lucide-react";
import { useBarcodeScanner } from "@/components/dispositivos/useBarcodeScanner";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

type HIDDeviceLike = {
  productName?: string;
  vendorId?: number;
  productId?: number;
};

type USBDeviceLike = {
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  vendorId?: number;
  productId?: number;
};

type SerialPortLike = {
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
};

type DeviceNavigator = Navigator & {
  hid?: {
    getDevices: () => Promise<HIDDeviceLike[]>;
    requestDevice: (options: { filters: Array<Record<string, unknown>> }) => Promise<HIDDeviceLike[]>;
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
  };
  usb?: {
    getDevices: () => Promise<USBDeviceLike[]>;
    requestDevice: (options: { filters: Array<Record<string, unknown>> }) => Promise<USBDeviceLike>;
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
  };
  serial?: {
    getPorts: () => Promise<SerialPortLike[]>;
    requestPort: (options?: Record<string, unknown>) => Promise<SerialPortLike>;
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
  };
};

type FilaDispositivo = {
  id: string;
  tipo: "lector" | "impresora" | "serial";
  nombre: string;
  detalle: string;
};

function navDispositivos(): DeviceNavigator {
  return navigator as DeviceNavigator;
}

function hex(valor?: number): string {
  if (valor === undefined) return "----";
  return `0x${valor.toString(16).padStart(4, "0").toUpperCase()}`;
}

export function DispositivosPanel() {
  const { mostrar } = useToast();
  const [hid, setHid] = useState<HIDDeviceLike[]>([]);
  const [usb, setUsb] = useState<USBDeviceLike[]>([]);
  const [serial, setSerial] = useState<SerialPortLike[]>([]);
  const [cargando, setCargando] = useState(false);
  const [ultimoCodigo, setUltimoCodigo] = useState("");

  const soporte = useMemo(() => {
    if (typeof navigator === "undefined") {
      return { hid: false, usb: false, serial: false };
    }
    const nav = navDispositivos();
    return {
      hid: Boolean(nav.hid),
      usb: Boolean(nav.usb),
      serial: Boolean(nav.serial),
    };
  }, []);

  const refrescar = useCallback(async () => {
    const nav = navDispositivos();
    setCargando(true);
    const [hidDevices, usbDevices, serialPorts] = await Promise.all([
      nav.hid?.getDevices().catch(() => []) ?? Promise.resolve([]),
      nav.usb?.getDevices().catch(() => []) ?? Promise.resolve([]),
      nav.serial?.getPorts().catch(() => []) ?? Promise.resolve([]),
    ]);
    setHid(hidDevices);
    setUsb(usbDevices);
    setSerial(serialPorts);
    setCargando(false);
  }, []);

  useEffect(() => {
    refrescar();
    const nav = navDispositivos();
    const listener = () => refrescar();
    nav.hid?.addEventListener?.("connect", listener);
    nav.hid?.addEventListener?.("disconnect", listener);
    nav.usb?.addEventListener?.("connect", listener);
    nav.usb?.addEventListener?.("disconnect", listener);
    nav.serial?.addEventListener?.("connect", listener);
    nav.serial?.addEventListener?.("disconnect", listener);
    return () => {
      nav.hid?.removeEventListener?.("connect", listener);
      nav.hid?.removeEventListener?.("disconnect", listener);
      nav.usb?.removeEventListener?.("connect", listener);
      nav.usb?.removeEventListener?.("disconnect", listener);
      nav.serial?.removeEventListener?.("connect", listener);
      nav.serial?.removeEventListener?.("disconnect", listener);
    };
  }, [refrescar]);

  useBarcodeScanner({
    onScan: (codigo) => {
      setUltimoCodigo(codigo);
      mostrar("success", `Lector detecto ${codigo}`);
    },
  });

  async function pedirHid() {
    const nav = navDispositivos();
    if (!nav.hid) {
      mostrar("warning", "Este navegador no soporta WebHID");
      return;
    }
    try {
      await nav.hid.requestDevice({ filters: [] });
      await refrescar();
    } catch {
      mostrar("warning", "No se autorizo ningun lector HID");
    }
  }

  async function pedirImpresoraUsb() {
    const nav = navDispositivos();
    if (!nav.usb) {
      mostrar("warning", "Este navegador no soporta WebUSB");
      return;
    }
    try {
      await nav.usb.requestDevice({ filters: [{ classCode: 7 }] });
      await refrescar();
    } catch {
      mostrar("warning", "No se autorizo ninguna impresora USB");
    }
  }

  async function pedirSerial() {
    const nav = navDispositivos();
    if (!nav.serial) {
      mostrar("warning", "Este navegador no soporta WebSerial");
      return;
    }
    try {
      await nav.serial.requestPort();
      await refrescar();
    } catch {
      mostrar("warning", "No se autorizo ningun puerto serial");
    }
  }

  const filas: FilaDispositivo[] = [
    ...hid.map((d, index) => ({
      id: `hid-${index}-${d.vendorId}-${d.productId}`,
      tipo: "lector" as const,
      nombre: d.productName || "Dispositivo HID autorizado",
      detalle: `Vendor ${hex(d.vendorId)} / Product ${hex(d.productId)}`,
    })),
    ...usb.map((d, index) => ({
      id: `usb-${index}-${d.vendorId}-${d.productId}`,
      tipo: "impresora" as const,
      nombre: [d.manufacturerName, d.productName].filter(Boolean).join(" ") || "Dispositivo USB autorizado",
      detalle: `Vendor ${hex(d.vendorId)} / Product ${hex(d.productId)}${d.serialNumber ? ` / Serie ${d.serialNumber}` : ""}`,
    })),
    ...serial.map((d, index) => {
      const info = d.getInfo?.() ?? {};
      return {
        id: `serial-${index}-${info.usbVendorId}-${info.usbProductId}`,
        tipo: "serial" as const,
        nombre: "Puerto serial autorizado",
        detalle: `Vendor ${hex(info.usbVendorId)} / Product ${hex(info.usbProductId)}`,
      };
    }),
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Lector de barras" subtitle="Teclado rapido o HID" />
          <CardBody className="space-y-4">
            <EstadoSoporte soportado={soporte.hid} texto="WebHID" />
            <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3 text-small">
              <div className="flex items-center gap-2 font-medium">
                <Barcode size={15} />
                {ultimoCodigo || "Esperando escaneo"}
              </div>
              <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                Los lectores que escriben como teclado funcionan sin permiso extra.
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={pedirHid}>
              <Keyboard size={14} /> Autorizar lector
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Impresora de facturas" subtitle="USB o dialogo de impresion" />
          <CardBody className="space-y-4">
            <EstadoSoporte soportado={soporte.usb} texto="WebUSB" />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={pedirImpresoraUsb}>
                <Usb size={14} /> Autorizar USB
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.print()}>
                <Printer size={14} /> Probar
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Caja / cajon" subtitle="Serial o conectado a impresora" />
          <CardBody className="space-y-4">
            <EstadoSoporte soportado={soporte.serial} texto="WebSerial" />
            <Button variant="secondary" size="sm" onClick={pedirSerial}>
              <Cable size={14} /> Autorizar puerto
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Dispositivos reconocidos"
          subtitle={`${filas.length} autorizados en este navegador`}
          actions={
            <Button variant="ghost" size="sm" onClick={refrescar} loading={cargando}>
              <RefreshCw size={14} /> Actualizar
            </Button>
          }
        />
        <CardBody>
          {filas.length === 0 ? (
            <div className="rounded-md border border-dashed border-[color:var(--color-border)] p-6 text-center text-small text-[color:var(--color-text-muted)]">
              Autoriza un lector, impresora o puerto para verlo aqui.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-[color:var(--color-border)]">
              <table className="w-full text-small">
                <thead className="bg-[color:var(--color-surface-2)]">
                  <tr>
                    <th className="text-label px-3 py-2 text-left">Tipo</th>
                    <th className="text-label px-3 py-2 text-left">Nombre</th>
                    <th className="text-label px-3 py-2 text-left">Detalle</th>
                    <th className="text-label px-3 py-2 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => (
                    <tr key={fila.id} className="border-t border-[color:var(--color-border)]">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          {fila.tipo === "lector" ? (
                            <Barcode size={14} />
                          ) : fila.tipo === "impresora" ? (
                            <Printer size={14} />
                          ) : (
                            <Store size={14} />
                          )}
                          {fila.tipo === "lector"
                            ? "Lector"
                            : fila.tipo === "impresora"
                              ? "Impresora"
                              : "Caja/serial"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">{fila.nombre}</td>
                      <td className="px-3 py-2 font-mono text-[12px] text-[color:var(--color-text-muted)]">
                        {fila.detalle}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="success">
                          <BadgeCheck size={12} /> Reconocido
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function EstadoSoporte({
  soportado,
  texto,
}: {
  soportado: boolean;
  texto: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-small">
      <span>{texto}</span>
      <Badge variant={soportado ? "success" : "warning"}>
        {soportado ? "Disponible" : "No soportado"}
      </Badge>
    </div>
  );
}
