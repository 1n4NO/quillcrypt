import { deflateRawSync } from 'node:zlib';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = process.argv.find((argument) => argument.startsWith('--browser='))?.split('=')[1];
if (!['chrome', 'firefox'].includes(browser)) throw new Error('Use --browser=chrome or --browser=firefox');

const { version } = JSON.parse(readFileSync(resolve(extensionRoot, 'package.json'), 'utf8'));
const sourceRoot = resolve(extensionRoot, `${browser}-dist`);
const artifactRoot = resolve(extensionRoot, 'web-ext-artifacts');
const outputPath = resolve(artifactRoot, `quillcrypt-${version}${browser === 'chrome' ? '-chrome' : ''}.zip`);
mkdirSync(artifactRoot, { recursive: true });

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(absolutePath);
    if (entry.name.endsWith('.b64')) return [];
    return [absolutePath];
  });
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDate() {
  return { time: 0, date: 33 }; // 1980-01-01 00:00:00, the ZIP epoch.
}

const files = collectFiles(sourceRoot)
  .sort((left, right) => relative(sourceRoot, left).localeCompare(relative(sourceRoot, right), 'en'))
  .map((absolutePath) => {
    const name = relative(sourceRoot, absolutePath).split('\\').join('/');
    const input = readFileSync(absolutePath);
    const compressed = deflateRawSync(input, { level: 9 });
    return {
      name: Buffer.from(name, 'utf8'),
      input,
      data: compressed.length < input.length ? compressed : input,
      method: compressed.length < input.length ? 8 : 0,
      crc: crc32(input),
    };
  });

const localParts = [];
const centralParts = [];
let offset = 0;
const { time, date } = dosDate();
for (const file of files) {
  const localHeader = Buffer.alloc(30 + file.name.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filenames.
  localHeader.writeUInt16LE(file.method, 8);
  localHeader.writeUInt16LE(time, 10);
  localHeader.writeUInt16LE(date, 12);
  localHeader.writeUInt32LE(file.crc, 14);
  localHeader.writeUInt32LE(file.data.length, 18);
  localHeader.writeUInt32LE(file.input.length, 22);
  localHeader.writeUInt16LE(file.name.length, 26);
  file.name.copy(localHeader, 30);
  localParts.push(localHeader, file.data);

  const centralHeader = Buffer.alloc(46 + file.name.length);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0x0800, 8);
  centralHeader.writeUInt16LE(file.method, 10);
  centralHeader.writeUInt16LE(time, 12);
  centralHeader.writeUInt16LE(date, 14);
  centralHeader.writeUInt32LE(file.crc, 16);
  centralHeader.writeUInt32LE(file.data.length, 20);
  centralHeader.writeUInt32LE(file.input.length, 24);
  centralHeader.writeUInt16LE(file.name.length, 28);
  centralHeader.writeUInt32LE(0, 38); // external attributes
  centralHeader.writeUInt32LE(offset, 42);
  file.name.copy(centralHeader, 46);
  centralParts.push(centralHeader);
  offset += localHeader.length + file.data.length;
}

const centralDirectory = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(offset, 16);

writeFileSync(outputPath, Buffer.concat([...localParts, centralDirectory, end]));
console.log(`Created deterministic ${browser} archive with ${files.length} files: ${outputPath}`);
