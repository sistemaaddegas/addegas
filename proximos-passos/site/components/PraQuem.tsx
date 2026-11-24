import type { CSSProperties } from "react";
import Marquee from "./Marquee";

const FF = "var(--font-archivo), sans-serif";

const CHIPS = ["Adegas", "Depósitos de bebida", "Comércios do setor"];

// [value, hover rotate]
const VALUES: [string, number][] = [
  ["Proximidade", -2], ["Noite", 2], ["Autenticidade", 2], ["Movimento", -2], ["Energia", -2],
  ["Irreverência", 2], ["Cultura urbana", 2], ["Diversão", -2], ["Bebida", -2], ["Personalidade", 2],
];

const CITIES = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Salvador", "Recife", "Fortaleza", "Belém", "Manaus", "Brasília", "Goiânia", "Curitiba", "Florianópolis", "Porto Alegre", "Vitória", "Natal", "São Luís"];

const valueBase: CSSProperties = { justifySelf: "start", marginLeft: -8, padding: "2px 8px", font: `900 clamp(20px,2.4vw,34px)/1.12 ${FF}`, fontStretch: "88%", textTransform: "uppercase", transition: "background .2s, color .2s, transform .3s cubic-bezier(.3,1.6,.5,1)", cursor: "default" };

export default function PraQuem() {
  return (
    <section id="pra-quem" style={{ background: "#FBC009", color: "#0A0A0A", padding: "clamp(88px,11vw,160px) 0 0" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 clamp(16px,4vw,40px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#0A0A0A", marginBottom: "clamp(40px,6vw,80px)" }}>
          <span>Público e posicionamento</span>
          <span>06</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "clamp(40px,6vw,96px)", alignItems: "end" }}>
          <div>
            <h2 data-reveal style={{ margin: 0, font: `900 clamp(44px,6.2vw,100px)/.88 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.02em" }}>
              Feita pra
              <br />
              adega de
              <br />
              bairro.
            </h2>
            <p data-reveal style={{ margin: "28px 0 0", maxWidth: "40ch", font: `500 clamp(17px,1.4vw,20px)/1.5 ${FF}`, color: "#0A0A0A", textWrap: "pretty" }}>
              Adegas, depósitos e comércios de bebida da periferia e das regiões urbanas de todo o Brasil. A Addegas fala a sua língua — sem cara de empresa de tecnologia.
            </p>
            <div data-stagger style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}>
              {CHIPS.map((c) => (
                <span key={c} className="pq-chip" style={{ padding: "11px 20px", border: "1.5px solid #0A0A0A", borderRadius: 999, font: `700 14px/1 ${FF}`, transition: "background .2s, color .2s", cursor: "default" }}>{c}</span>
              ))}
            </div>
          </div>
          <div data-stagger style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "4px 24px" }}>
            {VALUES.map(([v, rh]) => (
              <span key={v} className="pq-value" style={{ ...valueBase, ["--rh" as string]: `${rh}deg` } as CSSProperties}>{v}</span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: "clamp(64px,8vw,112px)", paddingBottom: 18, font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#0A0A0A" }}>
          De bairro em bairro · do Oiapoque ao Chuí
        </div>
      </div>
      <div style={{ background: "#0A0A0A", padding: "clamp(16px, 2vw, 26px) 0", overflow: "hidden" }}>
        <Marquee items={CITIES} opts={{ fg: "#FBC009", dur: 70, rev: true, outline: true, sep: "/assets/dd-dark.png", sepH: ".9em", size: "clamp(22px, 3vw, 42px)", gap: "clamp(16px, 2vw, 30px)" }} />
      </div>
    </section>
  );
}
