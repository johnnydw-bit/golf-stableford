// Generates public/icon-192.png and public/icon-512.png — run with: node generate-icons.mjs
import zlib from 'zlib'
import fs from 'fs'

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0)
  const crcB = Buffer.allocUnsafe(4); crcB.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crcB])
}

function makePNG(size) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10])
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0

  const rows = []
  const cx = size / 2
  const ballCY = size * 0.38
  const ballR  = size * 0.21
  const poleW  = Math.max(2, Math.round(size * 0.025))
  const poleTop = ballCY + ballR * 0.7
  const poleBot = size * 0.80
  const flagH   = size * 0.12
  const flagW   = size * 0.18

  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3); row[0] = 0
    for (let x = 0; x < size; x++) {
      let r = 22, g = 101, b = 52  // green background

      // Golf ball (white circle)
      const dx = x - cx, dy = y - ballCY
      if (dx*dx + dy*dy < ballR*ballR) { r=255; g=255; b=255 }
      // Flag pole
      else if (x >= cx - poleW/2 && x <= cx + poleW/2 && y > poleTop && y < poleBot) {
        r=255; g=255; b=255
      }
      // Flag (red triangle to the right of pole top)
      else if (y >= poleTop && y < poleTop + flagH && x > cx + poleW/2 && x < cx + poleW/2 + flagW * (1 - (y - poleTop)/flagH)) {
        r=220; g=38; b=38
      }

      row[1 + x*3] = r; row[2 + x*3] = g; row[3 + x*3] = b
    }
    rows.push(row)
  }

  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

for (const size of [192, 512]) {
  fs.writeFileSync(`public/icon-${size}.png`, makePNG(size))
  console.log(`✓ public/icon-${size}.png`)
}
