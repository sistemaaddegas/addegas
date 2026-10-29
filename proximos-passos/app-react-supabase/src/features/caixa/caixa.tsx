import { useAuth } from '@/lib/auth'
import { useOperador } from './dados'
import { Pdv } from './pdv'
import { Pin } from './pin'
import { SemTerminal } from './sem-terminal'

/** Caixa (E09, E10, E19, E20): aparelho registrado → operador com PIN → abrir, vender e fechar. */
export function Caixa() {
  const { terminal } = useAuth()
  const [op, setOp] = useOperador(terminal?.id)
  if (!terminal) return <SemTerminal />
  if (!op) return <Pin onEntrar={setOp} />
  return <Pdv key={op.sessionId} op={op} onTrocar={() => setOp(null)} />
}
