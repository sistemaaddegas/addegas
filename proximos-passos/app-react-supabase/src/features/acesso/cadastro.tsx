import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, rpc } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { mensagem } from '@/lib/erros'
import { senhaForte } from '@/lib/senha'
import { useToast } from '@/components/toast'
import { chip, chipCls } from '@/lib/visual'
import { AuthLayout, Field, btnPrimary, btnText } from './layout'
import { useMyStores } from './lojas'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * E06 · Cadastro do dono em 3 passos, como no protótipo: conta (e-mail e senha, com confirmação),
 * dados da adega e preferências. Quem já é dono e volta aqui cadastra uma loja a mais (E08).
 */
export function Cadastro() {
  const { session, loading } = useAuth()
  if (loading) return null
  return session ? <Onboarding /> : <Conta />
}

function Conta() {
  const toast = useToast()
  const [f, setF] = useState({ nome: '', email: '', senha: '' })
  const [enviado, setEnviado] = useState(false)
  const [busy, setBusy] = useState(false)

  const criar = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.nome.trim()) return toast('Informe seu nome')
    if (!EMAIL.test(f.email.trim())) return toast('Informe um e-mail válido')
    if (!senhaForte(f.senha)) return toast('A senha precisa de 8 caracteres, com letras e números')
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email: f.email.trim().toLowerCase(), password: f.senha,
      options: { emailRedirectTo: `${location.origin}/cadastro`, data: { full_name: f.nome.trim() } },
    })
    setBusy(false)
    if (error) return toast(error.status === 429 ? mensagem('RATE_LIMITED') : error.message.includes('registered') ? 'Esse e-mail já tem cadastro. Entre pelo login.' : mensagem('AUTH_ERROR'))
    setEnviado(true)
  }

  if (enviado) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-2.5 p-[18px] rounded-[4px_13px_5px_11px] bg-[#0D1A0F] border border-[#16C60C]">
          <div className="text-xl font-black">Confirme seu e-mail</div>
          <div className="text-[15px] text-[#D4D4D8] leading-normal">Mandamos um link para {f.email.trim()}. Abra o link neste aparelho para continuar o cadastro da adega. Confira também o spam.</div>
        </div>
        <Link to="/entrar" className={`${btnText}`}>Voltar ao login</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form onSubmit={criar} className="contents">
        <div className="text-[30px] font-black uppercase leading-none tracking-[-0.01em]" style={{ fontStretch: '100%' }}>Cadastrar minha adega</div>
        <div className="text-[15px] text-[#C4C4C9] -mt-1">14 dias grátis, sem cartão.</div>
        <Field label="Seu nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoComplete="name" />
        <Field label="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} type="email" autoComplete="email" autoCapitalize="none" />
        <Field label="Senha" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} type="password" autoComplete="new-password" placeholder="8 ou mais, com letras e números" />
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Criando…' : 'Continuar'}</button>
        <div className="flex justify-center gap-1.5 text-sm text-[#C4C4C9]">Já usa?<Link to="/entrar" className="text-brand font-bold">Entrar</Link></div>
      </form>
    </AuthLayout>
  )
}

function Passos({ atual }: { atual: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-extrabold text-[#ADADB4] uppercase tracking-[.08em]">Passo {atual + 1} de 3</div>
      <div className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="flex-1 h-1.5 rounded-full" style={{ background: i <= atual ? '#FBC009' : '#2A2A2E' }} />)}</div>
    </div>
  )
}

const PRODUTOS = [
  ['catalogo', 'Começar com catálogo pronto', 'Bebidas com foto, código de barras e categoria. Você ajusta preço e estoque.'],
  ['planilha', 'Importar planilha', 'Mandamos um modelo com nome, código, preço e estoque, e a equipe ajuda a subir.'],
  ['depois', 'Cadastrar depois', 'Começa vazio e você cadastra pelo leitor, produto por produto.'],
] as const
const APPS = ['iFood', 'Zé Delivery', '99Food', 'Keeta']

function Onboarding() {
  const { session, setStoreId, signOut } = useAuth()
  const { data: lojas } = useMyStores()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const dono = lojas?.find((l) => l.role === 'owner')
  const [passo, setPasso] = useState(1)
  const [f, setF] = useState({ nome: '', bairro: '', wa: '', produtos: 'catalogo', apps: [] as string[] })
  const [busy, setBusy] = useState(false)

  const concluir = async () => {
    setBusy(true)
    try {
      const [bairro, ...resto] = f.bairro.split(',').map((x) => x.trim())
      const cidade = resto.join(', ') || null
      const wa = f.wa.replace(/\D/g, '') || null
      const r = dono
        ? await rpc<{ store_id: string; slug?: string }>('create_store', { p_account_id: dono.account_id, p_name: f.nome.trim(), p_neighborhood: bairro || null, p_city: cidade, p_whatsapp: wa })
        : await rpc<{ store_id: string }>('complete_onboarding', {
          p_store_name: f.nome.trim(), p_neighborhood: bairro || null, p_city: cidade, p_whatsapp: wa,
          p_owner_name: (session?.user.user_metadata?.full_name as string | undefined) ?? null,
          p_origin: { produtos: f.produtos, apps: f.apps },
        })
      await qc.invalidateQueries({ queryKey: ['my_stores'] })
      setStoreId(r.store_id)
      toast(dono ? `${f.nome.trim()} criada` : 'Tudo pronto! Seu teste grátis de 14 dias começou.')
      navigate(f.produtos === 'depois' || dono ? '/' : f.produtos === 'catalogo' ? '/estoque?catalogo=1' : '/estoque', { replace: true })
    } catch (e) {
      toast((e as Error).message)
      setBusy(false)
    }
  }

  const avancar = () => {
    if (passo === 1 && f.nome.trim().length < 2) return toast(mensagem('ONBOARDING_STORE_NAME'))
    if (passo === 1 && dono) return concluir() // loja a mais: só os dados dela
    if (passo < 3) return setPasso(passo + 1)
    void concluir()
  }

  return (
    <AuthLayout>
      {!dono && <Passos atual={passo - 1} />}
      {passo === 1 && (
        <>
          <div className="text-2xl font-black" style={{ fontStretch: '100%' }}>{dono ? 'Nova loja' : 'Dados da adega'}</div>
          <Field label={dono ? 'Nome da loja' : 'Nome da adega'} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Adega Esquina" autoFocus />
          <Field label="Bairro e cidade" value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })} placeholder="Ex.: Vila Madalena, São Paulo" />
          <Field label="WhatsApp do dono (recebe os alertas)" value={f.wa} onChange={(e) => setF({ ...f, wa: e.target.value })} inputMode="tel" placeholder="(11) 90000-0000" />
        </>
      )}
      {passo === 2 && (
        <>
          <div className="text-2xl font-black" style={{ fontStretch: '100%' }}>Como começar os produtos</div>
          {PRODUTOS.map(([id, t, d]) => (
            <button key={id} onClick={() => setF({ ...f, produtos: id })} className="flex flex-col gap-1 p-4 rounded-[3px_11px_4px_10px] border text-left cursor-pointer"
              style={{ borderColor: f.produtos === id ? '#FBC009' : '#2A2A2E', background: f.produtos === id ? 'rgba(251,192,9,.08)' : 'transparent' }}>
              <span className="text-base font-extrabold">{t}</span><span className="text-sm text-[#C4C4C9]">{d}</span>
            </button>
          ))}
        </>
      )}
      {passo === 3 && (
        <>
          <div className="text-2xl font-black" style={{ fontStretch: '100%' }}>Apps de delivery</div>
          <div className="text-sm text-[#C4C4C9] -mt-1">Marque os que você usa. Os pedidos dos apps conectados entram direto em Pedidos. Dá para mudar depois em Ajustes.</div>
          <div className="flex flex-wrap gap-2">
            {APPS.map((a, k) => <button key={a} onClick={() => setF({ ...f, apps: f.apps.includes(a) ? f.apps.filter((x) => x !== a) : [...f.apps, a] })} className={chipCls} style={chip(f.apps.includes(a), k)}>{a}</button>)}
          </div>
        </>
      )}
      <div className="flex gap-2.5">
        <button onClick={() => (passo > 1 ? setPasso(passo - 1) : dono ? navigate('/lojas') : signOut())} className="h-[58px] px-5 rounded-[3px_11px_4px_10px] border border-line-2 bg-transparent font-bold cursor-pointer">Voltar</button>
        <button onClick={avancar} disabled={busy} className={`${btnPrimary} flex-1`}>{busy ? 'Criando…' : dono ? 'Criar loja' : passo < 3 ? 'Continuar' : 'Concluir e abrir o sistema'}</button>
      </div>
    </AuthLayout>
  )
}
