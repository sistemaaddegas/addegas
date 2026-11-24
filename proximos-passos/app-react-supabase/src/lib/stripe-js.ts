/**
 * Stripe.js para o checkout embutido (E34). O Stripe exige carregar o script do js.stripe.com (não pode ir no
 * build): os campos do cartão ficam num iframe dele, e o número do cartão nunca passa pelo nosso código.
 * Só a chave publicável (pk_) fica no front; a secreta vive nas Edge Functions.
 */
type Checkout = { mount(el: HTMLElement): void; destroy(): void }
type StripeJs = { initEmbeddedCheckout(o: { fetchClientSecret: () => Promise<string> }): Promise<Checkout> }
declare global { interface Window { Stripe?: (pk: string, o?: { locale?: string }) => StripeJs } }

let carregando: Promise<StripeJs> | null = null

export function stripeJs(): Promise<StripeJs> {
  const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
  if (!pk) return Promise.reject(new Error('Pagamento não configurado neste ambiente (VITE_STRIPE_PUBLISHABLE_KEY).'))
  carregando ??= new Promise<StripeJs>((ok, erro) => {
    const pronto = () => (window.Stripe ? ok(window.Stripe(pk, { locale: 'pt-BR' })) : erro(new Error('Stripe.js não carregou.')))
    if (window.Stripe) return pronto()
    const s = document.createElement('script')
    s.src = 'https://js.stripe.com/v3/'
    s.async = true
    s.onload = pronto
    s.onerror = () => { carregando = null; s.remove(); erro(new Error('Não deu para abrir o pagamento do Stripe. Confira a internet e tente de novo.')) }
    document.head.appendChild(s)
  })
  return carregando
}

/**
 * Monta o checkout embutido no elemento. O Stripe só aceita um por página, então cada montagem espera a anterior
 * ser desfeita (trocar de ciclo, sair da tela ou a montagem dupla do React no desenvolvimento).
 */
let fila: Promise<void> = Promise.resolve()
export function montarCheckout(el: HTMLElement, clientSecret: string): { pronto: Promise<void>; desmontar: () => void } {
  let checkout: Checkout | null = null
  let cancelado = false
  const pronto = fila.then(async () => {
    if (cancelado) return
    const c = await (await stripeJs()).initEmbeddedCheckout({ fetchClientSecret: async () => clientSecret })
    if (cancelado) { c.destroy(); return }
    c.mount(el)
    checkout = c
  })
  fila = pronto.catch(() => {})
  return { pronto, desmontar: () => { cancelado = true; checkout?.destroy(); checkout = null } }
}
