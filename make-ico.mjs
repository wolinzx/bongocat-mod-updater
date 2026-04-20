import { readFileSync, writeFileSync } from 'fs'

const png = readFileSync('./resources/icon256.png')
const header = Buffer.from([0,0, 1,0, 1,0])
const entry = Buffer.alloc(16)
entry[0] = 0; entry[1] = 0; entry[2] = 0; entry[3] = 0
entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(png.length, 8)
entry.writeUInt32LE(22, 12)
const ico = Buffer.concat([header, entry, png])
writeFileSync('./resources/icon.ico', ico)
console.log('ICO written:', ico.length, 'bytes, w:', ico[6] || 256)
