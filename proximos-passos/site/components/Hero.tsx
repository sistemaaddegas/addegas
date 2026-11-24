import type { CSSProperties } from "react";
import { IconArrow, IconWa } from "./icons";
import { WA_DEFAULT } from "@/lib/site";

const FF = "var(--font-archivo), sans-serif";
const abs: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

function NeonLogo() {
  return (
    <div
      data-neon
      role="img"
      aria-label="Addegas"
      style={{ position: "relative", width: "min(940px, 88vw)", aspectRatio: "3544 / 1200" }}
    >
      <div
        data-neon-glow
        style={{
          position: "absolute",
          left: "12%",
          width: "44%",
          top: "-30%",
          bottom: "-40%",
          background: "radial-gradient(closest-side, rgba(251,192,9,.32), rgba(251,192,9,0))",
          filter: "blur(24px)",
          pointerEvents: "none",
        }}
      />
      <img src="/assets/logo-letters.png" alt="" style={abs} />
      <img src="/assets/logo-dd.png" alt="" style={{ ...abs, filter: "brightness(.3) saturate(.6)" }} />
      <img
        data-neon-lit
        src="/assets/logo-dd.png"
        alt=""
        style={{
          ...abs,
          filter:
            "drop-shadow(0 0 6px rgba(251,192,9,.95)) drop-shadow(0 0 22px rgba(251,192,9,.6)) drop-shadow(0 0 60px rgba(251,192,9,.4))",
        }}
      />
      <div style={{ position: "absolute", right: "-2%", top: "-30%", width: "clamp(84px, 12vw, 150px)", aspectRatio: "1" }}>
        <svg
          viewBox="0 0 200 200"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", animation: "addSpin 22s linear infinite" }}
          aria-hidden="true"
        >
          <defs>
            <path id="addCirc" d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" />
          </defs>
          <text fill="#FBC009" fontSize={16.5} fontWeight={800} fontFamily={FF} letterSpacing={2}>
            <textPath href="#addCirc" textLength={498} lengthAdjust="spacing">
              14 DIAS GRÁTIS • ADDEGAS • 14 DIAS GRÁTIS •{" "}
            </textPath>
          </text>
        </svg>
        <img
          src="/assets/app-icon.png"
          alt=""
          style={{
            position: "absolute",
            left: "26%",
            top: "26%",
            width: "48%",
            height: "48%",
            borderRadius: "22%",
            boxShadow: "0 0 0 1px rgba(255,255,255,.14), 0 10px 30px rgba(0,0,0,.6)",
          }}
        />
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section
      id="topo"
      data-hero
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "112px clamp(16px,4vw,40px) 110px",
        overflow: "hidden",
        background: "#0B0B0B",
        isolation: "isolate",
      }}
    >
      <div data-spot style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: -1 }} />
      <div data-grain style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.1, mixBlendMode: "overlay", zIndex: 2 }} />
      <div
        data-hero-inner
        style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(22px,3.4vw,40px)", willChange: "transform" }}
      >
        <a
          data-intro
          href="#planos"
          className="wa-cta-yellow hide-wide"
          style={{
            width: "100%",
            maxWidth: 360,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            height: 54,
            borderRadius: 999,
            background: "#FBC009",
            color: "#0A0A0A",
            font: `800 15px/1 ${FF}`,
            letterSpacing: ".05em",
            textTransform: "uppercase",
            boxShadow: "0 10px 36px rgba(251,192,9,.28)",
          }}
        >
          Começar grátis <IconArrow />
        </a>
        <div data-intro style={{ display: "flex", alignItems: "center", gap: 10, font: `600 12px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#BDBDBD" }}>
          <span data-pulse style={{ width: 8, height: 8, borderRadius: "50%", background: "#FBC009", flex: "none" }} />
          <h1 style={{ margin: 0, font: "inherit", letterSpacing: "inherit", color: "inherit" }}>Sistema de gestão e ERP para adegas</h1>
        </div>
        <div data-intro data-delay="150" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <NeonLogo />
        </div>
        <p
          data-intro
          data-delay="550"
          style={{ margin: 0, font: `900 clamp(36px,6vw,88px)/.92 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.01em", textAlign: "center", textWrap: "balance" }}
        >
          Gestão pra{" "}
          <span
            data-wipe
            data-delay="1150"
            style={{ backgroundImage: "linear-gradient(#FBC009,#FBC009)", backgroundRepeat: "no-repeat", backgroundSize: "100% 100%", color: "#0A0A0A", padding: "0 .1em" }}
          >
            adega.
          </span>
        </p>
        <p data-intro data-delay="700" style={{ margin: 0, maxWidth: 620, textAlign: "center", font: `400 clamp(16px,1.35vw,19px)/1.55 ${FF}`, color: "#C4C4C4", textWrap: "pretty" }}>
          O sistema feito pra adegas, depósitos de bebida e pequenos negócios do setor. Estoque, caixa e combos no controle — de bairro em bairro, do Oiapoque ao Chuí.
        </p>
        <div data-intro data-delay="850" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
          <a
            data-mag
            href="#planos"
            className="cta-primary hide-narrow"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 56,
              padding: "0 28px",
              borderRadius: 999,
              background: "#FBC009",
              color: "#0A0A0A",
              font: `800 15px/1 ${FF}`,
              letterSpacing: ".05em",
              textTransform: "uppercase",
              transition: "transform .3s cubic-bezier(.2,.8,.2,1), background .2s, box-shadow .3s",
              boxShadow: "0 0 0 rgba(251,192,9,0)",
            }}
          >
            Começar grátis <IconArrow />
          </a>
          <a
            data-mag
            href={WA_DEFAULT}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-outline"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 56,
              padding: "0 26px",
              borderRadius: 999,
              border: "1.5px solid #3A3A3A",
              color: "#FFFFFF",
              font: `700 15px/1 ${FF}`,
              letterSpacing: ".05em",
              textTransform: "uppercase",
              transition: "transform .3s cubic-bezier(.2,.8,.2,1), border-color .2s, color .2s",
            }}
          >
            <IconWa /> Chamar no WhatsApp
          </a>
        </div>
      </div>
      <div style={{ position: "absolute", left: "50%", bottom: 26, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, font: `600 10px/1 ${FF}`, letterSpacing: ".3em", textTransform: "uppercase", color: "#8F8F8F" }}>
        <span>Role</span>
        <span style={{ position: "relative", width: 1, height: 44, background: "#2E2E2E", overflow: "hidden", display: "block" }}>
          <span data-hint-dot style={{ position: "absolute", left: -1, top: 0, width: 3, height: 10, background: "#FBC009", display: "block" }} />
        </span>
      </div>
    </section>
  );
}
