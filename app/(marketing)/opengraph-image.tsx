import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt =
  "ARCA — Punto de venta, inventario y contabilidad en un solo sistema";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "linear-gradient(135deg, #0b0416 0%, #241056 55%, #1e3a8a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "72px",
              height: "72px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #7c3aed, #2563eb)",
              fontSize: "40px",
              fontWeight: 700,
            }}
          >
            A
          </div>
          <div style={{ fontSize: "44px", fontWeight: 700, letterSpacing: "-1px" }}>
            ARCA
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <div
            style={{
              fontSize: "68px",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-2px",
              maxWidth: "980px",
            }}
          >
            El sistema operativo de tu negocio.
          </div>
          <div
            style={{
              fontSize: "32px",
              color: "rgba(255,255,255,0.72)",
              maxWidth: "900px",
              lineHeight: 1.35,
            }}
          >
            Punto de venta, inventario y contabilidad conectados en una sola
            plataforma.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            fontSize: "26px",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <span>Honduras</span>
          <span>·</span>
          <span>Nicaragua</span>
          <span>·</span>
          <span>Guatemala</span>
          <span>·</span>
          <span>Costa Rica</span>
          <span>·</span>
          <span>El Salvador</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
