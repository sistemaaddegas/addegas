import { Icon } from './icon'

/** Canais de pedido (orders.channel) com o logo do app, ou uma letra sobre a cor do canal. */
export const CANAL: Record<string, { nome: string; cor: string; img?: string; letra?: string; bg?: string; tinta?: string }> = {
  ifood: { nome: 'iFood', cor: '#FF4B4B', img: '/assets/apps/ifood-red.png' },
  ze_delivery: { nome: 'Zé Delivery', cor: '#F5B800', img: '/assets/apps/ze-delivery.png' },
  food99: { nome: '99Food', cor: '#FF8A3D', img: '/assets/apps/99food.png' },
  keeta: { nome: 'Keeta', cor: '#3DD6C4', img: '/assets/apps/keeta.png' },
  whatsapp: { nome: 'WhatsApp', cor: '#3BD16F', bg: '#25D366', tinta: '#FFFFFF' },
  phone: { nome: 'Telefone', cor: '#ADADB4', letra: 'T', bg: '#2A2A2E', tinta: '#F5F5F2' },
  counter: { nome: 'Balcão', cor: '#ADADB4', letra: 'B', bg: '#2A2A2E', tinta: '#F5F5F2' },
  catalog: { nome: 'Catálogo', cor: '#FBC009', letra: 'C', bg: '#FBC009', tinta: '#0A0A0B' },
}
export const canal = (ch: string) => CANAL[ch] ?? { nome: ch, cor: '#ADADB4', letra: ch[0]?.toUpperCase(), bg: '#2A2A2E', tinta: '#F5F5F2' }

export function CanalLogo({ channel }: { channel: string }) {
  const c = canal(channel)
  return (
    <span title={c.nome} className="w-10 h-10 flex-none overflow-hidden rounded-[3px_10px_2px_9px] flex items-center justify-center text-[17px] font-black"
      style={{ background: c.img ? '#FFFFFF' : c.bg, color: c.tinta }}>
      {c.img ? <span className="block w-full h-full bg-cover bg-center" style={{ backgroundImage: `url("${c.img}")` }} />
        : c.letra ?? <Icon name="chat" size={22} />}
    </span>
  )
}
