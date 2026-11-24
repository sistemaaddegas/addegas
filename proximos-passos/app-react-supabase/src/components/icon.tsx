// Ícones do protótipo (Addegas.dc.html, IC): traços em 24×24; "c:x,y,r" vira círculo.
const IC = {
  calc: ['M5 3h14v18H5z', 'M8 7h8', 'M8 12h.01', 'M12 12h.01', 'M16 12h.01', 'M8 16h.01', 'M12 16h.01', 'M16 16h.01'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'c:12,12,3'],
  eyeOff: ['M3 3l18 18', 'M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4', 'M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  star: ['m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z'],
  grip: ['c:9,6,1', 'c:15,6,1', 'c:9,12,1', 'c:15,12,1', 'c:9,18,1', 'c:15,18,1'],
  help: ['c:12,12,10', 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3', 'M12 17h.01'],
  img: ['M3 5h18v14H3z', 'c:8.5,10,1.5', 'm21 15-5-5L5 19'],
  send: ['m22 2-7 20-4-9-9-4z', 'M22 2 11 13'],
  home: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  cart: ['M3 3h2l2.4 12.2a2 2 0 0 0 2 1.8h8.9a2 2 0 0 0 2-1.6L22 7H6', 'c:9,21,1', 'c:19,21,1'],
  bag: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  box: ['M21 8 12 3 3 8v8l9 5 9-5z', 'm3 8 9 5 9-5', 'M12 13v8'],
  layers: ['M12 2 2 7l10 5 10-5z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  chart: ['M3 3v18h18', 'M7 16v-4', 'M12 16V8', 'M17 16v-7'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'c:9,7,4', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  chat: ['M7.9 20A9 9 0 1 0 4 16.1L2 22z'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  search: ['c:11,11,8', 'm21 21-4.3-4.3'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  alert: ['m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z', 'M12 9v4', 'M12 17h.01'],
  check: ['M20 6 9 17l-5-5'],
  clock: ['c:12,12,10', 'M12 6v6l4 2'],
  scan: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M8 7v10', 'M12 7v10', 'M16 7v10'],
  chev: ['m9 18 6-6-6-6'],
  chevDown: ['m6 9 6 6 6-6'],
  down: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
  cal: ['M3 5h18v16H3z', 'M16 3v4', 'M8 3v4', 'M3 10h18'],
  wallet: ['M3 7h18v13H3z', 'M3 7l3-4h12l3 4', 'M16 13.5h.01'],
  qr: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M20 14v.01', 'M14 20h.01', 'M17 17h4v4'],
  cash: ['M2 6h20v12H2z', 'c:12,12,3'],
  card: ['M2 5h20v14H2z', 'M2 10h20'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z', 'M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5'],
  truck: ['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7z', 'c:5.5,18.5,2.5', 'c:18.5,18.5,2.5'],
  user: ['c:12,8,4', 'M4 21a8 8 0 0 1 16 0'],
  tag: ['M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4z', 'M7 7h.01'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  copy: ['M8 8h13v13H8z', 'M4 16H3V3h13v1'],
  store: ['M3 9h18l-2-6H5z', 'M5 9v12h14V9', 'M9 21v-6h6v6'],
  receipt: ['M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2z', 'M9 7h6', 'M9 11h6', 'M9 15h4'],
  note: ['M4 3h16v12l-6 6H4z', 'M14 21v-6h6', 'M8 8h8', 'M8 12h5'],
  glass: ['M5 3h14l-2 18H7z', 'M6 9h12'],
  pen: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  chevL: ['m15 18-6-6 6-6'],
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
