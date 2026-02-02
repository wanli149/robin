/**
 * SQL Utilities
 * 安全的SQL查询构建工具
 */

/**
 * 生成安全的IN子句占位符
 * @param count 参数数量
 * @returns 占位符字符串，如 "?, ?, ?"
 */
export function generatePlaceholders(count: number): string {
  return Array(count).fill('?').join(', ');
}

/**
 * 构建安全的WHERE IN子句
 * @param column 列名
 * @param values 值数组
 * @returns { clause: string, values: any[] }
 */
export function buildWhereIn<T>(column: string, values: T[]): {
  clause: string;
  values: T[];
} {
  if (values.length === 0) {
    return { clause: '1=0', values: [] };
  }
  
  const placeholders = generatePlaceholders(values.length);
  return {
    clause: `${column} IN (${placeholders})`,
    values,
  };
}

/**
 * 构建安全的批量更新语句
 * @param table 表名
 * @param updates 更新字段映射
 * @param whereClause WHERE条件
 * @returns { sql: string, values: any[] }
 */
export function buildBatchUpdate(
  table: string,
  updates: Record<string, any>,
  whereClause: string
): {
  sql: string;
  values: any[];
} {
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  
  const setClause = fields.map(field => `${field} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  
  return { sql, values };
}

/**
 * 验证列名是否安全（防止SQL注入）
 * 只允许字母、数字、下划线
 */
export function isSafeColumnName(columnName: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(columnName);
}

/**
 * 验证表名是否安全（防止SQL注入）
 */
export function isSafeTableName(tableName: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(tableName);
}

/**
 * 构建安全的ORDER BY子句
 * @param column 列名
 * @param direction 排序方向
 * @returns ORDER BY子句或空字符串
 */
export function buildOrderBy(
  column: string,
  direction: 'ASC' | 'DESC' = 'ASC'
): string {
  if (!isSafeColumnName(column)) {
    throw new Error(`Invalid column name: ${column}`);
  }
  
  return `ORDER BY ${column} ${direction}`;
}

/**
 * 构建分页子句
 */
export function buildPagination(page: number, limit: number): {
  clause: string;
  values: number[];
} {
  const offset = (page - 1) * limit;
  return {
    clause: 'LIMIT ? OFFSET ?',
    values: [limit, offset],
  };
}
