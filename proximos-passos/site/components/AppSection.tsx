import type { CSSProperties } from "react";

const FF = "var(--font-archivo), sans-serif";

const APPLE_PATH =
  "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701";
const PLAY_PATH =
  "M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z";

const BARS: [number, string][] = [[38, "S"], [52, "T"], [44, "Q"], [61, "Q"], [70, "S"], [92, "S"], [100, "D"]];
const BENEFITS = ["Vendas e caixa ao vivo", "Alerta de estoque baixo", "Aviso de pedido dos apps", "Fechamento do dia no celular"];

const badgeStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, height: 60, padding: "0 22px 0 18px", borderRadius: 14, background: "#0A0A0A", color: "#FFFFFF", boxShadow: "0 10px 30px rgba(0,0,0,.18)", transition: "transform .3s cubic-bezier(.3,1.6,.5,1)", cursor: "default" };
const notifCard: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "#EFEBE3", color: "#0A0A0A", boxShadow: "0 20px 50px rgba(0,0,0,.28)" };
const statCard: CSSProperties = { borderRadius: 14, background: "#1C1C1C", padding: 12 };
const orderRow: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "#1C1C1C" };

function StoreBadge({ path, pre, name }: { path: string; pre: string; name: string }) {
  return (
    <div className="store-badge" style={badgeStyle}>
      <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor" aria-hidden="true" style={{ display: "block", flex: "none" }}>
        <path d={path} />
      </svg>
      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ font: `600 11px/1 ${FF}`, letterSpacing: ".08em", textTransform: "uppercase", color: "#FBC009" }}>{pre}</span>
        <span style={{ font: `800 21px/1 ${FF}` }}>{name}</span>
      </span>
    </div>
  );
}

export default function AppSection() {
  return (
    <section id="app" style={{ position: "relative", overflow: "hidden", background: "#FBC009", color: "#0A0A0A", padding: "clamp(88px,11vw,160px) clamp(16px,4vw,40px)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#0A0A0A", marginBottom: "clamp(40px,6vw,80px)" }}>
          <span>App Addegas · iOS e Android</span>
          <span>08</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "clamp(56px,7vw,112px)", alignItems: "center" }}>
          <div>
            <span data-reveal style={{ display: "inline-flex", padding: "8px 14px", borderRadius: 999, background: "#0A0A0A", color: "#FBC009", font: `700 11px/1 ${FF}`, letterSpacing: ".18em", textTransform: "uppercase" }}>Em breve nas lojas</span>
            <h2 data-reveal style={{ margin: "24px 0 0", font: `900 clamp(44px,6.6vw,104px)/.88 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.02em" }}>
              A adega
              <br />
              na palma
              <br />
              da mão.
            </h2>
            <p data-reveal style={{ margin: "26px 0 0", maxWidth: "44ch", font: `500 clamp(17px,1.4vw,20px)/1.55 ${FF}`, color: "#0A0A0A", textWrap: "pretty" }}>
              App da Addegas para iPhone e Android. De casa, da praia ou do outro lado do país: o dono da adega fica sabendo de tudo que acontece no negócio — vendas, caixa, estoque e pedidos dos apps — em tempo real.
            </p>
            <div data-stagger style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12 }}>
              <StoreBadge path={APPLE_PATH} pre="Em breve na" name="App Store" />
              <StoreBadge path={PLAY_PATH} pre="Em breve no" name="Google Play" />
            </div>
            <ul data-stagger style={{ listStyle: "none", margin: "36px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: "0 24px" }}>
              {BENEFITS.map((b) => (
                <li key={b} style={{ padding: "14px 0", borderTop: "1.5px solid #0A0A0A", font: `700 16px/1.3 ${FF}` }}>{b}</li>
              ))}
            </ul>
          </div>
          <div data-reveal style={{ position: "relative", display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <div data-float data-delay="0" style={{ position: "absolute", left: 0, top: -14, zIndex: 2, width: "min(250px,60vw)" }}>
              <div style={notifCard}>
                <img src="/assets/app-icon.png" alt="" style={{ width: 34, height: 34, borderRadius: 9, display: "block", flex: "none" }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ font: `700 10px/1 ${FF}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#5E5A52" }}>Zé Delivery</span>
                  <span style={{ font: `700 14px/1.25 ${FF}` }}>Novo pedido · R$ 86,00</span>
                </span>
              </div>
            </div>
            <div data-float data-delay="1400" style={{ position: "absolute", right: 0, bottom: -14, zIndex: 2, width: "min(250px,60vw)" }}>
              <div style={notifCard}>
                <img src="/assets/app-icon.png" alt="" style={{ width: 34, height: 34, borderRadius: 9, display: "block", flex: "none" }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ font: `700 10px/1 ${FF}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#5E5A52" }}>Estoque</span>
                  <span style={{ font: `700 14px/1.25 ${FF}` }}>Heineken 600 ml acabando</span>
                </span>
              </div>
            </div>
            <div role="img" aria-label="Tela do app Addegas com vendas do dia, gráfico da semana e alertas" style={{ position: "relative", width: "min(100%,330px)", borderRadius: 46, background: "#0A0A0A", padding: 11, boxShadow: "0 50px 100px rgba(0,0,0,.35), inset 0 0 0 1.5px #2A2A2A" }}>
              <div style={{ borderRadius: 36, background: "#111111", padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
                <div style={{ alignSelf: "center", width: 96, height: 26, borderRadius: 999, background: "#000000" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={{ font: `500 12px/1 ${FF}`, color: "#9A9A9A" }}>Boa noite, Zé</span>
                    <span style={{ font: `800 18px/1 ${FF}`, color: "#FFFFFF" }}>Adega do Zé</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "#1C1C1C", font: `700 10px/1 ${FF}`, letterSpacing: ".12em", textTransform: "uppercase", color: "#FBC009" }}>
                    <span data-pulse style={{ width: 7, height: 7, borderRadius: "50%", background: "#FBC009" }} />
                    Ao vivo
                  </span>
                </div>
                <div style={{ borderRadius: 18, background: "#FBC009", color: "#0A0A0A", padding: 16 }}>
                  <div style={{ font: `700 10px/1 ${FF}`, letterSpacing: ".16em", textTransform: "uppercase" }}>Vendas hoje</div>
                  <div style={{ marginTop: 8, font: `900 32px/1 ${FF}`, fontStretch: "90%" }}>R$ 3.482,50</div>
                  <div style={{ marginTop: 6, font: `600 12px/1.2 ${FF}` }}>+18% que a última sexta</div>
                </div>
                <div style={{ borderRadius: 18, background: "#1C1C1C", padding: "14px 14px 10px" }}>
                  <div style={{ font: `700 10px/1 ${FF}`, letterSpacing: ".16em", textTransform: "uppercase", color: "#9A9A9A" }}>Semana</div>
                  <div style={{ marginTop: 12, height: 80, display: "flex", alignItems: "flex-end", gap: 8 }}>
                    {BARS.map(([h, l], i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                        <div style={{ width: "100%", height: `${h}%`, borderRadius: 5, background: h === 100 ? "#FBC009" : "#3A3A3A" }} />
                        <span style={{ font: `600 9px/1 ${FF}`, color: "#8F8F8F" }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={statCard}>
                    <div style={{ font: `700 10px/1 ${FF}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#9A9A9A" }}>Pedidos</div>
                    <div style={{ marginTop: 7, font: `800 22px/1 ${FF}`, color: "#FFFFFF" }}>58</div>
                  </div>
                  <div style={statCard}>
                    <div style={{ font: `700 10px/1 ${FF}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#9A9A9A" }}>Ticket médio</div>
                    <div style={{ marginTop: 7, font: `800 22px/1 ${FF}`, color: "#FFFFFF" }}>R$ 60</div>
                  </div>
                </div>
                <div style={orderRow}>
                  <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", background: "#FBC009" }} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ font: `700 10px/1 ${FF}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#9A9A9A" }}>iFood</span>
                    <span style={{ font: `600 13px/1.2 ${FF}`, color: "#FFFFFF" }}>Pedido #0428 recebido</span>
                  </span>
                </div>
                <div style={orderRow}>
                  <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", background: "#FBC009" }} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ font: `700 10px/1 ${FF}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#9A9A9A" }}>Estoque</span>
                    <span style={{ font: `600 13px/1.2 ${FF}`, color: "#FFFFFF" }}>Gelo 5 kg · 4 unidades</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
