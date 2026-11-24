import { useEffect, useRef } from 'react'
import { useInstall } from './install-provider'

/**
 * Passo a passo de instalação no iPhone e no iPad (E54), onde o Safari não oferece instalação automática.
 * Instalar importa também para o caixa: o Safari apaga dados de site não usado por 7 dias se o app não
 * estiver na tela inicial, e as anotações do modo contingência ficam no aparelho.
 */
const STEPS = [
  { n: 1, text: 'Toque em Compartilhar', hint: 'o quadrado com a seta para cima, na barra do Safari' },
  { n: 2, text: 'Escolha "Adicionar à Tela de Início"', hint: 'role a lista de opções se não aparecer de cara' },
  { n: 3, text: 'Toque em "Adicionar"', hint: 'o Addegas aparece na tela inicial, como um app' },
]

export function IosInstallTutorial() {
  const { iosTutorialOpen, closeIosTutorial } = useInstall()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (iosTutorialOpen && !dialog.open) dialog.showModal()
    if (!iosTutorialOpen && dialog.open) dialog.close()
  }, [iosTutorialOpen])

  return (
    <dialog ref={dialogRef} onClose={closeIosTutorial}
      className="m-auto w-[min(92vw,420px)] rounded-3xl border border-[#2A2A2E] bg-[#141416] p-6 text-[#F5F5F2] backdrop:bg-black/70">
      <h2 className="display text-[24px] font-extrabold">Instalar no iPhone</h2>
      <ol className="mt-5 space-y-4">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FBC009] font-extrabold text-[#0A0A0B]">{s.n}</span>
            <div>
              <p className="text-[15px] font-bold">{s.text}</p>
              <p className="text-[13px] text-[#A1A1A6]">{s.hint}</p>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={closeIosTutorial}
        className="mt-6 h-12 w-full rounded-[3px_10px_2px_9px] bg-[#FBC009] text-[15px] font-extrabold text-[#0A0A0B]">
        Entendi
      </button>
    </dialog>
  )
}
