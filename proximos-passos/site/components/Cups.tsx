import type { CSSProperties } from "react";

const abs: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

const WAVE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='none'%3E%3Cpath d='M0 12 Q25 2 50 12 T100 12 V20 H0Z' fill='%23FBC009'/%3E%3C/svg%3E\")";

function mask(url: string): CSSProperties {
  return {
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  };
}

// [left%, width%, dur, delay]
const BUBBLES: [number, number, number, number][] = [
  [14, 1.6, 3.4, 0], [24, 1.1, 2.8, 1.2], [34, 2, 4.2, 0.6], [41, 1.3, 3.1, 2], [56, 1.8, 3.8, 0.3],
  [64, 1.2, 2.6, 1.6], [74, 2.1, 4.4, 1], [84, 1.4, 3.2, 2.4], [29, 1, 2.4, 2.8], [70, 1, 2.9, 0.9],
];

export default function Cups() {
  return (
    <div role="img" aria-label="Os DD da Addegas como dois copos enchendo" style={{ position: "relative", width: "min(100%, 520px, 34vh)", aspectRatio: "3514 / 3367" }}>
      <div style={{ ...abs, filter: "drop-shadow(0 0 1.2px rgba(255,255,255,.75)) drop-shadow(0 30px 70px rgba(251,192,9,.22))" }}>
        <div style={{ ...abs, ...mask("/assets/dd-cups.png"), background: "linear-gradient(100deg, #1B1B1B 0%, #2E2E2E 16%, #161616 34%, #222222 70%, #121212 100%)" }} />
      </div>
      <div style={{ ...abs, ...mask("/assets/dd-straw-in.png"), background: "#FBC009", opacity: 0.7 }} />
      <div style={{ ...abs, ...mask("/assets/dd-cups.png") }}>
        <div data-liquid style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "6%", background: "#FBC009" }}>
          {BUBBLES.map((b, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: `${b[0]}%`,
                bottom: "-4%",
                width: `${b[1]}%`,
                aspectRatio: "1",
                borderRadius: "50%",
                background: "rgba(255,255,255,.6)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,.8)",
                animation: `addBub ${b[2]}s ease-in ${b[3]}s infinite`,
              }}
            />
          ))}
        </div>
        <div
          data-wave
          style={{
            position: "absolute",
            left: 0,
            bottom: "6%",
            width: "200%",
            height: "4.5%",
            marginBottom: "-1px",
            backgroundImage: WAVE,
            backgroundSize: "12.5% 100%",
            backgroundRepeat: "repeat-x",
            animation: "addMarq 2.8s linear infinite",
          }}
        />
      </div>
      <div data-strawdark style={{ ...abs, ...mask("/assets/dd-straw-in.png"), background: "rgba(10,10,10,.22)", clipPath: "inset(94% 0 0 0)" }} />
      <div style={{ ...abs, ...mask("/assets/dd-straw-out.png"), background: "#FBC009" }} />
    </div>
  );
}
