"use client";

import { useState } from "react";
import { IconWa } from "./icons";

const FF = "var(--font-archivo), sans-serif";

type RuleKey = "validade" | "parado" | "estoque" | "abre" | "desconto" | "fecha";

const RULES: { k: RuleKey; t: string; d: string; tag: string; msg: string; time: string }[] = [
  { k: "validade", t: "Validade chegando", d: "Avisa 7 dias antes do produto vencer", tag: "Validade", msg: "Atenção: Heineken lata 350 ml — 24 unidades vencem em 5 dias (lote 0912). Que tal um combo?", time: "09:00" },
  { k: "parado", t: "Produto parado", d: "Sem vender há mais de 3 dias", tag: "Produto parado", msg: "Vinho Pérgola 1 L está há 4 dias sem vender. 12 unidades na prateleira.", time: "10:30" },
  { k: "estoque", t: "Estoque baixo", d: "Quando passar do mínimo que você definiu", tag: "Estoque baixo", msg: "Gelo 5 kg: restam 4 unidades. Mínimo configurado: 10.", time: "17:45" },
  { k: "abre", t: "Caixa aberto", d: "Toda vez que alguém abrir o caixa", tag: "Caixa aberto", msg: "Caixa aberto por Bruno às 18:02. Troco inicial: R$ 200,00.", time: "18:02" },
  { k: "desconto", t: "Desconto fora da regra", d: "Quando pedirem mais desconto que o permitido", tag: "Permissão", msg: "Bruno tentou dar 15% de desconto. Limite do caixa: 5%. Precisa da sua senha.", time: "21:37" },
  { k: "fecha", t: "Caixa fechado", d: "Resumo completo no fechamento", tag: "Caixa fechado", msg: "Caixa fechado às 02:14. Entrou R$ 3.482,50 · saiu R$ 120,00 · mais vendido: Combo Gin.", time: "02:14" },
];

const PERMS: { label: string; cells: string[] }[] = [
  { label: "Vender no PDV", cells: ["check", "check", "check", "dash"] },
  { label: "Dar desconto", cells: ["Livre", "Até 15%", "Até 5%", "dash"] },
  { label: "Cancelar venda", cells: ["check", "check", "dash", "dash"] },
  { label: "Abrir e fechar caixa", cells: ["check", "check", "check", "dash"] },
  { label: "Entrada e contagem de estoque", cells: ["check", "check", "dash", "check"] },
  { label: "Alterar preços e combos", cells: ["check", "check", "dash", "dash"] },
  { label: "Ver relatórios e lucro", cells: ["check", "Parcial", "dash", "dash"] },
];

const MOBILE_CARDS = [
  { role: "Dono", accent: true, chips: ["Vender no PDV", "Desconto livre", "Cancelar venda", "Abrir e fechar caixa", "Estoque", "Preços e combos", "Relatórios e lucro"] },
  { role: "Gerente", accent: false, chips: ["Vender no PDV", "Desconto até 15%", "Cancelar venda", "Abrir e fechar caixa", "Estoque", "Preços e combos", "Relatórios parciais"] },
  { role: "Caixa", accent: false, chips: ["Vender no PDV", "Desconto até 5%", "Abrir e fechar caixa"] },
  { role: "Estoque", accent: false, chips: ["Entrada e contagem de estoque"] },
];

const th: React.CSSProperties = { padding: "18px 12px", font: `800 13px/1 ${FF}`, letterSpacing: ".1em", textTransform: "uppercase", color: "#FFFFFF", borderBottom: "1.5px solid #232323", textAlign: "center" };
const td: React.CSSProperties = { padding: "14px 12px", textAlign: "center", borderBottom: "1px solid #1C1C1C" };
const check = <span aria-label="Permitido" style={{ width: 26, height: 26, borderRadius: "50%", background: "#FBC009", color: "#0A0A0A", display: "inline-flex", alignItems: "center", justifyContent: "center", font: `800 14px/1 ${FF}` }}>✓</span>;
const dash = <span aria-label="Bloqueado" style={{ font: `600 16px/1 ${FF}`, color: "#4A4A4A" }}>—</span>;

function Cell({ v }: { v: string }) {
  if (v === "check") return check;
  if (v === "dash") return dash;
  return <span style={{ font: `700 13px/1 ${FF}`, color: "#FBC009", whiteSpace: "nowrap" }}>{v}</span>;
}

export default function Alertas() {
  const [alerts, setAlerts] = useState<Record<RuleKey, boolean>>({ validade: true, parado: true, estoque: true, abre: true, desconto: true, fecha: true });
  const toggle = (k: RuleKey) => setAlerts((s) => ({ ...s, [k]: !s[k] }));
  const msgs = RULES.filter((r) => alerts[r.k]);
  const count = msgs.length;

  return (
    <section id="alertas" style={{ position: "relative", overflow: "hidden", background: "#0B0B0B", padding: "clamp(88px,11vw,160px) clamp(16px,4vw,40px)", borderTop: "1px solid #1C1C1C" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#9A9A9A", marginBottom: "clamp(40px,6vw,80px)" }}>
          <span>Alertas no WhatsApp</span>
          <span>04</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))", gap: "clamp(48px,6vw,96px)", alignItems: "start" }}>
          <div>
            <h2 data-reveal style={{ margin: 0, font: `900 clamp(40px,6vw,92px)/.9 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.015em" }}>
              O sistema
              <br />
              te chama
              <br />
              <span style={{ color: "#FBC009" }}>no zap.</span>
            </h2>
            <p data-reveal style={{ margin: "24px 0 0", maxWidth: "46ch", font: `400 clamp(17px,1.4vw,20px)/1.55 ${FF}`, color: "#C4C4C4", textWrap: "pretty" }}>
              Cerveja perto de vencer, produto encalhado, caixa abrindo às 18h. Você escolhe do que quer ser lembrado e a Addegas manda a mensagem no seu WhatsApp, na hora certa.
            </p>
            <div style={{ margin: "36px 0 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <span style={{ font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#9A9A9A" }}>Monte seus lembretes</span>
              <span style={{ font: `600 13px/1 ${FF}`, color: "#FBC009" }}>{count} ligados</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", borderTop: "1.5px solid #262626" }}>
              {RULES.map((r) => {
                const on = alerts[r.k];
                return (
                  <button
                    key={r.k}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggle(r.k)}
                    className="alert-row"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, width: "100%", padding: "16px 4px", border: "none", borderBottom: "1.5px solid #262626", background: "transparent", color: "#FFFFFF", textAlign: "left", cursor: "pointer", transition: "background .2s" }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                      <span style={{ font: `800 clamp(17px,1.6vw,21px)/1.1 ${FF}`, fontStretch: "92%", textTransform: "uppercase", color: on ? "#FFFFFF" : "#8C8C8C", transition: "color .25s" }}>{r.t}</span>
                      <span style={{ font: `400 15px/1.35 ${FF}`, color: "#9A9A9A" }}>{r.d}</span>
                    </span>
                    <span aria-hidden="true" style={{ position: "relative", width: 54, height: 32, flex: "none", borderRadius: 999, background: on ? "#FBC009" : "#2A2A2A", transition: "background .25s" }}>
                      <span style={{ position: "absolute", top: 4, left: 4, width: 24, height: 24, borderRadius: "50%", background: on ? "#0A0A0A" : "#8F8F8F", transform: on ? "translateX(22px)" : "translateX(0px)", transition: "transform .3s cubic-bezier(.3,1.5,.5,1), background .25s" }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div data-reveal style={{ width: "100%", maxWidth: 420, justifySelf: "center", borderRadius: 30, background: "#050505", padding: 10, boxShadow: "0 40px 90px rgba(0,0,0,.6), 0 0 100px rgba(251,192,9,.12), inset 0 0 0 1.5px #232323" }}>
            <div style={{ borderRadius: 22, overflow: "hidden", background: "#121212" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#1C1C1C" }}>
                <img src="/assets/app-icon.png" alt="" style={{ width: 40, height: 40, borderRadius: "50%", display: "block", flex: "none" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
                  <span style={{ font: `700 15px/1.1 ${FF}`, color: "#FFFFFF" }}>Addegas · Alertas</span>
                  <span style={{ font: `500 12px/1 ${FF}`, color: "#8FD9A8" }}>online</span>
                </div>
                <span style={{ color: "#25D366" }}><IconWa /></span>
              </div>
              <div style={{ padding: 16, minHeight: 420, display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ alignSelf: "center", padding: "5px 10px", borderRadius: 8, background: "#1C1C1C", font: `600 11px/1 ${FF}`, letterSpacing: ".08em", textTransform: "uppercase", color: "#8F8F8F" }}>Hoje</span>
                {msgs.map((m) => (
                  <div key={m.k} style={{ alignSelf: "flex-start", maxWidth: "88%", padding: "10px 12px 8px", borderRadius: "4px 16px 16px 16px", background: "#262626", color: "#FFFFFF", display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ font: `800 11px/1 ${FF}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#FBC009" }}>{m.tag}</span>
                    <span style={{ font: `500 14px/1.4 ${FF}` }}>{m.msg}</span>
                    <span style={{ alignSelf: "flex-end", font: `500 11px/1 ${FF}`, color: "#8F8F8F" }}>{m.time}</span>
                  </div>
                ))}
                {count === 0 ? (
                  <div style={{ margin: "auto", maxWidth: "26ch", textAlign: "center", font: `500 15px/1.5 ${FF}`, color: "#8F8F8F" }}>
                    Nenhum lembrete ligado. Liga um aí do lado e veja a mensagem chegar.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div data-reveal style={{ marginTop: "clamp(72px,9vw,128px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,540px),1fr))", gap: "clamp(36px,5vw,72px)", alignItems: "start" }}>
          <div>
            <span style={{ font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#9A9A9A" }}>Regras e permissões</span>
            <h3 style={{ margin: "20px 0 0", font: `900 clamp(34px,4.4vw,64px)/.92 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.01em" }}>
              Cada um no
              <br />
              <span style={{ color: "#FBC009" }}>seu quadrado.</span>
            </h3>
            <p style={{ margin: "22px 0 0", maxWidth: "42ch", font: `400 clamp(16px,1.3vw,19px)/1.55 ${FF}`, color: "#C4C4C4", textWrap: "pretty" }}>
              Cada funcionário com seu login e só o acesso que precisa. Desconto fora da regra pede a senha do dono, e tudo fica registrado: quem fez, o quê e quando.
            </p>
            <div data-stagger style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 10 }}>
              {["Login por funcionário", "Limite de desconto", "Senha do dono", "Histórico de ações"].map((c) => (
                <span key={c} style={{ padding: "10px 16px", borderRadius: 999, border: "1.5px solid #3A3A3A", font: `700 14px/1 ${FF}`, color: "#FFFFFF" }}>{c}</span>
              ))}
            </div>
          </div>

          <div className="hide-narrow" style={{ overflowX: "auto", borderRadius: 24, border: "1px solid #232323", background: "#050505" }}>
            <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontFamily: FF }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "18px 20px", font: `600 11px/1 ${FF}`, letterSpacing: ".2em", textTransform: "uppercase", color: "#9A9A9A", borderBottom: "1.5px solid #232323" }}>Permissão</th>
                  <th style={{ ...th, color: "#0A0A0A", background: "#FBC009" }}>Dono</th>
                  <th style={th}>Gerente</th>
                  <th style={th}>Caixa</th>
                  <th style={th}>Estoque</th>
                </tr>
              </thead>
              <tbody>
                {PERMS.map((row) => (
                  <tr key={row.label} className="perm-row" style={{ transition: "background .2s" }}>
                    <td style={{ padding: "14px 20px", font: `600 15px/1.3 ${FF}`, color: "#FFFFFF", borderBottom: "1px solid #1C1C1C" }}>{row.label}</td>
                    {row.cells.map((c, i) => (
                      <td key={i} style={td}><Cell v={c} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div data-stagger className="hide-wide" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MOBILE_CARDS.map((card) => (
              <div key={card.role} style={{ borderRadius: 20, padding: 18, background: card.accent ? "#FBC009" : "#050505", color: card.accent ? "#0A0A0A" : "#FFFFFF", border: card.accent ? "1px solid #FBC009" : "1px solid #232323" }}>
                <div style={{ font: `900 22px/1 ${FF}`, fontStretch: "88%", textTransform: "uppercase" }}>{card.role}</div>
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {card.chips.map((chip) => (
                    <span key={chip} style={{ padding: "7px 11px", borderRadius: 999, background: card.accent ? "#0A0A0A" : "#1C1C1C", color: card.accent ? "#FBC009" : "#E6E6E6", font: `600 13px/1 ${FF}` }}>{chip}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
