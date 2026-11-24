import type { CSSProperties } from "react";

const WA_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
const YT_PATH =
  "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z";
const X_PATH =
  "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z";

const block: CSSProperties = { display: "block", flex: "none" };
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconWa({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={block}>
      <path d={WA_PATH} />
    </svg>
  );
}

export function IconWaHub() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={{ width: "54%", height: "54%", display: "block" }}>
      <path d={WA_PATH} />
    </svg>
  );
}

export function IconYt() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={block}>
      <path d={YT_PATH} />
    </svg>
  );
}

export function IconX() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={block}>
      <path d={X_PATH} />
    </svg>
  );
}

export function IconIg() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" style={block} {...stroke}>
      <rect x={2.5} y={2.5} width={19} height={19} rx={5.5} />
      <circle cx={12} cy={12} r={4.2} />
      <circle cx={17.4} cy={6.6} r={1.1} fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMail() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" style={block} {...stroke}>
      <rect x={2.5} y={4.5} width={19} height={15} rx={2.5} />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </svg>
  );
}

export function IconClose() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden="true" style={block} {...stroke} strokeWidth={2.6}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconMenu() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" style={block} {...stroke} strokeWidth={2.4}>
      <path d="M4 8h16M4 16h16" />
    </svg>
  );
}

export function IconArrow() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" style={block} {...stroke} strokeWidth={2.4}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
