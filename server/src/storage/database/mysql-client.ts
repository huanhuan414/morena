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

export interface QueryResult {
  data: any[] | null;
  error: Error | null;
}

export interface SingleQueryResult {
  data: any | null;
  error: Error | null;
}

export interface InsertResult {
  data: { id: string } | null;
  error: Error | null;
}

export interface CountResult {
  data: number | null;
  error: Error | null;
}

export interface UpdateResult {
  data: { affectedRows: number } | null;
  error: Error | null;
}

export interface DeleteResult {
  data: { affectedRows: number } | null;
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

// Query Builder for chainable queries
class QueryBuilder {
  private tableName: string;
  private jsonFields: string[] = [];
  private conditions: string = '';
  private conditionValues: any[] = [];
  private selectedColumns: string = '*';
  private orderByClause: string = '';
  private limitClause: string = '';
  private offsetClause: string = '';
  private groupByClause: string = '';
  private joinClause: string = '';

  constructor(tableName: string, jsonFields: string[] = []) {
    this.tableName = tableName;
    this.jsonFields = jsonFields;
  }

  where(conditions: Record<string, any>, operator: string = '='): this {
    const keys = Object.keys(conditions);
    if (keys.length === 0) return this;
    
    const clauses = keys.map(key => `${toSnakeCase(key)} ${operator} ?`).join(' AND ');
    const values = keys.map(key => {
      const val = conditions[key];
      if (Array.isArray(val)) {
        return JSON.stringify(val);
      }
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    });
    
    if (this.conditions) {
      this.conditions += ' AND ' + clauses;
    } else {
      this.conditions = clauses;
    }
    this.conditionValues.push(...values);
    return this;
  }

  whereIn(column: string, values: any[]): this {
    const placeholders = values.map(() => '?').join(', ');
    if (this.conditions) {
      this.conditions += ` AND ${toSnakeCase(column)} IN (${placeholders})`;
    } else {
      this.conditions = `${toSnakeCase(column)} IN (${placeholders})`;
    }
    this.conditionValues.push(...values);
    return this;
  }

  select(columns: string): this {
    this.selectedColumns = columns;
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByClause = `ORDER BY ${toSnakeCase(column)} ${direction}`;
    return this;
  }

  limit(count: number): this {
    this.limitClause = `LIMIT ${count}`;
    return this;
  }

  offset(count: number): this {
    this.offsetClause = `OFFSET ${count}`;
    return this;
  }

  groupBy(column: string): this {
    this.groupByClause = `GROUP BY ${toSnakeCase(column)}`;
    return this;
  }

  join(table: string, condition: string, type: 'LEFT' | 'RIGHT' | 'INNER' = 'INNER'): this {
    this.joinClause += ` ${type} JOIN ${table} ON ${condition}`;
    return this;
  }

  async first(): Promise<SingleQueryResult> {
    const result = await this.execute();
    if (result.data && result.data.length > 0) {
      return { data: result.data[0], error: null };
    }
    return { data: null, error: null };
  }

  async then(resolve: (value: QueryResult) => void): Promise<void> {
    const result = await this.execute();
    resolve(result);
  }

  async execute(): Promise<QueryResult> {
    try {
      const pool = getPool();
      let sql = `SELECT ${this.selectedColumns} FROM ${this.tableName}${this.joinClause}`;
      
      if (this.conditions) {
        sql += ` WHERE ${this.conditions}`;
      }
      if (this.groupByClause) {
        sql += ` ${this.groupByClause}`;
      }
      if (this.orderByClause) {
        sql += ` ${this.orderByClause}`;
      }
      if (this.limitClause) {
        sql += ` ${this.limitClause}`;
      }
      if (this.offsetClause) {
        sql += ` ${this.offsetClause}`;
      }
      
      const [rows] = await pool.query<RowDataPacket[]>(sql, this.conditionValues);
      const data = (rows as any[]).map(row => {
        const converted = convertKeysToCamel(row);
        return parseJsonFields(converted, this.jsonFields);
      });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async count(): Promise<{ data: number | null; error: Error | null }> {
    try {
      const pool = getPool();
      let sql = `SELECT COUNT(*) as count FROM ${this.tableName}${this.joinClause}`;
      
      if (this.conditions) {
        sql += ` WHERE ${this.conditions}`;
      }
      if (this.groupByClause) {
        sql = sql.replace('SELECT COUNT(*) as count', 'SELECT COUNT(*) as count FROM (SELECT 1');
        sql += `) as subquery`;
      }
      
      const [rows] = await pool.query<RowDataPacket[]>(sql, this.conditionValues);
      return { data: rows[0]?.count || 0, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async update(data: Record<string, any>): Promise<UpdateResult> {
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
      }), ...this.conditionValues];
      
      let sql = `UPDATE ${this.tableName} SET ${setClause}`;
      if (this.conditions) {
        sql += ` WHERE ${this.conditions}`;
      }
      
      const [result] = await pool.query<ResultSetHeader>(sql, values);
      return { data: { affectedRows: result.affectedRows }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  async delete(): Promise<UpdateResult> {
    try {
      const pool = getPool();
      let sql = `DELETE FROM ${this.tableName}`;
      if (this.conditions) {
        sql += ` WHERE ${this.conditions}`;
      }
      
      const [result] = await pool.query<ResultSetHeader>(sql, this.conditionValues);
      return { data: { affectedRows: result.affectedRows }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }
}

export class MysqlClient {
  private tableName: string;
  private jsonFields: string[] = [];

  constructor(tableName: string, jsonFields: string[] = []) {
    this.tableName = tableName;
    this.jsonFields = jsonFields;
  }

  select(columns: string = '*'): QueryBuilder {
    const builder = new QueryBuilder(this.tableName, this.jsonFields);
    return builder.select(columns);
  }

  where(conditions: Record<string, any>, operator: string = '='): QueryBuilder {
    const builder = new QueryBuilder(this.tableName, this.jsonFields);
    return builder.where(conditions, operator);
  }

  whereIn(column: string, values: any[]): QueryBuilder {
    const builder = new QueryBuilder(this.tableName, this.jsonFields);
    return builder.whereIn(column, values);
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
      
      return { data: { affectedRows: result.affectedRows }, error: null };
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
      return { data: { affectedRows: result.affectedRows }, error: null };
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

// 便捷查询函数
export async function query(sql: string, params: any[] = []): Promise<QueryResult> {
  const client = getPool();
  try {
    const [rows] = await client.query(sql, params);
    return { data: rows as any[], error: null };
  } catch (error: any) {
    console.error('Query error:', error.message);
    return { data: null, error };
  }
}

export async function insert(sql: string, params: any[] = []): Promise<InsertResult> {
  const client = getPool();
  try {
    const [result] = await client.query(sql, params);
    return { data: { id: (result as any).insertId?.toString() || '' }, error: null };
  } catch (error: any) {
    console.error('Insert error:', error.message);
    return { data: null, error };
  }
}

export async function updateData(sql: string, params: any[] = []): Promise<UpdateResult> {
  const client = getPool();
  try {
    const [result] = await client.query(sql, params);
    return { data: { affectedRows: (result as any).affectedRows || 0 }, error: null };
  } catch (error: any) {
    console.error('Update error:', error.message);
    return { data: null, error };
  }
}

// 兼容 Supabase API 的 execute 函数
export async function execute(sql: string, params?: any[]): Promise<QueryResult> {
  return query(sql, params || []);
}

// 兼容 Supabase 链式 API 的快捷方法
export function skillsTable() {
  return new MysqlClient('skills');
}

export function avatarSkillsTable() {
  return new MysqlClient('avatar_skills');
}

export function skillReviewsTable() {
}

export function friendshipsTable() {
  return new MysqlClient('friendships');
}

export function avatarOrdersTable() {
  return new MysqlClient('avatar_orders');
}

export function orderItemsTable() {
  return new MysqlClient('order_items');
}
