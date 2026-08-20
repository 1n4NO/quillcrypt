import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const pages = ['index.html', 'privacy.html'];
const pageHtml = pages.map((page) => readFileSync(resolve(root, page), 'utf8'));
const html = pageHtml.join('\n');
const localReferences = pageHtml.flatMap((content) => [...content.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value) => !value.startsWith('#') && !/^(?:https?:|mailto:|data:)/.test(value)));
const ogImage = pageHtml[0].match(/property="og:image"\s+content="([^"]+)"/);
if (ogImage && !/^(?:https?:|data:)/.test(ogImage[1])) localReferences.push(ogImage[1]);
const missing = localReferences.filter((value) => !existsSync(resolve(root, value.split('#')[0].split('?')[0])));
if (missing.length) throw new Error(`Missing landing assets: ${missing.join(', ')}`);
if (html.includes('data-demo') || /Coming soon/i.test(html)) throw new Error('Landing page still contains demo CTA behavior');
if (readFileSync(resolve(root, 'styles.css'), 'utf8').includes('fonts.googleapis.com')) throw new Error('Landing page still depends on Google Fonts');
console.log(`Landing checks passed: ${localReferences.length} local references verified.`);
