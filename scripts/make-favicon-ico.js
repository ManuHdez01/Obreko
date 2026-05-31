// One-shot: build /favicon.ico (16, 32, 48) from /favicon.svg using sharp.
// ICO format is built manually (ICONDIR + ICONDIRENTRY[] + PNG data).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

(async () => {
  const root = path.join(__dirname, '..');
  const svg = fs.readFileSync(path.join(root, 'favicon.svg'));
  const sizes = [16, 32, 48];

  const pngs = [];
  for (const s of sizes) {
    const buf = await sharp(svg).resize(s, s).png().toBuffer();
    pngs.push({ size: s, buf });
  }

  const n = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type = icon
  header.writeUInt16LE(n, 4);      // count

  const entries = Buffer.alloc(16 * n);
  let offset = 6 + 16 * n;
  for (let i = 0; i < n; i++) {
    const { size, buf } = pngs[i];
    const e = entries.subarray(i * 16, (i + 1) * 16);
    e.writeUInt8(size === 256 ? 0 : size, 0); // width
    e.writeUInt8(size === 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2);                       // palette
    e.writeUInt8(0, 3);                       // reserved
    e.writeUInt16LE(1, 4);                    // planes
    e.writeUInt16LE(32, 6);                   // bpp
    e.writeUInt32LE(buf.length, 8);           // size of image data
    e.writeUInt32LE(offset, 12);              // offset
    offset += buf.length;
  }

  const out = Buffer.concat([header, entries, ...pngs.map(p => p.buf)]);
  fs.writeFileSync(path.join(root, 'favicon.ico'), out);
  console.log('wrote favicon.ico ' + out.length + ' bytes (' + sizes.join('/') + ')');
})();
