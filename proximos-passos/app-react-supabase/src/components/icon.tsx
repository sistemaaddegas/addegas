// Ícones do protótipo (Addegas.dc.html, IC): traços em 24×24; "c:x,y,r" vira círculo.
const IC = {
  check: ['M20 6 9 17l-5-5'],
  chev: ['m9 18 6-6-6-6'],
  plus: ['M12 5v14', 'M5 12h14'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
} satisfies Record<string, string[]>

export type IconName = keyof typeof IC

export function Icon({ name, size = 20, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className="block flex-none" aria-hidden="true">
      {IC[name].map((d, i) => {
        if (!d.startsWith('c:')) return <path key={i} d={d} />
        const [cx, cy, r] = d.slice(2).split(',')
        return <circle key={i} cx={cx} cy={cy} r={r} />
      })}
    </svg>
  )
}
