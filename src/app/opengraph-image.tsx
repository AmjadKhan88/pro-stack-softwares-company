import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

export const alt = "Pro Stack Creations: software built to solve real business problems";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#121310",
        color: "#f3efe7",
        padding: 72,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "#de5527",
            color: "#121310",
            fontSize: 36,
            fontWeight: 700,
          }}
        >
          P
        </div>
        <div style={{ display: "flex", fontSize: 32 }}>{siteConfig.name}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 68, lineHeight: 1.1, fontWeight: 700, maxWidth: 900 }}>
          Software built to solve real business problems.
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#bcb2a0", marginTop: 24 }}>
          {siteConfig.location}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
