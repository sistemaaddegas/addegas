"use client";

import { useState, type CSSProperties } from "react";
import { IconArrow, IconWa } from "./icons";
import { PLANOS, TESTE_DIAS, cadastroLink, waLink, type Ciclo } from "@/lib/site";

const FF = "var(--font-archivo), sans-serif";

// O que já está no sistema hoje (o que ainda está em desenvolvimento fica na seção de integrações).
const INCLUI = [
  "Caixa rápido com Pix, cartão e dinheiro",
  "Estoque com baixa a cada venda",
  "Combos, promoções e Lucro no Copo",
  "Mesas e comandas",
  "Fiado com nome e telefone",
  "Pedidos e entregas",
  "Relatórios e fechamento do dia",
  "Equipe com permissão por função",
  "Caixa que vende sem internet",
];

const tab = (on: boolean): CSSProperties => ({
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 48,
  padding: "0 10px",
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  background: on ? "#FBC009" : "transparent",
  color: on ? "#0A0A0A" : "#D4D4D4",
  font: `800 13px/1 ${FF}`,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  transition: "background .2s, color .2s",
});

export default function Planos() {
  const [ciclo, setCiclo] = useState<Ciclo>("annual");
  const p = PLANOS.find((x) => x.ciclo === ciclo)!;

  // Leva junto os UTMs da visita, para o CRM saber de onde veio a adega.
  const ir = () => {
    window.location.href = cadastroLink(ciclo, window.location.search);
  };

  return (
    <section id="planos" style={{ position: "relative", overflow: "hidden", background: "#0B0B0B", padding: "clamp(88px,11vw,160px) clamp(16px,4vw,40px)" }}>
      <div style={{ position: "absolute", left: "-10%", top: "10%", width: "60%", height: "80%", background: "radial-gradient(closest-side, rgba(251,192,9,.16), rgba(251,192,9,0))", pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#9A9A9A", marginBottom: "clamp(40px,6vw,80px)" }}>
          <span>Planos</span>
          <span>09</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "clamp(48px,6vw,96px)", alignItems: "center" }}>
          <div>
            <h2 data-reveal style={{ margin: 0, font: `900 clamp(48px,8vw,124px)/.86 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.02em" }}>
              Um plano.
              <br />
              <span style={{ color: "#FBC009" }}>Tudo dentro.</span>
            </h2>
            <p data-reveal style={{ margin: "24px 0 0", maxWidth: "44ch", font: `400 clamp(17px,1.4vw,20px)/1.55 ${FF}`, color: "#C4C4C4", textWrap: "pretty" }}>
              {TESTE_DIAS} dias grátis, sem cartão. Cadastra a adega, usa de verdade e escolhe como pagar quando quiser.
            </p>
            <ul style={{ listStyle: "none", margin: "32px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: "12px 24px" }}>
              {INCLUI.map((t) => (
                <li key={t} style={{ display: "flex", alignItems: "flex-start", gap: 10, font: `500 16px/1.4 ${FF}`, color: "#E4E4E4" }}>
                  <span aria-hidden="true" style={{ flex: "none", marginTop: 3, width: 16, height: 16, borderRadius: "50%", background: "#FBC009", color: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", font: `900 11px/1 ${FF}` }}>✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal style={{ padding: "clamp(24px,3vw,40px)", borderRadius: 28, background: "#141414", border: "1.5px solid #2A2A2A", boxShadow: "0 40px 90px rgba(0,0,0,.6), 0 0 120px rgba(251,192,9,.12)" }}>
            <div role="tablist" aria-label="Ciclo de pagamento" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, background: "#0B0B0B", border: "1px solid #2A2A2A" }}>
              {PLANOS.map((x) => (
                <button key={x.ciclo} type="button" role="tab" aria-selected={x.ciclo === ciclo} onClick={() => setCiclo(x.ciclo)} style={tab(x.ciclo === ciclo)}>
                  {x.nome}
                  {x.desconto > 0 ? <span style={{ font: `800 11px/1 ${FF}`, opacity: x.ciclo === ciclo ? 0.75 : 0.6 }}>−{x.desconto}%</span> : null}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 32, font: `600 12px/1 ${FF}`, letterSpacing: ".22em", textTransform: "uppercase", color: "#9A9A9A" }}>Addegas · {p.nome}</div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ font: `700 22px/1 ${FF}`, color: "#C4C4C4" }}>R$</span>
              <span style={{ font: `900 clamp(64px,8vw,104px)/.9 ${FF}`, fontStretch: "88%", letterSpacing: "-.02em", color: "#FFFFFF" }}>{p.porMes}</span>
              <span style={{ font: `600 16px/1 ${FF}`, color: "#C4C4C4" }}>/mês</span>
            </div>
            <div style={{ marginTop: 12, minHeight: 22, font: `500 15px/1.45 ${FF}`, color: "#A8A8A8" }}>
              {p.ciclo === "monthly" ? "Cobrado todo mês no cartão." : `${p.total} ${p.periodo}, no cartão.`}
            </div>
            <div style={{ marginTop: 6, font: `500 15px/1.45 ${FF}`, color: "#A8A8A8" }}>Loja a mais: {p.loja}.</div>

            <button
              type="button"
              data-mag
              onClick={ir}
              className="cta-primary"
              style={{ marginTop: 32, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 60, borderRadius: 999, border: "none", cursor: "pointer", background: "#FBC009", color: "#0A0A0A", font: `800 16px/1 ${FF}`, letterSpacing: ".05em", textTransform: "uppercase", transition: "transform .3s cubic-bezier(.2,.8,.2,1), background .2s, box-shadow .3s" }}
            >
              Começar {TESTE_DIAS} dias grátis <IconArrow />
            </button>
            <div style={{ marginTop: 14, textAlign: "center", font: `500 13px/1.45 ${FF}`, color: "#8F8F8F" }}>
              Sem cartão no teste. Pagamento seguro pelo Stripe quando você assinar.
            </div>
            <a
              href={waLink("Olá! Vim pelo site e tenho uma dúvida sobre os planos da Addegas.")}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-outline"
              style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 52, borderRadius: 999, border: "1.5px solid #3A3A3A", color: "#FFFFFF", font: `700 14px/1 ${FF}`, letterSpacing: ".05em", textTransform: "uppercase", transition: "border-color .2s, color .2s" }}
            >
              <IconWa /> Tirar dúvida no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
