export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** O banco guarda dinheiro em centavos (bigint). */
export const brlc = (centavos: number) => brl(centavos / 100)

/** "1.500,50" | "1500,5" | "1500.50" -> 1500.5 */
export const parseBRL = (s: string) => {
  const n = parseFloat(s.replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
}

/** Texto digitado em reais -> centavos. */
export const centavos = (s: string) => Math.round(parseBRL(s) * 100)

/** Centavos -> texto para um campo editável ("12,90"). */
export const reais = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','))
