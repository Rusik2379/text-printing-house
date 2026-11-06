import { open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
const table = Array.from({ length: 256 }, (_, i) => {
  for (let k = 0; k < 8; k++) i = i & 1 ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
  return i >>> 0;
});
export async function createZip(target, files) {
  const out = await open(target, 'wx', 0o600);
  let offset = 0;
  const entries = [];
  const write = async (bytes) => {
    let n = 0;
    while (n < bytes.length) {
      const r = await out.write(bytes, n, bytes.length - n, offset);
      n += r.bytesWritten;
      offset += r.bytesWritten;
    }
  };
  try {
    for (const file of files) {
      const name = Buffer.from(file.name, 'utf8'),
        start = offset,
        h = Buffer.alloc(30);
      h.writeUInt32LE(0x04034b50);
      h.writeUInt16LE(20, 4);
      h.writeUInt16LE(0x808, 6);
      h.writeUInt16LE(33, 12);
      h.writeUInt16LE(name.length, 26);
      await write(h);
      await write(name);
      let crc = 0xffffffff,
        size = 0;
      for await (const chunk of createReadStream(file.path)) {
        for (const b of chunk) crc = table[(crc ^ b) & 255] ^ (crc >>> 8);
        size += chunk.length;
        await write(chunk);
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      const d = Buffer.alloc(16);
      d.writeUInt32LE(0x08074b50);
      d.writeUInt32LE(crc, 4);
      d.writeUInt32LE(size, 8);
      d.writeUInt32LE(size, 12);
      await write(d);
      entries.push({ name, start, size, crc });
    }
    const central = offset;
    for (const e of entries) {
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50);
      h.writeUInt16LE(20, 4);
      h.writeUInt16LE(20, 6);
      h.writeUInt16LE(0x808, 8);
      h.writeUInt16LE(33, 14);
      h.writeUInt32LE(e.crc, 16);
      h.writeUInt32LE(e.size, 20);
      h.writeUInt32LE(e.size, 24);
      h.writeUInt16LE(e.name.length, 28);
      h.writeUInt32LE(e.start, 42);
      await write(h);
      await write(e.name);
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(offset - central, 12);
    end.writeUInt32LE(central, 16);
    await write(end);
    await out.sync();
  } finally {
    await out.close();
  }
}
