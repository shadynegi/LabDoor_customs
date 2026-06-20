require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const postgres = require('postgres');

const url = process.env.DATABASE_URL || process.argv[2];
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 15, prepare: false, ssl: false });

sql`SELECT 1 AS ok`
  .then((rows) => {
    console.log('DB OK:', rows[0]);
    return sql.end();
  })
  .catch((err) => {
    console.error('DB FAIL:', err.message);
    process.exit(1);
  });
