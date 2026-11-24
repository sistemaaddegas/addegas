const FF = "var(--font-archivo), sans-serif";

function Figure({ src, alt, flex }: { src: string; alt: string; flex: string }) {
  return (
    <figure data-clip style={{ margin: 0, position: "relative", flex, height: "clamp(280px,34vw,500px)", overflow: "hidden", borderRadius: 18, background: "#141414" }}>
      <div data-par style={{ position: "absolute", left: 0, right: 0, top: "-10%", height: "120%" }}>
        <img className="gal-img" src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 1.2s cubic-bezier(.2,.7,.2,1)" }} />
      </div>
    </figure>
  );
}

export default function NaRua() {
  return (
    <section id="na-rua" style={{ background: "#0B0B0B", padding: "clamp(88px,11vw,160px) clamp(16px,4vw,40px)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", font: `600 11px/1 ${FF}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#9A9A9A", marginBottom: "clamp(40px,6vw,80px)" }}>
          <span>A marca na rua</span>
          <span>07</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "28px 64px", alignItems: "end", marginBottom: "clamp(36px,5vw,64px)" }}>
          <h2 data-reveal style={{ margin: 0, font: `900 clamp(40px,6.4vw,100px)/.9 ${FF}`, fontStretch: "88%", textTransform: "uppercase", letterSpacing: "-.015em" }}>
            Veste a adega.
            <br />
            <span style={{ color: "#FBC009" }}>Cara de combo.</span>
          </h2>
          <p data-reveal style={{ margin: 0, maxWidth: "40ch", justifySelf: "end", font: `400 clamp(17px,1.4vw,20px)/1.55 ${FF}`, color: "#C4C4C4", textWrap: "pretty" }}>
            Do copo ao boné, do letreiro ao celular: a Addegas aparece onde a adega acontece.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Figure src="/assets/mock/camiseta.jpg" alt="Camiseta preta com logo Addegas" flex="1 1 300px" />
            <Figure src="/assets/mock/copos-trio.jpg" alt="Três copos de drink com os DD" flex="2 1 540px" />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Figure src="/assets/mock/copo-logo.jpg" alt="Copo com logo Addegas" flex="1 1 280px" />
            <Figure src="/assets/mock/bone.jpg" alt="Boné com logo Addegas" flex="1.4 1 400px" />
            <Figure src="/assets/mock/copo-dd.jpg" alt="Copo com os DD" flex="1 1 280px" />
          </div>
        </div>
      </div>
    </section>
  );
}
