export type NavItem = { path: string; label: string; group: 'Operação' | 'Gestão' | 'Análise' | 'Ferramentas' | 'Configurar'; rail?: boolean; tab?: boolean }

export const NAV: NavItem[] = [
  { path: '/', label: 'Início', group: 'Operação', rail: true, tab: true },
  { path: '/caixa', label: 'Caixa', group: 'Operação', rail: true, tab: true },
  { path: '/pedidos', label: 'Pedidos', group: 'Operação', rail: true, tab: true },
  { path: '/estoque', label: 'Estoque', group: 'Gestão', rail: true },
  { path: '/combos', label: 'Combos', group: 'Gestão' },
  { path: '/clientes', label: 'Clientes e fiado', group: 'Gestão', rail: true },
  { path: '/compras', label: 'Compras e contas', group: 'Gestão' },
  { path: '/relatorios', label: 'Relatórios', group: 'Análise', rail: true, tab: true },
  { path: '/lucro-no-copo', label: 'Lucro no Copo', group: 'Ferramentas' },
  { path: '/anotacoes', label: 'Anotações', group: 'Ferramentas' },
  { path: '/equipe', label: 'Equipe', group: 'Configurar' },
  { path: '/whatsapp', label: 'WhatsApp', group: 'Configurar' },
  { path: '/ajustes', label: 'Ajustes', group: 'Configurar' },
]
