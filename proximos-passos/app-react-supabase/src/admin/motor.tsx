// @ts-nocheck
// Motor do painel portado do protótipo aprovado (`Addegas Admin.dc.html`): mesmas funções de formatação, cores,
// estilos e blocos. O protótipo é JavaScript solto com objetos montados na hora; tipar cada bloco duplicaria o
// arquivo sem ganho, então este módulo e o painel ficam fora da checagem de tipos. A fronteira tipada é a api.ts.
import { createElement } from 'react'

export const TZ = 'America/Sao_Paulo', DAY = 864e5, Y = '#FBC009'
// "Agora" do painel: atualizado a cada retrato e a cada desenho (o protótipo tinha uma data fixa).
export let NOW = new Date()
export const tick = () => { NOW = new Date() }
export const R = ['3px 10px 2px 9px', '2px 8px 3px 7px', '4px 13px 5px 11px', '3px 11px 4px 10px', '2px 7px 3px 6px']
export const dt = (s) => s instanceof Date ? s : new Date(typeof s === 'string' && s.length <= 10 ? s + 'T12:00:00-03:00' : (typeof s === 'string' && s.length === 16 ? s + ':00-03:00' : s))
export const fD = (x) => x ? dt(x).toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
export const fT = (x) => dt(x).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
export const fDT = (x) => x ? fD(x) + ' às ' + fT(x) : '—'
export const fM = (x) => dt(x).toLocaleDateString('pt-BR', { timeZone: TZ, month: 'short' }).replace('.', '')
export const money = (n) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const pc = (n, d = 1) => (n * 100).toFixed(d).replace('.', ',') + '%'
export const nz = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const addM = (x, n) => { const y = new Date(dt(x)); y.setMonth(y.getMonth() + n); return y }
export const addD = (x, n) => new Date(dt(x).getTime() + n * DAY)
export const isoD = (x) => new Date(dt(x).getTime() - 3 * 36e5).toISOString().slice(0, 10)
export const ago = (h) => h == null ? 'Nunca usou' : h < 1 ? 'Agora há pouco' : h < 24 ? 'Há ' + Math.round(h) + ' h' : Math.round(h / 24) === 1 ? 'Há 1 dia' : 'Há ' + Math.round(h / 24) + ' dias'
export const PL = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias', '12m': '12 meses' }, PD = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }
export const ASS = { teste: ['Em teste', '#1E90FF', '#FFFFFF'], ativa: ['Ativa', '#16C60C', '#0A0A0B'], inadimplente: ['Inadimplente', '#E5241B', '#FFFFFF'], cancelada: ['Cancelada', '#3A3A40', '#F5F5F2'], expirada: ['Expirada', '#6E6E73', '#FFFFFF'] }
export const ACC = { liberado: ['Liberado', '#16241A', '#4ADE80'], carencia: ['Em carência', '#FF8A00', '#0A0A0B'], suspenso: ['Suspenso', '#E5241B', '#FFFFFF'] }
export const INV = { paga: ['Paga', '#16241A', '#4ADE80'], aberta: ['A vencer', '#1C1C1F', '#F5F5F2'], vencida: ['Vencida', '#E5241B', '#FFFFFF'], reemb: ['Reembolso', '#1E90FF', '#FFFFFF'], cancelada: ['Cancelada', '#3A3A40', '#F5F5F2'] }
export const BK = { primary: [Y, '#0A0A0B', 'none'], ghost: ['transparent', '#F5F5F2', '1px solid #3A3A40'], danger: ['#E5241B', '#FFFFFF', 'none'], green: ['#16C60C', '#0A0A0B', 'none'], dark: ['#1C1C1F', '#F5F5F2', '1px solid #2A2A2E'] }
export const bst = (k = 'ghost', i = 0, o = {}) => { const [bg, fg, bd] = BK[k]; return { height: o.h || 40, padding: '0 14px', borderRadius: R[i % 5], border: bd, background: bg, color: fg, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap', opacity: o.dim ? .45 : 1 } }
export const chipSt = (on, i) => ({ height: 38, padding: '0 12px', borderRadius: R[i % 5], border: on ? 'none' : '1px solid #2A2A2E', background: on ? Y : '#141416', color: on ? '#0A0A0B' : '#F5F5F2', fontSize: 14, fontWeight: on ? 800 : 600, cursor: 'pointer' })
export const bdg = (t, bg, fg, sub) => ({ t, badge: true, sub: sub || '', bst: { alignSelf: 'flex-start', height: 24, padding: '0 9px', borderRadius: '2px 7px 3px 6px', background: bg, color: fg, fontSize: 12.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' } })
export const cl = (t, sub, o = {}) => ({ t: String(t == null ? '—' : t), sub: sub || '', plain: true, st: { fontSize: o.sz || 14, fontWeight: o.b ? 800 : 500, color: o.c || '#F5F5F2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } })
export const dot = (c, s = 8) => ({ width: s, height: s, borderRadius: 2, background: c, flex: 'none' })
export const IC = { gift: ['M3 8h18v4H3z', 'M5 12v9h14v-9', 'M12 8v13', 'M12 8C10 3 6 3 6.5 6 7 8 12 8 12 8', 'M12 8c2-5 6-5 5.5-2C17 8 12 8 12 8'], home: ['M3 11 12 4l9 7', 'M5 10v10h14V10'], store: ['M3 9 4.5 4h15L21 9', 'M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z', 'M5 13v8h14v-8'], funnel: ['M3 4h18l-7 9v6l-4 2v-8z'], card: ['M2 6h20v12H2z', 'M2 10h20'], wallet: ['M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3z', 'M3 7V5a1 1 0 0 1 1-1h12', 'M16 13h2'], tag: ['M3 3h8l10 10-8 8L3 11z', 'c:7.5,7.5,1.5'], box: ['M3 7l9-4 9 4v10l-9 4-9-4z', 'M3 7l9 4 9-4', 'M12 11v10'], ticket: ['M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z', 'M14 7v10'], chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'], mega: ['M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z', 'M17 8a5 5 0 0 1 0 8'], map: ['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z', 'M9 4v14', 'M15 6v14'], msg: ['M4 4h16v12H8l-4 4z'], shield: ['M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z'], team: ['c:9,8,3.5', 'M2 20c1-4 4-6 7-6s6 2 7 6', 'c:17,9,2.5', 'M17 14c2.5 0 4.5 1.5 5 5'], gear: ['c:12,12,3', 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1'], search: ['c:11,11,7', 'm21 21-4.3-4.3'], bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10 21a2 2 0 0 0 4 0'], menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'], x: ['M18 6 6 18', 'M6 6l12 12'], back: ['M15 18l-6-6 6-6'], alert: ['M12 3 2 21h20z', 'M12 10v5', 'M12 18h.01'], lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'], check: ['M5 12l5 5 9-10'], logout: ['M9 21H4V3h5', 'M16 17l5-5-5-5', 'M21 12H9'], clock: ['c:12,12,9', 'M12 7v5l3 2'], tool: ['M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9a4 4 0 0 0-2-2z'] }
export const ic = (n, s = 20, w = 2) => createElement('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block', flex: 'none' } }, (IC[n] || []).map((d, i) => d.startsWith('c:') ? createElement('circle', { key: i, cx: +d.slice(2).split(',')[0], cy: +d.split(',')[1], r: +d.split(',')[2] }) : createElement('path', { key: i, d })))
export const NAV = [['Painel', [['overview', 'Visão geral', 'home']]], ['Clientes', [['adegas', 'Adegas', 'store'], ['crm', 'CRM e oportunidades', 'funnel']]], ['Receita', [['planos', 'Planos e assinaturas', 'card'], ['financeiro', 'Financeiro', 'wallet'], ['descontos', 'Descontos e benefícios', 'tag']]], ['Produto', [['produtos', 'Repositório de produtos', 'box'], ['tickets', 'Tickets e melhorias', 'ticket'], ['uso', 'Uso do sistema e funis', 'chart']]], ['Crescimento', [['marketing', 'Marketing e tráfego', 'mega'], ['brindes', 'Brindes de fidelidade', 'gift'], ['mapa', 'Mapa de adegas', 'map'], ['mensagens', 'Central de mensagens', 'msg']]], ['Plataforma', [['monitor', 'Monitoramento e segurança', 'shield'], ['equipe', 'Equipe administrativa', 'team'], ['config', 'Configurações', 'gear']]]]

// Perfis: o código do banco (platform.staff_roles) e a chave usada nas telas do protótipo.
export const ROLEKEY = { master: 'mestre', finance: 'financeiro', support: 'suporte', commercial: 'comercial', analyst: 'analista' }
export const ROLECODE = Object.fromEntries(Object.entries(ROLEKEY).map(([a, b]) => [b, a]))
export const AREA = { mestre: 'Administração', financeiro: 'Financeiro', suporte: 'Suporte', comercial: 'Marketing', analista: 'Análise' }
// Permissão das telas → ação do servidor (platform.role_actions). O servidor confere de novo em cada chamada.
export const PERMACT = { 'plan.change': 'accounts.plan', 'plan.write': 'platform.config', 'access.suspend': 'accounts.access', 'access.temp': 'accounts.temp_access', 'trial.extend': 'accounts.extend_trial', 'payment.register': 'billing.manual_payment', 'discount.write': 'billing.discount', 'note.write': 'accounts.note', 'export': 'export', 'gift.send': 'gifts.write', 'crm.write': 'crm.write', 'ticket.write': 'tickets.reply', 'catalog.write': 'catalog.write', 'msg.send': 'messages.send', 'msg.promo': 'marketing.write', 'log.write': 'monitoring.read', 'team.write': 'staff.manage', 'config.write': 'platform.config', 'mkt.write': 'marketing.write' }
export const PERM = { 'plan.change': 'ativar ou trocar plano', 'plan.write': 'editar planos', 'access.suspend': 'suspender ou reativar acesso', 'access.temp': 'conceder acesso temporário', 'trial.extend': 'estender teste', 'payment.register': 'registrar pagamento', 'discount.write': 'conceder ou revogar descontos', 'note.write': 'escrever anotações', 'export': 'exportar dados', 'gift.send': 'enviar brindes ou mexer no estoque de brindes', 'crm.write': 'editar leads e oportunidades', 'ticket.write': 'responder ou alterar tickets', 'catalog.write': 'editar o repositório de produtos', 'msg.send': 'enviar mensagens', 'msg.promo': 'enviar campanhas promocionais', 'log.write': 'investigar ocorrências', 'team.write': 'gerenciar a equipe administrativa', 'config.write': 'alterar configurações da plataforma', 'mkt.write': 'informar investimento de marketing', nav: 'abrir esta área' }
export const NAVACT = { overview: ['overview.read'], adegas: ['accounts.read'], crm: ['crm.write'], planos: ['accounts.plan', 'billing.read'], financeiro: ['billing.read'], descontos: ['billing.discount'], produtos: ['catalog.write'], tickets: ['tickets.read'], uso: ['usage.read'], marketing: ['marketing.write', 'usage.read'], brindes: ['gifts.write'], mapa: ['crm.write', 'marketing.write', 'usage.read'], mensagens: ['messages.send'], monitor: ['monitoring.read'], equipe: ['staff.manage'], config: ['platform.config'] }

export const gt = (b) => { let s = 0; for (let i = 0; i < b.length; i++) s += (+b[b.length - 1 - i]) * (i % 2 === 0 ? 3 : 1); return b + ((10 - s % 10) % 10) }
export const gtOk = (v) => /^\d{8,14}$/.test(v) && gt(v.slice(0, -1)) === v
export const TKT = { falha: 'Falha no sistema', duvida: 'Dúvida', financeiro: 'Problema financeiro', melhoria: 'Sugestão de melhoria' }
export const TKS = { novo: ['Novo', Y, '#0A0A0B'], atendimento: ['Em atendimento', '#1E90FF', '#FFFFFF'], aguard_cliente: ['Aguardando cliente', '#3A3A40', '#F5F5F2'], aguard_tec: ['Aguardando equipe técnica', '#FF8A00', '#0A0A0B'], resolvido: ['Resolvido', '#16C60C', '#0A0A0B'], encerrado: ['Encerrado', '#1C1C1F', '#A1A1A6'] }
export const TKP = { critica: ['Crítica', '#E5241B', '#FFFFFF'], alta: ['Alta', '#FF8A00', '#0A0A0B'], media: ['Média', '#2A2A2E', '#F5F5F2'], baixa: ['Baixa', '#1C1C1F', '#B4B4B9'] }
export const TG1 = { critica: 1, alta: 4, media: 8, baixa: 24 }, TGR = { critica: 8, alta: 24, media: 72, baixa: 120 }
export const GST2 = { analise: ['Em análise', '#3A3A40', '#F5F5F2'], planejada: ['Planejada', '#1E90FF', '#FFFFFF'], dev: ['Em desenvolvimento', '#FF8A00', '#0A0A0B'], entregue: ['Entregue', '#16C60C', '#0A0A0B'] }
export const PST = { publicado: ['Publicado', '#16C60C', '#0A0A0B'], rascunho: ['Rascunho', Y, '#0A0A0B'], arquivado: ['Arquivado', '#3A3A40', '#F5F5F2'] }
export const DST = { ativo: ['Ativo', '#16C60C', '#0A0A0B'], agendado: ['Agendado', '#1E90FF', '#FFFFFF'], encerrado: ['Encerrado', '#3A3A40', '#F5F5F2'], revogado: ['Revogado', '#E5241B', '#FFFFFF'] }
export const SEV = { critico: ['Crítico', '#E5241B', '#FFFFFF'], erro: ['Erro', '#FF8A00', '#0A0A0B'], aviso: ['Aviso', Y, '#0A0A0B'], info: ['Info', '#2A2A2E', '#F5F5F2'] }
export const LST = { aberto: ['Aberto', '#1C1C1F', '#F5F5F2'], investigando: ['Investigando', '#1E90FF', '#FFFFFF'], resolvido: ['Resolvido', '#16241A', '#4ADE80'] }
export const VARS = ['nome_adega', 'responsavel', 'plano', 'vencimento', 'prazo_final', 'link_regularizacao']
export const COST = { servico: 0.08, promo: 0.35 }
export const LL = { 'Vila Madalena': [-23.5535, -46.6913], 'Pinheiros': [-23.5673, -46.6925], 'Butantã': [-23.5717, -46.7086], 'Jardins': [-23.567, -46.66], 'Vila Mariana': [-23.5891, -46.6345], 'Osasco|Centro': [-23.5329, -46.792], 'Tatuapé': [-23.5403, -46.5761], 'Guarulhos|Centro': [-23.4628, -46.5333], 'Santa Cecília': [-23.539, -46.6535], 'Mooca': [-23.559, -46.5995], 'Lapa': [-23.5235, -46.7036], 'Santo André|Centro': [-23.6639, -46.5383], 'Itaim Bibi': [-23.5847, -46.6797], 'Freguesia do Ó': [-23.5007, -46.6964], 'Penha': [-23.526, -46.544], 'Moema': [-23.601, -46.664], 'Barra Funda': [-23.526, -46.666], 'Santana': [-23.5, -46.625], 'Tucuruvi': [-23.48, -46.603], 'Brooklin': [-23.6127, -46.6926], 'Saúde': [-23.6185, -46.6386], 'Vila Prudente': [-23.5826, -46.5817], 'Aclimação': [-23.5717, -46.6293], 'Ipiranga': [-23.5865, -46.6066], 'Largo do Arouche': [-23.5427, -46.6438], 'Consolação': [-23.5534, -46.6597], 'Perdizes': [-23.5372, -46.6797], 'Bela Vista': [-23.5614, -46.6469], 'Liberdade': [-23.5587, -46.6355] }
export const REGIAO = { 'Vila Madalena': 'Zona Oeste', 'Pinheiros': 'Zona Oeste', 'Butantã': 'Zona Oeste', 'Jardins': 'Zona Oeste', 'Lapa': 'Zona Oeste', 'Perdizes': 'Zona Oeste', 'Barra Funda': 'Centro', 'Santa Cecília': 'Centro', 'Consolação': 'Centro', 'Bela Vista': 'Centro', 'Liberdade': 'Centro', 'Largo do Arouche': 'Centro', 'Vila Mariana': 'Zona Sul', 'Itaim Bibi': 'Zona Sul', 'Moema': 'Zona Sul', 'Brooklin': 'Zona Sul', 'Saúde': 'Zona Sul', 'Aclimação': 'Zona Sul', 'Ipiranga': 'Zona Sul', 'Tatuapé': 'Zona Leste', 'Mooca': 'Zona Leste', 'Penha': 'Zona Leste', 'Vila Prudente': 'Zona Leste', 'Freguesia do Ó': 'Zona Norte', 'Santana': 'Zona Norte', 'Tucuruvi': 'Zona Norte' }
export const CENTERS = { 'Centro de SP': [-23.5505, -46.6333], 'Pinheiros': [-23.5673, -46.6925], 'Tatuapé': [-23.5403, -46.5761], 'Santana': [-23.5, -46.625] }
export const llOf = (b, c) => LL[c + '|' + b] || LL[b] || null
export const km = (a, b) => { const r = Math.PI / 180, dl = (b[0] - a[0]) * r, dg = (b[1] - a[1]) * r, x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dg / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)) }
export const ETAPACOR = { novo: '#A1A1A6', contato: '#7CB3FF', demo: '#FF8A00', teste: '#1E90FF', cliente: '#16C60C' }
export const fone = (t) => { const d = String(t || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : (t || '—') }

// Ciclos do plano único (D03) fazem o papel dos "planos" do protótipo: preço por mês equivalente.
const CICLO = { monthly: ['Mensal', 1], semiannual: ['Semestral', 6], annual: ['Anual', 12] }
const FEATNOME = { members: 'Usuários ilimitados', products: 'Produtos ilimitados', terminals: 'Caixas ilimitados', whatsapp_alerts: 'Alertas no WhatsApp', public_catalog: 'Vitrine pública', integrations_delivery: 'Pedidos dos apps' }
const STATUS = { trial: 'teste', active: 'ativa', past_due: 'inadimplente', canceled: 'cancelada', expired: 'expirada' }
const ACESSO = { allowed: 'liberado', grace: 'carencia', suspended: 'suspenso' }
const TKSTATUS = { novo: 'novo', em_andamento: 'atendimento', aguardando_cliente: 'aguard_cliente', aguardando_equipe: 'aguard_tec', resolvido: 'resolvido', fechado: 'encerrado' }
export const TKSTATUS_DB = Object.fromEntries(Object.entries(TKSTATUS).map(([a, b]) => [b, a]))
const TKKIND = { problema: 'falha', duvida: 'duvida', financeiro: 'financeiro', melhoria: 'melhoria' }
const GSTATUS = { analise: 'analise', planejada: 'planejada', desenvolvimento: 'dev', entregue: 'entregue' }
export const GSTATUS_DB = Object.fromEntries(Object.entries(GSTATUS).map(([a, b]) => [b, a]))
const CATST = { draft: 'rascunho', published: 'publicado', archived: 'arquivado' }
export const CATST_DB = Object.fromEntries(Object.entries(CATST).map(([a, b]) => [b, a]))
const ORIGEM = { direto: 'Direto', site: 'Site', google: 'Google', meta: 'Meta Ads', instagram: 'Instagram', indicacao: 'Indicação', evento: 'Evento' }
const origemNome = (o) => !o ? 'Direto' : ORIGEM[nz(o).replace(/\s.*/, '')] || o
const CANAL = { whatsapp: 'WhatsApp', email: 'E-mail' }
const ENTIDADE = { sale: 'Caixa', cash_session: 'Caixa', product: 'Estoque', stock: 'Estoque', fiado: 'Clientes e fiado', fiado_account: 'Clientes e fiado', order: 'Pedidos dos apps', report: 'Relatórios', bundle: 'Promoções', drink_recipe: 'Lucro no Copo', note: 'Anotações', member: 'Equipe', tab: 'Mesas e comandas', purchase_order: 'Compras', bill: 'Contas a pagar', supplier: 'Compras', quick_access: 'Vitrine / acesso rápido', store: 'Ajustes', terminal: 'Ajustes' }
const cod = (p, i, n = 2) => p + String(i).padStart(n, '0')
const r2 = (c) => Math.round(c) / 100
const horas = (t) => t ? (NOW.getTime() - new Date(t).getTime()) / 36e5 : null

// Texto do "antes → depois" da auditoria, como na linha do tempo do protótipo.
const CAMPO = { access: 'acesso', status: 'assinatura', cycle: 'ciclo', price: 'mensalidade', trial_ends_at: 'fim do teste', temp_access_until: 'acesso temporário até', revoked: 'revogado', kind: 'tipo', value: 'valor', cycles: 'ciclos', stacks: 'acumula', internal: 'nota interna', priority: 'prioridade', assignee: 'responsável', improvement_id: 'melhoria', role: 'perfil', active: 'ativa', email: 'e-mail', rows: 'linhas', amount: 'valor', proof: 'comprovante', payment_id: 'pagamento', name: 'nome', channels: 'canais', accounts: 'adegas', queued: 'na fila', skipped: 'sem consentimento', template: 'modelo' }
const VAL = { allowed: 'Liberado', grace: 'Em carência', suspended: 'Suspenso', trial: 'Em teste', active: 'Ativa', past_due: 'Inadimplente', canceled: 'Cancelada', expired: 'Expirada', monthly: 'Mensal', semiannual: 'Semestral', annual: 'Anual', paid: 'Paga', open: 'Aberta', true: 'sim', false: 'não' }
const vtxt = (k, v) => v == null ? '—' : (k === 'price' || k === 'amount') ? money(r2(v)) : /_at$|_until$/.test(k) && typeof v === 'string' ? fDT(v) : VAL[String(v)] ?? (typeof v === 'object' ? JSON.stringify(v) : String(v))
const diffTxt = (b, a) => !a ? '' : Object.keys(a).filter((k) => !['action', 'id'].includes(k) && JSON.stringify(b?.[k]) !== JSON.stringify(a[k]))
  .map((k) => (CAMPO[k] || k) + ': ' + (b && k in b ? vtxt(k, b[k]) + ' → ' : '') + vtxt(k, a[k])).join(' · ')
function acaoNome(e) {
  if (e.outcome === 'denied') return 'Ação negada por permissão'
  const a = e.after || {}, b = e.before || {}
  switch (e.action) {
    case 'subscription.transition':
      if (a.access === 'suspended' && b.access !== 'suspended') return e.system ? 'Acesso suspenso automaticamente' : 'Acesso suspenso'
      if (a.status === 'past_due' && b.status !== 'past_due') return 'Carência iniciada'
      if (a.status === 'active' && b.status !== 'active') return 'Assinatura ativada'
      if (a.status === 'canceled') return 'Assinatura cancelada'
      if (a.status === 'expired') return 'Teste expirado'
      if (a.access === 'allowed' && b.access !== 'allowed') return 'Acesso reativado'
      return 'Assinatura atualizada'
    case 'accounts.access': return a.access === 'suspended' ? 'Acesso suspenso' : 'Acesso reativado'
    case 'accounts.temp_access': return 'Acesso temporário concedido'
    case 'accounts.extend_trial': return 'Teste estendido'
    case 'accounts.plan': return a.status === 'active' && b.status !== 'active' ? 'Plano ativado' : 'Plano trocado'
    case 'accounts.note': return 'Anotação interna'
    case 'billing.manual_payment': return 'Pagamento registrado'
    case 'billing.refund': return 'Reembolso'
    case 'billing.discount': return a.revoked ? 'Desconto revogado' : 'Desconto concedido'
    case 'tickets.reply': return 'Ticket atualizado'
    case 'catalog.write': return 'Repositório de produtos'
    case 'crm.write': return 'CRM atualizado'
    case 'messages.send': return 'Envio pela central'
    case 'staff.manage': return 'Mudança de permissão'
    case 'platform.config': return 'Configuração alterada'
    case 'monitoring.read': return 'Ocorrência atualizada'
    case 'gifts.write': return 'Brinde de fidelidade'
    case 'marketing.write': return 'Investimento informado'
    case 'usage.read': return 'Funil criado'
    case 'export': return 'Exportação de dados'
    default: return e.action
  }
}

/** Traduz o retrato do banco (private.admin_snapshot) para o formato que as telas do protótipo usam. */
export function montar(snap) {
  tick()
  const me = snap.me, acts = me.actions || []
  const extra = snap.extra_store_prices || {}
  const feats = (snap.features || []).filter((f) => f.enabled)
  const lojasInc = (feats.find((f) => f.code === 'stores_included') || {}).limit || 1
  const recursos = feats.filter((f) => FEATNOME[f.code]).map((f) => FEATNOME[f.code])
  const plans = (snap.plans || []).map((p) => {
    const [nome, meses] = CICLO[p.cycle]
    return { id: p.cycle, nome, meses, total: r2(p.price), preco: r2(p.price) / meses, lojas: 0, lojasInc, usuarios: 0, produtos: 0, extra: extra[p.cycle] ? r2(extra[p.cycle]) / meses : 0, recursos, ativo: true, planName: p.plan_name }
  })
  const P = Object.fromEntries(plans.map((p) => [p.id, p]))
  const accRaw = snap.accounts || []
  const accCod = Object.fromEntries(accRaw.map((a, i) => [a.id, cod('A', i + 1)]))
  const leadOf = Object.fromEntries(accRaw.filter((a) => a.lead_id).map((a) => [a.lead_id, accCod[a.id]]))
  const adegas = accRaw.map((a) => {
    const [, meses] = CICLO[a.cycle] || ['', 1]
    const assin = STATUS[a.status] || 'teste', acesso = ACESSO[a.access] || 'liberado'
    const pago = ['ativa', 'inadimplente', 'cancelada'].includes(assin)
    return {
      id: accCod[a.id], uuid: a.id, nome: a.name, resp: a.owner_name || '—', tel: fone(a.owner_phone), email: a.owner_email || '—',
      end: a.address || '—', cidade: a.city || '—', bairro: a.neighborhood || '—',
      regiao: REGIAO[a.neighborhood] || (a.city && a.city !== 'São Paulo' ? a.city : 'São Paulo'),
      cad: a.created_at, plano: P[a.cycle] ? a.cycle : (plans[0] || {}).id, assin, acesso, ult: horas(a.last_action_at), origem: origemNome(a.origin),
      lojas: a.stores, usuarios: a.members, gmv: r2(a.gmv_30), uso: [a.active_days_30 || 0, a.sales_30 || 0, a.sessions_30 || 0], prevd: a.active_days_prev || 0,
      mensal: r2(a.price + a.extra_stores * a.extra_store_price) / meses, extraLojas: a.extra_stores,
      renov: !a.cancel_at_period_end, promo: !!a.promo, notas: a.notes || [], people: a.people || [],
      ini: a.started_at || (pago ? a.period_start || a.created_at : null), trialEnd: a.trial_ends_at,
      cancelEm: assin === 'cancelada' ? a.canceled_at || a.subscription_updated_at : null,
      motivoCancel: assin === 'cancelada' || assin === 'expirada' || a.cancel_at_period_end ? a.cancel_reason : null,
      validoAte: a.cancel_at_period_end ? a.period_end : null, cancelPedido: a.cancel_at_period_end ? a.subscription_updated_at : null,
      overdue: a.overdue_at, graceEnd: a.grace_ends_at, suspEm: acesso === 'suspenso' ? a.suspended_at : null,
      tempAte: a.temp_access_until && new Date(a.temp_access_until) > NOW ? a.temp_access_until : null,
      utm: a.utm && Object.keys(a.utm).length ? a.utm : null, campanha: a.campaign, leadId: a.lead_id, periodEnd: a.period_end,
    }
  })
  const A = Object.fromEntries(adegas.map((a) => [a.uuid, a]))
  const porConta = {}
  const invoices = (snap.invoices || []).filter((i) => A[i.account_id]).map((i) => {
    const a = A[i.account_id]; porConta[a.id] = (porConta[a.id] || 0) + 1
    const st = i.status === 'paid' ? 'paga' : i.status === 'open' ? (new Date(i.due_at) < NOW ? 'vencida' : 'aberta') : 'cancelada'
    return { id: 'F' + a.id.slice(1) + '-' + String(porConta[a.id]).padStart(2, '0'), uuid: i.id, a, venc: dt(i.due_at), val: r2(i.amount), base: r2(i.amount), dc: 0, st, pago: i.paid_at ? dt(i.paid_at) : null, taxa: 0, metodo: i.method, fonte: i.source, paymentId: i.payment_id }
  })
  const refunds = (snap.refunds || []).filter((r) => A[r.account_id]).map((r) => ({ a: A[r.account_id].id, when: r.created_at, val: r2(r.amount), motivo: r.reason, who: r.who }))
  const discounts = (snap.discounts || []).map((d, i) => {
    const ids = (d.accounts || []).map((x) => accCod[x]).filter(Boolean)
    return { id: 'D-' + String(i + 1).padStart(3, '0'), uuid: d.id, ids, alvo: ids.length === 1 ? (A[d.accounts[0]] || {}).nome : 'Grupo: ' + ids.length + ' adegas', tipo: d.kind === 'pct' ? 'pct' : 'fixo', valor: d.kind === 'pct' ? +d.value : r2(+d.value), plano: 'todos', ini: d.starts_at, ciclos: d.cycles, aplic: d.cycles === 1 ? 'unica' : 'recorrente', motivo: d.reason, resp: d.who, acumula: d.stacks, criado: d.created_at, revog: d.revoked_at, revogMotivo: d.revoke_reason }
  })
  const audit = (snap.audit || []).map((e) => ({ id: e.id, when: e.when, who: e.who, action: acaoNome(e), adega: accCod[e.account_id] || null, motivo: e.reason || '', diff: diffTxt(e.before, e.after) }))
  const tplNome = Object.fromEntries((snap.templates || []).map((t) => [t.code, t.name]))
  const queue = (snap.queue || []).filter((q) => !String(q.dedupe || '').startsWith('send:') && A[q.account_id]).map((q) => ({ id: q.id, adega: A[q.account_id].id, when: q.when, t: tplNome[q.template] || q.template, canal: CANAL[q.channel], st: q.status === 'pending' ? 'agendado' : q.status === 'canceled' ? 'cancelado' : q.status === 'sent' ? 'enviado' : q.status === 'sending' ? 'agendado' : 'falhou' }))
  const tpls = Object.values((snap.templates || []).reduce((m, t) => { const o = m[t.code] || (m[t.code] = { id: t.code, nome: t.name || t.code, tipo: t.kind === 'promotional' ? 'promo' : 'servico', txt: t.body, canais: [] }); o.canais.push(CANAL[t.channel]); if (t.channel === 'whatsapp') o.txt = t.body; return m }, {}))
  const sends = (snap.campaigns || []).map((c, i, all) => {
    const ids = ((c.audience || {}).accounts || []).map((x) => accCod[x]).filter(Boolean), chs = (c.audience || {}).channels || [c.channel]
    const falhas = (c.deliveries || []).filter((d) => ['failed', 'dead'].includes(d.status)).map((d) => accCod[d.account_id])
    return { id: 'E-' + String(all.length - i).padStart(3, '0'), uuid: c.id, when: c.sent_at || c.scheduled_for || c.created_at, tpl: c.template, canal: chs.length > 1 ? 'Ambos' : CANAL[chs[0]], ids, falhas, st: c.status === 'scheduled' || c.status === 'draft' ? 'agendado' : c.status === 'canceled' ? 'cancelado' : 'enviado', por: c.who, result: c.result }
  })
  const imps = (snap.improvements || []).map((g) => ({ id: cod('M-', g.number), uuid: g.id, t: g.title, st: GSTATUS[g.status], area: g.area || '—', entregue: g.delivered_at }))
  const impCod = Object.fromEntries(imps.map((g) => [g.uuid, g.id]))
  const tickets = (snap.tickets || []).map((t) => ({
    id: 'TK-' + String(t.number).padStart(4, '0'), uuid: t.id, tipo: TKKIND[t.kind] || 'duvida', adega: accCod[t.account_id], sol: t.opened_by, area: t.subject, desc: t.description || t.subject,
    prio: t.priority, st: TKSTATUS[t.status] || 'novo', resp: t.assignee_name || '', respId: t.assignee, aberto: t.created_at, primeiraResp: t.first_response_at,
    resolvido: t.resolved_at, atual: t.updated_at || t.created_at, anexos: t.attachments || [], grupo: impCod[t.improvement_id] || null, corr: t.correlation_ids || [],
    msgs: (t.messages || []).map((m) => ({ when: m.when, who: m.who, lado: m.side === 'equipe' ? 'equipe' : 'cliente', interno: m.internal, t: m.t })),
  }))
  const etapas = (snap.stages || []).map((e) => [e.code, e.name, e.color || ETAPACOR[e.code] || '#B4B4B9'])
  const leads = (snap.leads || []).map((l, i) => ({
    id: 'L-' + (101 + i), uuid: l.id, nome: l.store_name || l.name, resp: l.name, tel: fone(l.phone), email: l.email || '', bairro: l.neighborhood || '', cidade: l.city || 'São Paulo', end: l.address || '',
    origem: origemNome(l.source), campanha: l.campaign || '', utm: l.utm && l.utm.source ? [l.utm.source, l.utm.medium || '', l.utm.campaign || ''] : null, etapa: l.stage, plano: null, dono: l.owner || '—', donoId: l.owner_id,
    prox: l.next_task && l.next_task_at ? { t: l.next_task, when: l.next_task_at } : null, promo: l.promo_ok, criado: l.created_at,
    hist: (l.events || []).map((e) => ({ when: e.when, who: e.who, canal: e.kind === 'update' ? 'Sistema' : e.kind, t: e.kind === 'update' ? 'Dados atualizados' : e.body })),
    adega: accCod[l.account_id] || leadOf[l.id] || null, perdido: l.lost_at ? { motivo: l.lost_reason, det: l.lost_detail, when: l.lost_at } : null, mergedUuid: l.merged_into,
  }))
  const leadCod = Object.fromEntries(leads.map((l) => [l.uuid, l.id]))
  leads.forEach((l) => { l.mergedInto = l.mergedUuid ? leadCod[l.mergedUuid] : null })
  const catalog = (snap.catalog || []).map((c, i) => ({
    id: cod('CAT-', i + 1, 4), uuid: c.id, nome: c.name, marca: c.brand || '', cat: c.category || 'Outros', sub: c.subcategory || '', ean: c.ean || '', vol: c.volume, un: c.unit || 'ml', emb: c.packaging || '', abv: c.abv == null ? null : +c.abv,
    origem: c.origin || 'Addegas', st: CATST[c.status] || 'rascunho', atual: c.updated_at || c.created_at, uso: c.usage || 0, pend: 0, img: c.image, desc: c.description || '', ver: c.version || 1,
    hist: (c.history || []).map((h) => ({ when: h.when, who: h.who, diff: diffTxt(null, h.after) || 'atualização' })).concat([{ when: c.created_at, who: c.origin === 'Importação' ? 'Importação' : 'Addegas', diff: 'cadastro inicial' }]),
  }))
  const SUGST = { pendente: 'pendente', aprovada: 'aprovada', vinculada: 'vinculada', recusada: 'recusada' }
  const catCod = Object.fromEntries(catalog.map((c) => [c.uuid, c.id]))
  const suggestions = (snap.suggestions || []).map((x) => ({ id: cod('SG-', x.number, 3), uuid: x.id, adega: accCod[x.account_id] || null, adegaNome: x.account, nome: x.name, ean: x.ean || '',
    vol: x.volume_ml, cat: x.category || '', st: SUGST[x.status] || 'pendente', catalogo: catCod[x.catalog_product_id] || null, motivo: x.reason || '', criado: x.created_at, revisto: x.reviewed_at, who: x.who || '', mesmoEan: x.same_ean || 0 }))
  const LAYER = { front: 'fe', back: 'be', security: 'sec' }, SEVR = { error: 'erro', warn: 'aviso', info: 'info', debug: 'info' }
  const logs = (snap.logs || []).map((l) => {
    const c = l.context || {}, layer = LAYER[l.source] || 'be'
    return { id: layer.toUpperCase() + '-' + l.id.slice(0, 4).toUpperCase(), uuid: l.id, layer, when: l.when, sev: c.critical ? 'critico' : SEVR[l.level] || 'info', mod: c.module || l.code || '—', adega: accCod[l.account_id] || null, msg: l.message, rota: c.route || '—', ver: c.version || '—', ctx: c.device || c.ip || c.detail || l.code || '', corr: l.correlation_id || '—', st: l.status, resp: l.assignee || '', hist: [{ when: l.when, who: 'Sistema', t: 'Ocorrência registrada' }, ...(l.history || [])] }
  })
  const team = (snap.team || []).map((t) => ({ uid: t.user_id, email: t.email, nome: t.name, role: ROLEKEY[t.role], st: !t.active ? 'inativo' : t.invited ? 'convite' : 'ativo', last: t.last, mfa: t.mfa }))
  const staffNames = (snap.staff_names || []).map((s) => ({ uid: s.user_id, nome: s.name, role: ROLEKEY[s.role] }))
  const funnels = (snap.funnels || []).map((f) => ({ id: f.code, nome: f.name, janela: 21, steps: f.steps.map((s) => [s, s, 'backend']), n: (f.counts || []).some((x) => x > 0) ? f.counts : null, t: [], err: [], errs: [], criado: null }))
  const stock = Object.fromEntries((snap.gift_items || []).map((g) => [g.code, { n: g.name, q: g.qty, c: r2(g.unit_cost) }]))
  const kits = Object.fromEntries(Object.entries(snap.gift_kits || {}).map(([k, v]) => [+k, v]))
  const gifts = (snap.gifts || []).filter((g) => A[g.account_id]).map((g) => ({ id: cod('BR-', g.number, 3), uuid: g.id, adega: A[g.account_id].id, m: g.milestone, itens: g.items, tam: g.size || '', end: g.address, dest: g.recipient, cartao: g.card || '', criado: g.created_at, envio: g.sent_at, entrega: g.delivered_at, rastreio: g.tracking, st: g.status, resp: g.who || '—', custo: r2(g.cost), frete: r2(g.freight) }))
  // Canais de marketing a partir da origem real de leads e adegas e do investimento informado no mês.
  const spend = (snap.marketing_spend || []), mesIni = new Date(NOW.getFullYear(), NOW.getMonth(), 1)
  const canais = [...new Set([...leads.map((l) => l.origem), ...adegas.map((a) => a.origem), ...spend.map((s) => origemNome(s.channel))])]
  const mkt = canais.map((c) => {
    const ls = leads.filter((l) => l.origem === c && !l.mergedInto), as = adegas.filter((a) => a.origem === c)
    const inv = spend.filter((s) => origemNome(s.channel) === c && new Date(s.period_end + 'T23:59:59-03:00') >= mesIni).reduce((x, s) => x + r2(s.amount), 0)
    const rec = invoices.filter((i) => i.st === 'paga' && as.includes(i.a)).reduce((x, i) => x + i.val, 0)
    return { c, vis: null, leads: ls.length, cad: as.length, teste: as.filter((a) => a.assin === 'teste').length, assin: as.filter((a) => ['ativa', 'inadimplente'].includes(a.assin)).length, inv: spend.some((s) => origemNome(s.channel) === c) ? inv : null, rec: rec || null, utm: ls.some((l) => l.utm) }
  })
  const camps = Object.values(leads.filter((l) => l.campanha).reduce((m, l) => { const o = m[l.campanha] || (m[l.campanha] = { nome: l.campanha, canal: l.origem, utm: l.utm ? l.utm[2] : '—', leads: 0, assin: 0 }); o.leads++; if (l.adega) o.assin++; return m }, {}))
  const FE = snap.features_usage || [], ativas = adegas.filter((a) => a.acesso !== 'suspenso').length || 1
  const feat = Object.entries(FE.reduce((m, f) => { const k = ENTIDADE[f.entity]; if (k) m[k] = Math.max(m[k] || 0, f.accounts); return m }, {})).map(([k, n]) => [k, Math.round(n / ativas * 100)])
  const st = snap.settings || {}
  return {
    me: { email: me.email, nome: me.name, role: ROLEKEY[me.role], uid: me.user_id, roleLabel: me.role_label, acts },
    roles: (snap.roles || []).map((r) => ({ key: ROLEKEY[r.code], code: r.code, label: r.name, acts: r.actions })), actionNames: snap.action_names || {},
    plans, adegas, invoices, refunds, discounts, audit, queue, tpls, sends, tickets, groups: imps, etapas, leads, catalog, suggestions, logs, team, staffNames, funnels,
    stock, kits, gifts, mkt, camps, feat, alerts: (st.alerts || {}).items || [], ret: st.retention || { fe: '30', be: '90', sec: '5' },
    cfg: { ...(st.automation || {}), sessao: (st.staff_session || {}).sessao || '30' }, updRule: (st.catalog_update_rule || {}).rule || 'manual',
  }
}
