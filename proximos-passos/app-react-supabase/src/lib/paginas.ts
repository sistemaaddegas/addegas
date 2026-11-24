// Paginação padrão de toda listagem (app e painel): quantos por página e os números das páginas.

export const POR_PAGINA = [5, 10, 15, 20, 50, 100] as const
export const POR_PADRAO = 10

/** Números a mostrar: primeira, última e as vizinhas da atual; o resto vira "…". Página começa em 0. */
export function numerosPagina(atual: number, paginas: number): (number | '…')[] {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i)
  const meio = [atual - 1, atual, atual + 1].filter((i) => i > 0 && i < paginas - 1)
  if (atual <= 2) meio.push(1, 2, 3)
  if (atual >= paginas - 3) meio.push(paginas - 4, paginas - 3, paginas - 2)
  const vistos = [...new Set([0, ...meio, paginas - 1])].sort((a, b) => a - b)
  return vistos.flatMap((i, k) => (k > 0 && i - vistos[k - 1] > 1 ? ['…' as const, i] : [i]))
}
