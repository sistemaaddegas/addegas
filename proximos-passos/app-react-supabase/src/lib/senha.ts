/**
 * Regra de senha da tela, a mesma do Auth (supabase/config.toml: minimum_password_length = 8 e
 * password_requirements = "letters_digits"). O painel da equipe pede mais: 10 caracteres.
 */
export const senhaForte = (senha: string, minimo = 8) => senha.length >= minimo && /\d/.test(senha) && /[a-z]/i.test(senha)
