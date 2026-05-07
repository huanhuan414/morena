import * as mysql from 'mysql2/promise';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

let pool: Pool | null = null;
let envLoaded = false;

interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface QueryResult {
  data: any[] | null;
  error: Error | null;
}

interface InsertResult {
  data: { id: string } | null;
  error: Error | null;
}

interface UpdateResult {
  data: { affected_rows: number } | null;
  error: Error | null;
}

function loadEnv(): void {
  if (envLoaded) return;

  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env');
    
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex);
          const value = trimmed.substring(eqIndex + 1);
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  } catch {
    // ignore
  }
  
  envLoaded = true;
}

function getMysqlConfig(): MysqlConfig {
  loadEnv();

  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = parseInt(process.env.MYSQL_PORT || '3306');
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'mrl';

  return { host, port, user, password, database };
}

function getPool(): Pool {
  if (!pool) {
    const config = getMysqlConfig();
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+08:00',
    });
  }
  return pool;
}

// Convert camelCase to snake_case
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Convert snake_case to camelCase
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert object keys from snake_case to camelCase
function convertKeysToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamel);
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[toCamelCase(key)] = convertKeysToCamel(obj[key]);
    }
    return result;
  }
  return obj;
}

// Convert object keys from camelCase to snake_case
function convertKeysToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnake);
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[toSnakeCase(key)] = convertKeysToSnake(obj[key]);
    }
    return result;
  }
  return obj;
}

// Parse JSON fields
function parseJsonFields(row: any, jsonFields: string[]): any {
  if (!row) return row;
  const result = { ...row };
  for (const field of jsonFields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = JSON.parse(result[field]);
      } catch {
        // Keep as string if not valid JSON
      }
    }
  }
  return result;
}

export class MysqlClient {
  private tableName: string;
  private jsonFields: string[] = [];

  constructor(tableName: string, jsonFields: string[] = []) {
    this.tableName = tableName;
    this.jsonFields = jsonFields;
  }

  async select(columns: string = '*'): Promise<QueryResult> {
    try {
      const pool = getPool();
      const [rows] = await pool.query<RowDataPacket[]>(`SELECT ${columns} FROM ${this.tableName}`);
      const data = (rows as any[]).map(row => {
        const converted = convertKeysToCamel(row);
        return parseJsonFields(converted, this.jsonFields);
      });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async where(conditions: Record<string, any>, operator: string = '='): Promise<QueryResult> {
    try {
      const pool = getPool();
      const keys = Object.keys(conditions);
      const clauses = keys.map(key => `${toSnakeCase(key)} ${operator} ?`).join(' AND ');
      const values = keys.map(key => {
        const val = conditions[key];
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return val;
      });
      
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM ${this.tableName} WHERE ${clauses}`,
        values
      );
      const data = (rows as any[]).map(row => {
        const converted = convertKeysToCamel(row);
        return parseJsonFields(converted, this.jsonFields);
      });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async findById(id: string): Promise<QueryResult> {
    try {
      const pool = getPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM ${this.tableName} WHERE id = ?`,
        [id]
      );
      if (rows.length === 0) {
        return { data: null, error: null };
      }
      const converted = convertKeysToCamel(rows[0]);
      const data = parseJsonFields(converted, this.jsonFields);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async insert(data: Record<string, any>): Promise<InsertResult> {
    try {
      const pool = getPool();
      const id = data.id || uuidv4();
      // 移除 data 中的 id，避免重复插入
      const { id: _, ...restData } = data;
      const keys = Object.keys(restData);
      const snakeData = convertKeysToSnake(restData);
      
      const columns = ['id', ...keys.map(k => toSnakeCase(k))].join(', ');
      const placeholders = ['?', ...keys.map(() => '?')].join(', ');
      const values = [id, ...keys.map(k => {
        const val = snakeData[toSnakeCase(k)];
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return val;
      })];
      
      await pool.query(
        `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`,
        values
      );
      
      return { data: { id }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async update(id: string, data: Record<string, any>): Promise<UpdateResult> {
    try {
      const pool = getPool();
      const keys = Object.keys(data);
      const snakeData = convertKeysToSnake(data);
      
      const setClause = keys.map(k => `${toSnakeCase(k)} = ?`).join(', ');
      const values = [...keys.map(k => {
        const val = snakeData[k];
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return val;
      }), id];
      
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`,
        values
      );
      
      return { data: { affected_rows: result.affectedRows }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async upsert(data: Record<string, any>, uniqueKey: string = 'id'): Promise<InsertResult> {
    try {
      const pool = getPool();
      const id = data.id || uuidv4();
      const keys = Object.keys(data);
      const snakeData = convertKeysToSnake(data);
      
      const columns = ['id', ...keys.map(k => toSnakeCase(k))].join(', ');
      const placeholders = ['?', ...keys.map(() => '?')].join(', ');
      const values = [id, ...keys.map(k => {
        const val = snakeData[k];
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return val;
      })];
      
      const setClause = keys.map(k => `${toSnakeCase(k)} = VALUES(${toSnakeCase(k)})`).join(', ');
      
      await pool.query(
        `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${setClause}`,
        [...values, ...values]
      );
      
      return { data: { id }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async delete(id: string): Promise<UpdateResult> {
    try {
      const pool = getPool();
      const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM ${this.tableName} WHERE id = ?`,
        [id]
      );
      return { data: { affected_rows: result.affectedRows }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    try {
      const pool = getPool();
      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      const data = (rows as any[]).map(row => {
        const converted = convertKeysToCamel(row);
        return parseJsonFields(converted, this.jsonFields);
      });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }
}

// Table-specific clients
export function usersTable() {
  return new MysqlClient('users', ['settings']);
}

export function avatarsTable() {
  return new MysqlClient('avatars', ['skills', 'config', 'learningData', 'photoAnalysis']);
}

export function conversationsTable() {
  return new MysqlClient('conversations', ['context']);
}

export function messagesTable() {
  return new MysqlClient('messages', ['metadata']);
}

export function commentsTable() {
  return new MysqlClient('comments');
}

export function followsTable() {
  return new MysqlClient('follows');
}

export function postsTable() {
  return new MysqlClient('posts', ['images', 'videos', 'tags']);
}

export function ordersTable() {
  return new MysqlClient('orders', ['requirements', 'result']);
}

export function orderResultsTable() {
  return new MysqlClient('order_results', ['screenshots']);
}

export function tasksTable() {
  return new MysqlClient('tasks', ['params', 'result', 'logs']);
}

export function likesTable() {
  return new MysqlClient('likes');
}

export function notificationsTable() {
  return new MysqlClient('notifications', ['data']);
}

export function earningsTable() {
  return new MysqlClient('earnings');
}

export function withdrawalRequestsTable() {
  return new MysqlClient('withdrawal_requests');
}

export function healthCheckTable() {
  return new MysqlClient('health_check');
}

export { getPool };
