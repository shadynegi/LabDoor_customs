/**
 * One-off codemod: wrap `await sql`...`; with dbQuery(() => sql...`, 'label').
 * Skips lines already using dbQuery( or sql.begin(
 */
import fs from 'fs';
import path from 'path';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node wrap-sql-with-retry.mjs <file.ts> [...]');
  process.exit(1);
}

const IMPORT_OLD = "import sql from '../lib/db';";
const IMPORT_NEW = "import sql, { query as dbQuery } from '../lib/db';";

function prefixFromFile(filePath) {
  return path.basename(filePath, '.ts').replace(/\.ts$/, '');
}

function wrapFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(IMPORT_OLD) && !content.includes('query as dbQuery')) {
    if (content.includes("from './db'") && !content.includes('dbQuery')) {
      content = content.replace(
        /import sql from '\.\/db';/,
        "import sql, { query as dbQuery } from './db';"
      );
    } else if (!content.includes('dbQuery')) {
      console.warn(`Skip ${filePath}: no sql import`);
      return;
    }
  } else if (content.includes(IMPORT_OLD)) {
    content = content.replace(IMPORT_OLD, IMPORT_NEW);
  }

  const prefix = prefixFromFile(filePath);
  let counter = 0;

  const transformed = content.replace(/await sql`([\s\S]*?)`;/g, (match, body, offset) => {
    const before = content.slice(Math.max(0, offset - 40), offset);
    if (before.includes('dbQuery(') || before.includes('sql.begin')) {
      return match;
    }
    counter += 1;
    return `await dbQuery(() => sql\`${body}\`, '${prefix}:q${counter}');`;
  });

  // sql.begin blocks — wrap whole begin call
  let withBegin = transformed;
  let beginCounter = 0;
  withBegin = withBegin.replace(/await sql\.begin\(/g, () => {
    beginCounter += 1;
    return `await dbQuery(() => sql.begin(`;
  });
  // Close dbQuery for begin — match `await dbQuery(() => sql.begin(async ...` until `);` at same indent level is hard.
  // Handle common pattern: await dbQuery(() => sql.begin(async (tx) => { ... })); 
  // For now only direct sql.begin at start - admin uses sql.begin without await sometimes

  if (counter === 0 && beginCounter === 0 && !content.includes('dbQuery')) {
    console.log(`${filePath}: no changes`);
    return;
  }

  fs.writeFileSync(filePath, withBegin);
  console.log(`${filePath}: wrapped ${counter} sql queries${beginCounter ? `, ${beginCounter} begin (` : ''}`);
}

for (const file of files) {
  wrapFile(path.resolve(file));
}
