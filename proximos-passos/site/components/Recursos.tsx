import Cups from "./Cups";

const FF = "var(--font-archivo), sans-serif";

const STEPS = [
  { n: "01", t: "Caixa rápido", d: "Venda no balcão em segundos. Pix, cartão ou dinheiro — a fila de sexta não espera." },
  { n: "02", t: "Estoque na mão", d: "Saiba o que tá gelando, o que tá acabando e o que tá parado na prateleira." },
  { n: "03", t: "Combo num toque", d: "Monte os combos do jeito da casa e venda com um clique. O estoque baixa sozinho." },
  { n: "04", t: "Fechamento do dia", d: "Acabou o expediente, a conta fecha: quanto entrou, quanto saiu e o que mais vendeu." },
];

export default function Recursos() {
  return (
    <section id="recursos" data-pin style={{ position: "relative", background: "#0B0B0B" }}>
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 1320, minHeight: "100vh", margin: "0 auto", padding: "88px clamp(16px,4vw,40px) 24px", display: "flex", flexWrap: "wrap", alignContent: "center", alignItems: "center", gap: "clamp(20px,5vw,80px)" }}>
          <div style={{ flex: "1 1 300px", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Cups />
          </div>
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#9A9A9A", marginBottom: "clamp(18px,3vw,36px)" }}>
              <span>Recursos</span>
              <span>
                <span data-count style={{ color: "#FBC009" }}>01</span> / 04
              </span>
            </div>
            <h2 style={{ margin: "0 0 clamp(18px,3vw,36px)", font: `900 clamp(32px,4.6vw,68px)/.92 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.01em" }}>
              Enche o copo.
              <br />
              <span style={{ color: "#FBC009" }}>Esvazia a bagunça.</span>
            </h2>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
              {STEPS.map((s, i) => (
                <li key={s.n} data-step style={{ borderTop: "1.5px solid #262626", ...(i === STEPS.length - 1 ? { borderBottom: "1.5px solid #262626" } : {}), padding: "clamp(12px,1.6vw,18px) 0", transition: "border-color .4s" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                    <span style={{ font: `700 12px/1 ${FF}`, letterSpacing: ".14em", color: "#FBC009" }}>{s.n}</span>
                    <span data-step-title style={{ font: `800 clamp(19px,2.1vw,28px)/1.05 ${FF}`, fontStretch: "90%", textTransform: "uppercase", color: "#FFFFFF", transition: "color .4s" }}>
                      {s.t}
                    </span>
                  </div>
                  <p data-step-desc style={{ margin: "12px 0 0 38px", maxWidth: "42ch", font: `400 16px/1.5 ${FF}`, color: "#BDBDBD", overflow: "hidden", transition: "max-height .5s ease, opacity .5s ease, margin .5s ease" }}>
                    {s.d}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
