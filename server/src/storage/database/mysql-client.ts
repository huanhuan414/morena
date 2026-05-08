import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// 数据库连接池
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: parseInt(process.env.MYSQL_PORT || '16033'),
      user: process.env.MYSQL_USER || 'mrl',
      password: process.env.MYSQL_PASSWORD || 'SYDPHJB8aGBn83Eh',
      database: process.env.MYSQL_DATABASE || 'mrl',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

// 类型定义
export interface InsertResult {
  data?: { id?: number; insertId?: number; affectedRows?: number };
  error?: any;
}

export interface UpdateResult {
  data?: { affectedRows: number };
  error?: any;
}

export interface QueryResult {
  data: any[];
  error: any;
}

export interface SingleQueryResult {
  data: any;
  error: any;
}

// 驼峰转下划线
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// 下划线转驼峰
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// 递归转换对象键
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

// 递归转换对象键到下划线
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

// MySQL 客户端类
export class MysqlClient {
  private _table: string;
  private jsonFields: string[] = [];

  constructor(table: string, jsonFields: string[] = []) {
    this._table = table;
    this.jsonFields = jsonFields;
  }

  // 切换表
  table(tableName: string): MysqlClient {
    return new MysqlClient(tableName, this.jsonFields);
  }

  // from 方法（兼容旧代码）
  from(tableName: string): MysqlClient {
    return new MysqlClient(tableName, this.jsonFields);
  }

  // select 方法（兼容旧代码）
  select(tableName: string, conditions?: Record<string, any>): Promise<any[]> {
    return this.query(tableName, conditions);
  }

  // where 方法（兼容旧代码）
  where(conditions: Record<string, any>): MysqlClient {
    return this;
  }

  // whereIn 方法（兼容旧代码）
  whereIn(field: string, values: any[]): MysqlClient {
    return this;
  }

  // insert 方法（兼容旧代码，接收表名）
  async insert(tableName: string, data: Record<string, any>): Promise<InsertResult>
  async insert(data: Record<string, any>): Promise<InsertResult>
  async insert(tableOrData: string | Record<string, any>, data?: Record<string, any>): Promise<InsertResult> {
    const table = typeof tableOrData === 'string' ? tableOrData : this._table;
    const insertData = typeof tableOrData === 'string' ? data : tableOrData;
    if (!insertData) return { data: undefined, error: 'No data provided' };
    try {
      const pool = getPool();
      const keys = Object.keys(insertData);
      const values = Object.values(convertKeysToSnake(insertData));
      const columns = keys.map(k => toSnakeCase(k)).join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      
      const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
      const [result] = await pool.query<ResultSetHeader>(sql, values);
      
      return { data: { insertId: result.insertId, affectedRows: result.affectedRows }, error: null };
    } catch (error: any) {
      return { data: undefined, error };
    }
  }

  // 批量插入
  async insertMany(items: Record<string, any>[]): Promise<InsertResult> {
    if (!items.length) return { data: undefined, error: null };
    try {
      const pool = getPool();
      const keys = Object.keys(convertKeysToSnake(items[0]));
      const columns = keys.join(', ');
      const placeholders = items.map(() => `(${keys.map(() => '?').join(', ')})`).join(', ');
      
      const values: any[] = [];
      for (const item of items) {
        const row = Object.values(convertKeysToSnake(item));
        values.push(...row);
      }
      
      const sql = `INSERT INTO ${this._table} (${columns}) VALUES ${placeholders}`;
      const [result] = await pool.query<ResultSetHeader>(sql, values);
      
      return { data: { affectedRows: result.affectedRows }, error: null };
    } catch (error: any) {
      return { data: undefined, error };
    }
  }

  // 更新数据（根据 ID，可选表名）
  async update(tableName: string, id: number | string, data: Record<string, any>): Promise<UpdateResult>
  async update(id: number | string, data: Record<string, any>): Promise<UpdateResult>
  async update(idOrTable: number | string | Record<string, any>, dataOrId: Record<string, any> | number | string, data?: Record<string, any>): Promise<UpdateResult> {
    // 重载处理
    if (typeof idOrTable === 'string' && typeof dataOrId !== 'object') {
      // db.update('table', id, data)
      const table = idOrTable;
      const id = dataOrId as number | string;
      const updateData = data!;
      try {
        const pool = getPool();
        const keys = Object.keys(updateData).map(k => `${toSnakeCase(k)} = ?`);
        const values = [...Object.values(convertKeysToSnake(updateData)), id];
        const sql = `UPDATE ${table} SET ${keys.join(', ')} WHERE id = ?`;
        const [result] = await pool.query<ResultSetHeader>(sql, values);
        return { data: { affectedRows: result.affectedRows }, error: null };
      } catch (error: any) {
        return { data: undefined, error };
      }
    }
    // db.update(id, data)
    const id = idOrTable as number | string;
    const updateData = dataOrId as Record<string, any>;
    try {
      const pool = getPool();
      const keys = Object.keys(updateData).map(k => `${toSnakeCase(k)} = ?`);
      const values = [...Object.values(convertKeysToSnake(updateData)), id];
      
      const sql = `UPDATE ${this._table} SET ${keys.join(', ')} WHERE id = ?`;
      const [result] = await pool.query<ResultSetHeader>(sql, values);
      
      return { data: { affectedRows: result.affectedRows }, error: null };
    } catch (error: any) {
      return { data: undefined, error };
    }
  }

  // 条件更新（支持表名参数）
  async updateWhere(conditions: Record<string, any>, data: Record<string, any>): Promise<UpdateResult>
  async updateWhere(table: string, conditions: Record<string, any>, data: Record<string, any>): Promise<UpdateResult>
  async updateWhere(tableOrConditions: string | Record<string, any>, conditionsOrData: Record<string, any> | Record<string, any>, data?: Record<string, any>): Promise<UpdateResult> {
    let table: string;
    let conditions: Record<string, any>;
    let updateData: Record<string, any>;

    if (typeof tableOrConditions === 'string') {
      // updateWhere(table, conditions, data)
      table = tableOrConditions;
      conditions = conditionsOrData as Record<string, any>;
      updateData = data as Record<string, any>;
    } else {
      // updateWhere(conditions, data)
      table = this._table;
      conditions = tableOrConditions;
      updateData = conditionsOrData as Record<string, any>;
    }

    try {
      const pool = getPool();
      const setKeys = Object.keys(updateData).map(k => `${toSnakeCase(k)} = ?`);
      const whereKeys = Object.keys(conditions).map(k => `${toSnakeCase(k)} = ?`);
      
      const values = [...Object.values(convertKeysToSnake(updateData)), ...Object.values(conditions)];
      
      const sql = `UPDATE ${table} SET ${setKeys.join(', ')} WHERE ${whereKeys.join(' AND ')}`;
      const [result] = await pool.query<ResultSetHeader>(sql, values);
      
      return { data: { affectedRows: result.affectedRows }, error: null };
    } catch (error: any) {
      return { data: undefined, error };
    }
  }

  // 删除数据（支持表名）
  async delete(conditions: Record<string, any>): Promise<UpdateResult>
  async delete(table: string, conditions: Record<string, any>): Promise<UpdateResult>
  async delete(tableOrConditions: string | Record<string, any>, conditions?: Record<string, any>): Promise<UpdateResult> {
    let table: string;
    let deleteConditions: Record<string, any>;
    
    if (typeof tableOrConditions === 'string') {
      table = tableOrConditions;
      deleteConditions = conditions as Record<string, any>;
    } else {
      table = this._table;
      deleteConditions = tableOrConditions;
    }
    
    try {
      const pool = getPool();
      const keys = Object.keys(deleteConditions).map(k => `${toSnakeCase(k)} = ?`);
      const values = Object.values(deleteConditions);
      
      const sql = `DELETE FROM ${table} WHERE ${keys.join(' AND ')}`;
      const [result] = await pool.query<ResultSetHeader>(sql, values);
      
      return { data: { affectedRows: result.affectedRows }, error: null };
    } catch (error: any) {
      return { data: undefined, error };
    }
  }

  // 条件删除（兼容旧代码）
  async deleteRow(table: string, conditions: Record<string, any>): Promise<UpdateResult> {
    return new MysqlClient(table).delete(conditions);
  }

  // 查询单条
  async findOne(conditions: Record<string, any>): Promise<any> {
    try {
      const pool = getPool();
      const keys = Object.keys(conditions).map(k => `${toSnakeCase(k)} = ?`);
      const values = Object.values(conditions);
      
      const sql = `SELECT * FROM ${this._table} WHERE ${keys.join(' AND ')} LIMIT 1`;
      const [rows] = await pool.query<RowDataPacket[]>(sql, values);
      
      if (rows.length === 0) return null;
      return convertKeysToCamel(rows[0]);
    } catch (error: any) {
      throw error;
    }
  }

  // 查询多条
  async findMany(conditions?: Record<string, any>, options?: { limit?: number; offset?: number; orderBy?: string }): Promise<any[]> {
    try {
      const pool = getPool();
      let sql = `SELECT * FROM ${this._table}`;
      let values: any[] = [];
      
      if (conditions && Object.keys(conditions).length > 0) {
        const keys = Object.keys(conditions).map(k => `${toSnakeCase(k)} = ?`);
        sql += ` WHERE ${keys.join(' AND ')}`;
        values = Object.values(conditions);
      }
      
      if (options?.orderBy) {
        sql += ` ORDER BY ${toSnakeCase(options.orderBy)}`;
      }
      
      if (options?.limit) {
        sql += ` LIMIT ${options.limit}`;
      }
      
      if (options?.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
      
      const [rows] = await pool.query<RowDataPacket[]>(sql, values);
      return rows.map((row: any) => convertKeysToCamel(row));
    } catch (error: any) {
      throw error;
    }
  }

  // 通用查询方法
  async query(sqlOrTable: string, paramsOrConditions?: any[] | Record<string, any>): Promise<any> {
    // 如果第二个参数是对象，转换为 SQL 查询
    if (paramsOrConditions && typeof paramsOrConditions === 'object' && !Array.isArray(paramsOrConditions)) {
      const conditions = paramsOrConditions as Record<string, any>;
      const keys = Object.keys(conditions).map(k => `${toSnakeCase(k)} = ?`);
      const values = Object.values(conditions);
      
      // 如果条件为空，直接查询所有
      if (keys.length === 0) {
        return this.query(`SELECT * FROM ${sqlOrTable}`, []);
      }
      
      return this.query(`SELECT * FROM ${sqlOrTable} WHERE ${keys.join(' AND ')}`, values);
    }
    // 标准 SQL 查询
    try {
      const pool = getPool();
      const [rows] = await pool.query<RowDataPacket[]>(sqlOrTable, paramsOrConditions || []);
      return rows.map((row: any) => convertKeysToCamel(row));
    } catch (error: any) {
      throw error;
    }
  }

  // 按 ID 查询
  async findById(id: number | string): Promise<any> {
    return this.findOne({ id } as any);
  }

  // 计数
  async count(conditions?: Record<string, any>): Promise<number> {
    try {
      const pool = getPool();
      let sql = `SELECT COUNT(*) as count FROM ${this._table}`;
      let params: any[] = [];
      
      if (conditions && Object.keys(conditions).length > 0) {
        const keys = Object.keys(conditions).map(k => `${toSnakeCase(k)} = ?`);
        sql += ` WHERE ${keys.join(' AND ')}`;
        params = Object.values(conditions);
      }
      
      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      return rows[0]?.count || 0;
    } catch (error: any) {
      return 0;
    }
  }

  // 带条件的计数
  async countWhere(conditions: Record<string, any>): Promise<number> {
    return this.count(conditions);
  }

  // 查询单条记录（支持两个参数：表名和条件）
  async queryOne(tableOrConditions: string | Record<string, any>, conditions?: Record<string, any>): Promise<any> {
    if (typeof tableOrConditions === 'string') {
      return new MysqlClient(tableOrConditions).findOne(conditions || {});
    }
    return this.findOne(tableOrConditions);
  }

  // 带条件的查询（兼容旧代码，支持表名和自定义WHERE条件）
  async queryWhere(tableOrConditions: string | Record<string, any>, whereOrOptions?: string | Record<string, any> | any, options?: any): Promise<any[]> {
    // queryWhere(conditions) - 标准用法
    if (typeof tableOrConditions === 'object') {
      return this.findMany(tableOrConditions);
    }
    
    // queryWhere(table, whereSql, options) - 兼容旧代码
    const table = tableOrConditions;
    const whereSql = whereOrOptions as string;
    const opt = options || {};
    
    try {
      const pool = getPool();
      let sql = `SELECT * FROM ${table}`;
      const values: any[] = [];
      
      if (whereSql) {
        sql += ` WHERE ${whereSql}`;
      }
      
      if (opt.orderBy) {
        sql += ` ORDER BY ${toSnakeCase(opt.orderBy)}`;
        if (opt.orderDirection) {
          sql += ` ${opt.orderDirection}`;
        }
      }
      
      if (opt.limit) {
        sql += ` LIMIT ${opt.limit}`;
      }
      
      if (opt.offset) {
        sql += ` OFFSET ${opt.offset}`;
      }
      
      const [rows] = await pool.query<RowDataPacket[]>(sql, values);
      return rows.map((row: any) => convertKeysToCamel(row));
    } catch (error: any) {
      throw error;
    }
  }

  // 带条件的计数（兼容旧代码，支持表名和自定义WHERE条件）
  async countWhere(tableOrConditions: string | Record<string, any>, whereSql?: string): Promise<number> {
    // countWhere(conditions) - 标准用法
    if (typeof tableOrConditions === 'object') {
      return this.count(tableOrConditions);
    }
    
    // countWhere(table, whereSql) - 兼容旧代码
    const table = tableOrConditions;
    
    try {
      const pool = getPool();
      let sql = `SELECT COUNT(*) as count FROM ${table}`;
      const values: any[] = [];
      
      if (whereSql) {
        sql += ` WHERE ${whereSql}`;
      }
      
      const [rows] = await pool.query<RowDataPacket[]>(sql, values);
      return rows[0]?.count || 0;
    } catch (error: any) {
      return 0;
    }
  }

  // 构建 WHERE 子句
  private buildWhereClause(conditions: Record<string, any>): { sql: string; params: any[] } {
    const keys = Object.keys(conditions).map(k => `${toSnakeCase(k)} = ?`);
    return {
      sql: keys.join(' AND '),
      params: Object.values(conditions)
    };
  }

  // EXISTS 检查
  async exists(conditions: Record<string, any>): Promise<boolean> {
    const count = await this.count(conditions);
    return count > 0;
  }

  // IN 查询
  async findIn(column: string, values: any[]): Promise<any[]> {
    if (!values.length) return [];
    try {
      const pool = getPool();
      const placeholders = values.map(() => '?').join(', ');
      const sql = `SELECT * FROM ${this._table} WHERE ${toSnakeCase(column)} IN (${placeholders})`;
      const [rows] = await pool.query<RowDataPacket[]>(sql, values);
      return rows.map((row: any) => convertKeysToCamel(row));
    } catch (error: any) {
      throw error;
    }
  }

  // Upsert (插入或更新)
  async upsert(data: Record<string, any>, uniqueKey: string = 'id'): Promise<InsertResult> {
    try {
      const pool = getPool();
      const keys = Object.keys(data);
      const columns = keys.map(k => toSnakeCase(k)).join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const updateColumns = keys.filter(k => k !== uniqueKey).map(k => `${toSnakeCase(k)} = VALUES(${toSnakeCase(k)})`).join(', ');
      
      const values = Object.values(convertKeysToSnake(data));
      
      let sql: string;
      if (updateColumns) {
        sql = `INSERT INTO ${this._table} (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateColumns}`;
      } else {
        sql = `INSERT INTO ${this._table} (${columns}) VALUES (${placeholders})`;
      }
      
      const [result] = await pool.query<ResultSetHeader>(sql, values);
      return { data: { insertId: result.insertId, affectedRows: result.affectedRows }, error: null };
    } catch (error: any) {
      return { data: undefined, error };
    }
  }

  // 模拟 Supabase 的 .eq() 链式调用（返回包含 eq 方法的对象）
  eq(column: string, value: any): { then: (resolve: (value: any) => void) => void; select: () => any } {
    const self = this;
    return {
      then(resolve: (value: any) => void) {
        // 模拟 Supabase 的异步查询
        Promise.resolve(self.findMany({ [column]: value })).then(resolve);
      },
      select() {
        return self.findMany({ [column]: value });
      }
    };
  }
}

// 创建表访问函数
export function usersTable() {
  return new MysqlClient('users', ['settings', 'preferences']);
}

export function avatarsTable() {
  return new MysqlClient('avatars', ['profile', 'settings', 'styles', 'voiceSettings', 'personalityConfig']);
}

export function avatarSkillsTable() {
  return new MysqlClient('avatar_skills');
}

export function avatarMemoriesTable() {
  return new MysqlClient('avatar_memories', ['memoryData']);
}

export function avatarFriendsTable() {
  return new MysqlClient('avatar_friends');
}

export function postsTable() {
  return new MysqlClient('posts', ['mediaUrls', 'mentions', 'locationData']);
}

export function likesTable() {
  return new MysqlClient('likes');
}

export function commentsTable() {
  return new MysqlClient('comments');
}

export function followsTable() {
  return new MysqlClient('follows');
}

export function ordersTable() {
  return new MysqlClient('orders', ['orderDetails', 'metadata']);
}

export function orderResultsTable() {
  return new MysqlClient('order_results', ['resultData']);
}

export function orderDispatchRequestsTable() {
  return new MysqlClient('order_dispatch_requests', ['requestData']);
}

export function earningsTable() {
  return new MysqlClient('earnings', ['earningsData']);
}

export function transactionsTable() {
  return new MysqlClient('transactions', ['transactionData']);
}

export function withdrawalsTable() {
  return new MysqlClient('withdrawals');
}

export function subscriptionPlansTable() {
  return new MysqlClient('subscription_plans', ['features', 'limitations']);
}

export function userSubscriptionsTable() {
  return new MysqlClient('user_subscriptions', ['subscriptionData']);
}

export function notificationsTable() {
  return new MysqlClient('notifications', ['data']);
}

export function skillsTable() {
  return new MysqlClient('skills', ['config', 'capabilities']);
}

export function referralsTable() {
  return new MysqlClient('referrals');
}

export function recommendationsTable() {
  return new MysqlClient('recommendations', ['recommendationData']);
}

export function conversationsTable() {
  return new MysqlClient('conversations', ['contextData']);
}

export function messagesTable() {
  return new MysqlClient('messages', ['metadata']);
}

export function tasksTable() {
  return new MysqlClient('tasks', ['taskData', 'result']);
}

export function avatarAccountsTable() {
  return new MysqlClient('avatar_accounts', ['accountData', 'platformConfig']);
}

export function publishedWorksTable() {
  return new MysqlClient('published_works', ['mediaUrls']);
}

export function paymentOrdersTable() {
  return new MysqlClient('payment_orders', ['metadata']);
}

export function avatarHostingConfigsTable() {
  return new MysqlClient('avatar_hosting_configs', ['behaviorRules', 'scheduleConfig']);
}

export function avatarHostingLogsTable() {
  return new MysqlClient('avatar_hosting_logs');
}

export function verificationCodesTable() {
  return new MysqlClient('verification_codes');
}

// 独立导出 deleteRow 函数
export async function deleteRow(table: string, conditions: Record<string, any>): Promise<any> {
  return new MysqlClient(table).delete(conditions);
}

// 导出 getMySQLClient 函数 - 返回 MysqlClient 实例
export function getMySQLClient(table?: string): MysqlClient {
  return new MysqlClient(table || 'users');
}
