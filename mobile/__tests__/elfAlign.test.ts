/**
 * TASK-026: the 16 KB page-size verification tool (scripts/lib/elfAlign.js, scripts/check-16kb.js).
 * ELF files and zips are built in memory; nothing here touches a real bundle.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { zipSync } from 'fflate';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { minLoadAlign, isSixteenKbReady, check } = require('../scripts/lib/elfAlign');

const PT_LOAD = 1;
const PT_NOTE = 4;

/** Minimal ELF64 little-endian image: header + one program header per entry. */
function makeElf(headers: { type: number; align: number }[], cls = 2): Buffer {
  const phoff = 64;
  const phentsize = 56;
  const buf = Buffer.alloc(phoff + phentsize * headers.length);
  buf.write('\x7fELF', 0, 'latin1');
  buf[4] = cls;
  buf[5] = 1; // little endian
  buf[6] = 1; // version
  buf.writeBigUInt64LE(BigInt(phoff), 32); // e_phoff
  buf.writeUInt16LE(phentsize, 54); // e_phentsize
  buf.writeUInt16LE(headers.length, 56); // e_phnum
  headers.forEach((h, i) => {
    const o = phoff + i * phentsize;
    buf.writeUInt32LE(h.type, o);
    buf.writeBigUInt64LE(BigInt(h.align), o + 48); // p_align
  });
  return buf;
}

const elf16 = () => makeElf([{ type: PT_LOAD, align: 0x4000 }, { type: PT_LOAD, align: 0x4000 }]);
const elf4 = () => makeElf([{ type: PT_LOAD, align: 0x1000 }]);

function tmpFile(name: string, data: Uint8Array | Buffer): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elf16-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, data);
  return file;
}

describe('minLoadAlign / isSixteenKbReady', () => {
  it('reads 16 KB alignment', () => {
    expect(minLoadAlign(elf16())).toBe(16384);
  });

  it('returns the smallest of several PT_LOAD headers', () => {
    const e = makeElf([{ type: PT_LOAD, align: 0x4000 }, { type: PT_LOAD, align: 0x1000 }]);
    expect(minLoadAlign(e)).toBe(4096);
  });

  it('ignores non-load headers', () => {
    const e = makeElf([{ type: PT_NOTE, align: 8 }, { type: PT_LOAD, align: 0x4000 }]);
    expect(minLoadAlign(e)).toBe(16384);
  });

  it('accepts 16 KB and 64 KB, rejects 4 KB', () => {
    expect(isSixteenKbReady(makeElf([{ type: PT_LOAD, align: 0x4000 }]))).toBe(true);
    expect(isSixteenKbReady(makeElf([{ type: PT_LOAD, align: 0x10000 }]))).toBe(true);
    expect(isSixteenKbReady(elf4())).toBe(false);
  });

  it('rejects a buffer that is not an ELF file', () => {
    expect(() => minLoadAlign(Buffer.from('hello world, not elf at all, padding padding padding'))).toThrow(
      'not an ELF file',
    );
  });

  it('rejects 32-bit ELF', () => {
    expect(() => minLoadAlign(makeElf([{ type: PT_LOAD, align: 0x1000 }], 1))).toThrow('unsupported ELF class');
  });
});

describe('check()', () => {
  it('skips 32-bit ABIs and reports only the 64-bit libraries', () => {
    const zip = zipSync({
      'lib/armeabi-v7a/libx.so': new Uint8Array(elf4()),
      'lib/arm64-v8a/liby.so': new Uint8Array(elf16()),
    });
    const res = check(tmpFile('a.apk', zip));
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ abi: 'arm64-v8a', ok: true, align: 16384 });
  });

  it('reads the base/lib layout of an .aab', () => {
    const zip = zipSync({ 'base/lib/arm64-v8a/libz.so': new Uint8Array(elf16()) });
    const res = check(tmpFile('a.aab', zip));
    expect(res.map((r: { file: string }) => r.file)).toEqual(['base/lib/arm64-v8a/libz.so']);
  });

  it('reports a library aligned to 4 KB as failing', () => {
    const zip = zipSync({ 'lib/arm64-v8a/libold.so': new Uint8Array(elf4()) });
    const res = check(tmpFile('a.apk', zip));
    expect(res[0]).toMatchObject({ ok: false, align: 4096 });
  });

  it('flags a stored .so that does not start on a 16 KB boundary (apk only)', () => {
    // level 0 = stored. The zip starts the data right after the 30-byte header + name, so it is not 16 KB aligned.
    const zip = zipSync({ 'lib/arm64-v8a/libx.so': [new Uint8Array(elf16()), { level: 0 }] });
    const res = check(tmpFile('a.apk', zip));
    expect(res[0].ok).toBe(false);
    // the same file as an .aab is not subject to the zip-offset rule
    expect(check(tmpFile('b.aab', zipSync({ 'base/lib/arm64-v8a/libx.so': [new Uint8Array(elf16()), { level: 0 }] })))[0].ok).toBe(true);
  });
});

describe('check-16kb CLI', () => {
  const cli = path.join(__dirname, '..', 'scripts', 'check-16kb.js');
  const run = (file: string) => spawnSync(process.execPath, [cli, file], { encoding: 'utf8' });

  it('exits 0 when every 64-bit library is aligned', () => {
    const r = run(tmpFile('ok.aab', zipSync({ 'base/lib/arm64-v8a/liba.so': new Uint8Array(elf16()) })));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('OK');
  });

  it('exits non-zero when a library is not aligned', () => {
    const r = run(tmpFile('bad.aab', zipSync({ 'base/lib/arm64-v8a/liba.so': new Uint8Array(elf4()) })));
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain('FAIL');
  });

  it('exits non-zero when no libraries are found', () => {
    const r = run(tmpFile('empty.aab', zipSync({ 'base/manifest/AndroidManifest.xml': new Uint8Array([1]) })));
    expect(r.status).not.toBe(0);
  });
});
