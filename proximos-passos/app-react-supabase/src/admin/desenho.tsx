// @ts-nocheck
// Desenho do painel: o template do protótipo (`Addegas Admin.dc.html`) convertido para JSX, com os mesmos estilos.
// Os efeitos de hover/foco do protótipo (style-hover, style-focus) viram classes em admin.css.

const FUNDO = "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%2764%27%3E%3Cg fill=%27%230A0A0C%27%3E%3Crect x=%271%27 y=%271%27 width=%2758%27 height=%2730%27 rx=%272%27/%3E%3Crect x=%2761%27 y=%271%27 width=%2758%27 height=%2730%27 rx=%272%27/%3E%3Crect x=%27-29%27 y=%2733%27 width=%2758%27 height=%2730%27 rx=%272%27/%3E%3Crect x=%2731%27 y=%2733%27 width=%2758%27 height=%2730%27 rx=%272%27/%3E%3Crect x=%2791%27 y=%2733%27 width=%2758%27 height=%2730%27 rx=%272%27/%3E%3C/g%3E%3C/svg%3E')"
const rotulo = { fontSize: 12, fontWeight: 800, color: '#0A0A0B', textTransform: 'uppercase', letterSpacing: '.06em' }
const campoAuth = { height: 50, padding: '0 14px', borderRadius: '3px 10px 2px 9px', border: '2px solid #0A0A0B', background: '#0A0A0B', color: '#F5F5F2', fontSize: 16, outline: 'none' }
const btnAuth = { height: 54, borderRadius: '3px 11px 4px 10px', border: 'none', background: '#0A0A0B', color: '#FBC009', fontSize: 16, fontWeight: 900, cursor: 'pointer' }
const linkAuth = { alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: '#0A0A0B', textDecoration: 'underline', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const erroAuth = { padding: '10px 12px', borderRadius: '2px 7px 3px 6px', background: '#E5241B', color: '#FFFFFF', fontSize: 14, fontWeight: 600 }
const titAuth = (t, s) => <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.02em' }}>{t}</div><div style={{ fontSize: 15, color: '#2A2306', lineHeight: 1.45 }}>{s}</div></div>
const codigo = (au) => <input value={au.code} onChange={au.onCode} onKeyDown={au.onKey2} inputMode="numeric" maxLength={6} placeholder="000000" autoFocus className="f-white" style={{ height: 64, padding: '0 14px', borderRadius: '3px 10px 2px 9px', border: '2px solid #0A0A0B', background: '#0A0A0B', color: '#F5F5F2', fontSize: 30, fontWeight: 800, letterSpacing: '.4em', textAlign: 'center', outline: 'none' }} />

function Auth({ au }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: '#050506' }}>
      {au.wide && (
        <div style={{ flex: '1 1 50%', minWidth: 0, height: '100dvh', position: 'relative', overflow: 'hidden', background: '#050506', backgroundImage: FUNDO, color: '#F5F5F2', borderRight: '1px solid #1F1F22', padding: 'clamp(24px,5vh,64px) clamp(28px,4vw,64px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 'clamp(14px,3vh,32px)' }}>
          <img src="/assets/dd-amarelo-vidro.png" alt="" aria-hidden="true" style={{ position: 'absolute', right: -70, bottom: -80, width: 'min(62%,54vh,560px)', height: 'auto', transform: 'rotate(-10deg)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}><img src="/assets/addegas-logo-dark.png" alt="Addegas" style={{ display: 'block', width: 'clamp(180px,min(26vw,34vh),340px)', height: 'auto' }} /><span style={{ fontSize: 'clamp(14px,1.6vw,20px)', fontWeight: 900, letterSpacing: '.32em', textTransform: 'uppercase', color: '#FBC009', paddingLeft: 4 }}>Administração</span></div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520, marginTop: 'clamp(4px,2vh,40px)' }}>
            <div style={{ fontSize: 'clamp(28px,min(4.4vw,6.4vh),60px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-.02em', textTransform: 'uppercase', textWrap: 'balance' }}>Quem cuida do <span style={{ display: 'inline-block', background: '#FBC009', color: '#0A0A0B', padding: '0 .14em', borderRadius: '2px 8px 3px 7px', transform: 'rotate(-1.5deg)' }}>Addegas</span> entra por aqui.</div>
            <div style={{ fontSize: 'clamp(15px,2vh,17px)', fontWeight: 600, lineHeight: 1.45, maxWidth: 440, color: '#C9C9CC' }}>Adegas, assinaturas, suporte e operação num painel só. Acesso individual, com verificação em duas etapas.</div>
            <div style={{ position: 'relative', fontSize: 14, fontWeight: 700, color: '#C9C9CC', padding: '8px 12px', alignSelf: 'flex-start', background: '#0A0A0B', borderRadius: '2px 8px 3px 7px', marginLeft: -12 }}>Dono de adega? Entre pelo painel da sua adega.</div>
          </div>
        </div>
      )}
      <div style={{ flex: '1 1 50%', minWidth: 0, height: '100dvh', overflow: 'hidden', position: 'relative', display: 'flex', background: '#FBC009', color: '#0A0A0B' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}><div style={{ position: 'absolute', inset: -40, backgroundImage: 'url(/assets/dd-pattern-canudo.png)', backgroundSize: '78px auto', backgroundRepeat: 'space', opacity: .07, transform: 'rotate(-12deg)' }} /></div>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', padding: 'clamp(16px,4vh,48px) clamp(16px,4vw,56px)' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 420, margin: 'auto', display: 'flex', flexDirection: 'column', gap: 'clamp(10px,1.9vh,18px)' }}>
            {au.narrow && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}><img src="/assets/addegas-logo-preto.png" alt="Addegas" style={{ display: 'block', width: 180, height: 'auto' }} /><span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '.3em', textTransform: 'uppercase' }}>Administração</span></div>}
            {au.boot && titAuth('Entrando…', 'Conferindo a sua sessão.')}
            {au.isLogin && <>
              {titAuth('Entrar', 'Use seu e-mail da equipe Addegas.')}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={rotulo}>E-mail</span><input type="email" value={au.email} onChange={au.onEmail} placeholder="nome@addegas.com.br" autoComplete="username" className="f-white" style={campoAuth} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={rotulo}>Senha</span><input type="password" value={au.pass} onChange={au.onPass} onKeyDown={au.onKey} placeholder="••••••••" autoComplete="current-password" className="f-white" style={{ ...campoAuth, borderRadius: '2px 8px 3px 7px' }} /></label>
              {au.err && <div style={erroAuth}>{au.err}</div>}
              <button onClick={au.login} disabled={au.busy} className="a-press" style={{ ...btnAuth, opacity: au.busy ? .6 : 1 }}>Continuar</button>
              <button onClick={au.toRec} style={linkAuth}>Esqueci minha senha</button>
            </>}
            {au.is2fa && <>
              {titAuth('Verificação em duas etapas', 'Digite o código de 6 dígitos do seu aplicativo autenticador para ' + au.email + '.')}
              {codigo(au)}
              {au.err && <div style={erroAuth}>{au.err}</div>}
              <button onClick={au.verify} disabled={au.busy} style={btnAuth}>Verificar e entrar</button>
              <button onClick={au.toLogin} style={linkAuth}>Voltar</button>
            </>}
            {au.isEnroll && au.enroll && <>
              {titAuth('Ative as duas etapas', 'Primeiro acesso: escaneie o código com o aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password…) e digite os 6 dígitos que ele mostrar.')}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, borderRadius: '3px 10px 2px 9px', background: '#0A0A0B' }}>
                <img src={au.enroll.qr} alt="QR code para o aplicativo autenticador" style={{ width: 148, height: 148, background: '#FFFFFF', borderRadius: 4, padding: 6, flex: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, color: '#F5F5F2' }}><span style={{ fontSize: 12, fontWeight: 800, color: '#FBC009', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sem câmera? Digite a chave</span><span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'ui-monospace,Menlo,monospace', overflowWrap: 'anywhere', lineHeight: 1.4 }}>{au.enroll.secret}</span></div>
              </div>
              {codigo(au)}
              {au.err && <div style={erroAuth}>{au.err}</div>}
              <button onClick={au.verify} disabled={au.busy} style={btnAuth}>Ativar e entrar</button>
              <button onClick={au.toLogin} style={linkAuth}>Voltar ao login</button>
            </>}
            {au.isRec && <>
              {titAuth('Recuperar acesso', 'Enviaremos um link de redefinição para o e-mail da equipe. A verificação em duas etapas continua valendo.')}
              <input type="email" value={au.email} onChange={au.onEmail} placeholder="nome@addegas.com.br" className="f-white" style={campoAuth} />
              {au.err && <div style={erroAuth}>{au.err}</div>}
              <button onClick={au.recover} style={btnAuth}>Enviar link</button>
              <button onClick={au.toLogin} style={linkAuth}>Voltar ao login</button>
            </>}
            {au.isSent && <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 18, borderRadius: '4px 13px 5px 11px', background: '#0E1A0E', border: '1px solid #16C60C', color: '#F5F5F2' }}><div style={{ fontSize: 18, fontWeight: 900 }}>Pedido recebido</div><div style={{ fontSize: 15, color: '#D4D4D8', lineHeight: 1.5 }}>Se o e-mail pertencer à equipe, o link chega em alguns minutos. Confira também o spam.</div></div>
              <button onClick={au.toLogin} style={{ height: 50, borderRadius: '2px 8px 3px 7px', border: '2px solid #0A0A0B', background: 'transparent', color: '#0A0A0B', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Voltar ao login</button>
            </>}
            {au.isNew && <>
              {titAuth('Nova senha', 'Escolha a senha nova (mínimo de 10 caracteres). Depois o painel pede o código do aplicativo.')}
              <input type="password" value={au.pass} onChange={au.onPass} placeholder="Nova senha" autoComplete="new-password" className="f-white" style={campoAuth} />
              <input type="password" value={au.pass2} onChange={au.onPass2} placeholder="Repita a senha" autoComplete="new-password" className="f-white" style={campoAuth} />
              {au.err && <div style={erroAuth}>{au.err}</div>}
              <button onClick={au.newPass} style={btnAuth}>Salvar senha</button>
            </>}
          </div>
        </div>
      </div>
    </div>
  )
}

const Btn = ({ a }) => <button onClick={a.go} title={a.tip} style={a.st}>{a.label}</button>
const Celula = ({ c }) => (
  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
    {c.badge && <span style={c.bst}>{c.t}</span>}
    {c.plain && <span style={c.st}>{c.t}</span>}
    {c.sub && <span style={{ fontSize: 12.5, color: '#B4B4B9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sub}</span>}
  </div>
)
function Campo({ f, modal }) {
  return (
    <div style={f.wrap}>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#8A8A90', textTransform: 'uppercase', letterSpacing: '.06em' }}>{f.label}{modal && f.req && <span style={{ color: '#FBC009' }}> *</span>}</span>
      {f.isInput && <input type={f.type} value={f.val} onChange={f.on} placeholder={f.ph} style={f.inSt} />}
      {f.isSelect && <select value={f.val} onChange={f.on} style={f.inSt}>{f.opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>}
      {f.isArea && <textarea value={f.val} onChange={f.on} placeholder={f.ph} rows={3} style={f.areaSt} />}
      {f.isChips && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{f.chips.map((c, i) => <button key={i} onClick={c.go} style={c.st}>{c.label}</button>)}</div>}
      {f.hint && <span style={{ fontSize: 13, color: '#B4B4B9', lineHeight: 1.4 }}>{f.hint}</span>}
      {f.err && <span style={{ fontSize: 13, color: '#FF6B5E', fontWeight: 700 }}>{f.err}</span>}
    </div>
  )
}

const Contagem = ({ t }) => <span style={{ fontSize: 14.5, fontWeight: 800, color: '#F5F5F2', marginLeft: 'auto', whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: '2px 7px 3px 6px', background: '#1C1C1F', border: '1px solid #2A2A2E' }}>{t}</span>
const botaoPag = (on) => ({ height: 36, padding: '0 14px', borderRadius: '2px 8px 3px 7px', border: '1px solid #3A3A40', background: 'transparent', color: '#F5F5F2', fontSize: 13.5, fontWeight: 800, cursor: on ? 'pointer' : 'default', opacity: on ? 1 : .4 })
function Paginador({ p }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px', paddingTop: 10 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#E4E4E7' }}>{p.txt}</span>
      {p.pag && <span style={{ fontSize: 13, color: '#8A8A90' }}>{p.pag}</span>}
      {(p.prev || p.next) && <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button onClick={p.prev || undefined} disabled={!p.prev} style={botaoPag(!!p.prev)}>‹ Anterior</button>
        <button onClick={p.next || undefined} disabled={!p.next} style={botaoPag(!!p.next)}>Próxima ›</button>
      </span>}
    </div>
  )
}
// Busca e contagem dos blocos que são lista (listas, linhas do tempo, conversas, cartões e kanban).
function BarraBloco({ l, I }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      {l.busca && <div style={{ flex: '1 1 220px', maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', borderRadius: '3px 10px 2px 9px', background: '#141416', border: '1px solid #2A2A2E', color: '#A1A1A6' }}>{I.search}<input value={l.busca.val} onChange={l.busca.on} placeholder={l.busca.ph} style={{ flex: 1, minWidth: 0, height: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#F5F5F2', fontSize: 14.5 }} /></div>}
      <Contagem t={l.txt} />
    </div>
  )
}

function Bloco({ b, I }) {
  return (
    <div style={b.wrap}>
      {b.hasHead && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '10px 16px', marginBottom: 14 }}><div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}><div style={{ fontSize: 17, fontWeight: 800 }}>{b.title}</div>{b.sub && <div style={{ fontSize: 14, color: '#B4B4B9', lineHeight: 1.45, textWrap: 'pretty' }}>{b.sub}</div>}</div>{b.hasActs && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{b.acts.map((a, i) => <Btn key={i} a={a} />)}</div>}</div>}
      {b.lista && <BarraBloco l={b.lista} I={I} />}
      {b.isKpis && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,190px),1fr))', gap: 10 }}>{b.items.map((k, i) => <button key={i} onClick={k.go || undefined} title={k.def} style={k.st}><span style={{ flex: 'none', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, fontWeight: 700, color: '#C9C9CC', lineHeight: 1.25 }}><span style={k.dot} /><span style={{ minWidth: 0 }}>{k.label}</span></span><span style={{ flex: 'none', fontSize: 26, fontWeight: 900, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{k.value}</span>{k.sub && <span style={{ fontSize: 13, color: '#B4B4B9', lineHeight: 1.35 }}>{k.sub}</span>}{k.delta && <span style={k.deltaSt}>{k.delta}</span>}</button>)}</div>}
      {b.isChart && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>{b.legend.map((l, i) => <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#C9C9CC' }}><span style={l.sw} />{l.label}</span>)}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 210, borderBottom: '1px solid #2A2A2E' }}>{b.groups.map((g, i) => <div key={i} title={g.tip} style={{ flex: '1 1 0', minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>{g.bars.map((br, j) => <div key={j} style={br.st} />)}</div>)}</div>
        <div style={{ display: 'flex', gap: 10 }}>{b.groups.map((g, i) => <span key={i} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 12.5, color: '#B4B4B9', lineHeight: 1.3 }}>{g.label}<br /><b style={{ color: '#F5F5F2' }}>{g.val}</b></span>)}</div>
      </div>}
      {b.isList && <div style={{ display: 'flex', flexDirection: 'column' }}>{b.items.map((it, i) => <button key={i} onClick={it.go} className="h-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', border: 'none', borderTop: '1px solid #1C1C1F', background: 'transparent', color: '#F5F5F2', textAlign: 'left', cursor: 'pointer', width: '100%' }}><span style={it.dot} /><span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 14.5, fontWeight: 700 }}>{it.label}</span>{it.sub && <span style={{ fontSize: 13, color: '#B4B4B9' }}>{it.sub}</span>}</span><span style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{it.value}</span></button>)}{!b.items.length && b.empty && <div style={{ padding: '16px 4px', fontSize: 14, color: '#A1A1A6' }}>{b.empty}</div>}</div>}
      {b.isNote && <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><span style={b.iconSt}>{b.icon}</span><div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>{b.nt && <div style={{ fontSize: 15.5, fontWeight: 800 }}>{b.nt}</div>}{b.text && <div style={{ fontSize: 14.5, lineHeight: 1.5, color: '#E4E4E7', textWrap: 'pretty' }}>{b.text}</div>}{b.bullets && <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{b.bullets.map((t, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 14, lineHeight: 1.45, color: '#E4E4E7' }}><span style={{ color: '#FBC009', flex: 'none', fontWeight: 900 }}>•</span><span>{t}</span></div>)}</div>}{b.hasNActs && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>{b.nacts.map((a, i) => <Btn key={i} a={a} />)}</div>}</div></div>}
      {b.isTabs && <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>{b.items.map((t, i) => <button key={i} onClick={t.go} style={t.st}>{t.label}{t.count !== '' && t.count != null && <span style={t.cst}>{t.count}</span>}</button>)}</div>}
      {b.isKv && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,200px),1fr))', gap: '16px 20px' }}>{b.items.map((it, i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}><span style={{ fontSize: 12, fontWeight: 800, color: '#8A8A90', textTransform: 'uppercase', letterSpacing: '.06em' }}>{it.k}</span><span style={it.st}>{it.v}</span>{it.s && <span style={{ fontSize: 13, color: '#B4B4B9', lineHeight: 1.35 }}>{it.s}</span>}</div>)}</div>}
      {b.isCards && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: 12 }}>{b.items.map((c, i) => <div key={i} style={c.st}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1, fontSize: 19, fontWeight: 900 }}>{c.t}</span>{c.tag && <span style={c.tagSt}>{c.tag}</span>}</div>{c.v !== '' && <span style={{ fontSize: 28, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{c.v}</span>}<span style={{ fontSize: 13.5, color: '#B4B4B9', lineHeight: 1.4 }}>{c.sub}</span><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{c.bullets.map((t, j) => <span key={j} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#E4E4E7', lineHeight: 1.35 }}><span style={{ color: '#FBC009', flex: 'none', fontWeight: 900 }}>✓</span>{t}</span>)}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'auto', paddingTop: 6 }}>{c.acts.map((a, j) => <Btn key={j} a={a} />)}</div></div>)}</div>}
      {b.isTimeline && <div style={{ display: 'flex', flexDirection: 'column' }}>{b.items.map((e, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr)', gap: 12 }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 5 }}><span style={e.dot} /><span style={{ flex: 1, width: 2, background: '#232327', marginTop: 4 }} /></div><div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 16, minWidth: 0 }}><span style={{ fontSize: 15, fontWeight: 800 }}>{e.t}</span><span style={{ fontSize: 13, color: '#B4B4B9' }}>{e.meta}</span>{e.why && <span style={{ fontSize: 14, color: '#E4E4E7', lineHeight: 1.45 }}>Motivo: {e.why}</span>}{e.diff && <span style={{ fontSize: 13, fontFamily: 'ui-monospace,Menlo,monospace', color: '#D4D4D8', background: '#0A0A0B', border: '1px solid #232327', padding: '6px 8px', borderRadius: '2px 6px 2px 5px', overflowWrap: 'anywhere', lineHeight: 1.45 }}>{e.diff}</span>}</div></div>)}{!b.items.length && b.empty && <div style={{ padding: '12px 0', fontSize: 14, color: '#A1A1A6' }}>{b.empty}</div>}</div>}
      {b.isTable && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {b.hasTools && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {b.search && <div style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 12px', borderRadius: '3px 10px 2px 9px', background: '#141416', border: '1px solid #2A2A2E', color: '#A1A1A6' }}>{I.search}<input value={b.search.val} onChange={b.search.on} placeholder={b.search.ph} style={{ flex: 1, minWidth: 0, height: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#F5F5F2', fontSize: 14.5 }} /></div>}
          {b.filters.map((f, i) => <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 42, padding: '0 4px 0 12px', borderRadius: '2px 8px 3px 7px', background: '#141416', border: '1px solid #2A2A2E', fontSize: 13, color: '#A1A1A6' }}><span style={{ whiteSpace: 'nowrap' }}>{f.label}</span><select value={f.val} onChange={f.on} style={{ height: 38, background: 'transparent', border: 'none', outline: 'none', color: '#F5F5F2', fontSize: 14, fontWeight: 700, cursor: 'pointer', maxWidth: 190 }}>{f.opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>)}
          {b.count && <span style={{ fontSize: 14.5, fontWeight: 800, color: '#F5F5F2', marginLeft: 'auto', whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: '2px 7px 3px 6px', background: '#1C1C1F', border: '1px solid #2A2A2E' }}>{b.count}</span>}
        </div>}
        {b.hasRows && <div style={{ overflowX: 'auto', scrollbarWidth: 'thin' }}><div style={b.inner}>
          <div style={b.headSt}>{b.cols.map((c, i) => <button key={i} onClick={c.go} style={c.st}>{c.label}<span style={{ color: '#FBC009' }}>{c.arrow}</span></button>)}</div>
          {b.rows.map((r, i) => <div key={i} onClick={r.go || undefined} className={r.go ? 'h-row' : ''} style={r.st}>{r.cells.map((c, j) => <Celula key={j} c={c} />)}</div>)}
        </div></div>}
        {b.pager && <Paginador p={b.pager} />}
        {b.noRows && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '36px 16px', textAlign: 'center', border: '1.5px dashed #2A2A2E', borderRadius: '4px 12px 3px 10px' }}><span style={{ color: '#FBC009' }}>{I.search}</span><span style={{ fontSize: 16, fontWeight: 800 }}>{b.emptyT}</span><span style={{ fontSize: 14, color: '#B4B4B9', maxWidth: 420, lineHeight: 1.45 }}>{b.emptyS}</span>{b.clear && <button onClick={b.clear} style={{ marginTop: 4, height: 38, padding: '0 14px', borderRadius: '2px 8px 3px 7px', border: '1px solid #3A3A40', background: 'transparent', color: '#F5F5F2', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Limpar filtros</button>}</div>}
      </div>}
      {b.isForm && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{b.fields.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,220px),1fr))', gap: 14 }}>{b.fields.map((f, i) => <Campo key={i} f={f} />)}</div>}{b.hasFActs && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{b.facts.map((a, i) => <Btn key={i} a={a} />)}</div>}</div>}
      {b.isSkel && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><div style={{ height: 16, width: '38%', borderRadius: 3, background: '#1C1C1F' }} /><div style={{ height: 12, width: '62%', borderRadius: 3, background: '#17171A' }} /><div style={b.box} /></div>}
      {b.isMap && <><div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', minHeight: 300, borderRadius: '4px 13px 5px 11px', overflow: 'hidden', background: '#0B0D10', backgroundImage: 'linear-gradient(#15181D 1px,transparent 1px),linear-gradient(90deg,#15181D 1px,transparent 1px)', backgroundSize: '40px 40px', border: '1px solid #232327' }}>{b.labels.map((l, i) => <span key={i} style={l.st}>{l.t}</span>)}{b.ring && <span style={b.ring} />}{b.pts.map((p, i) => <button key={i} onClick={p.go} title={p.tip} style={p.st} />)}<span style={{ position: 'absolute', left: 10, bottom: 8, right: 10, fontSize: 12, fontWeight: 700, color: '#A1A1A6', lineHeight: 1.35 }}>{b.foot}</span></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>{b.legend.map((l, i) => <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#C9C9CC' }}><span style={l.sw} />{l.label}</span>)}</div></>}
      {b.isKanban && <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(240px,1fr)', gap: 12, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'thin' }}>{b.cols.map((c, i) => <div key={i} onDragOver={c.over} onDrop={c.drop} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: '3px 11px 4px 10px', background: '#0E0E10', border: '1px solid #1F1F22', minWidth: 0, minHeight: 160 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={c.dot} /><span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800 }}>{c.label}</span><span style={{ fontSize: 13, fontWeight: 800, color: '#B4B4B9' }}>{c.count}</span></div>{c.items.map((it, j) => <button key={j} draggable onDragStart={it.ds} onClick={it.go} style={it.st}><span style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.25 }}>{it.t}</span><span style={{ fontSize: 13, color: '#B4B4B9', lineHeight: 1.35 }}>{it.sub}</span>{it.meta && <span style={it.metaSt}>{it.meta}</span>}</button>)}{c.empty && <span style={{ padding: '14px 4px', fontSize: 13, color: '#8A8A90', textAlign: 'center', border: '1px dashed #2A2A2E', borderRadius: '2px 8px 3px 7px' }}>Arraste um lead para cá</span>}</div>)}</div>}
      {b.isThread && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{b.items.map((m, i) => <div key={i} style={m.wrap}><div style={m.box}><div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center' }}><span style={{ fontSize: 13.5, fontWeight: 800 }}>{m.who}</span>{m.tag && <span style={m.tagSt}>{m.tag}</span>}<span style={{ fontSize: 12.5, color: '#B4B4B9' }}>{m.when}</span></div><div style={{ fontSize: 14.5, lineHeight: 1.5, color: '#F5F5F2', whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>{m.t}</div>{m.att && <span style={{ fontSize: 12.5, color: '#FBC009', fontWeight: 700 }}>{m.att}</span>}</div></div>)}{!b.items.length && b.empty && <div style={{ padding: '12px 0', fontSize: 14, color: '#A1A1A6' }}>{b.empty}</div>}</div>}
      {b.lista?.pager && <Paginador p={b.lista.pager} />}
      {b.isState && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '48px 16px', textAlign: 'center' }}><span style={b.iconSt}>{b.icon}</span><span style={{ fontSize: 19, fontWeight: 900 }}>{b.st1}</span><span style={{ fontSize: 14.5, color: '#B4B4B9', maxWidth: 460, lineHeight: 1.5 }}>{b.st2}</span>{b.hasNActs && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6 }}>{b.nacts.map((a, i) => <Btn key={i} a={a} />)}</div>}</div>}
    </div>
  )
}

function Menu({ v, compacto }) {
  return v.nav.map((g, i) => (
    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#FBC009', textTransform: 'uppercase', letterSpacing: '.08em', padding: '0 10px 6px' }}>{g.label}</div>
      {g.items.map((n, j) => <button key={j} onClick={n.go} style={n.st}>{n.icon}<span style={compacto ? { flex: 1, minWidth: 0 } : { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span></button>)}
    </div>
  ))
}

function App({ v }) {
  const I = v.I, m = v.modal
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#050506', backgroundImage: FUNDO }}>
      {v.showSide && <aside style={{ width: 268, flex: 'none', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', background: '#060607', borderRight: '1px solid #1A1A1D' }}>
        <button onClick={v.goHome} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '20px 18px 16px', background: 'none', border: 'none', color: '#F5F5F2', cursor: 'pointer', textAlign: 'left' }}><img src="/assets/addegas-logo-dark.png" alt="Addegas — Administração da Plataforma" style={{ display: 'block', width: 170, height: 'auto' }} /><span style={{ fontSize: 13, fontWeight: 900, color: '#FBC009', textTransform: 'uppercase', letterSpacing: '.26em', paddingLeft: 2 }}>{v.me.area}</span></button>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 12px 16px', display: 'flex', flexDirection: 'column', gap: 14, scrollbarWidth: 'thin' }}><Menu v={v} /></div>
        <div style={{ padding: 12, borderTop: '1px solid #1A1A1D', fontSize: 12.5, color: '#8A8A90', lineHeight: 1.4 }}>Perfil: <b style={{ color: '#F5F5F2' }}>{v.me.roleLabel}</b><br />Permissões validadas no servidor a cada ação.</div>
      </aside>}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10, padding: '10px clamp(12px,2vw,24px)', background: '#060607', borderBottom: '1px solid #1A1A1D', minHeight: 64 }}>
          {v.showBurger && <button onClick={v.openNav} title="Menu" style={{ width: 44, height: 44, flex: 'none', borderRadius: '2px 8px 3px 7px', border: '1px solid #2A2A2E', background: 'transparent', color: '#F5F5F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{I.menu}</button>}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0, maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 12px', borderRadius: '3px 10px 2px 9px', background: '#141416', border: '1px solid #2A2A2E', color: '#A1A1A6' }}>{I.search}<input value={v.gs.q} onChange={v.gs.on} onFocus={v.gs.open} placeholder="Buscar adega, responsável, fatura…" style={{ flex: 1, minWidth: 0, height: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#F5F5F2', fontSize: 15 }} /></div>
            {v.gs.show && <div style={{ position: 'absolute', left: 0, right: 0, top: 50, zIndex: 40, display: 'flex', flexDirection: 'column', padding: 6, borderRadius: '3px 11px 4px 10px', background: '#141416', border: '1px solid #2A2A2E', boxShadow: '0 20px 40px -12px rgba(0,0,0,.8)' }}>
              {v.gs.items.map((r, i) => <button key={i} onClick={r.go} className="h-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: 'none', borderRadius: '2px 7px 3px 6px', background: 'transparent', color: '#F5F5F2', textAlign: 'left', cursor: 'pointer' }}><span style={{ fontSize: 11, fontWeight: 800, color: '#0A0A0B', background: '#FBC009', borderRadius: '2px 5px 2px 4px', padding: '3px 6px', flex: 'none' }}>{r.kind}</span><span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 14.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.t}</span><span style={{ fontSize: 12.5, color: '#A1A1A6' }}>{r.s}</span></span></button>)}
              {v.gs.none && <div style={{ padding: 14, fontSize: 14, color: '#A1A1A6' }}>Nada encontrado para “{v.gs.q}”.</div>}
            </div>}
          </div>
          <div style={{ flex: 1 }} />
          {v.showPeriodSeg && <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: '3px 10px 2px 9px', background: '#141416', border: '1px solid #2A2A2E' }}>{v.periods.map((p) => <button key={p.k} onClick={p.go} style={p.st}>{p.label}</button>)}</div>}
          {v.showPeriodSel && <select value={v.period} onChange={v.onPeriod} style={{ height: 44, padding: '0 8px', borderRadius: '2px 8px 3px 7px', border: '1px solid #2A2A2E', background: '#141416', color: '#F5F5F2', fontSize: 14, fontWeight: 700 }}>{v.periods.map((p) => <option key={p.k} value={p.k}>{p.label}</option>)}</select>}
          <div style={{ position: 'relative', flex: 'none' }}>
            <button onClick={v.toggleNotif} title="Notificações" style={{ position: 'relative', width: 44, height: 44, borderRadius: '2px 8px 3px 7px', border: '1px solid #2A2A2E', background: 'transparent', color: '#F5F5F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{I.bell}{v.notifCount > 0 && <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: '#E5241B', color: '#FFFFFF', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{v.notifCount}</span>}</button>
            {v.notifOpen && <div style={{ position: 'absolute', right: 0, top: 52, zIndex: 40, width: 'min(360px,calc(100vw - 24px))', display: 'flex', flexDirection: 'column', padding: 6, borderRadius: '3px 11px 4px 10px', background: '#141416', border: '1px solid #2A2A2E', boxShadow: '0 20px 40px -12px rgba(0,0,0,.8)' }}>
              <div style={{ padding: '8px 10px', fontSize: 12, fontWeight: 800, color: '#8A8A90', textTransform: 'uppercase', letterSpacing: '.06em' }}>Notificações</div>
              {v.notifs.map((n, i) => <button key={i} onClick={n.go} className="h-item" style={{ display: 'flex', gap: 10, padding: 10, border: 'none', borderRadius: '2px 7px 3px 6px', background: 'transparent', color: '#F5F5F2', textAlign: 'left', cursor: 'pointer' }}><span style={n.dot} /><span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 14.5, fontWeight: 700 }}>{n.t}</span><span style={{ fontSize: 13, color: '#A1A1A6' }}>{n.s}</span></span></button>)}
              {v.notifEmpty && <div style={{ padding: 14, fontSize: 14, color: '#A1A1A6' }}>Tudo em dia.</div>}
            </div>}
          </div>
          <div style={{ position: 'relative', flex: 'none' }}>
            <button onClick={v.toggleProf} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 10px 0 4px', borderRadius: '3px 10px 2px 9px', border: '1px solid #2A2A2E', background: 'transparent', color: '#F5F5F2', cursor: 'pointer' }}><span style={{ width: 34, height: 34, borderRadius: '2px 8px 3px 7px', background: '#FBC009', color: '#0A0A0B', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{v.me.ini}</span>{v.showProfName && <span style={{ fontSize: 14, fontWeight: 700, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.me.first}</span>}</button>
            {v.profOpen && <div style={{ position: 'absolute', right: 0, top: 52, zIndex: 40, width: 'min(300px,calc(100vw - 24px))', display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: '3px 11px 4px 10px', background: '#141416', border: '1px solid #2A2A2E', boxShadow: '0 20px 40px -12px rgba(0,0,0,.8)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={{ fontSize: 16, fontWeight: 900 }}>{v.me.nome}</span><span style={{ fontSize: 13, color: '#A1A1A6' }}>{v.me.email}</span></div>
              <span style={{ alignSelf: 'flex-start', height: 26, padding: '0 9px', borderRadius: '2px 7px 3px 6px', background: '#FBC009', color: '#0A0A0B', fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center' }}>{v.me.roleLabel}</span>
              <div style={{ fontSize: 13, color: '#A1A1A6', lineHeight: 1.45 }}>Duas etapas ativa · sessão expira após 30 min sem uso. O perfil é definido pela conta e validado pelo servidor.</div>
              <button onClick={v.logout} style={{ height: 44, borderRadius: '2px 8px 3px 7px', border: 'none', background: '#E5241B', color: '#FFFFFF', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>{I.logout}Sair</button>
            </div>}
          </div>
        </header>
        <main style={{ flex: 1, padding: 'clamp(14px,2.4vw,28px)', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1480, width: '100%', margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px 16px' }}>
            <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {v.page.back && <button onClick={v.page.back} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, color: '#FBC009', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{I.back}{v.page.backLabel}</button>}
              <div style={{ fontSize: 'clamp(26px,3vw,36px)', fontWeight: 900, letterSpacing: '-.025em', lineHeight: 1.05 }}>{v.page.title}</div>
              {v.page.sub && <div style={{ fontSize: 15, color: '#B4B4B9', lineHeight: 1.45, textWrap: 'pretty' }}>{v.page.sub}</div>}
            </div>
            {v.page.hasActs && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{v.page.acts.map((a, i) => <Btn key={i} a={a} />)}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>{v.blocks.map((b, i) => <Bloco key={(b.title || b.type) + i} b={b} I={I} />)}</div>
        </main>
      </div>
      {v.navOpen && <div onClick={v.closeNav} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.7)' }}><div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 'min(300px,86vw)', background: '#060607', borderRight: '1px solid #1A1A1D', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16 }}><span style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 7 }}><img src="/assets/addegas-logo-dark.png" alt="Addegas — Administração da Plataforma" style={{ display: 'block', width: 150, height: 'auto' }} /><span style={{ fontSize: 12, fontWeight: 900, color: '#FBC009', textTransform: 'uppercase', letterSpacing: '.24em', paddingLeft: 2 }}>{v.me.area}</span></span><button onClick={v.closeNav} style={{ width: 40, height: 40, borderRadius: '2px 8px 3px 7px', border: '1px solid #2A2A2E', background: 'transparent', color: '#F5F5F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{I.x}</button></div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}><Menu v={v} compacto /></div>
      </div></div>}
      {m && <div onClick={v.closeModal} style={m.outer}><div onClick={(e) => e.stopPropagation()} style={m.box}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}><div style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-.01em' }}>{m.title}</div>{m.sub && <div style={{ fontSize: 14.5, color: '#B4B4B9', lineHeight: 1.45 }}>{m.sub}</div>}</div><button onClick={v.closeModal} style={{ width: 40, height: 40, flex: 'none', borderRadius: '2px 8px 3px 7px', border: '1px solid #2A2A2E', background: 'transparent', color: '#F5F5F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{I.x}</button></div>
        {m.hasFields && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,220px),1fr))', gap: 14 }}>{m.fields.map((f, i) => <Campo key={i} f={f} modal />)}</div>}
        {m.hasPrev && <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 14px', borderRadius: '3px 10px 2px 9px', background: '#0A0A0B', border: '1px solid #232327' }}><div style={{ padding: '10px 0 4px', fontSize: 12, fontWeight: 800, color: '#FBC009', textTransform: 'uppercase', letterSpacing: '.06em' }}>{m.prevTitle}</div>{m.prev.map((p, i) => <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', padding: '9px 0', borderTop: '1px solid #1C1C1F' }}><span style={{ flex: '1 1 140px', fontSize: 14, color: '#B4B4B9' }}>{p.k}</span><span style={{ ...p.st, overflowWrap: 'anywhere' }}>{p.v}</span></div>)}</div>}
        {m.notes.map((n, i) => <div key={i} style={n.st}><span style={{ flex: 'none', color: n.c }}>{I.alert}</span><span>{n.t}</span></div>)}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}><button onClick={v.closeModal} style={{ height: 46, padding: '0 18px', borderRadius: '2px 8px 3px 7px', border: '1px solid #3A3A40', background: 'transparent', color: '#F5F5F2', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>{m.cancelLabel}</button>{m.ok && <button onClick={m.ok} style={m.okSt}>{m.okLabel}</button>}</div>
      </div></div>}
      {v.toast && <Toast t={v.toast} />}
    </div>
  )
}

const Toast = ({ t }) => <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 70, maxWidth: 'calc(100vw - 24px)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: '3px 11px 4px 10px', background: '#F5F5F2', color: '#0A0A0B', fontSize: 14.5, fontWeight: 700, boxShadow: '0 20px 40px -10px rgba(0,0,0,.8)' }}><span style={t.dot} /><span>{t.t}</span></div>

export function Desenho({ v }) {
  return v.isAuth ? <><Auth au={v.au} />{v.toast && <Toast t={v.toast} />}</> : <App v={v} />
}
