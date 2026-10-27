/** Bounded interpretation of supported text-bearing binary formats.
 * Format names and paths never grant acceptance. Unsupported variants fail closed.
 */
const MAX_BYTES = 16777216;
const MAX_ITEMS = 100000;
function requireFormat(condition) { if (!condition) throw new Error('binary-structure-invalid'); }
function text(bytes, encoding) { return new TextDecoder(encoding, { fatal: true }).decode(bytes); }
function trueType(b) {
  const size = b.length;
  const bounds = (offset, length, end = size) => requireFormat(Number.isSafeInteger(offset + length) && offset >= 0 && length >= 0 && offset + length <= end);
  const u16 = p => { bounds(p, 2); return b.readUInt16BE(p); };
  const u32 = p => { bounds(p, 4); return b.readUInt32BE(p); };
  requireFormat(size <= MAX_BYTES && size >= 12 && u32(0) === 0x10000);
  const count = u16(4); requireFormat(count > 0 && count <= 256); bounds(12, count * 16);
  const power = 2 ** Math.floor(Math.log2(count));
  requireFormat(u16(6) === power * 16 && u16(8) === Math.log2(power) && u16(10) === count * 16 - power * 16);
  const tables = new Map(); const ranges = []; let previous = '';
  for (let i = 0; i < count; i++) {
    const p = 12 + i * 16; const tag = b.toString('latin1', p, p + 4);
    requireFormat(/^[\x20-\x7e]{4}$/u.test(tag) && tag > previous); previous = tag;
    const offset = u32(p + 8); const length = u32(p + 12); bounds(offset, length);
    requireFormat(offset >= 12 + count * 16 && offset % 4 === 0);
    tables.set(tag, { offset, length }); if (length) ranges.push({ offset, length });
  }
  ranges.sort((a, c) => a.offset - c.offset); let end = 12 + count * 16;
  for (const r of ranges) {
    requireFormat(r.offset >= end && r.offset - end <= 3);
    for (let i = end; i < r.offset; i++) requireFormat(b[i] === 0);
    end = r.offset + r.length;
  }
  requireFormat(size - end <= 3); for (let i = end; i < size; i++) requireFormat(b[i] === 0);
  function table(tag, min) { const r = tables.get(tag); requireFormat(r && r.length >= min); return r; }
  const head = table('head', 54); requireFormat(u32(head.offset) === 0x10000 && u32(head.offset + 12) === 0x5f0f3cf5);
  requireFormat(u16(head.offset + 18) >= 16 && u16(head.offset + 18) <= 16384);
  const locaFormat = b.readInt16BE(head.offset + 50); requireFormat(locaFormat === 0 || locaFormat === 1);
  const maxp = table('maxp', 32); requireFormat(u32(maxp.offset) === 0x10000); const glyphs = u16(maxp.offset + 4); requireFormat(glyphs > 0);
  const hhea = table('hhea', 36); requireFormat(u32(hhea.offset) === 0x10000); const metrics = u16(hhea.offset + 34); requireFormat(metrics > 0 && metrics <= glyphs);
  table('hmtx', metrics * 4 + (glyphs - metrics) * 2); table('OS/2', 68); table('post', 32);
  const glyf = table('glyf', 0); const loca = table('loca', (glyphs + 1) * (locaFormat ? 4 : 2)); let prior = 0;
  for (let i = 0; i <= glyphs; i++) { const value = locaFormat ? u32(loca.offset + i * 4) : u16(loca.offset + i * 2) * 2; requireFormat(value >= prior && value <= glyf.length); prior = value; }
  const cmap = table('cmap', 4); requireFormat(u16(cmap.offset) === 0); const mappings = u16(cmap.offset + 2); requireFormat(mappings > 0 && mappings <= 256); bounds(4, mappings * 8, cmap.length);
  for (let i = 0; i < mappings; i++) {
    const start = u32(cmap.offset + 8 + i * 8); bounds(start, 2, cmap.length); const f = u16(cmap.offset + start);
    requireFormat([0, 4, 6, 12, 13, 14].includes(f)); const length = f === 14 ? u32(cmap.offset + start + 2) : f >= 12 ? u32(cmap.offset + start + 4) : u16(cmap.offset + start + 2);
    requireFormat(length >= (f >= 12 ? 16 : 6)); bounds(start, length, cmap.length);
    if (f === 0) requireFormat(length === 262);
    if (f === 6) requireFormat(length >= 10 && 10 + u16(cmap.offset + start + 8) * 2 === length);
    if (f === 14) throw new Error('binary-format-unsupported');
    if (f === 4) {
      const p = cmap.offset + start; const twice = u16(p + 6); const segments = twice / 2; requireFormat(segments > 0 && twice % 2 === 0 && 16 + segments * 8 <= length);
      requireFormat(u16(p + 14 + segments * 2) === 0); let previousEnd = -1;
      for (let j = 0; j < segments; j++) {
        const last = u16(p + 14 + j * 2); const first = u16(p + 16 + segments * 2 + j * 2); const rangePosition = 16 + segments * 6 + j * 2; const range = u16(p + rangePosition);
        requireFormat(first <= last && last > previousEnd && range % 2 === 0); previousEnd = last;
        if (range) { requireFormat(rangePosition + range >= 16 + segments * 8); bounds(rangePosition + range, (last - first + 1) * 2, length); }
      }
      requireFormat(previousEnd === 0xffff);
    }
    if (f === 12 || f === 13) { const groups = u32(cmap.offset + start + 12); requireFormat(groups <= MAX_ITEMS && 16 + groups * 12 === length); let previous = -1;
      for (let j = 0; j < groups; j++) { const p = cmap.offset + start + 16 + j * 12; const first = u32(p); const last = u32(p + 4); const glyph = u32(p + 8); requireFormat(first > previous && first <= last && last <= 0x10ffff && glyph < glyphs && (f === 13 || glyph + last - first < glyphs)); previous = last; } }
  }
  const name = table('name', 6); const format = u16(name.offset); requireFormat(format === 0 || format === 1); const records = u16(name.offset + 2); const storage = u16(name.offset + 4);
  requireFormat(records <= 4096); bounds(6, records * 12, name.length); requireFormat(storage >= 6 + records * 12 && storage <= name.length);
  const strings = []; let extractedBytes = 0;
  const charge = length => { extractedBytes += length; requireFormat(extractedBytes <= MAX_BYTES); };
  for (let i = 0; i < records; i++) {
    const p = name.offset + 6 + i * 12; const platform = u16(p); const encoding = u16(p + 2); const length = u16(p + 8); const offset = u16(p + 10);
    bounds(storage + offset, length, name.length); charge(length); let codec;
    if (platform === 0 && encoding <= 6 || platform === 3 && [0, 1, 10].includes(encoding)) { requireFormat(length % 2 === 0); codec = 'utf-16be'; }
    else if (platform === 1 && encoding === 0) codec = 'macintosh';
    else throw new Error('binary-text-encoding-unsupported');
    strings.push({ location: `sfnt/name/${i}`, text: text(b.subarray(name.offset + storage + offset, name.offset + storage + offset + length), codec) });
  }
  if (format === 1) {
    const p = 6 + records * 12; bounds(p, 2, name.length); const languages = u16(name.offset + p); requireFormat(languages <= 4096); bounds(p + 2, languages * 4, name.length); requireFormat(storage >= p + 2 + languages * 4);
    for (let i = 0; i < languages; i++) { const length = u16(name.offset + p + 2 + i * 4); const offset = u16(name.offset + p + 4 + i * 4); requireFormat(length % 2 === 0); bounds(storage + offset, length, name.length); charge(length); strings.push({ location: `sfnt/language/${i}`, text: text(b.subarray(name.offset + storage + offset, name.offset + storage + offset + length), 'utf-16be') }); }
  }
  return strings;
}
function bedrock(b) {
  requireFormat(b.length <= MAX_BYTES && b.length >= 11 && b.readUInt32LE(0) === 10 && b.readUInt32LE(4) === b.length - 8);
  let position = 8; let nodes = 0; let stringBytes = 0; const strings = [];
  const take = length => { requireFormat(Number.isSafeInteger(length) && length >= 0 && position + length <= b.length); const value = b.subarray(position, position + length); position += length; return value; };
  const byte = () => take(1)[0]; const int = () => take(4).readInt32LE();
  const string = location => { const length = take(2).readUInt16LE(); stringBytes += length; requireFormat(stringBytes <= MAX_BYTES && strings.length < MAX_ITEMS); strings.push({ location, text: text(take(length), 'utf-8') }); };
  function payload(type, depth, location) {
    requireFormat(++nodes <= MAX_ITEMS && depth <= 64);
    if (type >= 1 && type <= 6) take([0, 1, 2, 4, 8, 4, 8][type]);
    else if ([7, 11, 12].includes(type)) { const count = int(); requireFormat(count >= 0 && count <= MAX_BYTES); take(count * (type === 11 ? 4 : type === 12 ? 8 : 1)); }
    else if (type === 8) string(location + '/value');
    else if (type === 9) { const subtype = byte(); const count = int(); requireFormat(count >= 0 && count <= MAX_ITEMS && subtype <= 12 && (subtype > 0 || count === 0)); for (let i = 0; i < count; i++) payload(subtype, depth + 1, location + '/list/' + i); }
    else if (type === 10) { let index = 0; while (true) { const subtype = byte(); if (subtype === 0) break; requireFormat(subtype <= 12); const child = location + '/tag/' + index++; string(child + '/name'); payload(subtype, depth + 1, child); } }
    else throw new Error('binary-structure-invalid');
  }
  requireFormat(byte() === 10); string('nbt/root/name'); payload(10, 0, 'nbt/root'); requireFormat(position === b.length); return strings;
}
export function interpretEotWrapper(b) {
  requireFormat(b.length >= 82 && b.length <= MAX_BYTES && b.readUInt32LE(0) === b.length);
  const fontBytes = b.readUInt32LE(4); const version = b.readUInt32LE(8); const flags = b.readUInt32LE(12);
  requireFormat([0x10000, 0x20001, 0x20002].includes(version) && [0, 1, 4, 5].includes(flags) && b.readUInt16LE(34) === 0x504c && fontBytes > 0);
  for (let p = 64; p < 80; p += 4) requireFormat(b.readUInt32LE(p) === 0);
  let position = 80; const strings = [];
  const take = length => { requireFormat(length >= 0 && position + length <= b.length); const value = b.subarray(position, position + length); position += length; return value; };
  const u16 = () => take(2).readUInt16LE(); const u32 = () => take(4).readUInt32LE();
  const string = label => { requireFormat(u16() === 0); const length = u16(); requireFormat(length % 2 === 0); const bytes = take(length); strings.push({ location: 'eot/' + label, text: text(bytes, 'utf-16le') }); return bytes; };
  for (const label of ['family', 'style', 'version', 'full-name']) string(label);
  let root = Buffer.alloc(0); if (version >= 0x20001) root = string('root');
  if (version === 0x20002) {
    const checksum = root.reduce((sum, value) => sum + value, 0) ^ 0x50475342;
    requireFormat(u32() === (checksum >>> 0)); requireFormat(u32() === 0 && u16() === 0 && u16() === 0 && u32() === 0 && u32() === 0);
  }
  requireFormat(position + fontBytes === b.length);
  return { strings, compressed: Boolean(flags & 4), fontData: b.subarray(position) };
}
export function interpretBinaryContent(bytes, { decodeEot } = {}) {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length >= 36 && b.readUInt16LE(34) === 0x504c) {
    const wrapper = interpretEotWrapper(b);
    let font = wrapper.fontData;
    if (wrapper.compressed) { requireFormat(typeof decodeEot === 'function'); font = decodeEot(b); }
    const names = trueType(font);
    return { format: 'eot', strings: [...wrapper.strings, ...names.map(item => ({ ...item, location: 'eot/' + item.location }))] };
  }
  if (b.length >= 4 && b.readUInt32BE(0) === 0x10000) return { format: 'truetype', strings: trueType(b) };
  if (b.length >= 9 && b.readUInt32LE(0) === 10 && b[8] === 10) return { format: 'bedrock-nbt', strings: bedrock(b) };
  return null;
}
