import { Pool } from "pg";
import { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } from "../config";

export const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
});
