import type { CSSProperties } from "react";

const FF = "var(--font-archivo), sans-serif";

export type MarqueeOpts = {
  fg: string;
  dur: number;
  rev?: boolean;
  outline?: boolean;
  sep: string;
  sepH: string;
  size: string;
  gap: string;
};

const head: CSSProperties = {
  fontFamily: FF,
  fontWeight: 900,
  fontStretch: "88%",
  textTransform: "uppercase",
  lineHeight: 1,
  whiteSpace: "nowrap",
  letterSpacing: "-.005em",
};

export default function Marquee({ items, opts }: { items: string[]; opts: MarqueeOpts }) {
  const Copy = ({ hidden }: { hidden?: boolean }) => (
    <div aria-hidden={hidden || undefined} style={{ display: "flex", alignItems: "center", gap: opts.gap, paddingRight: opts.gap, flex: "none" }}>
      {items.concat(items).map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: opts.gap }}>
          <span
            style={{
              ...head,
              fontSize: opts.size,
              color: opts.outline && i % 2 ? "transparent" : opts.fg,
              WebkitTextStroke: opts.outline && i % 2 ? `1.5px ${opts.fg}` : undefined,
            }}
          >
            {t}
          </span>
          <img src={opts.sep} alt="" style={{ height: opts.sepH, width: "auto", display: "block", flex: "none" }} />
        </div>
      ))}
    </div>
  );
  return (
    <div data-marq style={{ display: "flex", width: "max-content", animation: `addMarq ${opts.dur}s linear infinite${opts.rev ? " reverse" : ""}` }}>
      <Copy />
      <Copy hidden />
    </div>
  );
}
