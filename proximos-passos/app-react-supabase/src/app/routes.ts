import type { IconName } from '@/components/icon'

export type NavItem = {
  path: string; label: string; icon: IconName
  group: 'Operação' | 'Gestão' | 'Análise' | 'Ferramentas' | 'Configurar'
  /** Permissão exigida (E12); sem ela o item some do menu. */
  perm?: string
  rail?: boolean
}

// Mesma ordem e nomes do NAVG do Addegas.dc.html.
export const NAV: NavItem[] = [
  { path: '/', label: 'Início', icon: 'home', group: 'Operação', rail: true },
  { path: '/caixa', label: 'Caixa', icon: 'cart', group: 'Operação', rail: true },
  { path: '/pedidos', label: 'Pedidos', icon: 'bag', group: 'Operação', perm: 'pedidos', rail: true },
  { path: '/estoque', label: 'Estoque', icon: 'box', group: 'Gestão', perm: 'estoque', rail: true },
  { path: '/clientes', label: 'Clientes e fiado', icon: 'book', group: 'Gestão', perm: 'fiado_receber', rail: true },
  { path: '/compras', label: 'Compras', icon: 'truck', group: 'Gestão', perm: 'compras' },
  { path: '/contas', label: 'Contas a pagar', icon: 'receipt', group: 'Gestão', perm: 'contas' },
  { path: '/relatorios', label: 'Relatórios', icon: 'chart', group: 'Análise', perm: 'relatorios', rail: true },
  { path: '/combos', label: 'Promoções', icon: 'tag', group: 'Ferramentas', perm: 'precos' },
  { path: '/lucro-no-copo', label: 'Lucro no Copo', icon: 'glass', group: 'Ferramentas', perm: 'ferramentas' },
  { path: '/anotacoes', label: 'Anotações', icon: 'note', group: 'Ferramentas', perm: 'ferramentas' },
  { path: '/equipe', label: 'Equipe', icon: 'users', group: 'Configurar', perm: 'equipe' },
  { path: '/whatsapp', label: 'WhatsApp', icon: 'chat', group: 'Configurar', perm: 'ajustes' },
  { path: '/ajustes', label: 'Ajustes', icon: 'sliders', group: 'Configurar' },
]

/** Abas do celular, na ordem do protótipo (TABS): Início · Pedidos · Vender · Relatórios · Mais. */
export const TABS: { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: 'Início', icon: 'home' },
  { path: '/pedidos', label: 'Pedidos', icon: 'bag' },
  { path: '/caixa', label: 'Vender', icon: 'cart' },
  { path: '/relatorios', label: 'Relatórios', icon: 'chart' },
]

/** Título do cabeçalho de cada tela (TITLE do protótipo). */
export const TITULO: Record<string, string> = {
  ...Object.fromEntries(NAV.map((n) => [n.path, n.label])),
  '/mais': 'Mais', '/suporte': 'Registrar ticket', '/perfil': 'Meu perfil', '/assinatura': 'Assinatura',
}
