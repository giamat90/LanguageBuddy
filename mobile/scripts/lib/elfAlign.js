/**
 * 16 KB page-size verification (TASK-026).
 *
 * Google Play requires the 64-bit native libraries of an app that targets Android 15+ to be
 * built for 16 KB pages: every PT_LOAD segment must have p_align >= 16384, and in an .apk the
 * uncompressed .so files must start on a 16 KB boundary. 32-bit ABIs are exempt.
 * No dependencies: a minimal zip reader (central directory) and an ELF64 header reader.
 */
const fs = require('fs');
const zlib = require('zlib');

const PAGE = 16384;
const PT_LOAD = 1;
const ABIS_64 = ['arm64-v8a', 'x86_64'];

/** Smallest p_align over all PT_LOAD program headers of an ELF64 little-endian image. */
function minLoadAlign(elf) {
  if (elf.length < 64 || elf.readUInt32BE(0) !== 0x7f454c46) throw new Error('not an ELF file');
  if (elf[4] !== 2 || elf[5] !== 1) throw new Error('unsupported ELF class');
  const phoff = Number(elf.readBigUInt64LE(32));
  const phentsize = elf.readUInt16LE(54);
  const phnum = elf.readUInt16LE(56);
  let min = Infinity;
  for (let i = 0; i < phnum; i++) {
    const o = phoff + i * phentsize;
    if (o + 56 > elf.length) throw new Error('truncated ELF file');
    if (elf.readUInt32LE(o) === PT_LOAD) min = Math.min(min, Number(elf.readBigUInt64LE(o + 48)));
  }
  return min === Infinity ? 0 : min;
}

function isSixteenKbReady(elf) {
  return minLoadAlign(elf) >= PAGE;
}

/** Entries of a zip: { name, method, compSize, dataOffset }. */
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt zip directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    entries.push({ name, method, compSize, dataOffset: localOffset + 30 + lNameLen + lExtraLen });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function contents(buf, e) {
  const raw = buf.subarray(e.dataOffset, e.dataOffset + e.compSize);
  return e.method === 0 ? raw : zlib.inflateRawSync(raw);
}

/** Checks every 64-bit lib/<abi>/*.so of an .apk / .aab. */
function check(file) {
  const buf = fs.readFileSync(file);
  const isApk = file.toLowerCase().endsWith('.apk');
  const results = [];
  for (const e of readZip(buf)) {
    const m = e.name.match(/(?:^|\/)lib\/([^/]+)\/[^/]+\.so$/);
    if (!m || !ABIS_64.includes(m[1])) continue;
    const align = minLoadAlign(contents(buf, e));
    const zipOk = !isApk || e.method !== 0 || e.dataOffset % PAGE === 0;
    results.push({ file: e.name, abi: m[1], ok: align >= PAGE && zipOk, align });
  }
  return results;
}

module.exports = { minLoadAlign, isSixteenKbReady, check, PAGE };
