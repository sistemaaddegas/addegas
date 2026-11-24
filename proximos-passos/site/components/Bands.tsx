import Marquee, { type MarqueeOpts } from "./Marquee";

function Band({ items, opts, rot, bg, z }: { items: string[]; opts: MarqueeOpts; rot: number; bg: string; z: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "-10%",
        width: "120%",
        top: "50%",
        transform: `translateY(-50%) rotate(${rot}deg)`,
        background: bg,
        padding: "clamp(12px, 1.5vw, 22px) 0",
        boxShadow: "0 24px 60px rgba(0,0,0,.45)",
        zIndex: z,
      }}
    >
      <Marquee items={items} opts={opts} />
    </div>
  );
}

export default function Bands() {
  return (
    <div
      aria-label="Caixa rápido, estoque na mão, combos, fechamento do dia"
      style={{ position: "relative", height: "clamp(190px, 22vw, 300px)", overflow: "hidden", background: "#0B0B0B" }}
    >
      <Band
        rot={3}
        bg="#141414"
        z={1}
        items={["14 dias grátis", "Feita pra adega de bairro", "Irregular de propósito", "Organizada por dentro"]}
        opts={{ fg: "#FBC009", dur: 46, rev: true, outline: true, sep: "/assets/dd-dark.png", sepH: "1em", size: "clamp(24px, 3.6vw, 52px)", gap: "clamp(18px, 2.2vw, 36px)" }}
      />
      <Band
        rot={-4}
        bg="#FBC009"
        z={2}
        items={["Caixa rápido", "Estoque na mão", "Combos", "Fechamento do dia", "Gestão pra adega", "Sextou na adega"]}
        opts={{ fg: "#0A0A0A", dur: 40, rev: false, outline: false, sep: "/assets/dd-black.png", sepH: "1em", size: "clamp(26px, 4.2vw, 60px)", gap: "clamp(18px, 2.2vw, 36px)" }}
      />
    </div>
  );
}
