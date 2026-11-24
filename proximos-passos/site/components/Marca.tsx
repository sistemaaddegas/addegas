import type { CSSProperties } from "react";

const FF = "var(--font-archivo), sans-serif";

// [word, base rotate, hover rotate]
const WORDS: [string, number, number][] = [
  ["Urbana", -2, 3], ["Popular", 1.5, -2.25], ["Irregular", -1, 1.5],
  ["Vibrante", 2, -3], ["Espontânea", -1.5, 2.25], ["Expressiva", 1, -1.5],
];

const SISTEMA = ["Organizado", "Simples", "Intuitivo", "Rápido", "Limpo", "Funcional"];

const cardHead: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 };

export default function Marca() {
  return (
    <section id="marca" style={{ background: "#0B0B0B", padding: "clamp(88px,11vw,160px) clamp(16px,4vw,40px)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#9A9A9A", marginBottom: "clamp(40px,6vw,72px)" }}>
          <span>Marca × Sistema</span>
          <span>05</span>
        </div>
        <h2 data-reveal style={{ margin: 0, font: `900 clamp(36px,5.4vw,84px)/.94 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.015em", textWrap: "balance" }}>
          Irreverente na cara.
          <br />
          <span style={{ color: "#FBC009" }}>Organizado por dentro.</span>
        </h2>
        <div data-stagger style={{ marginTop: "clamp(40px,5vw,64px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,500px),1fr))", gap: 12 }}>
          <div style={{ background: "#050505", border: "1px solid #232323", borderRadius: 24, padding: "clamp(28px,3.6vw,48px)", display: "flex", flexDirection: "column", gap: "clamp(28px,3vw,40px)", minWidth: 0 }}>
            <div style={cardHead}>
              <span style={{ font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#9A9A9A" }}>Marca</span>
              <span style={{ font: `500 14px/1.3 ${FF}`, color: "#8F8F8F" }}>Como a gente fala</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", alignItems: "center" }}>
              {WORDS.map(([w, r, rh]) => (
                <span
                  key={w}
                  className="mword"
                  style={{ display: "inline-block", font: `900 clamp(28px,3vw,44px)/1.05 ${FF}`, fontStretch: "88%", textTransform: "uppercase", color: "#FBC009", transform: `rotate(${r}deg)`, transition: "transform .35s cubic-bezier(.3,1.6,.5,1), color .2s", cursor: "default", ["--rh" as string]: `${rh}deg` } as CSSProperties}
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
          <div style={{ background: "#EFEBE3", color: "#0A0A0A", borderRadius: 24, padding: "clamp(28px,3.6vw,48px)", display: "flex", flexDirection: "column", gap: "clamp(20px,2.4vw,32px)", minWidth: 0 }}>
            <div style={cardHead}>
              <span style={{ font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#5E5A52" }}>Sistema</span>
              <span style={{ font: `500 14px/1.3 ${FF}`, color: "#5E5A52" }}>Como a gente funciona</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", columnGap: 24 }}>
              {SISTEMA.map((s, i) => (
                <li key={s} className="sys-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 10px", margin: "0 -10px", borderBottom: "1.5px solid #0A0A0A", font: `600 clamp(19px,1.7vw,24px)/1.1 ${FF}`, transition: "background .25s" }}>
                  {s}
                  <span style={{ font: `600 11px/1 ${FF}`, letterSpacing: ".2em", color: "#5E5A52" }}>{String(i + 1).padStart(2, "0")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div data-reveal style={{ marginTop: 12, borderRadius: 24, background: "#FBC009", color: "#0A0A0A", padding: "clamp(20px,2.4vw,28px) clamp(28px,3.6vw,48px)", font: `800 clamp(16px,1.6vw,22px)/1.3 ${FF}`, textTransform: "uppercase", textWrap: "balance" }}>
          A identidade pode ser irreverente sem que o sistema seja confuso.
        </div>
      </div>
    </section>
  );
}
