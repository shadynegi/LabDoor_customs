import fs from 'fs';
import path from 'path';

const root = path.join(import.meta.dirname, '../src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function getAttr(attrs, name) {
  const quoted = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`));
  if (quoted) return quoted[1];
  const braced = attrs.match(new RegExp(`\\b${name}\\s*=\\s*\\{([^}]+)\\}`));
  return braced ? braced[1].trim() : null;
}

const issues = [];

for (const file of walk(root)) {
  const content = fs.readFileSync(file, 'utf8');
  const re = /<(input|select|textarea)\b([\s\S]*?)(?:\/>|>)/gi;
  let m;
  while ((m = re.exec(content))) {
    const tag = m[1];
    const attrs = m[2];
    const line = content.slice(0, m.index).split('\n').length;
    const id = getAttr(attrs, 'id');
    const ariaLabel = getAttr(attrs, 'aria-label');
    const ariaLabelledby = getAttr(attrs, 'aria-labelledby');
    const hasAriaLabel = ariaLabel || /\baria-label\s*=/.test(attrs);
    const hidden = /\bhidden\b/.test(attrs) || /type\s*=\s*["']hidden["']/.test(attrs);
    if (hidden) continue;
    if (hasAriaLabel || ariaLabelledby) continue;

    const before = content.slice(Math.max(0, m.index - 1500), m.index);
    const lastLabelOpen = before.lastIndexOf('<label');
    const lastLabelClose = before.lastIndexOf('</label>');
    const wrappedInLabel = lastLabelOpen > lastLabelClose;

    if (wrappedInLabel) continue;

    if (!id) {
      issues.push({ file, line, tag, id: null, reason: 'no id and not wrapped in label' });
      continue;
    }

    const staticId = id.replace(/\$\{[^}]+\}/g, '').replace(/[`'"]/g, '').trim();
    const hasHtmlFor =
      content.includes(`htmlFor="${id}"`) ||
      content.includes(`htmlFor={${id}}`) ||
      (staticId && content.includes(`htmlFor="${staticId}"`)) ||
      (staticId && new RegExp(`htmlFor=\\{[^}]*${staticId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(content));

    if (!hasHtmlFor) {
      issues.push({ file, line, tag, id, reason: 'no htmlFor/aria-label and not wrapped in label' });
    }
  }
}

for (const i of issues) {
  const rel = i.file.replace(/.*frontend[\\/]src[\\/]/, '');
  console.log(`${rel}:${i.line} <${i.tag}> id=${i.id ?? '—'} (${i.reason})`);
}
console.log('count', issues.length);
