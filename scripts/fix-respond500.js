const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../backend/src/routes');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));

const catchRe =
  /} catch \(error: (?:any|unknown)\) \{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;

for (const file of files) {
  const fp = path.join(dir, file);
  let c = fs.readFileSync(fp, 'utf8');
  let changed = false;

  if (!c.includes("import { respond500 }")) {
    if (c.includes("import { logger }")) {
      c = c.replace(
        "import { logger } from '../lib/logger';",
        "import { logger } from '../lib/logger';\nimport { respond500 } from '../lib/safeError';"
      );
      changed = true;
    }
  }

  const blockRe =
    /\} catch \(error: any\) \{\s*([\s\S]*?)\s*res\.status\(500\)\.json\(\{\s*success: false,\s*error: [^}]+\}\);\s*\}/g;

  c = c.replace(blockRe, (full, inner) => {
    changed = true;
    const logMatch = inner.match(/logger\.error\([^;]+;/);
    const log = logMatch ? logMatch[0] : 'logger.error("Error:", error);';
    const fallbackMatch = full.match(
      /error: (?:error\.message \|\| |\(\(\) => \{ throw new Error\('use respond500'\); \}\)\(\), |error instanceof Error \? error\.message : )'([^']*)'/
    );
    const fallback = fallbackMatch ? fallbackMatch[1] : 'Request failed';
    return `} catch (error: unknown) {\n    ${log}\n    respond500(res, error, '${fallback}');\n  }`;
  });

  // Fix broken throw placeholders left in res.status(500) blocks
  c = c.replace(
    /res\.status\(500\)\.json\(\{\s*success: false,\s*error: \(\(\) => \{ throw new Error\('use respond500'\); \}\)\(\),\s*\}\);/g,
    () => {
      changed = true;
      return 'respond500(res, error, "Request failed");';
    }
  );

  if (changed) {
    fs.writeFileSync(fp, c);
    console.log('fixed', file);
  }
}
