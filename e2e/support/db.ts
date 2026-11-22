import { Pool } from "pg";
import { DB_URL } from "./env";

let pool: Pool | null = null;
export function db(): Pool { return (pool ??= new Pool({ connectionString: DB_URL, max: 4 })); }
/** Direct SQL. Only for things the API cannot do (time travel, reading ground truth). Document each use. */
export async function sql<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await db().query(text, params);
  return r.rows as T[];
}
export async function closeDb() { await pool?.end(); pool = null; }
