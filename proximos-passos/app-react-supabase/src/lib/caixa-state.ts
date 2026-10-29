/**
 * Estado mínimo do caixa que outras partes do app precisam saber (E54):
 * a atualização do PWA não pode trocar a versão com uma venda em andamento.
 * O carrinho do caixa chama setCartOpen(true/false); a atualização consulta canUpdateNow().
 */
type Listener = () => void

let cartOpen = false
let lastSaleAt = 0
const listeners = new Set<Listener>()

export function setCartOpen(open: boolean) {
  cartOpen = open
  if (!open) lastSaleAt = Date.now()
  listeners.forEach((l) => l())
}

/** Seguro atualizar: sem carrinho aberto e sem venda nos últimos 10 minutos — ou fora do caixa. */
export function canUpdateNow(onCaixa: boolean): boolean {
  if (!onCaixa) return true
  return !cartOpen && Date.now() - lastSaleAt > 10 * 60 * 1000
}

export function onCaixaStateChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
