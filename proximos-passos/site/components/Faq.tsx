import { IconWa } from "./icons";
import { FAQ, waLink } from "@/lib/site";

const FF = "var(--font-archivo), sans-serif";

export default function Faq() {
  return (
    <section id="duvidas" style={{ background: "#EFEBE3", color: "#0A0A0A", padding: "clamp(88px,11vw,160px) clamp(16px,4vw,40px)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#5E5A52", marginBottom: "clamp(40px,6vw,72px)" }}>
          <span>Perguntas frequentes</span>
          <span>10</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "clamp(40px,6vw,96px)", alignItems: "start" }}>
          <div>
            <h2 data-reveal style={{ margin: 0, font: `900 clamp(40px,6vw,92px)/.9 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.015em" }}>
              Dúvida
              <br />
              de <span style={{ background: "#FBC009", padding: "0 .08em" }}>balcão.</span>
            </h2>
            <p data-reveal style={{ margin: "24px 0 0", maxWidth: "40ch", font: `500 clamp(17px,1.4vw,20px)/1.5 ${FF}`, color: "#2B2925", textWrap: "pretty" }}>
              Tudo sobre o sistema para adega da Addegas. Não achou o que procurava? Chama no WhatsApp.
            </p>
            <a href={waLink("Olá! Tenho uma dúvida sobre a Addegas.")} target="_blank" rel="noopener noreferrer" className="wa-dark-btn" style={{ marginTop: 28, display: "inline-flex", alignItems: "center", gap: 10, height: 52, padding: "0 22px", borderRadius: 999, background: "#0A0A0A", color: "#FBC009", font: `800 14px/1 ${FF}`, letterSpacing: ".06em", textTransform: "uppercase" }}>
              <IconWa /> Tirar dúvida no zap
            </a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", borderTop: "1.5px solid #0A0A0A" }}>
            {FAQ.map((f) => (
              <details key={f.q} style={{ borderBottom: "1.5px solid #0A0A0A" }}>
                <summary className="faq-summary" style={{ listStyle: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, padding: "22px 0", font: `800 clamp(18px,1.7vw,23px)/1.25 ${FF}`, fontStretch: "92%", textTransform: "uppercase", transition: "color .2s" }}>
                  <h3 style={{ margin: 0, font: "inherit" }}>{f.q}</h3>
                  <span aria-hidden="true" style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: "#FBC009", color: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", font: `700 22px/1 ${FF}` }}>+</span>
                </summary>
                <p style={{ margin: "0 0 24px", maxWidth: "62ch", font: `400 17px/1.6 ${FF}`, color: "#2B2925", textWrap: "pretty" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
