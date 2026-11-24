"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { IconMenu, IconClose, IconWa } from "./icons";
import { APP_URL, WA_DEFAULT } from "@/lib/site";

const FF = "var(--font-archivo), sans-serif";

const NAV: [string, string][] = [
  ["Recursos", "#recursos"],
  ["Integrações", "#integracoes"],
  ["Pra quem é", "#pra-quem"],
  ["Na rua", "#na-rua"],
  ["App", "#app"],
  ["Planos", "#planos"],
  ["Contato", "#contato"],
  ["Entrar", `${APP_URL}/entrar`],
];

const navLink: CSSProperties = { font: `600 13px/20px ${FF}`, letterSpacing: ".1em", textTransform: "uppercase", color: "#D4D4D4", whiteSpace: "nowrap" };
const menuLink: CSSProperties = { padding: "14px 0", borderBottom: "1px solid #222222", color: "#FFFFFF", font: `900 clamp(30px,9vw,44px)/1 ${FF}`, fontStretch: "88%", textTransform: "uppercase" };

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onResize = () => { if (window.innerWidth >= 1120) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); };
  }, []);

  return (
    <>
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "rgba(11,11,11,.9)", backdropFilter: "blur(14px) saturate(1.4)", WebkitBackdropFilter: "blur(14px) saturate(1.4)", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div data-progress style={{ position: "absolute", left: 0, top: 0, height: 3, width: "100%", background: "#FBC009", transformOrigin: "0 50%", transform: "scaleX(0)" }} />
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 clamp(16px,4vw,40px)", height: 72, display: "flex", alignItems: "center", gap: "clamp(10px,2vw,24px)", boxSizing: "border-box" }}>
          <a href="#topo" className="hide-narrow" style={{ display: "flex", flex: "none" }}>
            <img src="/assets/logo-dark.png" alt="Addegas" style={{ height: 30, width: "auto", display: "block" }} />
          </a>
          <nav className="hide-narrow" style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", gap: "clamp(14px,2vw,30px)" }}>
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="nav-link" style={navLink}>{label}</a>
            ))}
          </nav>
          {/* Mobile: spacer + centered logo + hamburger */}
          <span aria-hidden="true" className="hide-wide" style={{ width: 44, flex: "none" }} />
          <a href="#topo" aria-label="Addegas — início" className="hide-wide" style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
            <img src="/assets/logo-dark.png" alt="Addegas" style={{ height: 42, width: "auto", display: "block" }} />
          </a>
          <a data-mag href="#planos" className="hdr-cta hide-narrow" style={{ flex: "none", display: "flex", alignItems: "center", height: 42, padding: "0 18px", borderRadius: 999, background: "#FBC009", color: "#0A0A0A", font: `800 13px/1 ${FF}`, letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", transition: "transform .3s cubic-bezier(.2,.8,.2,1), background .2s" }}>
            Começar grátis
          </a>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? "Fechar menu" : "Abrir menu"} className="hide-wide" style={{ flex: "none", width: 44, height: 44, padding: 0, borderRadius: "50%", border: "1.5px solid #3A3A3A", background: "#0B0B0B", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </header>

      {open ? (
        <div className="hide-wide" style={{ position: "fixed", inset: 0, zIndex: 45, background: "#0B0B0B", padding: "104px 24px 32px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", overflowY: "auto" }}>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            {NAV.map(([label, href]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="menu-link" style={menuLink}>{label}</a>
            ))}
          </nav>
          <a href={WA_DEFAULT} target="_blank" rel="noopener noreferrer" className="wa-cta-yellow" style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 56, borderRadius: 999, background: "#FBC009", color: "#0A0A0A", font: `800 15px/1 ${FF}`, letterSpacing: ".05em", textTransform: "uppercase" }}>
            <IconWa /> Chamar no WhatsApp
          </a>
        </div>
      ) : null}
    </>
  );
}
