import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { mensagem } from '@/lib/erros'
import { useToast } from '@/components/toast'
import { AuthLayout, Field, Title, btnPrimary, btnText } from './layout'

/** Primeiro acesso com senha provisória (E07) ou link de "Esqueci minha senha". */
export function NovaSenha() {
  const { passwordChanged, signOut } = useAuth()
  const [senha, setSenha] = useState('')
  const [repete, setRepete] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (senha.length < 8 || !/\d/.test(senha) || !/[a-z]/i.test(senha)) return toast(mensagem('PASSWORD_WEAK'))
    if (senha !== repete) return toast(mensagem('PASSWORD_MISMATCH'))
    setBusy(true)
    // Trocar a senha já tira a pendência: o banco compara com o hash da provisória.
    const { error } = await supabase.auth.updateUser({ password: senha })
    setBusy(false)
    if (error) {
      return toast(mensagem(error.code === 'same_password' ? 'PASSWORD_SAME' : error.code === 'weak_password' ? 'PASSWORD_WEAK' : 'AUTH_ERROR'))
    }
    passwordChanged() // as rotas levam para a escolha da loja
    toast('Senha criada')
  }

  return (
    <AuthLayout>
      <form onSubmit={salvar} className="contents">
        <Title sub="Antes de continuar, escolha uma senha só sua, com pelo menos 8 caracteres.">Crie sua senha</Title>
        <Field label="Nova senha" value={senha} onChange={(e) => setSenha(e.target.value)} type="password" autoComplete="new-password" />
        <Field label="Repita a senha" value={repete} onChange={(e) => setRepete(e.target.value)} type="password" autoComplete="new-password" />
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Salvando…' : 'Salvar e continuar'}</button>
        <button type="button" onClick={signOut} className={btnText}>Sair</button>
      </form>
    </AuthLayout>
  )
}
