// @ts-nocheck
// Painel Addegas (etapa 12): núcleo portado do protótipo `Addegas Admin.dc.html`.
// Sessão, 2FA, retrato do banco, permissões e os métodos de apoio das telas (telas-a/b/c e modais).
import { Component } from 'react'
import { adminAuth, adminApi } from './api'
import { NOW, tick, DAY, Y, R, dt, fD, fT, fDT, fM, money, nz, addD, addM, PL, PD, ASS, INV, NAV, AREA, PERM, PERMACT, NAVACT, bst, chipSt, dot, ic, montar } from './motor'
import { telasA } from './telas-a'
import { telasB } from './telas-b'
import { telasC } from './telas-c'
import { modais } from './modais'
import { Desenho } from './desenho'

const MSG0 = { tpl: 'cobranca_proxima', canal: 'WhatsApp', aud: 'filtro', adega: '', plano: 'todos', assin: 'todas', venc: 'todos', regiao: 'todas', teste: 'todos', ativ: 'todos', seg: '', quando: 'agora', data: '' }
const VAZIO = { adegas: [], plans: [], invoices: [], refunds: [], discounts: [], audit: [], queue: [], tpls: [], sends: [], tickets: null, groups: [], etapas: [], leads: [], catalog: [], suggestions: [], logs: [], team: [], staffNames: [], funnels: [], stock: {}, kits: {}, gifts: [], mkt: [], camps: [], feat: [], alerts: [], roles: [], actionNames: {} }

export class Painel extends Component {
  state = {
    auth: 'boot', email: '', pass: '', code: '', pass2: '', authErr: '', enroll: null, user: null, scr: 'overview', sel: null, tab: {}, loading: false, loadErr: null,
    period: '30d', gq: '', gOpen: false, nOpen: false, pOpen: false, navOpen: false, w: typeof window !== 'undefined' ? window.innerWidth : 1400,
    ...VAZIO, f: {}, sort: {}, modal: null, form: {}, formErr: {}, toast: null, noteTxt: '', tkf: {}, imp: { txt: '', rows: null }, dupIgn: {},
    msg: MSG0, mapF: { tipo: 'todos', cidade: 'todas', centro: 'Centro de SP', raio: 'todos', assin: 'todas', etapa: 'todas' }, mapSel: null,
    cfg: {}, ret: { fe: '30', be: '90', sec: '5' }, updRule: 'manual', busy: false,
  }

  componentDidMount() {
    this.onR = () => this.setState({ w: window.innerWidth }); window.addEventListener('resize', this.onR)
    this.onK = (e) => { if (e.key === 'Escape') this.setState({ modal: null, gOpen: false, nOpen: false, pOpen: false, navOpen: false }) }; window.addEventListener('keydown', this.onK)
    this.sub = adminAuth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') this.setState({ auth: 'newpass', authErr: '' }) }).data.subscription
    // Volta a cada 5 min para os números de "agora" (carência, SLA, tarefas) não envelhecerem com a aba aberta.
    this.iv = setInterval(() => { if (this.state.auth === 'app' && !this.state.modal) this.carregar(true) }, 300000)
    if (/type=recovery/.test(location.hash)) return
    this.entrarComSessao()
  }
  componentWillUnmount() { window.removeEventListener('resize', this.onR); window.removeEventListener('keydown', this.onK); this.sub?.unsubscribe(); clearInterval(this.iv); clearTimeout(this.tt) }

  // Sessão e 2FA -----------------------------------------------------------------------------------------
  async entrarComSessao() {
    const { data } = await adminAuth.getSession()
    if (!data.session) return this.setState({ auth: 'login' })
    if (data.session.user.app_metadata?.kind !== 'staff') { await adminAuth.signOut(); return this.setState({ auth: 'login', authErr: 'Este acesso não é da equipe Addegas. Dono de adega entra pelo painel da adega.' }) }
    this.setState({ email: data.session.user.email || '' })
    const { data: aal } = await adminAuth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel === 'aal2') return this.abrirPainel()
    if (aal?.nextLevel === 'aal2') return this.setState({ auth: '2fa', code: '', authErr: '' })
    return this.iniciarCadastro2fa()
  }
  async login() {
    const s = this.state
    if (!s.email.trim() || !s.pass) return this.setState({ authErr: 'Informe e-mail e senha.' })
    this.setState({ authErr: '', busy: true })
    const { error } = await adminAuth.signInWithPassword({ email: s.email.trim().toLowerCase(), password: s.pass })
    this.setState({ busy: false, pass: '' })
    if (error) return this.setState({ authErr: error.status === 429 ? 'Muitas tentativas. Espere alguns minutos e tente de novo.' : 'E-mail ou senha incorretos.' })
    this.entrarComSessao()
  }
  async iniciarCadastro2fa() {
    const { data: fs } = await adminAuth.mfa.listFactors()
    for (const f of (fs?.all || []).filter((x) => x.status !== 'verified')) await adminAuth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await adminAuth.mfa.enroll({ factorType: 'totp', friendlyName: 'Painel Addegas ' + Date.now().toString(36) })
    if (error) return this.setState({ auth: 'login', authErr: 'Não foi possível iniciar a verificação em duas etapas. Tente de novo.' })
    this.setState({ auth: 'enroll', enroll: { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret }, code: '', authErr: '' })
  }
  async verificar() {
    const s = this.state; if (s.code.length !== 6) return this.setState({ authErr: 'Digite os 6 dígitos do aplicativo.' })
    let factorId = s.enroll?.id
    if (!factorId) { const { data } = await adminAuth.mfa.listFactors(); factorId = data?.totp?.[0]?.id }
    if (!factorId) return this.iniciarCadastro2fa()
    this.setState({ busy: true })
    const { error } = await adminAuth.mfa.challengeAndVerify({ factorId, code: s.code })
    this.setState({ busy: false })
    if (error) return this.setState({ authErr: 'Código inválido ou expirado.', code: '' })
    this.setState({ enroll: null, code: '' }); this.abrirPainel()
  }
  async recuperar() {
    const em = this.state.email.trim().toLowerCase(); if (!em) return this.setState({ authErr: 'Informe o e-mail da equipe.' })
    await adminAuth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname })
    this.setState({ auth: 'sent', authErr: '' })
  }
  async novaSenha() {
    const s = this.state; if (s.pass.length < 10) return this.setState({ authErr: 'Use ao menos 10 caracteres.' }); if (s.pass !== s.pass2) return this.setState({ authErr: 'As senhas não conferem.' })
    const { error } = await adminAuth.updateUser({ password: s.pass }); if (error) return this.setState({ authErr: 'Não foi possível trocar a senha. Peça um novo link.' })
    history.replaceState(null, '', location.pathname); this.setState({ pass: '', pass2: '' }); this.toastMsg('Senha trocada.'); this.entrarComSessao()
  }
  async sair(msg) { await adminAuth.signOut(); this.setState({ auth: 'login', user: null, pOpen: false, pass: '', scr: 'overview', sel: null, modal: null, authErr: msg || '', ...VAZIO }) }
  async abrirPainel() { this.setState({ auth: 'app', loading: true, scr: 'overview', sel: null }); await this.carregar() }

  // Dados ------------------------------------------------------------------------------------------------
  async carregar(silencioso) {
    try {
      const snap = await adminApi('snapshot')
      const m = montar(snap)
      this.setState({ ...VAZIO, ...m, user: m.me, loading: false, loadErr: null, msg: { ...this.state.msg, tpl: this.state.msg.tpl && m.tpls.some((t) => t.id === this.state.msg.tpl) ? this.state.msg.tpl : (m.tpls[0] || {}).id, adega: this.state.msg.adega || (m.adegas[0] || {}).id } })
    } catch (e) { if (!this.tratarSessao(e) && !silencioso) this.setState({ loading: false, loadErr: e.code || 'INTERNAL' }) }
  }
  tratarSessao(e) {
    if (e.code === 'SESSION_IDLE') { this.sair('Sua sessão expirou depois de 30 minutos sem uso. Entre de novo.'); return true }
    if (e.code === 'AUTH_REQUIRED' || e.code === 'STAFF_INACTIVE') { this.sair(e.message); return true }
    if (e.code === 'MFA_REQUIRED') { this.setState({ auth: '2fa', code: '', authErr: e.message }); return true }
    return false
  }
  api(path, body) { return adminApi(path, body) }
  /** Ação do painel: chama a admin-api, fecha o modal, avisa e recarrega o retrato. Devolve undefined se falhou. */
  async call(path, body, ok, o = {}) {
    if (this.state.busy) return undefined
    this.setState({ busy: true })
    try {
      const r = await adminApi(path, body)
      if (o.close !== false) this.setState({ modal: null })
      if (ok) this.toastMsg(ok, o.tone || '#16C60C')
      if (o.reload !== false) await this.carregar(true)
      return r ?? true
    } catch (e) {
      if (!this.tratarSessao(e)) this.toastMsg(e.message + (e.code === 'FORBIDDEN_ACTION' ? ' Tentativa registrada na auditoria.' : ''), '#E5241B')
      return undefined
    } finally { this.setState({ busy: false }) }
  }

  // Apoio das telas (iguais ao protótipo) -----------------------------------------------------------------
  get role() { return { label: this.state.user ? this.state.user.roleLabel : '' } }
  can(p) { const a = PERMACT[p]; return !a || !!(this.state.user && this.state.user.acts.includes(a)) }
  canNav(k) { const u = this.state.user; return !!u && (NAVACT[k] || []).some((a) => u.acts.includes(a)) }
  toastMsg(t, tone) { clearTimeout(this.tt); this.setState({ toast: { t, dot: dot(tone || '#16C60C', 10) } }); this.tt = setTimeout(() => this.setState({ toast: null }), 4200) }
  deny(p) { this.toastMsg('Seu perfil (' + this.role.label + ') não pode ' + (PERM[p] || 'fazer isso') + '.', '#E5241B') }
  A(label, go, kind = 'ghost', perm, i = 0) { const ok = !perm || this.can(perm); return { label, tip: ok ? '' : 'Seu perfil não permite esta ação', go: ok ? go : () => this.deny(perm), st: bst(kind, i, { dim: !ok }) } }
  go(scr) { if (!this.canNav(scr)) { this.deny('nav'); return } this.setState({ scr, sel: null, navOpen: false, gOpen: false, nOpen: false, pOpen: false, gq: '' }); if (typeof window !== 'undefined') window.scrollTo(0, 0) }
  open(t, id) { const scr = { adega: 'adegas', lead: 'crm', ticket: 'tickets', prod: 'produtos' }[t] || this.state.scr; if (!this.canNav(scr)) return this.deny('nav'); this.setState({ scr, sel: { t, id }, navOpen: false, gOpen: false, nOpen: false, gq: '' }); if (typeof window !== 'undefined') window.scrollTo(0, 0) }
  fv(s, k, d) { const o = this.state.f[s]; return o && o[k] != null ? o[k] : d }
  setF(s, k, v) { this.setState((st) => ({ f: { ...st.f, [s]: { ...(st.f[s] || {}), [k]: v } } })) }
  goF(scr, k, v) { this.go(scr); this.setState((st) => ({ f: { ...st.f, [scr]: { [k]: v } } })) }
  srch(s, ph) { return { val: this.fv(s, 'q', ''), ph, on: (e) => this.setF(s, 'q', e.target.value) } }
  flt(s, k, label, opts, d) { return { label, val: this.fv(s, k, d), opts: opts.map((x) => Array.isArray(x) ? { v: x[0], l: x[1] } : { v: x, l: x }), on: (e) => this.setF(s, k, e.target.value) } }
  tbl(key, o) {
    const s = this.state, so = s.sort[key] || o.def || {}; let rs = o.rows; const c0 = o.cols.find((c) => c.k === so.k)
    // Padrão de toda listagem: busca e "X de Y registros". Tabela sem busca própria ganha uma busca no texto das
    // células; as tabelas de referência fixas (prazos, matriz de permissões, conexões, retenção, etapas de funil) não.
    const total = o.rows.length, fixa = /^(tk-sla|perm|int|ret|imp|fun-|fseg-)/.test(key)
    let search = o.search, clear = o.clear || null
    if (!search && !fixa && total) {
      const sk = 't:' + key, q = nz(this.fv(sk, 'q', '').trim())
      search = this.srch(sk, 'Buscar nesta lista')
      if (q) rs = rs.filter((r) => nz(r.cells.map((c) => (c.t || '') + ' ' + (c.sub || '')).join(' ')).includes(q))
      const antes = clear
      clear = () => { this.setState((st) => ({ f: { ...st.f, [sk]: {} } })); if (antes) antes() }
    }
    if (c0 && c0.sv) rs = [...rs].sort((a, b) => { const x = c0.sv(a.d), y = c0.sv(b.d); return (x > y ? 1 : x < y ? -1 : 0) * (so.dir || 1) })
    const count = o.count || (fixa || !total ? '' : rs.length === total ? total + (total === 1 ? ' registro' : ' registros') : rs.length + ' de ' + total + ' registros')
    // Enumeração: 25 por página, com "Mostrando 1–25 de N" e Anterior / Próxima.
    const POR = 25, achados = rs.length, pk = 'p:' + key, paginas = Math.max(1, Math.ceil(achados / POR))
    const pg = Math.min(this.fv(pk, 'pg', 0), paginas - 1), irPara = (n) => this.setF(pk, 'pg', n)
    const pager = fixa || !achados ? null : {
      txt: 'Mostrando ' + (pg * POR + 1) + '–' + Math.min(achados, (pg + 1) * POR) + ' de ' + achados + (achados < total ? ' (filtrados de ' + total + ')' : ''),
      prev: pg > 0 ? () => irPara(pg - 1) : null, next: pg < paginas - 1 ? () => irPara(pg + 1) : null, pag: paginas > 1 ? 'Página ' + (pg + 1) + ' de ' + paginas : '',
    }
    rs = rs.slice(pg * POR, (pg + 1) * POR)
    const tm = o.cols.map((c) => c.w || 'minmax(0,1fr)').join(' ')
    const hc = { background: 'none', border: 'none', padding: 0, color: '#8A8A90', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }
    return { type: 'table', title: o.title, sub: o.sub, acts: o.acts, span: o.span, search, filters: o.filters || [], count, hasTools: !!(search || (o.filters && o.filters.length) || count),
      cols: o.cols.map((c) => ({ label: c.label, arrow: so.k === c.k && c.sv ? (so.dir === -1 ? ' ↓' : ' ↑') : '', st: { ...hc, cursor: c.sv ? 'pointer' : 'default' }, go: c.sv ? () => this.setState((st) => { const cur = st.sort[key] || o.def || {}; return { sort: { ...st.sort, [key]: { k: c.k, dir: cur.k === c.k ? -(cur.dir || 1) : 1 } } } }) : () => {} })),
      rows: rs.map((r) => ({ cells: r.cells, go: r.go || null, st: { display: 'grid', gridTemplateColumns: tm, gap: 14, alignItems: 'center', padding: '11px 10px', borderTop: '1px solid #1C1C1F', cursor: r.go ? 'pointer' : 'default', boxShadow: r.hl ? 'inset 3px 0 0 ' + r.hl : 'none' } })),
      headSt: { display: 'grid', gridTemplateColumns: tm, gap: 14, padding: '0 10px 8px' }, inner: { minWidth: o.minW || 0 }, hasRows: rs.length > 0, noRows: rs.length === 0, emptyT: rs.length < total ? 'Nenhum resultado' : (o.empty || [])[0] || 'Nada por aqui', emptyS: rs.length < total ? 'Nada nesta lista bate com a busca.' : (o.empty || [])[1] || '', clear, pager }
  }
  kpi(label, value, o = {}) { return { label, value: String(value), sub: o.sub || '', def: o.def || '', delta: o.delta || '', deltaSt: { fontSize: 13, fontWeight: 800, color: o.dc || '#B4B4B9' }, dot: { ...dot(o.tone || Y), marginTop: 4 }, go: o.go || null, st: { display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px', minHeight: 112, borderRadius: R[(o.i || 0) % 5], border: '1px solid #232327', background: '#141416', color: '#F5F5F2', textAlign: 'left', cursor: o.go ? 'pointer' : 'default', minWidth: 0 } } }
  note(tone, nt, text, o = {}) { const T = { yellow: ['#1A1508', '#3A2F0A', Y, 'alert'], red: ['#200B09', '#5A1712', '#FF6B5E', 'alert'], green: ['#0D1A0F', '#1C4A22', '#4ADE80', 'check'], blue: ['#0B1424', '#1C3A66', '#7CB3FF', 'clock'], dark: ['#0E0E10', '#232327', '#A1A1A6', 'lock'] }[tone]; return { type: 'note', nt, text, bullets: o.bullets || null, span: o.span, nacts: o.acts || [], hasNActs: !!(o.acts && o.acts.length), icon: ic(T[3], 20, 2.2), iconSt: { color: T[2], flex: 'none', marginTop: 1 }, bg: T[0], bd: T[1] } }
  tabsB(key, items, d) { const cur = (this.state.tab[key]) || d; return { type: 'tabs', plain: true, items: items.map(([k, l, n], i) => { const on = cur === k; return { label: l, count: n || '', go: () => this.setState((s) => ({ tab: { ...s.tab, [key]: k } })), st: { ...chipSt(on, i), height: 40, display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }, cst: { minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: on ? '#0A0A0B' : '#2A2A2E', color: on ? Y : '#F5F5F2', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' } } }) } }
  fld(k, label, type, o = {}) {
    const s = this.state, v = o.get ? o.get() : (s.form[k] != null ? s.form[k] : (o.def != null ? o.def : '')); const err = s.formErr[k] || ''
    const set = o.set || ((val) => this.setState((st) => ({ form: { ...st.form, [k]: val }, formErr: { ...st.formErr, [k]: '' } })))
    const base = { height: 46, width: '100%', padding: '0 12px', borderRadius: '2px 8px 3px 7px', border: '1px solid ' + (err ? '#E5241B' : '#2A2A2E'), background: '#141416', color: '#F5F5F2', fontSize: 15, outline: 'none', colorScheme: 'dark' }
    const f = { label, req: !!o.req, hint: o.hint || '', err, type, val: v ?? '', ph: o.ph || '', on: (e) => set(e.target.value), inSt: base, areaSt: { ...base, height: 'auto', minHeight: 90, padding: '10px 12px', lineHeight: 1.5, resize: 'vertical' }, wrap: { display: 'flex', flexDirection: 'column', gap: 6, gridColumn: o.full ? '1/-1' : 'auto', minWidth: 0 }, isInput: ['text', 'number', 'date', 'datetime-local', 'email'].includes(type), isSelect: type === 'select', isArea: type === 'area', isChips: type === 'chips' }
    if (type === 'select') f.opts = o.opts.map((x) => Array.isArray(x) ? { v: x[0], l: x[1] } : { v: x, l: x })
    if (type === 'chips') f.chips = o.opts.map((x, i) => { const [cv, cl2] = Array.isArray(x) ? x : [x, x]; return { label: cl2, go: () => set(cv), st: chipSt(v === cv, i) } })
    return f
  }
  need(keys) { const e = {}; keys.forEach((k) => { const v = this.state.form[k]; if (v == null || String(v).trim() === '') e[k] = 'Obrigatório' }); if (Object.keys(e).length) { this.setState({ formErr: e }); return false } return true }
  openM(kind, p = {}, init = {}) { this.setState({ modal: { kind, ...p }, form: init, formErr: {}, pOpen: false, nOpen: false }) }
  csv(name, rows) {
    const txt = rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\n')
    try { const b = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000) } catch (_) {}
    adminApi('export/log', { name, rows: rows.length - 1 }).catch(() => {})
    this.toastMsg('Arquivo ' + name + ' gerado com ' + (rows.length - 1) + ' linhas.')
  }
  // Mesmos números do protótipo, calculados sobre cobranças e assinaturas reais.
  derive() {
    tick()
    const s = this.state, P = Object.fromEntries(s.plans.map((p) => [p.id, p])), A = s.adegas, days = PD[s.period], from = new Date(NOW - days * DAY), pfrom = new Date(NOW - 2 * days * DAY)
    const discOf = (a, due) => { let v = 0; const base = a.mensal; for (const d of s.discounts) { if (!d.ids.includes(a.id)) continue; if (d.revog && dt(d.revog) <= due) continue; const i0 = dt(d.ini); if (due < addD(i0, -1)) continue; const m = (due.getFullYear() - i0.getFullYear()) * 12 + due.getMonth() - i0.getMonth(); if (m >= d.ciclos) continue; v += d.tipo === 'pct' ? base * d.valor / 100 : d.valor; if (!d.acumula) break } return Math.min(v, base) }
    const paying = (a, t) => !!a.ini && dt(a.ini) <= t && (!a.cancelEm || dt(a.cancelEm) > t)
    const inv = s.invoices
    const cnt = { teste: 0, ativa: 0, inadimplente: 0, cancelada: 0, expirada: 0 }; A.forEach((a) => cnt[a.assin]++)
    const mrrAt = (t) => A.filter((a) => paying(a, t)).reduce((x, a) => x + a.mensal - discOf(a, t), 0)
    const mrr = A.filter((a) => ['ativa', 'inadimplente'].includes(a.assin)).reduce((x, a) => x + a.mensal - discOf(a, NOW), 0)
    const recIn = (f, t) => inv.filter((i) => i.st === 'paga' && i.pago > f && i.pago <= t)
    const sum = (l, k) => l.reduce((x, i) => x + (i[k] || 0), 0)
    const rec = recIn(from, NOW), recP = recIn(pfrom, from)
    const refunds = s.refunds.filter((r) => dt(r.when) > from)
    const venc = inv.filter((i) => i.st === 'vencida'), aberta = inv.filter((i) => i.st === 'aberta')
    const payersStart = A.filter((a) => paying(a, from)).length, cancels = A.filter((a) => a.cancelEm && dt(a.cancelEm) > from && dt(a.cancelEm) <= NOW)
    const mrrStart = mrrAt(from), lost = cancels.reduce((x, a) => x + a.mensal, 0)
    const trialEnd = (a) => a.ini ? dt(a.ini) : a.trialEnd ? dt(a.trialEnd) : null
    const trialsEnded = A.filter((a) => { const e = trialEnd(a); return e && e > from && e <= NOW }), conv = trialsEnded.filter((a) => a.ini)
    const newSubs = A.filter((a) => a.ini && dt(a.ini) > from && dt(a.ini) <= NOW).length, newSubsP = A.filter((a) => a.ini && dt(a.ini) > pfrom && dt(a.ini) <= from).length
    const usable = A.filter((a) => a.acesso !== 'suspenso')
    const act = (h) => usable.filter((a) => a.ult != null && a.ult < h).length
    const prazo = (a) => a.overdue ? (a.graceEnd ? dt(a.graceEnd) : addD(a.overdue, 5)) : null
    const months = []; for (let k = 5; k >= 0; k--) { const e = new Date(NOW); e.setDate(1); e.setHours(0, 0, 0, 0); const st = addM(e, -k), en = k === 0 ? NOW : addM(e, -k + 1); months.push({ label: fM(st), mrr: mrrAt(en), rec: sum(recIn(st, en), 'val'), parcial: k === 0 }) }
    return { A, P, inv, cnt, mrr, rec, recP, refunds, venc, aberta, payersStart, cancels, mrrStart, lost, trialsEnded, conv, newSubs, newSubsP, act, prazo, months, discOf, paying, sum, from, days, susp: A.filter((a) => a.acesso === 'suspenso').length, trialEnd }
  }

  // Valores de cada tela (como o renderVals do protótipo) ----------------------------------------------------
  renderVals() {
    const s = this.state, mob = s.w < 720, wide = s.w >= 1080
    const I = { search: ic('search', 18), menu: ic('menu', 22), bell: ic('bell', 20), x: ic('x', 18, 2.4), back: ic('back', 16, 2.6), alert: ic('alert', 18), logout: ic('logout', 18) }
    if (s.auth !== 'app') {
      const w = typeof window !== 'undefined' ? window.innerWidth : s.w
      return { isAuth: true, I, au: { wide: w >= 900, narrow: w < 900, boot: s.auth === 'boot', isLogin: s.auth === 'login', is2fa: s.auth === '2fa', isEnroll: s.auth === 'enroll', isRec: s.auth === 'rec', isSent: s.auth === 'sent', isNew: s.auth === 'newpass', busy: s.busy, enroll: s.enroll, email: s.email, pass: s.pass, pass2: s.pass2, code: s.code, err: s.authErr,
        onEmail: (e) => this.setState({ email: e.target.value, authErr: '' }), onPass: (e) => this.setState({ pass: e.target.value, authErr: '' }), onPass2: (e) => this.setState({ pass2: e.target.value, authErr: '' }), onCode: (e) => this.setState({ code: e.target.value.replace(/\D/g, '').slice(0, 6), authErr: '' }),
        onKey: (e) => { if (e.key === 'Enter') this.login() }, onKey2: (e) => { if (e.key === 'Enter') this.verificar() }, login: () => this.login(), verify: () => this.verificar(), toRec: () => this.setState({ auth: 'rec', authErr: '' }), toLogin: () => this.sair(), recover: () => this.recuperar(), newPass: () => this.novaSenha() }, toast: s.toast }
    }
    const u = s.user
    if (!u) return { isAuth: false, isApp: true, I, nav: [], me: { area: '', nome: '', first: '', email: s.email, ini: '', roleLabel: '' }, page: { title: 'Carregando…', sub: '', acts: [], hasActs: false }, blocks: this.estados(mob), gs: { q: '', items: [], show: false }, periods: [], notifs: [], modal: null, toast: s.toast, showSide: wide, showBurger: !wide }
    const D = this.derive()
    const nav = NAV.map(([g, items]) => ({ label: g, items: items.filter((n) => this.canNav(n[0])).map((n) => { const on = s.scr === n[0]; return { label: n[1], icon: ic(n[2], 19, on ? 2.4 : 2), go: () => this.go(n[0]), st: { display: 'flex', alignItems: 'center', gap: 11, height: 42, padding: '0 10px', borderRadius: R[n[1].length % 5], border: 'none', background: on ? Y : 'transparent', color: on ? '#0A0A0B' : '#E4E4E7', fontSize: 14.5, fontWeight: on ? 800 : 600, cursor: 'pointer', textAlign: 'left', width: '100%' } } }) })).filter((g) => g.items.length)
    const scr = this.canNav(s.scr) ? s.scr : 'overview'
    let page
    try { page = ({ overview: () => this.scrOverview(D), adegas: () => this.scrAdegas(D), planos: () => this.scrPlanos(D), financeiro: () => this.scrFin(D), descontos: () => this.scrDesc(D), brindes: () => this.scrBrindes(D), uso: () => this.scrUso(D), marketing: () => this.scrMkt(D), mapa: () => this.scrMapa(D), monitor: () => this.scrMon(D), equipe: () => this.scrEquipe(D), config: () => this.scrCfg(D), crm: () => this.scrCrm(D), tickets: () => this.scrTk(D), produtos: () => this.scrCat(D), mensagens: () => this.scrMsg(D) }[scr])() }
    catch (e) { console.error(e); page = { title: 'Não foi possível montar esta tela', blocks: [{ type: 'state', card: true, icon: ic('alert', 34), iconSt: { color: '#FF6B5E' }, st1: 'Erro ao montar a tela', st2: String(e && e.message || e), nacts: [this.A('Ir para a Visão geral', () => this.go('overview'), 'primary')], hasNActs: true }] } }
    let blocks = page.blocks
    if (s.loading || s.loadErr) blocks = this.estados(mob)
    blocks = blocks.map((b, i) => { const T = b.type; const span = mob ? 12 : (b.span && !wide && b.span < 12 ? (b.span >= 6 ? 12 : 6) : (b.span || 12)); const isCard = b.card || ['chart', 'list', 'note', 'kv', 'timeline', 'form', 'state', 'cards', 'thread'].includes(T) && !b.plain
      return { ...b, ['is' + T[0].toUpperCase() + T.slice(1)]: true, hasHead: !!b.title, hasActs: !!(b.acts && b.acts.length), sub: b.sub || '', hasFActs: !!(b.facts && b.facts.length), wrap: { gridColumn: 'span ' + span, minWidth: 0, ...(isCard ? { padding: mob ? 14 : 18, borderRadius: R[i % 5], background: T === 'note' ? b.bg : '#0E0E10', border: '1px solid ' + (T === 'note' ? b.bd : '#1F1F22') } : {}) } } })
    const q = nz(s.gq.trim()), PSTN = { publicado: 'Publicado', rascunho: 'Rascunho', arquivado: 'Arquivado' }
    const gItems = q.length < 2 ? [] : [...D.A.filter((a) => nz(a.nome + ' ' + a.resp + ' ' + a.bairro + ' ' + a.tel).includes(q)).map((a) => ({ kind: 'Adega', t: a.nome, s: a.resp + ' · ' + a.bairro + ' · ' + ASS[a.assin][0], go: () => this.open('adega', a.id) })), ...D.inv.filter((i) => nz(i.id).includes(q)).slice(0, 4).map((i) => ({ kind: 'Fatura', t: i.id + ' · ' + money(i.val), s: i.a.nome + ' · ' + INV[i.st][0], go: () => this.open('adega', i.a.id) })), ...s.leads.filter((l) => !l.mergedInto && !l.adega && nz(l.id + ' ' + l.nome + ' ' + l.resp + ' ' + l.tel).includes(q)).slice(0, 4).map((l) => ({ kind: 'Lead', t: l.nome, s: l.resp + ' · ' + ((s.etapas.find((e) => e[0] === l.etapa) || [, ''])[1]), go: () => this.open('lead', l.id) })), ...(s.tickets || []).filter((t) => nz(t.id + ' ' + t.desc).includes(q)).slice(0, 4).map((t) => ({ kind: 'Ticket', t: t.id + ' · ' + t.area, s: t.desc, go: () => this.open('ticket', t.id) })), ...s.catalog.filter((p) => nz(p.nome + ' ' + p.marca + ' ' + p.ean).includes(q)).slice(0, 4).map((p) => ({ kind: 'Produto', t: p.nome, s: p.id + ' · ' + PSTN[p.st], go: () => this.open('prod', p.id) })), ...s.discounts.filter((d) => nz(d.id + ' ' + d.alvo).includes(q)).map((d) => ({ kind: 'Desconto', t: d.id + ' · ' + this.dLabel(d), s: d.alvo, go: () => { this.go('descontos'); this.openM('discView', { id: d.id }, { motivo: '' }) } }))].filter((r) => this.canNav(({ Desconto: 'descontos', Lead: 'crm', Ticket: 'tickets', Produto: 'produtos' })[r.kind] || 'adegas')).slice(0, 8)
    const nts = []; D.A.forEach((a) => { if (a.acesso === 'suspenso' && a.assin === 'inadimplente') nts.push({ t: a.nome + ': acesso suspenso', s: 'Carência encerrou em ' + fDT(D.prazo(a)), c: '#E5241B', id: a.id }); if (a.acesso === 'carencia') nts.push({ t: a.nome + ': em carência', s: 'Prazo final ' + fDT(D.prazo(a)), c: '#FF8A00', id: a.id }); if (a.assin === 'teste' && a.trialEnd && dt(a.trialEnd) - NOW < 3 * DAY) nts.push({ t: 'Teste da ' + a.nome + ' termina', s: fDT(a.trialEnd), c: '#1E90FF', id: a.id }); if (a.renov === false && a.validoAte && !a.cancelEm) nts.push({ t: a.nome + ': cancelamento agendado', s: 'Acesso válido até ' + fDT(a.validoAte), c: '#7CB3FF', id: a.id }) })
    const notifs = nts.map((n) => ({ t: n.t, s: n.s, dot: { ...dot(n.c, 10), marginTop: 5 }, go: () => this.open('adega', n.id) }))
    const periods = Object.keys(PL).map((k, i) => ({ k, label: k, go: () => this.setState({ period: k }), st: { height: 36, padding: '0 12px', borderRadius: R[i % 5], border: 'none', background: s.period === k ? Y : 'transparent', color: s.period === k ? '#0A0A0B' : '#E4E4E7', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' } }))
    const [first] = u.nome.split(' ')
    return { isAuth: false, isApp: true, I, nav, showSide: wide, showBurger: !wide, navOpen: s.navOpen && !wide, openNav: () => this.setState({ navOpen: true }), closeNav: () => this.setState({ navOpen: false }), goHome: () => this.go('overview'),
      me: { area: AREA[u.role] || 'Administração', nome: u.nome, first, email: u.email, ini: u.nome.split(' ').map((x) => x[0]).join('').slice(0, 2), roleLabel: u.roleLabel }, showProfName: s.w >= 900,
      gs: { q: s.gq, on: (e) => this.setState({ gq: e.target.value, gOpen: true }), open: () => this.setState({ gOpen: true, nOpen: false, pOpen: false }), show: s.gOpen && q.length >= 2, items: gItems, none: gItems.length === 0 },
      periods, period: s.period, onPeriod: (e) => this.setState({ period: e.target.value }), showPeriodSeg: s.w >= 820, showPeriodSel: s.w < 820,
      notifs, notifCount: notifs.length, notifEmpty: !notifs.length, notifOpen: s.nOpen, toggleNotif: () => this.setState((st) => ({ nOpen: !st.nOpen, pOpen: false, gOpen: false })), profOpen: s.pOpen, toggleProf: () => this.setState((st) => ({ pOpen: !st.pOpen, nOpen: false, gOpen: false })),
      logout: () => this.sair(), page: { title: page.title, sub: page.sub || '', back: page.back || null, backLabel: page.backLabel || 'Voltar', acts: page.acts || [], hasActs: !!(page.acts && page.acts.length) }, blocks,
      modal: this.modalVals(D), closeModal: () => this.setState({ modal: null }), toast: s.toast }
  }
  estados(mob) {
    const s = this.state
    if (s.loadErr) return [{ type: 'state', isState: true, card: true, icon: ic('alert', 34), iconSt: { color: '#FF6B5E' }, st1: 'Não foi possível carregar', st2: 'O servidor não respondeu a tempo. Seus filtros foram mantidos. Código: ' + s.loadErr + '.', nacts: [this.A('Tentar de novo', () => { this.setState({ loading: true, loadErr: null }); this.carregar() }, 'primary')], hasNActs: true, wrap: { gridColumn: 'span 12', padding: mob ? 14 : 18, borderRadius: R[0], background: '#0E0E10', border: '1px solid #1F1F22' } }]
    return [{ type: 'skel', isSkel: true, box: { height: 110, borderRadius: R[0], background: '#141416' }, wrap: { gridColumn: 'span 12' } }, { type: 'skel', isSkel: true, box: { height: 220, borderRadius: R[2], background: '#141416' }, wrap: { gridColumn: mob ? 'span 12' : 'span 8' } }, { type: 'skel', isSkel: true, box: { height: 220, borderRadius: R[1], background: '#141416' }, wrap: { gridColumn: mob ? 'span 12' : 'span 4' } }]
  }
  render() { return <Desenho v={this.renderVals()} /> }
}
Object.assign(Painel.prototype, telasA, telasB, telasC, modais)
