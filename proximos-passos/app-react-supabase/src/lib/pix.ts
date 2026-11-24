/**
 * BR Code estático do Pix (D15): o mesmo texto do "Pix copia e cola", no padrão EMV do Banco Central,
 * montado no navegador com o valor da venda. Não passa por servidor e não confirma sozinho.
 */
const campo = (id: string, valor: string) => id + String(valor.length).padStart(2, '0') + valor

/** O padrão aceita só ASCII; nome até 25 e cidade até 15 caracteres. */
const ascii = (s: string, max: number) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .,-]/g, '').toUpperCase().trim().slice(0, max)

function crc16(s: string) {
  let crc = 0xffff
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export type PixConfig = { key: string; name: string; city: string }

/** valor em centavos; txid: até 25 letras ou números (o identificador que aparece no extrato). */
export function brCode(pix: PixConfig, centavos: number, txid: string) {
  const payload =
    campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', pix.key.trim())) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', (centavos / 100).toFixed(2)) +
    campo('58', 'BR') +
    campo('59', ascii(pix.name, 25) || 'ADEGA') +
    campo('60', ascii(pix.city, 15) || 'BRASIL') +
    campo('62', campo('05', txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***')) +
    '6304'
  return payload + crc16(payload)
}
