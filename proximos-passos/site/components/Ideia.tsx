import { Fragment } from "react";

const FF = "var(--font-archivo), sans-serif";

const WORDS: { t: string; hl?: boolean }[] = [
  { t: "A" }, { t: "marca" }, { t: "tem" }, { t: "a" }, { t: "cara" }, { t: "da" },
  { t: "adega.", hl: true },
  { t: "O" }, { t: "sistema" }, { t: "tem" }, { t: "a" }, { t: "organização" }, { t: "que" }, { t: "ela" }, { t: "precisa." },
];

export default function Ideia() {
  return (
    <section id="ideia" style={{ background: "#EFEBE3", color: "#0A0A0A", padding: "clamp(88px,11vw,160px) clamp(16px,4vw,40px)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#5E5A52", marginBottom: "clamp(40px,6vw,80px)" }}>
          <span>A ideia</span>
          <span>01</span>
        </div>
        <h2 data-manifesto style={{ margin: 0, font: `900 clamp(38px,6.6vw,104px)/.92 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.015em" }}>
          {WORDS.map((w, i) => (
            <Fragment key={i}>
              {i > 0 ? " " : null}
              <span
                data-w
                {...(w.hl ? { "data-hl": "" } : {})}
                style={w.hl ? { backgroundImage: "linear-gradient(#FBC009,#FBC009)", backgroundRepeat: "no-repeat", backgroundSize: "100% 100%", padding: "0 .08em" } : undefined}
              >
                {w.t}
              </span>
            </Fragment>
          ))}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 40, alignItems: "end", marginTop: "clamp(48px,7vw,96px)" }}>
          <img data-spin-scroll src="/assets/dd-yellow.png" alt="" style={{ width: "clamp(84px,9vw,128px)", height: "auto", display: "block" }} />
          <p data-reveal style={{ margin: 0, justifySelf: "end", maxWidth: "46ch", font: `500 clamp(17px,1.5vw,21px)/1.5 ${FF}`, color: "#2B2925", textWrap: "pretty" }}>
            Addegas é um sistema de gestão para adegas, depósitos de bebidas e pequenos negócios do setor. A tecnologia mora na experiência do produto.{" "}
            <strong style={{ fontWeight: 800, color: "#0A0A0A" }}>A marca mora na rua.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
