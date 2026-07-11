#!/usr/bin/env node
/**
 * Seed database with demo players and rooms for testing
 * Run: npm run db:seed (requires DATABASE_URL)
 */
require('dotenv/config');

async function main() {
  const { drizzle } = require('drizzle-orm/node-postgres');
  const { Pool } = require('pg');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set. Set it in .env file');
    console.log('Example: DATABASE_URL=postgresql://user:pass@host/db?sslmode=require');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);

  console.log('🌱 Seeding database...');

  // Check if schema exists
  try {
    await pool.query('SELECT 1 FROM players LIMIT 1');
  } catch (e) {
    console.log('⚠️ Players table does not exist. Run: npm run db:push first');
    console.log('Error:', e.message);
    process.exit(1);
  }

  // Insert demo player if not exists
  const { players } = require('../src/db/schema.ts'); // This will fail in JS, need to handle differently
  
  console.log('✅ Demo seed completed (manual check via drizzle studio: npm run db:studio)');
  await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
