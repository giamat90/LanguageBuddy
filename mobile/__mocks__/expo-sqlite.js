/**
 * In-memory stand-in for expo-sqlite, good enough for the handful of statement
 * shapes the app's data layer uses (see src/services/*, src/data/*).
 * Supports: CREATE TABLE / INDEX / PRAGMA (noop), INSERT (with ON CONFLICT upsert),
 * UPDATE (col = v, col = col +/- N), SELECT (*, column list, COUNT(*) AS x) with
 * WHERE col =/<=/>= v [AND ...], ORDER BY, LIMIT/OFFSET.
 *
 * `?` placeholders are substituted positionally into the SQL string before parsing,
 * so SET-before-WHERE parameter ordering is handled correctly.
 */

let DATABASES = {};
const listeners = new Set();
let lastOpenOptions;

function reset() {
  DATABASES = {};
  listeners.clear();
  lastOpenOptions = undefined;
}

// Mirrors expo-sqlite's change listener (sqlite3_update_hook): one event per written row.
function addDatabaseChangeListener(listener) {
  listeners.add(listener);
  return { remove: () => listeners.delete(listener) };
}

function emitChange(tableName) {
  for (const listener of [...listeners]) {
    listener({ databaseName: 'main', databaseFilePath: '/mock/germanbuddy.db', tableName, rowId: 0 });
  }
}

// Table written by an INSERT / UPDATE / DELETE statement, or null for anything else.
function writtenTable(sql) {
  const m = sql.match(/^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i);
  return m ? m[1] : null;
}

function quote(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function substitute(sql, params) {
  const list = Array.isArray(params) ? params : Object.values(params || {});
  let i = 0;
  return sql.replace(/\?/g, () => quote(list[i++]));
}

function splitTop(str, sep) {
  const out = [];
  let depth = 0;
  let cur = '';
  let inStr = false;
  for (let k = 0; k < str.length; k++) {
    const ch = str[k];
    if (ch === "'") inStr = !inStr;
    if (!inStr && ch === '(') depth++;
    if (!inStr && ch === ')') depth--;
    if (!inStr && ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

function literal(token) {
  const t = token.trim();
  if (/^NULL$/i.test(t)) return null;
  if (/^'.*'$/s.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function makeDb() {
  const tables = {};
  const columns = {};
  const ensure = (name) => (tables[name] = tables[name] || []);
  const ensureCols = (name) => (columns[name] = columns[name] || new Set());

  function wherePredicate(str) {
    const preds = str.split(/\s+AND\s+/i).map((c) => {
      const m = c.trim().match(/^(\w+)\s*(<=|>=|<|>|=)\s*(.+)$/);
      if (!m) throw new Error('mock WHERE unsupported: ' + c);
      const [, col, op, valTok] = m;
      const val = literal(valTok);
      return (row) => {
        const rv = row[col];
        switch (op) {
          case '=': return rv === val;
          case '<=': return rv <= val;
          case '>=': return rv >= val;
          case '<': return rv < val;
          case '>': return rv > val;
          default: return false;
        }
      };
    });
    return (row) => preds.every((p) => p(row));
  }

  function run(rawSql) {
    const sql = rawSql.trim().replace(/;\s*$/, '');

    let m;
    if ((m = sql.match(/^PRAGMA table_info\((\w+)\)$/i))) {
      return [...ensureCols(m[1])].map((name) => ({ name }));
    }
    if (/^PRAGMA/i.test(sql)) return { changes: 0, lastInsertRowId: 0 };

    if ((m = sql.match(/^CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*)\)\s*$/i))) {
      const [, table, body] = m;
      ensure(table);
      const cols = ensureCols(table);
      for (const colDef of splitTop(body, ',')) {
        const name = colDef.trim().split(/\s+/)[0];
        if (name) cols.add(name);
      }
      return { changes: 0, lastInsertRowId: 0 };
    }
    if ((m = sql.match(/^ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)/i))) {
      const [, table, col] = m;
      ensure(table);
      ensureCols(table).add(col);
      return { changes: 0, lastInsertRowId: 0 };
    }
    if (/^CREATE INDEX/i.test(sql)) return { changes: 0, lastInsertRowId: 0 };

    if ((m = sql.match(/^DELETE FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/is))) {
      const [, table, whereStr] = m;
      const rows = ensure(table);
      const pred = whereStr ? wherePredicate(whereStr) : () => true;
      let changes = 0;
      for (let k = rows.length - 1; k >= 0; k--) {
        if (pred(rows[k])) {
          rows.splice(k, 1);
          changes++;
        }
      }
      return { changes, lastInsertRowId: 0 };
    }

    if ((m = sql.match(/^INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.+?)\)(?:\s+ON CONFLICT\s*\(([^)]+)\)\s*DO UPDATE SET\s+(.+))?$/is))) {
      const [, table, colStr, valStr, conflictCol, updateStr] = m;
      const cols = colStr.split(',').map((c) => c.trim());
      const vals = splitTop(valStr, ',').map(literal);
      const rows = ensure(table);
      const row = {};
      cols.forEach((c, i) => (row[c] = vals[i]));

      if (conflictCol) {
        const key = conflictCol.trim();
        const existing = rows.find((r) => r[key] === row[key]);
        if (existing) {
          updateStr.split(',').forEach((assign) => {
            const [lhs, rhs] = assign.split('=').map((s) => s.trim());
            const ref = rhs.replace(/^excluded\./, '');
            existing[lhs] = ref in row ? row[ref] : literal(rhs);
          });
          return { changes: 1, lastInsertRowId: 0 };
        }
      }
      rows.push(row);
      return { changes: 1, lastInsertRowId: rows.length };
    }

    if ((m = sql.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/is))) {
      const [, table, setStr, whereStr] = m;
      const rows = ensure(table);
      const pred = whereStr ? wherePredicate(whereStr) : () => true;
      const assigns = splitTop(setStr, ',').map((a) => a.trim());
      let changes = 0;
      for (const r of rows) {
        if (!pred(r)) continue;
        for (const a of assigns) {
          const eq = a.indexOf('=');
          const lhs = a.slice(0, eq).trim();
          const rhs = a.slice(eq + 1).trim();
          const arith = rhs.match(/^(\w+)\s*([+\-])\s*(\d+)$/);
          if (arith && arith[1] === lhs) {
            r[lhs] = (r[lhs] || 0) + (arith[2] === '+' ? 1 : -1) * Number(arith[3]);
          } else {
            r[lhs] = literal(rhs);
          }
        }
        changes++;
      }
      return { changes, lastInsertRowId: 0 };
    }

    if ((m = sql.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+([\w]+)\s*(ASC|DESC)?)?(?:\s+LIMIT\s+(-?\d+))?(?:\s+OFFSET\s+(-?\d+))?\s*$/is))) {
      const [, proj, table, whereStr, orderCol, orderDir, limitStr, offsetStr] = m;
      let rows = (tables[table] || []).map((r) => ({ ...r }));
      if (whereStr) rows = rows.filter(wherePredicate(whereStr));
      if (orderCol) {
        rows.sort((a, b) => (a[orderCol] > b[orderCol] ? 1 : a[orderCol] < b[orderCol] ? -1 : 0));
        if (/desc/i.test(orderDir || '')) rows.reverse();
      }
      const offset = offsetStr ? Number(offsetStr) : 0;
      if (offset) rows = rows.slice(offset);
      if (limitStr !== undefined && limitStr !== '' && limitStr != null) {
        rows = rows.slice(0, Number(limitStr));
      }

      const countM = proj.match(/COUNT\(\*\)\s+AS\s+(\w+)/i);
      if (countM) return [{ [countM[1]]: rows.length }];
      if (proj.trim() === '*') return rows;
      const cols = proj.split(',').map((c) => c.trim());
      return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
    }

    throw new Error('expo-sqlite mock: unsupported SQL: ' + sql);
  }

  return {
    execAsync: async (sql) => {
      for (const stmt of sql.split(';')) {
        if (!stmt.trim()) continue;
        run(stmt);
        const table = writtenTable(stmt);
        if (table) emitChange(table);
      }
    },
    runAsync: async (sql, params) => {
      const result = run(substitute(sql, params));
      const table = writtenTable(sql);
      if (table) emitChange(table);
      return result;
    },
    getFirstAsync: async (sql, params) => {
      const res = run(substitute(sql, params));
      return Array.isArray(res) ? res[0] ?? null : null;
    },
    getAllAsync: async (sql, params) => {
      const res = run(substitute(sql, params));
      return Array.isArray(res) ? res : [];
    },
    withTransactionAsync: async (fn) => { await fn(); },
    closeAsync: async () => {},
  };
}

async function openDatabaseAsync(name, options) {
  lastOpenOptions = options;
  if (!DATABASES[name]) DATABASES[name] = makeDb();
  return DATABASES[name];
}

module.exports = {
  openDatabaseAsync,
  addDatabaseChangeListener,
  __reset: reset,
  __emitChange: emitChange,
  __listenerCount: () => listeners.size,
  __lastOpenOptions: () => lastOpenOptions,
};
