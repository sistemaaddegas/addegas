import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { SLUG_KEY } from '@/lib/auth'
import { mensagem } from '@/lib/erros'
import { useToast } from '@/components/toast'
import { AuthLayout, Field, btnOutline, btnPrimary, btnText } from './layout'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * E-mail real, ou usuário de quem não tem e-mail (E07): "diego@adega-esquina", ou só "diego"
 * quando o aparelho já entrou nessa loja. O front completa o e-mail técnico antes do Auth.
 */
function loginEmail(value: string): string | null {
  const v = value.trim().toLowerCase()
  if (EMAIL.test(v)) return v
  const [user, slug = localStorage.getItem(SLUG_KEY)] = v.split('@')
  if (!user || !slug || !/^[a-z0-9-]+$/.test(slug)) return null
  return `${user}@u.${slug}.addegas.invalid`
}

function authCode(e: AuthError) {
  if (e.code === 'invalid_credentials') return 'LOGIN_INVALID'
  if (e.code === 'email_not_confirmed') return 'EMAIL_NOT_CONFIRMED'
  if (e.status === 429 || e.code?.startsWith('over_')) return 'RATE_LIMITED'
  return 'AUTH_ERROR'
}

export function Entrar() {
  const [mode, setMode] = useState<'login' | 'rec' | 'sent'>('login')
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const doLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!login.trim()) return toast('Informe seu e-mail ou usuário')
    const email = loginEmail(login)
    if (!email) return toast(mensagem('LOGIN_NEEDS_STORE'))
    if (!senha) return toast('Informe a senha')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setBusy(false)
    if (error) toast(mensagem(authCode(error))) // com sucesso, as rotas levam para a próxima etapa
  }

  const doRec = async (e: FormEvent) => {
    e.preventDefault()
    const email = login.trim().toLowerCase()
    if (!EMAIL.test(email)) {
      return toast(email && !email.includes('.') ? 'Quem entra com usuário pede a nova senha ao dono da adega' : 'Informe um e-mail válido')
    }
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/nova-senha` })
    setBusy(false)
    // Não conta se o e-mail existe: só o limite de envios aparece como erro.
    if (error && authCode(error) === 'RATE_LIMITED') return toast(mensagem('RATE_LIMITED'))
    setMode('sent')
  }

  return (
    <AuthLayout>
      {mode === 'login' && (
        <form onSubmit={doLogin} className="contents">
          <div className="flex flex-col gap-1.5 mb-1">
            <div className="text-4xl font-black uppercase leading-none tracking-[-0.02em]" style={{ fontStretch: '100%' }}>
              Gelo no copo, <span className="text-brand">caixa aberto.</span>
            </div>
            <div className="text-[15px] text-[#C4C4C9]">Tudo pronto para começar.</div>
          </div>
          <Field label="E-mail ou usuário" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
          <Field label="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} type="password" autoComplete="current-password" placeholder="••••••••" />
          <button type="submit" disabled={busy} className={`${btnPrimary} mt-1`}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <button type="button" onClick={() => setMode('rec')} className="self-start -mt-1 p-0 bg-transparent text-brand text-sm font-bold cursor-pointer">Esqueci minha senha</button>
          <button type="button" onClick={() => toast('No caixa, cada pessoa entra com o PIN de 4 dígitos')} className={btnOutline}>Entrar no caixa com PIN</button>
          <div className="flex justify-center gap-1.5 text-sm text-[#C4C4C9] mt-2">
            Ainda não usa?<Link to="/cadastro" className="text-brand font-bold">Cadastrar minha adega</Link>
          </div>
        </form>
      )}
      {mode === 'rec' && (
        <form onSubmit={doRec} className="contents">
          <div className="flex flex-col gap-1.5 mb-1">
            <div className="text-[30px] font-black uppercase leading-none tracking-[-0.01em]" style={{ fontStretch: '100%' }}>Esqueceu a senha?</div>
            <div className="text-[15px] text-[#C4C4C9] leading-[1.45]">Sem estresse. Mandamos um link pra criar uma nova no seu e-mail.</div>
          </div>
          <Field label="E-mail" value={login} onChange={(e) => setLogin(e.target.value)} type="email" autoComplete="email" />
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Enviando…' : 'Enviar link'}</button>
          <button type="button" onClick={() => setMode('login')} className={btnText}>Voltar ao login</button>
        </form>
      )}
      {mode === 'sent' && (
        <>
          <div className="flex flex-col gap-2.5 p-[18px] rounded-[4px_13px_5px_11px] bg-[#0D1A0F] border border-[#16C60C]">
            <div className="text-xl font-black">Link enviado!</div>
            <div className="text-[15px] text-[#D4D4D8] leading-normal">Se {login.trim()} tiver cadastro, o link chega em alguns minutos e vale por 1 hora. Confira também o spam.</div>
          </div>
          <button type="button" onClick={() => setMode('login')} className={`${btnOutline} h-[54px] font-extrabold`}>Voltar ao login</button>
        </>
      )}
    </AuthLayout>
  )
}
