// Ícones do protótipo (Addegas.dc.html, IC): traços em 24×24; "c:x,y,r" vira círculo.
const IC = {
  check: ['M20 6 9 17l-5-5'],
  chev: ['m9 18 6-6-6-6'],
  plus: ['M12 5v14', 'M5 12h14'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  cart: ['M3 3h2l2.4 12.2a2 2 0 0 0 2 1.8h8.9a2 2 0 0 0 2-1.6L22 7H6', 'c:9,21,1', 'c:19,21,1'],
  wallet: ['M3 7h18v13H3z', 'M3 7l3-4h12l3 4', 'M16 13.5h.01'],
  down: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
  tag: ['M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4z', 'M7 7h.01'],
  alert: ['m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z', 'M12 9v4', 'M12 17h.01'],
  cal: ['M3 5h18v16H3z', 'M16 3v4', 'M8 3v4', 'M3 10h18'],
  clock: ['c:12,12,10', 'M12 6v6l4 2'],
  chat: ['M7.9 20A9 9 0 1 0 4 16.1L2 22z'],
  search: ['c:11,11,8', 'm21 21-4.3-4.3'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  minus: ['M5 12h14'],
  qr: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M20 14v.01', 'M14 20h.01', 'M17 17h4v4'],
  cash: ['M2 6h20v12H2z', 'c:12,12,3'],
  card: ['M2 5h20v14H2z', 'M2 10h20'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z', 'M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5'],
  user: ['c:12,8,4', 'M4 21a8 8 0 0 1 16 0'],
  store: ['M3 9h18l-2-6H5z', 'M5 9v12h14V9', 'M9 21v-6h6v6'],
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
