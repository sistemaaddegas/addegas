import { rpc } from '@/lib/supabase'
import { brlc } from '@/lib/format'

type Recibo = {
  store: { name: string; address: string | null; neighborhood: string | null; city: string | null; whatsapp: string | null; document: string | null }
  number: number; status: string; datetime: string; operator: string | null; tab: string | null
  items: { name: string; quantity: number; unit_price: number; total: number }[]
  subtotal: number; discount: number; delivery_fee: number; total: number
  payments: { method: string; amount: number; change: number | null }[]
  fiado_name: string | null; footer_legal: string
}

const FORMA: Record<string, string> = { cash: 'Dinheiro', pix: 'Pix', credit: 'Crédito', debit: 'Débito', fiado: 'Fiado', voucher: 'Vale' }
const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const qtd = (n: number) => String(Number(n)).replace('.', ',')

/** Cupom não fiscal (E24, D18) pela impressão do navegador, na largura de bobina de 80 mm. */
export async function imprimirCupom(saleId: string) {
  const r = await rpc<Recibo>('sale_receipt', { p_sale_id: saleId })
  const linha = (a: string, b: string, forte = false) => `<div class="l${forte ? ' f' : ''}"><span>${a}</span><span>${b}</span></div>`
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cupom #${r.number}</title><style>
    @page { size: 80mm auto; margin: 4mm }
    body { font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace; color: #000; margin: 0; width: 72mm }
    h1 { font-size: 15px; text-align: center; margin: 0 0 2px } .c { text-align: center } .s { border-top: 1px dashed #000; margin: 6px 0 }
    .l { display: flex; justify-content: space-between; gap: 8px } .f { font-weight: 700; font-size: 14px } .i { margin: 3px 0 }
  </style></head><body>
    <h1>${esc(r.store.name)}</h1>
    <div class="c">${esc([r.store.address, r.store.neighborhood, r.store.city].filter(Boolean).join(' · '))}</div>
    ${r.store.document ? `<div class="c">CNPJ ${esc(r.store.document)}</div>` : ''}
    <div class="s"></div>
    ${linha(`Venda #${r.number}`, esc(r.datetime))}
    ${r.operator ? linha('Operador', esc(r.operator)) : ''}${r.tab ? linha('Comanda', esc(r.tab)) : ''}
    ${r.status === 'canceled' ? '<div class="c f">VENDA CANCELADA</div>' : ''}
    <div class="s"></div>
    ${r.items.map((i) => `<div class="i">${esc(i.name)}${linha(`${qtd(i.quantity)} × ${brlc(i.unit_price)}`, brlc(i.total))}</div>`).join('')}
    <div class="s"></div>
    ${r.discount ? linha('Subtotal', brlc(r.subtotal)) + linha('Desconto', `− ${brlc(r.discount)}`) : ''}
    ${r.delivery_fee ? linha('Entrega', brlc(r.delivery_fee)) : ''}
    ${linha('TOTAL', brlc(r.total), true)}
    ${r.payments.map((p) => linha(FORMA[p.method] ?? p.method, brlc(p.amount)) + (p.change ? linha('Troco', brlc(p.change)) : '')).join('')}
    ${r.fiado_name ? linha('Fiado de', esc(r.fiado_name)) : ''}
    <div class="s"></div>
    <div class="c">${esc(r.footer_legal)}</div>
    <div class="c">Obrigado pela preferência!</div>
  </body></html>`

  const f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
  document.body.appendChild(f)
  const doc = f.contentDocument!
  doc.open(); doc.write(html); doc.close()
  f.contentWindow!.focus()
  f.contentWindow!.print()
  setTimeout(() => f.remove(), 60_000)
}
