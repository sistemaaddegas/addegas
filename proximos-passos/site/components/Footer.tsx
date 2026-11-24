import type { CSSProperties } from "react";
import { IconIg, IconYt, IconX, IconWa, IconMail } from "./icons";
import { SOCIAL, WA_DEFAULT, EMAIL } from "@/lib/site";

const FF = "var(--font-archivo), sans-serif";

const FOOT_WORDS: [string, number][] = [["Sextou", -2], ["na", 2], ["adega.", -1.5]];

const circle: CSSProperties = { width: 44, height: 44, flex: "none", borderRadius: "50%", border: "1.5px solid #333333", display: "flex", alignItems: "center", justifyContent: "center" };
const link: CSSProperties = { display: "flex", alignItems: "center", gap: 14, padding: "6px 0", color: "#FFFFFF", font: `600 16px/1 ${FF}`, transition: "color .2s" };
const colLabel: CSSProperties = { font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#9A9A9A", marginBottom: 12 };

export default function Footer() {
  return (
    <footer id="contato" style={{ background: "#050505", color: "#FFFFFF" }}>
      <div data-pattern style={{ height: "clamp(96px,10vw,144px)", backgroundColor: "#FBC009", backgroundImage: "url(/assets/dd-pattern.png)", backgroundSize: "120px 120px", backgroundRepeat: "repeat" }} />
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(72px,9vw,128px) clamp(16px,4vw,40px) 36px" }}>
        <div data-reveal style={{ display: "flex", flexWrap: "wrap", gap: "0 .22em", font: `900 clamp(52px,11vw,184px)/.86 ${FF}`, fontStretch: "86%", textTransform: "uppercase", letterSpacing: "-.02em", color: "#FBC009" }}>
          {FOOT_WORDS.map(([w, rh]) => (
            <span key={w} className="foot-word" style={{ display: "inline-block", transition: "transform .35s cubic-bezier(.3,1.6,.5,1), color .2s", cursor: "default", ["--rh" as string]: `${rh}deg` } as CSSProperties}>{w}</span>
          ))}
        </div>
        <p style={{ margin: "24px 0 0", maxWidth: "44ch", font: `400 clamp(17px,1.4vw,20px)/1.5 ${FF}`, color: "#BDBDBD" }}>
          Segue a Addegas nas redes e acompanha o lançamento de perto.
        </p>
        <div style={{ marginTop: "clamp(56px,7vw,88px)", paddingTop: 48, borderTop: "1px solid #222222", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <img src="/assets/logo-dark.png" alt="Addegas" style={{ width: 170, height: "auto", display: "block" }} />
            <span style={{ font: `500 15px/1.5 ${FF}`, color: "#BDBDBD" }}>Gestão pra adega.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={colLabel}>Redes</span>
            <a href={SOCIAL.instagram} target="_blank" rel="me noopener noreferrer" className="foot-link" style={link}><span style={circle}><IconIg /></span>@sistema.addegas</a>
            <a href={SOCIAL.youtube} target="_blank" rel="me noopener noreferrer" className="foot-link" style={link}><span style={circle}><IconYt /></span>@addegas</a>
            <a href={SOCIAL.x} target="_blank" rel="me noopener noreferrer" className="foot-link" style={link}><span style={circle}><IconX /></span>@sistemaaddegas</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={colLabel}>Fala com a gente</span>
            <a href={WA_DEFAULT} target="_blank" rel="noopener noreferrer" className="foot-link" style={link}><span style={circle}><IconWa /></span>(11) 98675-5103</a>
            <a href={`mailto:${EMAIL}`} className="foot-link" style={{ ...link, wordBreak: "break-all" }}><span style={circle}><IconMail /></span>{EMAIL}</a>
          </div>
        </div>
        <div style={{ marginTop: 64, paddingTop: 24, borderTop: "1px solid #222222", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, font: `500 13px/1.4 ${FF}`, color: "#8F8F8F" }}>
          <span>© 2026 Addegas. Todos os direitos reservados.</span>
          <span>A marca tem a cara da adega.</span>
        </div>
      </div>
    </footer>
  );
}
