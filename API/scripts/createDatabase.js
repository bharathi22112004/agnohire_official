import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.replace('/', '');

// Connect to postgres (not the target DB)
url.pathname = '/postgres';
const client = new Client({ connectionString: url.toString() });

async function createDatabase() {
  await client.connect();

  const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);

  if (res.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`✅ Database "${dbName}" created successfully`);
  } else {
    console.log(`ℹ️  Database "${dbName}" already exists`);
  }

  await client.end();
}

createDatabase().catch((err) => {
  console.error('❌ Failed to create database:', err.message);
  process.exit(1);
});
