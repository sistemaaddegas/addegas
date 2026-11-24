import type { CSSProperties } from "react";
import { IconWaHub, IconWa } from "./icons";

const FF = "var(--font-archivo), sans-serif";

const BENEFITS = [
  { n: "01", t: "Pedido em tempo real", d: "Chegou no app, apareceu no caixa." },
  { n: "02", t: "Estoque sincronizado", d: "Vendeu no app, baixou na prateleira." },
  { n: "03", t: "Cardápio num lugar só", d: "Muda o preço uma vez, atualiza em todos." },
  { n: "04", t: "Relatório por canal", d: "Quanto veio de cada app, no fechamento." },
];

const TILES: { src?: string; alt: string; left: string; top: string; delay: number; wa?: boolean }[] = [
  { src: "/assets/apps/ifood.png", alt: "iFood", left: "39.0%", top: "-1.0%", delay: 0 },
  { src: "/assets/apps/ze-delivery.png", alt: "Zé Delivery", left: "77.0%", top: "26.6%", delay: 280 },
  { src: "/assets/apps/99food.png", alt: "99Food", left: "62.5%", top: "71.4%", delay: 560 },
  { src: "/assets/apps/keeta.png", alt: "Keeta", left: "15.5%", top: "71.4%", delay: 840 },
  { alt: "WhatsApp", left: "1.0%", top: "26.6%", delay: 1120, wa: true },
];

const tileInner: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "24%",
  overflow: "hidden",
  boxShadow: "0 18px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08)",
  transition: "transform .35s cubic-bezier(.3,1.6,.5,1)",
};

const spoke = (x2: number, y2: number, path: string, begin: string) => (
  <>
    <line x1="50" y1="50" x2={x2} y2={y2} stroke="#3A3A3A" strokeWidth=".35" />
    <line x1="50" y1="50" x2={x2} y2={y2} stroke="#FBC009" strokeWidth=".5" strokeDasharray="1 2.2" strokeLinecap="round">
      <animate attributeName="stroke-dashoffset" from="0" to="6.4" dur="1.1s" repeatCount="indefinite" />
    </line>
    <circle r="1.25" fill="#FBC009">
      <animateMotion dur="2.4s" begin={begin} repeatCount="indefinite" path={path} />
    </circle>
  </>
);

export default function Integracoes() {
  return (
    <section id="integracoes" style={{ position: "relative", overflow: "hidden", background: "#0B0B0B", padding: "clamp(88px,11vw,160px) clamp(16px,4vw,40px)", borderTop: "1px solid #1C1C1C" }}>
      <div style={{ position: "absolute", right: "-15%", top: "5%", width: "70%", height: "90%", background: "radial-gradient(closest-side, rgba(251,192,9,.12), rgba(251,192,9,0))", pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#9A9A9A", marginBottom: "clamp(40px,6vw,80px)" }}>
          <span>Integrações</span>
          <span>03</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))", gap: "clamp(48px,6vw,96px)", alignItems: "center" }}>
          <div>
            <span data-reveal style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, border: "1.5px solid #FBC009", color: "#FBC009", font: `700 11px/1 ${FF}`, letterSpacing: ".18em", textTransform: "uppercase" }}>
              Em desenvolvimento · em breve
            </span>
            <h2 data-reveal style={{ margin: "24px 0 0", font: `900 clamp(40px,6vw,92px)/.9 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.015em" }}>
              Todo pedido
              <br />
              cai num
              <br />
              <span style={{ color: "#FBC009" }}>lugar só.</span>
            </h2>
            <p data-reveal style={{ margin: "24px 0 0", maxWidth: "46ch", font: `400 clamp(17px,1.4vw,20px)/1.55 ${FF}`, color: "#C4C4C4", textWrap: "pretty" }}>
              Integração robusta e moderna com os principais apps de comida e bebida do Brasil. O pedido do app cai direto no caixa da Addegas, o estoque baixa sozinho e o fechamento já sai separado por canal.
            </p>
            <div data-stagger style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: "0 28px" }}>
              {BENEFITS.map((b) => (
                <div key={b.n} className="bene" style={{ borderTop: "1.5px solid #262626", padding: "16px 0 18px", display: "flex", flexDirection: "column", gap: 8, transition: "border-color .3s" }}>
                  <span style={{ font: `700 12px/1 ${FF}`, letterSpacing: ".14em", color: "#FBC009" }}>{b.n}</span>
                  <span style={{ font: `800 19px/1.15 ${FF}`, fontStretch: "92%", textTransform: "uppercase", color: "#FFFFFF" }}>{b.t}</span>
                  <span style={{ font: `400 15px/1.45 ${FF}`, color: "#A8A8A8" }}>{b.d}</span>
                </div>
              ))}
            </div>
          </div>
          <div data-reveal style={{ position: "relative", width: "min(100%,560px)", aspectRatio: "1", margin: "0 auto" }}>
            <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1F1F1F" strokeWidth=".35" strokeDasharray="1 1.5" />
              <circle cx="50" cy="50" r="24" fill="none" stroke="#1F1F1F" strokeWidth=".35" />
              {spoke(50, 10, "M50 10 L50 50", "0s")}
              {spoke(88, 37.6, "M88 37.6 L50 50", "0.4s")}
              {spoke(73.5, 82.4, "M73.5 82.4 L50 50", "0.8s")}
              {spoke(26.5, 82.4, "M26.5 82.4 L50 50", "1.2s")}
              {spoke(12, 37.6, "M12 37.6 L50 50", "1.6s")}
            </svg>
            <div data-pulse style={{ position: "absolute", left: "35%", top: "35%", width: "30%", aspectRatio: "1", borderRadius: "24%", overflow: "hidden", boxShadow: "0 0 0 1.5px #FBC009, 0 30px 70px rgba(251,192,9,.25)" }}>
              <img src="/assets/app-icon.png" alt="Addegas" style={{ width: "100%", height: "100%", display: "block" }} />
            </div>
            {TILES.map((t) => (
              <div key={t.alt} data-float data-delay={String(t.delay)} style={{ position: "absolute", left: t.left, top: t.top, width: "22%", aspectRatio: "1" }}>
                {t.wa ? (
                  <div className="app-tile" style={tileInner}>
                    <div role="img" aria-label="WhatsApp" style={{ width: "100%", height: "100%", background: "#25D366", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IconWaHub />
                    </div>
                  </div>
                ) : (
                  <div className="app-tile" style={tileInner}>
                    <img src={t.src} alt={t.alt} style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div data-reveal style={{ marginTop: "clamp(64px,8vw,120px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "clamp(36px,5vw,72px)", alignItems: "center", padding: "clamp(24px,4vw,56px)", borderRadius: 28, background: "#EFEBE3", color: "#0A0A0A" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ width: 52, height: 52, flex: "none", borderRadius: 16, background: "#25D366", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconWa size={28} />
              </span>
              <span style={{ font: `700 12px/1 ${FF}`, letterSpacing: ".2em", textTransform: "uppercase", color: "#3D3A34" }}>Catálogo no WhatsApp</span>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: "#0A0A0A", color: "#FBC009", font: `800 11px/1 ${FF}`, letterSpacing: ".14em", textTransform: "uppercase" }}>Novo</span>
            </div>
            <h3 style={{ margin: "24px 0 0", font: `900 clamp(34px,4.6vw,68px)/.92 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.01em" }}>
              Sua adega no zap.
              <br />
              <span style={{ background: "#FBC009", padding: "0 .08em" }}>Pedido direto</span> no sistema.
            </h3>
            <p style={{ margin: "22px 0 0", maxWidth: "46ch", font: `500 clamp(16px,1.3vw,19px)/1.55 ${FF}`, color: "#2B2925", textWrap: "pretty" }}>
              Monte o catálogo da adega uma vez e compartilhe no WhatsApp. O cliente escolhe, pede pelo zap e o pedido entra direto na Addegas — sem anotar no papel, sem erro, sem pedido perdido.
            </p>
            <ol style={{ listStyle: "none", margin: "28px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { n: "1", t: "Cliente abre o catálogo da sua adega", accent: false },
                { n: "2", t: "Escolhe os produtos e pede pelo WhatsApp", accent: false },
                { n: "3", t: "O pedido cai no sistema, pronto pra separar", accent: true },
              ].map((s) => (
                <li key={s.n} style={{ display: "flex", alignItems: "center", gap: 14, font: `700 17px/1.3 ${FF}` }}>
                  <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: s.accent ? "#FBC009" : "#0A0A0A", color: s.accent ? "#0A0A0A" : "#FBC009", display: "flex", alignItems: "center", justifyContent: "center", font: `800 14px/1 ${FF}` }}>
                    {s.n}
                  </span>
                  {s.t}
                </li>
              ))}
            </ol>
          </div>
          <div style={{ width: "100%", maxWidth: 390, justifySelf: "center", borderRadius: 30, background: "#0A0A0A", padding: 10, boxShadow: "0 30px 70px rgba(0,0,0,.28)" }}>
            <div style={{ borderRadius: 22, overflow: "hidden", background: "#141414" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#1E1E1E" }}>
                <img src="/assets/app-icon.png" alt="" style={{ width: 40, height: 40, borderRadius: "50%", display: "block", flex: "none" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ font: `700 15px/1.1 ${FF}`, color: "#FFFFFF" }}>Adega do Zé</span>
                  <span style={{ font: `500 12px/1 ${FF}`, color: "#8FD9A8" }}>online · catálogo</span>
                </div>
              </div>
              <div data-stagger style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ alignSelf: "flex-start", width: "86%", padding: 12, borderRadius: "4px 16px 16px 16px", background: "#262626", color: "#FFFFFF" }}>
                  <div style={{ font: `800 13px/1 ${FF}`, letterSpacing: ".12em", textTransform: "uppercase", color: "#FBC009", marginBottom: 10 }}>Catálogo da casa</div>
                  {[
                    ["Combo Gin + Tônica", "R$ 49,90", true],
                    ["Balde 6 long necks", "R$ 42,00", true],
                    ["Gelo 5 kg", "R$ 12,00", false],
                  ].map(([name, price, border], i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", ...(border ? { borderBottom: "1px solid #333333" } : {}), font: `500 14px/1.2 ${FF}` }}>
                      <span>{name}</span>
                      <span style={{ fontWeight: 700 }}>{price}</span>
                    </div>
                  ))}
                </div>
                <div style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "11px 14px", borderRadius: "16px 4px 16px 16px", background: "#FBC009", color: "#0A0A0A", font: `600 14px/1.35 ${FF}` }}>
                  Manda 1 combo gin e 1 gelo, por favor!
                </div>
                <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: "#0A0A0A", border: "1.5px solid #FBC009" }}>
                  <img src="/assets/dd-yellow.png" alt="" style={{ width: 34, height: "auto", display: "block", flex: "none" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span style={{ font: `800 13px/1.1 ${FF}`, color: "#FBC009", textTransform: "uppercase", letterSpacing: ".06em" }}>Pedido #0427 na Addegas</span>
                    <span style={{ font: `500 13px/1.3 ${FF}`, color: "#D4D4D4" }}>1× Combo Gin + Tônica · 1× Gelo 5 kg — R$ 61,90 · estoque atualizado</span>
                  </div>
                </div>
                <div style={{ alignSelf: "flex-start", maxWidth: "80%", padding: "11px 14px", borderRadius: "4px 16px 16px 16px", background: "#262626", color: "#FFFFFF", font: `500 14px/1.35 ${FF}` }}>
                  Recebido! Sai em 15 minutos.
                </div>
              </div>
            </div>
          </div>
        </div>
        <p style={{ margin: "24px 0 0", font: `400 12px/1.5 ${FF}`, color: "#8F8F8F" }}>
          Integrações em desenvolvimento. As marcas citadas pertencem aos seus respectivos donos.
        </p>
      </div>
    </section>
  );
}
