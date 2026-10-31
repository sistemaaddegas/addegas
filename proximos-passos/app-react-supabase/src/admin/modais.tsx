// @ts-nocheck
// Modais do painel (portados do protótipo). Cada "ok" chama a admin-api; o servidor confere a permissão de novo.
import { NOW, DAY, Y, R, dt, fD, fDT, money, nz, addD, addM, ASS, ACC, DST, SEV, LST, PST, GST2, VARS, COST, bst, chipSt, gtOk, ROLECODE, GSTATUS_DB, CATST_DB } from './motor'

const num = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.'))
const LAYER = { fe: 'Frontend e experiência', be: 'Backend e integrações', sec: 'Segurança e auditoria' }

export const modais = {
  modalVals(D) {
    const s = this.state, m = s.modal; if (!m) return null
    const F = s.form, f = (k, l, t, o) => this.fld(k, l, t, o)
    const spec = { title: '', fields: [], prev: [], notes: [], ok: null, okLabel: 'Confirmar', danger: false }
    const pv = (k, v, c) => ({ k, v, st: { fontSize: 14.5, fontWeight: 800, color: c || '#F5F5F2', textAlign: 'right', flex: '1 1 auto' } })
    const nt = (t, tone) => ({ t, c: tone === 'red' ? '#FF6B5E' : tone === 'green' ? '#4ADE80' : Y, st: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: '2px 8px 3px 7px', background: tone === 'red' ? '#200B09' : tone === 'green' ? '#0D1A0F' : '#1A1508', border: '1px solid ' + (tone === 'red' ? '#5A1712' : tone === 'green' ? '#1C4A22' : '#3A2F0A'), fontSize: 14, lineHeight: 1.45, color: '#E4E4E7' } })
    const me = s.user ? s.user.nome : ''

    if (m.kind === 'adega') {
      const a = D.A.find((x) => x.id === m.id), p = D.P[a.plano], np = D.P[F.plano] || p, mot = f('motivo', 'Motivo', 'area', { req: 1, full: 1, ph: 'Explique a decisão. Fica registrado na linha do tempo.' })
      const T = { ativar: 'Ativar plano', trocar: 'Trocar plano', temp: 'Conceder acesso temporário', trial: 'Estender teste', suspender: 'Suspender acesso', reativar: 'Reativar acesso', pagamento: 'Registrar pagamento' }
      spec.title = T[m.act] + ' · ' + a.nome; spec.sub = 'Toda alteração registra autor, data, motivo e dados alterados.'; spec.prevTitle = 'Antes → depois'
      const plOpts = s.plans.map((x) => [x.id, x.nome + ' · ' + money(x.preco) + '/mês'])
      if (m.act === 'ativar' || m.act === 'trocar') {
        spec.fields = [f('plano', 'Ciclo de cobrança', 'select', { opts: plOpts, full: 1 }), mot]
        spec.prev = [pv('Ciclo', p.nome + ' → ' + np.nome), pv('Mensalidade', money(p.preco) + ' → ' + money(np.preco), np.preco > p.preco ? Y : '#4ADE80'), pv('Assinatura', ASS[a.assin][0] + ' → ' + (m.act === 'ativar' ? 'Ativa' : ASS[a.assin][0])), pv('Vigência', m.act === 'ativar' ? 'a partir de hoje · ciclo de ' + np.meses + ' mês(es)' : 'a partir do próximo ciclo'), pv('Cobrança', m.act === 'ativar' ? 'próxima cobrança no fim do ciclo' : 'próxima fatura já no novo ciclo')]
        if (a.overdue) spec.notes.push(nt('Há cobrança vencida. Trocar ou ativar plano não marca essa cobrança como paga.', 'red'))
      }
      if (m.act === 'temp') { const dias = Math.ceil((dt(F.fim) - NOW) / DAY); spec.fields = [f('fim', 'Acesso liberado até', 'date', { req: 1, hint: 'De 1 a 7 dias a partir de hoje.' }), mot]; spec.prev = [pv('Acesso', ACC[a.acesso][0] + ' → Liberado (temporário)', '#4ADE80'), pv('Válido até', fD(F.fim) + ' (' + Math.max(dias, 0) + ' dia(s))'), pv('Cobrança vencida', 'continua em aberto', '#FF6B5E')]; spec.notes.push(nt('Exceção autorizada: não marca nenhuma cobrança como paga e não altera a assinatura. Registrada na auditoria.')); if (!(dias >= 1 && dias <= 7)) spec.notes.push(nt('Escolha uma data entre amanhã e 7 dias.', 'red')) }
      if (m.act === 'trial') { const novo = addD(a.trialEnd && dt(a.trialEnd) > NOW ? a.trialEnd : NOW, +F.dias || 7); spec.fields = [f('dias', 'Estender por', 'chips', { opts: [['3', '3 dias'], ['7', '7 dias'], ['14', '14 dias']] }), mot]; spec.prev = [pv('Fim do teste', fDT(a.trialEnd) + ' → ' + fDT(novo), Y), pv('Cobrança', 'nenhuma durante o teste')]; spec.notes.push(nt('O lembrete "teste termina" acompanha a nova data.', 'green')) }
      if (m.act === 'suspender') { spec.danger = true; spec.fields = [mot]; spec.prev = [pv('Acesso', ACC[a.acesso][0] + ' → Suspenso', '#FF6B5E'), pv('Quando', 'Imediatamente'), pv('Cobrança', 'sem alteração'), pv('Dados da adega', 'preservados', '#4ADE80')]; spec.notes.push(nt('Bloqueia caixa, pedidos e estoque. A adega continua acessando regularização e suporte.', 'red')) }
      if (m.act === 'reativar') { spec.fields = [mot]; spec.prev = [pv('Acesso', 'Suspenso → Liberado', '#4ADE80'), pv('Assinatura', ASS[a.assin][0] + (a.assin === 'cancelada' ? ' → Ativa (nova vigência)' : ''))]; if (a.overdue) spec.notes.push(nt('Sem pagamento confirmado. Reativar agora é exceção: a cobrança continua vencida e a carência não reinicia.', 'red')); if (a.assin === 'cancelada') spec.notes.push(nt('Assinatura cancelada: reativar inicia nova vigência no ciclo ' + p.nome.toLowerCase() + ' a partir de hoje.')) }
      if (m.act === 'pagamento') {
        const v = D.inv.find((i) => i.a.id === a.id && i.st === 'vencida')
        spec.fields = [f('valor', 'Valor recebido (R$)', 'text', { req: 1 }), f('meio', 'Forma', 'select', { opts: ['Pix', 'Boleto', 'Cartão', 'Transferência'] }), f('motivo', 'Comprovante ou motivo', 'area', { req: 1, full: 1, ph: 'Ex.: Pix conferido no extrato, txid E1234…' })]
        spec.prev = [pv('Fatura', v ? v.id + ' · venc. ' + fD(v.venc) : '—'), pv('Situação', 'Vencida → Paga', '#4ADE80'), pv('Assinatura', ASS[a.assin][0] + ' → Ativa'), pv('Acesso', ACC[a.acesso][0] + ' → Liberado', '#4ADE80'), pv('Lembretes pendentes', s.queue.filter((q) => q.adega === a.id && q.st === 'agendado').length + ' serão cancelados')]
        spec.notes.push(nt('Confirmação de regularização é enviada à adega.', 'green'))
        if (v && F.valor && Math.abs(num(F.valor) - v.val) > 0.009) spec.notes.push(nt('Valor diferente da fatura (' + money(v.val) + '). Confira antes de confirmar.', 'red'))
      }
      spec.okLabel = T[m.act]; spec.ok = () => { if (!this.need(m.act === 'pagamento' ? ['motivo', 'valor'] : ['motivo'])) return; this.applyAdega(m.act, a, D) }
    }
    if (m.kind === 'disc') {
      const tgt = F.alvo === 'adega' ? D.A.filter((a) => a.id === F.adega) : D.A.filter((a) => ['ativa', 'inadimplente', 'teste'].includes(a.assin) && (F.grpPlano === 'todos' || a.plano === F.grpPlano) && (F.grpReg === 'todas' || a.regiao === F.grpReg))
      const elig = tgt, base = elig.length ? elig[0].mensal : 0, val = num(F.valor || 0) || 0, dsc = F.tipo === 'pct' ? base * Math.min(val, 100) / 100 : Math.min(val, base), cic = F.aplic === 'unica' ? 1 : Math.max(1, parseInt(F.ciclos) || 1), fim = addM(F.ini || NOW, cic)
      spec.title = 'Novo desconto'; spec.sub = 'Concedido por ' + me + '. Vale a partir da próxima cobrança dentro da vigência.'
      spec.fields = [f('alvo', 'Para', 'chips', { full: 1, opts: [['adega', 'Uma adega'], ['grupo', 'Grupo selecionado']] }), ...(F.alvo === 'adega' ? [f('adega', 'Adega', 'select', { full: 1, opts: D.A.filter((a) => !['cancelada', 'expirada'].includes(a.assin)).map((a) => [a.id, a.nome + ' · ' + D.P[a.plano].nome]) })] : [f('grpPlano', 'Grupo: ciclo', 'select', { opts: [['todos', 'Todos'], ...s.plans.map((p) => [p.id, p.nome])] }), f('grpReg', 'Grupo: região', 'select', { opts: [['todas', 'Todas'], ...[...new Set(D.A.map((a) => a.regiao))]] })]), f('tipo', 'Tipo', 'chips', { opts: [['pct', 'Percentual'], ['fixo', 'Valor fixo']] }), f('valor', F.tipo === 'pct' ? 'Desconto (%)' : 'Desconto (R$)', 'text', { req: 1 }), f('ini', 'Início', 'date', { req: 1 }), f('aplic', 'Aplicação', 'chips', { opts: [['unica', 'Única'], ['recorrente', 'Recorrente']] }), ...(F.aplic === 'recorrente' ? [f('ciclos', 'Quantidade de ciclos', 'number')] : []), f('acumula', 'Acumulação', 'select', { opts: [['nao', 'Não acumula: substitui outro desconto'], ['sim', 'Acumula com outros descontos']] }), f('motivo', 'Motivo', 'area', { req: 1, full: 1, ph: 'Ex.: retenção, indicação, condição comercial' })]
      spec.prevTitle = 'Prévia' + (elig.length > 1 ? ' (por adega, ' + elig.length + ' adegas)' : ''); spec.prev = [pv('Valor original', money(base)), pv('Desconto', '− ' + money(dsc), '#4ADE80'), pv('Valor final', money(base - dsc), Y), pv('Validade', fD(F.ini || NOW) + ' → ' + fD(fim) + ' · ' + cic + ' ciclo(s)'), pv('Adegas atingidas', String(elig.length))]
      if (!elig.length) spec.notes.push(nt('Nenhuma adega elegível com esses critérios.', 'red'))
      const conf = elig.filter((a) => s.discounts.some((d) => d.ids.includes(a.id) && ['ativo', 'agendado'].includes(this.dStatus(d)))); if (conf.length && F.acumula === 'nao') spec.notes.push(nt(conf.map((a) => a.nome).join(', ') + ' já tem desconto vigente. Sem acumulação, o novo substitui o anterior.'))
      if (F.tipo === 'pct' && val > 50) spec.notes.push(nt('Desconto acima de 50%. Confira o motivo antes de confirmar.', 'red'))
      spec.okLabel = 'Conceder desconto'; spec.ok = () => { if (!this.need(['valor', 'ini', 'motivo'])) return; if (!elig.length || !val) return this.setState({ formErr: { valor: 'Informe um desconto válido para adegas elegíveis' } }); this.call('billing/discount', { accounts: elig.map((a) => a.uuid), kind: F.tipo === 'pct' ? 'pct' : 'fixed', value: F.tipo === 'pct' ? val : Math.round(val * 100), cycles: cic, stacks: F.acumula === 'sim', starts_at: F.ini + 'T09:00:00-03:00', reason: F.motivo }, 'Desconto concedido para ' + elig.length + ' adega(s).') }
    }
    if (m.kind === 'discView') {
      const d = s.discounts.find((x) => x.id === m.id), st = this.dStatus(d); spec.title = 'Desconto ' + d.id; spec.sub = d.alvo; spec.prevTitle = 'Detalhes'
      spec.prev = [pv('Benefício', this.dLabel(d)), pv('Vigência', fD(d.ini) + ' → ' + fD(this.dEnd(d))), pv('Acumula', d.acumula ? 'Sim' : 'Não'), pv('Concedido por', d.resp + ' em ' + fD(d.criado)), pv('Motivo', d.motivo), pv('Situação', DST[st][0], DST[st][1] === '#1C1C1F' ? '#F5F5F2' : DST[st][1])]
      if (d.revog) spec.notes.push(nt('Revogado em ' + fDT(d.revog) + ': ' + d.revogMotivo, 'red'))
      if (['ativo', 'agendado'].includes(st)) { spec.fields = [f('motivo', 'Motivo da revogação', 'area', { full: 1, ph: 'Obrigatório para revogar' })]; spec.danger = true; spec.okLabel = 'Revogar desconto'; spec.ok = this.can('discount.write') ? () => { if (!this.need(['motivo'])) return; this.call('billing/discount-revoke', { discount_id: d.uuid, reason: F.motivo }, 'Desconto ' + d.id + ' revogado.', { tone: '#E5241B' }) } : () => this.deny('discount.write'); spec.notes.push(nt('Revogar remove o desconto das próximas cobranças. Cobranças já pagas não mudam.')) }
    }
    if (m.kind === 'plan') {
      const p = s.plans.find((x) => x.id === m.id), n = D.A.filter((a) => a.plano === m.id && ['ativa', 'inadimplente', 'teste'].includes(a.assin)).length, np = num(F.preco) || 0
      spec.title = 'Editar ciclo ' + p.nome; spec.sub = n + ' adega(s) neste ciclo hoje.'
      spec.fields = [f('preco', 'Preço do ciclo (R$)', 'text', { req: 1, hint: 'Valor cobrado a cada ' + p.meses + ' mês(es).' }), f('motivo', 'Motivo', 'area', { req: 1, full: 1 })]
      spec.prev = [pv('Preço do ciclo', money(p.total) + ' → ' + money(np), np > p.total ? Y : '#4ADE80'), pv('Por mês', money(p.preco) + ' → ' + money(np / p.meses)), pv('Assinantes atuais', 'mantêm ' + money(p.total) + ' até aviso com 30 dias'), pv('Novas assinaturas', 'pagam ' + money(np) + ' a partir de hoje')]
      if (np > p.total) spec.notes.push(nt('Aumento de preço exige aviso prévio às ' + n + ' adegas. Envie pela central de mensagens.'))
      spec.notes.push(nt('O Stripe recebe o preço novo na próxima sincronização (scripts/stripe-sync.mjs).'))
      spec.okLabel = 'Salvar preço'; spec.ok = () => { if (!this.need(['preco', 'motivo'])) return; if (!(np > 0)) return this.setState({ formErr: { preco: 'Preço inválido' } }); this.call('plans/price', { cycle: p.id, price: Math.round(np * 100), reason: F.motivo }, 'Preço salvo. Assinantes atuais mantêm o preço até o aviso.') }
    }
    if (m.kind === 'brinde' && Object.keys(s.stock).length) {
      const a = D.A.find((x) => x.id === m.id), S = s.stock, its = F.itens || [], tg = (k) => this.setState((st) => { const c = st.form.itens || []; return { form: { ...st.form, itens: c.includes(k) ? c.filter((x) => x !== k) : [...c, k] }, formErr: { ...st.formErr, itens: '' } } })
      const falta = its.filter((k) => !S[k] || S[k].q < 1), custo = this.gKitCost(its), FRETE = 24.9
      spec.title = 'Enviar brinde · ' + a.nome; spec.sub = m.m + (m.m > 1 ? ' anos' : ' ano') + ' de assinatura em ' + fD(addM(a.ini, 12 * m.m)) + '.'
      spec.fields = [{ label: 'Itens do kit', req: 1, err: s.formErr.itens || '', hint: 'Toque para incluir ou tirar. Entre parênteses: estoque.', isChips: true, chips: Object.keys(S).map((k, i) => ({ label: S[k].n + ' (' + S[k].q + ')', go: () => tg(k), st: chipSt(its.includes(k), i) })), wrap: { display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1/-1', minWidth: 0 } },
        ...(its.includes('camiseta') ? [f('tam', 'Tamanho da camiseta', 'select', { opts: ['P', 'M', 'G', 'GG', 'XG'] })] : []), f('dest', 'Destinatário', 'text', { req: 1 }), f('end', 'Endereço de entrega', 'text', { req: 1, full: 1 }), f('cartao', 'Cartão que vai junto', 'area', { full: 1 }), f('avisar', 'Avisar a adega por WhatsApp', 'chips', { opts: [['sim', 'Sim'], ['nao', 'Não']], hint: a.promo ? '' : 'Esta adega recusou mensagens promocionais: o aviso não será enviado.' })]
      spec.prevTitle = 'Resumo'; spec.prev = [pv('Itens', its.length ? this.gName(its) : 'nenhum'), pv('Custo dos itens', money(custo)), pv('Frete estimado', money(FRETE)), pv('Total', money(custo + FRETE), Y), pv('Aviso à adega', F.avisar === 'sim' && a.promo ? 'WhatsApp' : 'não enviar')]
      if (falta.length) spec.notes.push(nt('Sem estoque: ' + falta.map((k) => S[k].n).join(', ') + '. Reponha ou tire do kit.', 'red'))
      spec.okLabel = 'Registrar envio'; spec.ok = () => { if (!its.length) return this.setState({ formErr: { itens: 'Escolha ao menos um item' } }); if (!this.need(['dest', 'end'])) return; if (falta.length) return; this.call('gifts/action', { action: 'create', data: { account_id: a.uuid, milestone: m.m, items: its, size: its.includes('camiseta') ? (F.tam || 'G') : '', recipient: F.dest, address: F.end, card: F.cartao || '', notify: F.avisar === 'sim' && a.promo, freight: Math.round(FRETE * 100) } }, 'Brinde registrado para ' + a.nome + '.') }
    }
    if (m.kind === 'kit') {
      const S = s.stock, its = F.itens || [], tg = (k) => this.setState((st) => { const c = st.form.itens || []; return { form: { ...st.form, itens: c.includes(k) ? c.filter((x) => x !== k) : [...c, k] } } })
      spec.title = 'Editar kit de ' + m.m + (m.m > 1 ? ' anos' : ' ano'); spec.sub = 'Vale para os próximos envios. Envios já registrados não mudam.'
      spec.fields = [{ label: 'Itens', isChips: true, hint: '', err: '', chips: Object.keys(S).map((k, i) => ({ label: S[k].n, go: () => tg(k), st: chipSt(its.includes(k), i) })), wrap: { display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1/-1', minWidth: 0 } }]
      spec.prev = [pv('Custo dos itens', money(this.gKitCost(its)), Y)]; spec.okLabel = 'Salvar kit'; spec.ok = () => { if (!its.length) return; this.call('gifts/action', { action: 'kit', data: { milestone: m.m, items: its } }, 'Kit salvo.') }
    }
    if (m.kind === 'estoque' && s.stock[m.k]) {
      const it = s.stock[m.k], q = parseInt(F.qtd) || 0; spec.title = 'Repor ' + it.n; spec.fields = [f('qtd', 'Quantidade que chegou', 'number', { req: 1 }), f('custo', 'Custo unitário (R$)', 'text')]; spec.prev = [pv('Estoque', it.q + ' → ' + (it.q + q) + ' un.', '#4ADE80')]
      spec.okLabel = 'Repor estoque'; spec.ok = () => { if (q < 1) return this.setState({ formErr: { qtd: 'Informe a quantidade' } }); const c = num(F.custo); this.call('gifts/action', { action: 'restock', data: { code: m.k, qty: q, unit_cost: c > 0 ? Math.round(c * 100) : '' } }, 'Estoque de ' + it.n + ' atualizado.') }
    }
    if (m.kind === 'giftView') {
      const g = s.gifts.find((x) => x.id === m.id), a = D.A.find((x) => x.id === g.adega); spec.title = 'Brinde ' + g.id; spec.sub = (a ? a.nome : '') + ' · ' + g.m + (g.m > 1 ? ' anos' : ' ano'); spec.prevTitle = 'Detalhes'
      spec.prev = [pv('Itens', this.gName(g.itens) + (g.tam ? ' · camiseta ' + g.tam : '')), pv('Destinatário', g.dest), pv('Endereço', g.end), pv('Cartão', g.cartao || '—'), pv('Registrado', fDT(g.criado) + ' · ' + g.resp), pv('Enviado', g.envio ? fDT(g.envio) : '—'), pv('Entregue', g.entrega ? fDT(g.entrega) : '—'), pv('Rastreio', g.rastreio || '—'), pv('Custo total', money(g.custo + g.frete), Y)]
      const nx = g.st === 'preparando' ? ['enviado', 'Marcar como enviado'] : g.st === 'enviado' ? ['entregue', 'Marcar como entregue'] : null
      if (g.st === 'preparando') spec.fields = [f('rastreio', 'Código de rastreio', 'text', { full: 1, ph: 'Opcional' })]
      if (nx) { spec.okLabel = nx[1]; spec.ok = this.can('gift.send') ? () => this.call('gifts/action', { action: 'advance', data: { id: g.uuid, tracking: F.rastreio || '' } }, g.id + ': ' + nx[1].replace('Marcar como ', '') + '.') : () => this.deny('gift.send') }
    }
    if (m.kind === 'funil') {
      spec.title = 'Novo funil'; spec.sub = 'Use eventos confirmados pelo servidor nas etapas de resultado.'; spec.fields = [f('nome', 'Nome', 'text', { req: 1, full: 1 }), f('etapas', 'Eventos, um por linha, na ordem', 'area', { req: 1, full: 1, ph: 'cash_opened\nsale_finalized\ncash_closed' })]
      spec.okLabel = 'Criar funil'; spec.ok = () => { if (!this.need(['nome', 'etapas'])) return; const st = String(F.etapas).split('\n').map((x) => x.split('=').pop().trim()).filter(Boolean); if (st.length < 2) return this.setState({ formErr: { etapas: 'Informe ao menos 2 etapas' } }); this.call('usage/funnel-create', { name: F.nome, steps: st }, 'Funil criado. Os dados aparecem quando os eventos chegarem.') }
    }
    if (m.kind === 'inv') {
      spec.title = 'Informar investimento'; spec.sub = 'Valor do mês atual. Fica marcado como "informado manualmente".'; spec.fields = [f('canal', 'Canal', 'select', { opts: [...new Set([...s.mkt.map((c) => c.c), 'Google', 'Meta Ads', 'Instagram', 'Evento'])] }), f('valor', 'Valor (R$)', 'text', { req: 1 })]
      spec.okLabel = 'Salvar'; spec.ok = () => { const v = num(F.valor); if (!(v >= 0)) return this.setState({ formErr: { valor: 'Valor inválido' } }); this.call('marketing/spend', { channel: F.canal, amount: Math.round(v * 100) }, 'Investimento salvo.') }
    }
    if (m.kind === 'evento') {
      const l = s.logs.find((x) => x.id === m.id), rel = s.logs.filter((x) => x.corr === l.corr && x.corr !== '—' && x.id !== l.id); spec.title = l.id + ' · ' + l.mod; spec.sub = l.msg; spec.prevTitle = 'Contexto'
      spec.prev = [pv('Camada', LAYER[l.layer]), pv('Quando', fDT(l.when)), pv('Severidade', SEV[l.sev][0]), pv('Rota / origem', l.rota), pv('Versão', l.ver), pv('Detalhe', l.ctx || '—'), pv('Correlação', l.corr), pv('Relacionados', rel.length ? rel.map((x) => x.id + ' (' + x.layer.toUpperCase() + ')').join(', ') : 'nenhum'), ...l.hist.slice(-3).map((x) => pv(fDT(x.when), x.who + ': ' + x.t))]
      spec.fields = [f('st', 'Status', 'chips', { opts: Object.keys(LST).map((x) => [x, LST[x][0]]) }), f('resp', 'Responsável', 'select', { opts: [['', 'Ninguém'], ...this.equipeSuporte().map((t) => [t.uid, t.nome])] }), f('nota', 'Nota da investigação', 'area', { full: 1 })]
      spec.notes.push(nt('Dados pessoais mascarados. Senhas, tokens e dados de pagamento nunca entram nos logs.', 'green'))
      spec.okLabel = 'Salvar investigação'; spec.ok = this.can('log.write') ? () => this.call('monitor/triage', { log_id: l.uuid, status: F.st, assignee: F.resp || null, note: F.nota || '' }, l.id + ' atualizado.') : () => this.deny('log.write')
    }
    if (m.kind === 'membro') {
      const t = s.team.find((x) => x.email === m.email), self = t.uid === s.user.uid, RL = Object.fromEntries(s.roles.map((r) => [r.key, r.label])); spec.title = t.nome; spec.sub = t.email
      spec.fields = [f('role', 'Perfil', 'select', { opts: s.roles.map((r) => [r.key, r.label]) }), f('ativa', 'Situação', 'chips', { opts: [['sim', 'Ativa'], ['nao', 'Desativada']] }), f('motivo', 'Motivo', 'area', { req: 1, full: 1 })]
      if (self) spec.notes.push(nt('Você não pode mudar o próprio perfil nem se desativar.', 'red'))
      if (F.role === 'mestre' && t.role !== 'mestre') spec.notes.push(nt('Administrador mestre tem controle total, inclusive sobre a equipe e a auditoria.'))
      spec.prevTitle = 'Mudança'; spec.prev = [pv('Perfil', RL[t.role] + ' → ' + RL[F.role || t.role]), pv('Situação', (t.st === 'inativo' ? 'Desativada' : 'Ativa') + ' → ' + ((F.ativa || (t.st === 'inativo' ? 'nao' : 'sim')) === 'nao' ? 'Desativada' : 'Ativa'))]
      spec.okLabel = 'Salvar'; spec.ok = () => { if (self || !this.need(['motivo'])) return; this.call('staff/update', { user_id: t.uid, role: ROLECODE[F.role || t.role], active: (F.ativa || (t.st === 'inativo' ? 'nao' : 'sim')) === 'sim', reason: F.motivo }, 'Perfil alterado. Vale na próxima ação da pessoa.') }
    }
    if (m.kind === 'convite') {
      const em = String(F.email || '').trim().toLowerCase(), bad = em && !/@addegas\.com\.br$/.test(em), ex = s.team.find((x) => x.email === em); spec.title = 'Convidar pessoa'; spec.sub = 'Conta individual. A pessoa define a senha e ativa as duas etapas no primeiro acesso.'
      spec.fields = [f('nome', 'Nome', 'text', { req: 1 }), f('email', 'E-mail da equipe', 'email', { req: 1, ph: 'nome@addegas.com.br' }), f('role', 'Perfil', 'select', { full: 1, opts: s.roles.filter((r) => r.key !== 'mestre').map((r) => [r.key, r.label]), hint: 'Administrador mestre só pode ser concedido depois, com motivo.' })]
      if (bad) spec.notes.push(nt('Só e-mails @addegas.com.br.', 'red')); if (ex) spec.notes.push(nt('Esse e-mail já está na equipe.', 'red'))
      spec.okLabel = 'Enviar convite'; spec.ok = () => { if (!this.need(['nome', 'email']) || bad || ex) return; this.call('staff/invite', { email: em, name: F.nome, role: ROLECODE[F.role] }, 'Convite enviado para ' + em + '.') }
    }
    if (m.kind === 'leadNew') {
      const cand = { id: 'new', nome: F.nome || '', tel: F.tel || '', email: (F.email || '').trim().toLowerCase() }, dupL = (F.nome || F.tel || F.email) ? this.leadDup(cand) : null, dupA = D.A.find((a) => (this.digits(F.tel) && this.digits(a.tel) === this.digits(F.tel)) || (cand.email && a.email === cand.email)), hard = (dupL && ((this.digits(F.tel) && this.digits(dupL.tel) === this.digits(F.tel)) || (cand.email && dupL.email === cand.email))) || dupA
      spec.title = 'Novo lead'; spec.sub = 'Origem, campanha e UTMs ficam gravadas e acompanham o lead até virar cliente.'
      spec.fields = [f('nome', 'Nome da adega', 'text', { req: 1 }), f('resp', 'Responsável', 'text', { req: 1 }), f('tel', 'Telefone', 'text', { req: 1, ph: '(11) 9…' }), f('email', 'E-mail', 'email'), f('bairro', 'Bairro', 'text'), f('cidade', 'Cidade', 'text'), f('end', 'Endereço comercial', 'text', { full: 1 }), f('origem', 'Origem', 'select', { opts: ['Site', 'Google', 'Meta Ads', 'Instagram', 'Indicação', 'Evento', 'Mapa', 'Outro'] }), f('campanha', 'Campanha', 'text'), f('us', 'utm_source', 'text'), f('um', 'utm_medium', 'text'), f('uc', 'utm_campaign', 'text'), f('dono', 'Responsável comercial', 'select', { opts: (s.staffNames || []).filter((t) => ['mestre', 'comercial'].includes(t.role)).map((t) => [t.uid, t.nome]) }), f('promo', 'Aceita campanhas promocionais', 'chips', { opts: [['sim', 'Sim'], ['nao', 'Não']], hint: 'Avisos de serviço não dependem disso.' })]
      if (dupA) spec.notes.push(nt('Já é cliente: ' + dupA.nome + ' (' + dupA.id + ') tem o mesmo ' + (this.digits(dupA.tel) === this.digits(F.tel) ? 'telefone' : 'e-mail') + '. Registre o contato na ficha da adega.', 'red'))
      else if (dupL) spec.notes.push(nt((hard ? 'Lead já existe: ' : 'Parecido com ') + dupL.nome + ' (' + dupL.id + ', ' + (s.etapas.find((e) => e[0] === dupL.etapa) || [, ''])[1] + ').' + (hard ? ' Abra o existente para não duplicar.' : ' Confira antes de criar.'), hard ? 'red' : 'yellow'))
      spec.okLabel = hard ? 'Abrir existente' : 'Criar lead'
      spec.ok = async () => { if (hard) { this.setState({ modal: null }); return dupA ? this.open('adega', dupA.id) : this.open('lead', dupL.id) } if (!this.need(['nome', 'resp', 'tel'])) return; const utm = F.us || F.um || F.uc ? { source: F.us || '', medium: F.um || '', campaign: F.uc || '' } : null; const r = await this.call('crm/action', { action: 'create', data: { store_name: F.nome, name: F.resp, phone: this.digits(F.tel), email: cand.email, neighborhood: F.bairro || '', city: F.cidade || 'São Paulo', address: F.end || '', source: F.origem, campaign: F.campanha || '', utm, owner: F.dono || '', promo_ok: F.promo !== 'nao' } }, 'Lead criado.'); const nl = r && r.lead_id && this.state.leads.find((x) => x.uuid === r.lead_id); if (nl) this.open('lead', nl.id) }
    }
    if (m.kind === 'leadContato') {
      const l = s.leads.find((x) => x.id === m.id); spec.title = 'Registrar contato · ' + l.nome; spec.fields = [f('canal', 'Canal', 'chips', { full: 1, opts: ['WhatsApp', 'Ligação', 'E-mail', 'Visita', 'Reunião'] }), f('resumo', 'O que foi conversado', 'area', { req: 1, full: 1 }), f('prox', 'Próxima ação', 'text', { ph: 'Ex.: enviar proposta' }), f('quando', 'Data da próxima ação', 'datetime-local')]
      if (F.canal === 'WhatsApp' && !l.promo) spec.notes.push(nt('Este lead recusou campanhas promocionais. Conversa comercial individual pode, envio em massa não.'))
      spec.okLabel = 'Salvar contato'; spec.ok = () => { if (!this.need(['resumo'])) return; this.call('crm/action', { lead_id: l.uuid, action: 'contact', data: { channel: F.canal, body: F.resumo, next_task: F.prox && F.quando ? F.prox : '', next_task_at: F.prox && F.quando ? new Date(F.quando).toISOString() : '' } }, 'Contato registrado.') }
    }
    if (m.kind === 'leadEtapa') {
      const l = s.leads.find((x) => x.id === m.id); spec.title = 'Mudar etapa · ' + l.nome; spec.fields = [f('etapa', 'Etapa', 'chips', { full: 1, opts: s.etapas.map((e) => [e[0], e[1]]) })]
      if (F.etapa === 'cliente' && !l.adega) spec.notes.push(nt('Para virar assinante de verdade, converta o lead em adega e ative um plano. Mudar a etapa sozinha não cria assinatura.'))
      spec.okLabel = 'Mover'; spec.ok = () => { if (F.etapa === l.etapa) return this.setState({ modal: null }); this.moveLead(l, F.etapa) }
    }
    if (m.kind === 'leadPerdido') {
      const l = s.leads.find((x) => x.id === m.id); spec.danger = true; spec.title = 'Marcar como perdido · ' + l.nome; spec.fields = [f('motivo', 'Motivo', 'select', { full: 1, opts: ['Preço', 'Já usa outro sistema', 'Sem interesse agora', 'Não respondeu', 'Fechou o negócio', 'Outro'] }), f('det', 'Detalhe', 'area', { full: 1, req: 1 })]
      spec.okLabel = 'Marcar como perdido'; spec.ok = () => { if (!this.need(['det'])) return; this.call('crm/action', { lead_id: l.uuid, action: 'lost', data: { reason: F.motivo, detail: F.det } }, 'Lead marcado como perdido.', { tone: '#E5241B' }) }
    }
    if (m.kind === 'leadConv') {
      const l = s.leads.find((x) => x.id === m.id), link = (typeof location !== 'undefined' ? location.origin : 'https://app.addegas.com.br') + '/cadastro?lead=' + l.uuid
      spec.title = 'Converter em adega · ' + l.nome; spec.sub = 'A adega nasce em teste quando ' + l.resp.split(' ')[0] + ' concluir o cadastro pelo link. Histórico, origem e UTMs do lead ficam ligados à ficha.'
      spec.prevTitle = 'Vai acontecer'; spec.prev = [pv('Link de cadastro', link, Y), pv('Assinatura', 'Em teste ao concluir o cadastro', '#7CB3FF'), pv('Cobrança', 'nenhuma durante o teste'), pv('Origem', l.origem + (l.campanha ? ' · ' + l.campanha : '')), pv('Etapa do lead', (s.etapas.find((e) => e[0] === l.etapa) || [, ''])[1] + ' → Em teste')]
      spec.notes.push(nt('O link é copiado ao confirmar. Mande para ' + l.tel + ' pelo WhatsApp.', 'green'))
      spec.okLabel = 'Copiar link e converter'; spec.ok = () => { try { navigator.clipboard.writeText(link) } catch (_) {} this.call('crm/action', { lead_id: l.uuid, action: 'convert', data: {} }, 'Link copiado. ' + l.nome + ' entra em teste ao concluir o cadastro.') }
    }
    if (m.kind === 'etapas') {
      spec.title = 'Etapas do funil'; spec.sub = 'Renomeie ou acrescente etapas. A ordem segue a lista.'; spec.fields = [...s.etapas.map((e, i) => f('e' + i, 'Etapa ' + (i + 1), 'text', { req: 1 })), f('nova', 'Nova etapa (opcional, entra antes de "Em teste")', 'text', { full: 1, ph: 'Ex.: Proposta enviada' })]
      spec.okLabel = 'Salvar etapas'; spec.ok = () => { const names = Object.fromEntries(s.etapas.map((e, i) => [e[0], (F['e' + i] || e[1]).trim()])); this.call('crm/stages', { names, new: (F.nova || '').trim() }, 'Funil atualizado.') }
    }
    if (m.kind === 'merge') {
      const a = s.leads.find((x) => x.id === m.id), b = s.leads.find((x) => x.id === m.other); spec.title = 'Mesclar leads'; spec.prevTitle = 'Resultado'
      spec.prev = [pv('Fica', a.id + ' · ' + a.nome), pv('Some (vira referência)', b.id + ' · ' + b.nome), pv('Histórico', a.hist.length + ' + ' + b.hist.length + ' registros'), pv('Origens', [a.origem, b.origem].filter((v, i, arr) => arr.indexOf(v) === i).join(' + ')), pv('Promocionais', a.promo && b.promo ? 'Permitidas' : 'Recusadas (vale a restrição mais forte)', a.promo && b.promo ? '#4ADE80' : '#FF6B5E')]
      spec.okLabel = 'Mesclar'; spec.ok = () => this.call('crm/action', { lead_id: a.uuid, action: 'merge', data: { other: b.uuid } }, 'Leads mesclados.')
    }
    if (m.kind === 'agrupar') {
      const t = s.tickets.find((x) => x.id === m.id); spec.title = 'Agrupar sugestão ' + t.id; spec.fields = [f('grupo', 'Melhoria', 'select', { full: 1, opts: [...s.groups.filter((g) => g.st !== 'entregue').map((g) => [g.id, g.id + ' · ' + g.t]), ['novo', '+ Nova melhoria']] }), ...(F.grupo === 'novo' ? [f('titulo', 'Título da nova melhoria', 'text', { req: 1, full: 1 })] : [])]
      spec.okLabel = 'Agrupar'; spec.ok = () => { if (F.grupo === 'novo' && !this.need(['titulo'])) return; const g = s.groups.find((x) => x.id === F.grupo); this.call('tickets/update', { ticket_id: t.uuid, changes: F.grupo === 'novo' ? { improvement_title: F.titulo } : { improvement_id: g.uuid } }, t.id + ' agrupado.') }
    }
    if (m.kind === 'grupo') {
      const g = s.groups.find((x) => x.id === m.id), n = s.tickets.filter((t) => t.grupo === g.id); spec.title = g.id + ' · ' + g.t; spec.sub = n.length + ' pedido(s): ' + [...new Set(n.map((t) => (D.A.find((a) => a.id === t.adega) || {}).nome))].join(', ')
      spec.fields = [f('st', 'Situação', 'chips', { full: 1, opts: Object.keys(GST2).map((x) => [x, GST2[x][0]]) })]
      if (F.st === 'entregue') spec.notes.push(nt('Ao marcar como entregue, os ' + n.length + ' tickets ligados são resolvidos e as adegas recebem o aviso na conversa do ticket.', 'green'))
      spec.okLabel = 'Salvar'; spec.ok = this.can('ticket.write') ? () => this.call('tickets/improvement', { improvement_id: g.uuid, status: GSTATUS_DB[F.st] }, g.id + ': ' + GST2[F.st][0] + '.') : () => this.deny('ticket.write')
    }
    if (m.kind === 'prod') {
      const p = m.id && s.catalog.find((x) => x.id === m.id), ean = String(F.ean || '').replace(/\D/g, ''), bad = ean && !gtOk(ean), dupE = ean && s.catalog.find((x) => x.id !== (p && p.id) && x.st !== 'arquivado' && x.ean === ean)
      spec.title = p ? 'Editar ' + p.id : 'Novo produto'; spec.sub = p ? 'Gera nova versão. As ' + p.uso + ' adega(s) que usam recebem atualização disponível; preço, custo, estoque e descrição local não mudam.' : 'Entra como rascunho até ser publicado.'
      spec.fields = [f('nome', 'Nome', 'text', { req: 1, full: 1 }), f('marca', 'Marca', 'text', { req: 1 }), f('cat', 'Categoria', 'select', { opts: ['Cervejas', 'Destilados', 'Energéticos', 'Refrigerantes', 'Gelo', 'Drinks prontos', 'Vinhos', 'Água', 'Petiscos', 'Outros', ...new Set(s.catalog.map((x) => x.cat))].filter((v, i, a) => a.indexOf(v) === i) }), f('sub', 'Subcategoria', 'text'), f('ean', 'EAN / GTIN', 'text', { hint: ean ? (bad ? '' : 'dígito verificador ok') : '8 a 14 dígitos' }), f('vol', 'Volume, peso ou quantidade', 'number'), f('un', 'Unidade', 'select', { opts: ['ml', 'L', 'g', 'kg', 'un'] }), f('emb', 'Embalagem', 'text', { ph: 'Lata, long neck, garrafa…' }), f('abv', 'Teor alcoólico (%)', 'text', { hint: 'Vazio se não se aplica' }), f('img', 'Imagem (URL)', 'text', { full: 1 }), f('desc', 'Descrição', 'area', { full: 1 })]
      if (bad) spec.notes.push(nt('EAN inválido: o dígito verificador não confere.', 'red')); if (dupE) spec.notes.push(nt('Já existe ' + dupE.id + ' com este EAN (' + dupE.nome + ').', 'red'))
      spec.okLabel = p ? 'Salvar nova versão' : 'Criar rascunho'
      spec.ok = () => { if (!this.need(['nome', 'marca'])) return; if (bad || dupE) return; const o = { name: F.nome, brand: F.marca, category: F.cat, subcategory: F.sub || '', ean, volume: num(F.vol) || 1, unit: F.un || 'ml', packaging: F.emb || '', abv: F.abv ? num(F.abv) : '', image: F.img || '', description: F.desc || '' }; this.call('catalog/save', { product: p ? { id: p.uuid, ...o } : { ...o, status: 'draft' } }, p ? 'Nova versão salva.' : 'Produto criado como rascunho.') }
    }
    if (m.kind === 'sug') {
      const x = (s.suggestions || []).find((y) => y.id === m.id), ean = String(F.ean || '').replace(/\D/g, ''), bad = ean && !gtOk(ean), dupE = ean && s.catalog.find((c) => c.st !== 'arquivado' && c.ean === ean)
      spec.title = 'Sugestão ' + x.id + ' · ' + x.nome; spec.sub = 'Enviada pela ' + x.adegaNome + ' em ' + fD(x.criado) + '. Preço, custo e estoque continuam da adega.'
      spec.fields = [f('acao', 'Decisão', 'chips', { full: 1, opts: [['approve', 'Aprovar no catálogo'], ['link', 'Ligar a um produto que já existe'], ['reject', 'Recusar']] })]
      if (F.acao === 'approve') spec.fields.push(f('nome', 'Nome no catálogo', 'text', { req: 1, full: 1 }), f('marca', 'Marca', 'text'), f('cat', 'Categoria', 'select', { opts: ['Cervejas', 'Destilados', 'Energéticos', 'Refrigerantes', 'Gelo', 'Drinks prontos', 'Vinhos', 'Água', 'Petiscos', 'Outros', ...new Set(s.catalog.map((c) => c.cat))].filter((v, i, a) => a.indexOf(v) === i) }), f('ean', 'EAN / GTIN', 'text', { hint: ean ? (bad ? '' : 'dígito verificador ok') : 'Sem EAN o produto entra como rascunho' }), f('vol', 'Volume', 'number'), f('un', 'Unidade', 'select', { opts: ['ml', 'L', 'g', 'kg', 'un'] }))
      if (F.acao === 'link') spec.fields.push(f('link', 'Produto do catálogo', 'select', { full: 1, opts: [['', 'Escolha…'], ...s.catalog.filter((c) => c.st !== 'arquivado').map((c) => [c.id, c.id + ' · ' + c.nome + (c.ean ? ' · ' + c.ean : '')])] }))
      if (F.acao === 'reject') spec.fields.push(f('motivo', 'Motivo', 'area', { req: 1, full: 1, ph: 'Ex.: produto artesanal, só existe nesta adega' }))
      if (F.acao === 'approve' && bad) spec.notes.push(nt('EAN inválido: o dígito verificador não confere.', 'red'))
      if (F.acao === 'approve' && dupE) spec.notes.push(nt('Já existe ' + dupE.id + ' com este EAN (' + dupE.nome + '). Use "Ligar a um produto que já existe".', 'red'))
      if (x.mesmoEan) spec.notes.push(nt('Outras ' + x.mesmoEan + ' sugestão(ões) com o mesmo código de barras seguem a mesma decisão.', 'green'))
      spec.prevTitle = 'O que acontece'; spec.prev = F.acao === 'reject' ? [pv('Produto da adega', 'continua só na ' + x.adegaNome), pv('Catálogo', 'sem mudança')] : [pv('Produto da adega', 'fica ligado ao catálogo', '#4ADE80'), pv('Catálogo', F.acao === 'approve' ? (ean && !bad ? 'novo produto publicado' : 'novo rascunho') : 'sem produto novo'), pv('Outras adegas', F.acao === 'approve' && ean && !bad ? 'passam a achar no catálogo' : '—')]
      spec.danger = F.acao === 'reject'; spec.okLabel = F.acao === 'approve' ? 'Aprovar' : F.acao === 'link' ? 'Ligar' : 'Recusar'
      spec.ok = () => {
        if (F.acao === 'approve') { if (!this.need(['nome'])) return; if (bad || dupE) return; return this.call('catalog/suggestion', { id: x.uuid, action: 'approve', data: { name: F.nome, brand: F.marca || '', category: F.cat, ean, volume: F.vol || '', unit: F.un || 'ml', publish: true } }, x.nome + ' entrou no catálogo.') }
        if (F.acao === 'link') { const c = s.catalog.find((y) => y.id === F.link); if (!c) return this.setState({ formErr: { link: 'Escolha o produto' } }); return this.call('catalog/suggestion', { id: x.uuid, action: 'link', data: { catalog_id: c.uuid } }, x.nome + ' ligado a ' + c.id + '.') }
        if (!this.need(['motivo'])) return; return this.call('catalog/suggestion', { id: x.uuid, action: 'reject', data: { reason: F.motivo } }, 'Sugestão recusada.', { tone: '#E5241B' })
      }
    }
    if (m.kind === 'catMerge') {
      const a = s.catalog.find((x) => x.id === m.keep), b = s.catalog.find((x) => x.id === m.drop); spec.title = 'Mesclar produtos'; spec.prevTitle = 'Resultado'
      spec.prev = [pv('Fica', a.id + ' · ' + a.nome), pv('Vai para arquivados', b.id + ' · ' + b.nome, '#FF6B5E'), pv('Adegas transferidas', b.uso + ' → passam a usar ' + a.id), pv('Dados locais das adegas', 'preservados', '#4ADE80')]
      spec.okLabel = 'Mesclar'; spec.ok = () => this.call('catalog/merge', { keep: a.uuid, drop: b.uuid }, b.id + ' mesclado em ' + a.id + '.')
    }
    if (m.kind === 'envio') {
      const R2 = this.recips(D), tpl = R2.tpl, M2 = s.msg, cost = R2.ok.length * (M2.canal === 'E-mail' ? 0 : COST[tpl.tipo]); spec.title = 'Confirmar envio'; spec.sub = 'As mensagens entram na fila do servidor e saem pelo provedor de cada canal.'
      spec.prevTitle = 'Resumo'; spec.prev = [pv('Modelo', tpl.nome), pv('Tipo', tpl.tipo === 'promo' ? 'Campanha promocional' : 'Aviso de serviço', tpl.tipo === 'promo' ? Y : '#4ADE80'), pv('Canal', M2.canal), pv('Destinatários', R2.ok.length + ' adega(s) · ' + R2.n + ' mensagem(ns)'), pv('Excluídos', String(R2.ex.length)), pv('Quando', M2.quando === 'agendar' ? fDT(M2.data) : 'Agora'), pv('Custo estimado', money(cost))]
      spec.notes.push(nt('Prévia: ' + this.fill(tpl, R2.ok[0], D))); if (tpl.canais && M2.canal !== 'Ambos' && !tpl.canais.includes(M2.canal)) spec.notes.push(nt('Este modelo não existe para ' + M2.canal + '.', 'red'))
      spec.okLabel = M2.quando === 'agendar' ? 'Agendar envio' : 'Enviar agora'
      spec.ok = () => { const ag = M2.quando === 'agendar', chs = M2.canal === 'Ambos' ? ['whatsapp', 'email'] : [M2.canal === 'E-mail' ? 'email' : 'whatsapp']; this.call('messages/send', { template: tpl.id, channels: chs, accounts: R2.ok.map((a) => a.uuid), when: ag ? new Date(M2.data).toISOString() : null, promotional: tpl.tipo === 'promo' }, (ag ? 'Envio agendado: ' : 'Envio na fila: ') + R2.ok.length + ' adega(s).').then((r) => r !== undefined && this.setState((x) => ({ tab: { ...x.tab, msg: 'hist' } }))) }
    }
    if (m.kind === 'tpl') {
      const t = s.tpls.find((x) => x.id === m.id), bad = (String(F.txt || '').match(/\{(\w+)\}/g) || []).map((x) => x.slice(1, -1)).filter((v) => !VARS.includes(v) && v !== 'dias')
      spec.title = 'Editar modelo'; spec.sub = 'Variáveis aceitas: ' + VARS.map((v) => '{' + v + '}').join(' ') + ' {dias}'
      spec.fields = [f('nome', 'Nome', 'text', { req: 1, full: 1 }), f('tipo', 'Tipo', 'chips', { full: 1, opts: [['servico', 'Aviso de serviço'], ['promo', 'Campanha promocional']], hint: 'Promocional respeita quem recusou novidades e precisa de opção de saída.' }), f('txt', 'Texto', 'area', { req: 1, full: 1 })]
      if (bad.length) spec.notes.push(nt('Variável desconhecida: ' + bad.join(', '), 'red')); if (F.tipo === 'promo' && !/sair/i.test(F.txt || '')) spec.notes.push(nt('Campanhas promocionais devem dizer como parar de receber (ex.: "responda SAIR").'))
      spec.prevTitle = 'Prévia'; spec.prev = [pv('Exemplo', this.fill({ txt: F.txt || '' }, D.A[0], D))]
      spec.okLabel = 'Salvar modelo'; spec.ok = () => { if (!this.need(['nome', 'txt']) || bad.length) return; this.call('messages/template', { code: t.id, name: F.nome, kind: F.tipo === 'promo' ? 'promotional' : 'service', body: F.txt }, 'Modelo salvo.') }
    }
    if (m.kind === 'sendView') {
      const e = s.sends.find((x) => x.id === m.id), t = s.tpls.find((x) => x.id === e.tpl) || { nome: e.tpl }, nm = (id) => (D.A.find((a) => a.id === id) || { nome: id }).nome
      spec.title = 'Envio ' + e.id; spec.sub = t.nome + ' · ' + e.canal + ' · ' + fDT(e.when) + ' · por ' + e.por; spec.prevTitle = 'Destinatários'
      spec.prev = e.ids.map((id) => pv(nm(id), e.st === 'agendado' ? 'agendado' : e.st === 'cancelado' ? 'cancelado' : e.falhas.includes(id) ? 'falhou' : 'na fila / entregue', e.falhas.includes(id) ? '#FF6B5E' : e.st === 'agendado' ? '#7CB3FF' : '#4ADE80'))
      if (e.st === 'agendado') { spec.danger = true; spec.okLabel = 'Cancelar agendamento'; spec.ok = () => this.call('messages/cancel', { campaign_id: e.uuid }, 'Agendamento cancelado.') }
      else if (e.falhas.length) { spec.okLabel = 'Tentar de novo as falhas'; spec.ok = () => this.call('messages/retry', { campaign_id: e.uuid }, 'Falhas de volta na fila.') }
    }
    const mob = s.w < 720
    return { ...spec, cancelLabel: spec.ok ? 'Cancelar' : 'Fechar', hasFields: spec.fields.length > 0, hasPrev: spec.prev.length > 0, prevTitle: spec.prevTitle || 'Prévia', okSt: { ...bst(spec.danger ? 'danger' : 'primary', 3, { h: 46, dim: s.busy }), fontSize: 15, padding: '0 20px' }, outer: { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.74)', display: 'flex', alignItems: mob ? 'flex-end' : 'center', justifyContent: 'center', padding: mob ? 0 : 24 }, box: { width: '100%', maxWidth: 640, maxHeight: mob ? '92vh' : '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: mob ? '20px 16px calc(20px + env(safe-area-inset-bottom))' : 24, borderRadius: mob ? '14px 14px 0 0' : R[2], background: '#0E0E10', border: '1px solid #2A2A2E' } }
  },
  applyAdega(act, a, D) {
    const F = this.state.form
    if (act === 'ativar') return this.call('accounts/plan', { account_id: a.uuid, cycle: F.plano, activate: true, reason: F.motivo }, 'Plano ativado · ' + a.nome + '.')
    if (act === 'trocar') return this.call('accounts/plan', { account_id: a.uuid, cycle: F.plano, activate: false, reason: F.motivo }, 'Ciclo trocado · ' + a.nome + '.')
    if (act === 'temp') { const dias = Math.ceil((dt(F.fim) - NOW) / DAY); if (!(dias >= 1 && dias <= 7)) return this.setState({ formErr: { fim: 'De 1 a 7 dias' } }); return this.call('accounts/temp-access', { account_id: a.uuid, days: dias, reason: F.motivo }, 'Acesso temporário concedido · ' + a.nome + '.') }
    if (act === 'trial') return this.call('accounts/extend-trial', { account_id: a.uuid, days: +F.dias || 7, reason: F.motivo }, 'Teste estendido · ' + a.nome + '.')
    if (act === 'suspender') return this.call('accounts/access', { account_id: a.uuid, access: 'suspended', reason: F.motivo }, 'Acesso suspenso · ' + a.nome + '.', { tone: '#E5241B' })
    if (act === 'reativar') return a.assin === 'cancelada' ? this.call('accounts/plan', { account_id: a.uuid, cycle: a.plano, activate: true, reason: F.motivo }, 'Assinatura reativada · ' + a.nome + '.') : this.call('accounts/access', { account_id: a.uuid, access: 'allowed', reason: F.motivo }, 'Acesso reativado · ' + a.nome + '.')
    if (act === 'pagamento') { const v = D.inv.find((i) => i.a.id === a.id && i.st === 'vencida'); if (!v) return this.toastMsg('Nenhuma fatura vencida para esta adega.', '#FF8A00'); return this.call('billing/manual-payment', { invoice_id: v.uuid, method: nz(F.meio), proof_path: 'nota: ' + F.motivo, reason: F.motivo }, 'Pagamento registrado · ' + a.nome + '.') }
  },
}
