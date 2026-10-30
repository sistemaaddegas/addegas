import { useAuth } from '@/lib/auth'
import { useOperador } from './dados'
import { Pdv } from './pdv'
import { EscolherOperador } from './operador'
import { SemTerminal } from './sem-terminal'

/** Caixa (E09, E10, E19, E20): aparelho registrado → quem vai operar → abrir, vender e fechar. */
export function Caixa() {
  const { terminal } = useAuth()
  const [op, setOp] = useOperador(terminal?.id)
  if (!terminal) return <SemTerminal />
  if (!op) return <EscolherOperador onEntrar={setOp} />
  return <Pdv key={op.sessionId} op={op} onTrocar={() => setOp(null)} />
}
