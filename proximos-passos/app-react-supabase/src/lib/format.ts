export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** O banco guarda dinheiro em centavos (bigint). */
export const brlc = (centavos: number) => brl(centavos / 100)

/** "1.500,50" | "1500,5" | "1500.50" -> 1500.5 */
export const parseBRL = (s: string) => {
  const n = parseFloat(s.replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
}
