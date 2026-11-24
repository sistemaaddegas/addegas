"use client";

import { useEffect, useRef, useState } from "react";
import { IconWa, IconClose } from "./icons";
import { WA_DEFAULT } from "@/lib/site";

const FF = "var(--font-archivo), sans-serif";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let already = false;
    try { already = sessionStorage.getItem("addegas_chat_seen") === "1"; } catch {}
    if (already) {
      setSeen(true);
    } else if (window.innerWidth >= 700) {
      timer.current = setTimeout(() => {
        setOpen((o) => {
          if (o) return o;
          setSeenFlag();
          return true;
        });
      }, 5000);
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setSeenFlag(); } };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer.current); window.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => {
    if (open && cardRef.current) {
      cardRef.current.animate(
        [{ opacity: 0, transform: "translateY(18px) scale(.9)" }, { opacity: 1, transform: "none" }],
        { duration: 420, easing: "cubic-bezier(.2,1.3,.4,1)", fill: "backwards" }
      );
    }
  }, [open]);

  const setSeenFlag = () => {
    setSeen(true);
    try { sessionStorage.setItem("addegas_chat_seen", "1"); } catch {}
  };

  const toggle = () => {
    clearTimeout(timer.current);
    setSeenFlag();
    setOpen((v) => !v);
  };

  const showBadge = !open && !seen;

  return (
    <div style={{ position: "fixed", right: "clamp(14px,2.4vw,28px)", bottom: "clamp(14px,2.4vw,28px)", zIndex: 80, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 16, pointerEvents: "none" }}>
      {open ? (
        <div ref={cardRef} role="dialog" aria-label="Fale com a Addegas no WhatsApp" style={{ pointerEvents: "auto", width: "min(330px, calc(100vw - 32px))", boxSizing: "border-box", padding: 22, borderRadius: 20, background: "#EFEBE3", color: "#0A0A0A", boxShadow: "0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.06)", transformOrigin: "100% 100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/assets/app-icon.png" alt="" style={{ width: 52, height: 52, flex: "none", borderRadius: "50%", display: "block", boxShadow: "0 0 0 2px #FBC009" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ font: `800 18px/1.1 ${FF}` }}>Addegas</span>
              <span style={{ display: "flex", alignItems: "center", gap: 7, font: `500 14px/1 ${FF}`, color: "#4A4740" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 0 3px rgba(34,197,94,.2)", flex: "none" }} />
                Online agora
              </span>
            </div>
          </div>
          <p style={{ margin: "16px 0 18px", font: `500 17px/1.45 ${FF}`, color: "#1C1B18", textWrap: "pretty" }}>
            Quer levar a Addegas pra sua adega? Chama a gente e fica sabendo de tudo antes do lançamento.
          </p>
          <a href={WA_DEFAULT} target="_blank" rel="noopener noreferrer" className="chat-wa-brand" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 54, borderRadius: 14, background: "#0A0A0A", color: "#FBC009", font: `800 16px/1 ${FF}`, transition: "background .2s, transform .2s" }}>
            <IconWa size={30} /> Conversar no WhatsApp
          </a>
        </div>
      ) : null}
      <button type="button" onClick={toggle} aria-label="Conversar no WhatsApp" className="fab" style={{ pointerEvents: "auto", position: "relative", width: 62, height: 62, padding: 0, border: "none", borderRadius: "50%", background: "transparent", cursor: "pointer", transition: "transform .25s cubic-bezier(.3,1.5,.5,1)" }}>
        {!open ? <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid #FBC009", animation: "addPulse 2.4s ease-out infinite", pointerEvents: "none" }} /> : null}
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#FBC009", color: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 34px rgba(0,0,0,.5)" }}>
          {open ? <IconClose /> : <IconWa size={30} />}
        </span>
        {showBadge ? (
          <span style={{ position: "absolute", top: -3, right: -3, width: 22, height: 22, boxSizing: "border-box", borderRadius: "50%", background: "#0A0A0A", color: "#FBC009", border: "2px solid #FBC009", font: `800 11px/18px ${FF}`, textAlign: "center" }}>1</span>
        ) : null}
      </button>
    </div>
  );
}
