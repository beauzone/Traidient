import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

// Check for environment variables
if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL environment variable');
}

// Create the SQL client
const sql = neon(process.env.DATABASE_URL);

// Create the database instance
export const db = drizzle(sql, { schema });