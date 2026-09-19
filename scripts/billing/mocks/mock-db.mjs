/**
 * In-memory replacement for `@/lib/db` used by the credit-topup behavioral
 * tests. It understands exactly the drizzle call shapes used by
 * `src/lib/billing/credit-topup-service.ts`:
 *   - db.query.<table>.findFirst({ where })      (eq / and(eq, eq) filters)
 *   - db.transaction(cb) with snapshot rollback on throw
 *   - tx.insert(table).values(...)[.returning()][.onConflictDoNothing()]
 *   - tx.update(table).set(...).where(eq(table.id, id))
 *   - tx.execute(sql`UPDATE "UserCredit" ...`)   (grant / refund shapes)
 *   - db.select().from(table).where(...).orderBy(...).limit(...)
 * Any unsupported call throws loudly instead of silently faking success.
 */

import { Column, Param, getTableName } from "drizzle-orm"
import {
  accountsStore,
  applyUserCreditGrant,
  applyUserCreditRefund,
} from "./mock-credit-account.mjs"

export const topupRows = []
export const ledgerRows = []

export function resetMockDb() {
  topupRows.length = 0
  ledgerRows.length = 0
}

export function resetAllMockState() {
  topupRows.length = 0
  ledgerRows.length = 0
}

function rowsFor(tableName) {
  if (tableName === "CreditTopUp") return topupRows
  if (tableName === "CreditLedger") return ledgerRows
  throw new Error(`mock-db: unsupported table "${tableName}"`)
}

/* ------------------------------------------------------------------ */
/* SQL chunk walking                                                   */
/* ------------------------------------------------------------------ */

function isSqlChunk(node) {
  return Boolean(node) && typeof node === "object" && Array.isArray(node.queryChunks)
}

function flattenChunks(node, out) {
  if (node == null) return
  if (Array.isArray(node)) {
    for (const child of node) flattenChunks(child, out)
    return
  }
  if (isSqlChunk(node)) {
    for (const child of node.queryChunks) flattenChunks(child, out)
    return
  }
  if (node instanceof Column) {
    out.push({ col: node.name })
    return
  }
  if (node instanceof Param) {
    out.push({ val: node.value })
    return
  }
  if (node instanceof Date) {
    out.push({ date: node.toISOString() })
    return
  }
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean" || typeof node === "bigint") {
    out.push({ val: node })
    return
  }
  if (Array.isArray(node.value)) {
    out.push({ str: node.value.join("") })
    return
  }
  if (typeof node === "object") {
    if (typeof node.name === "string" && node.table) {
      out.push({ col: node.name })
      return
    }
    if ("value" in node) {
      out.push({ val: node.value })
      return
    }
  }
}

function renderSql(node) {
  const tokens = []
  flattenChunks(node, tokens)
  return tokens
    .map((token) => {
      if (token.str !== undefined) return token.str
      if (token.col !== undefined) return `"${token.col}"`
      if (token.date !== undefined) return `'${token.date}'`
      return inlineValue(token.val)
    })
    .join("")
}

function inlineValue(value) {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number" || typeof value === "bigint") return String(value)
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  if (value instanceof Date) return `'${value.toISOString()}'`
  return `'${String(value).replace(/'/g, "''")}'`
}

function wherePairs(where) {
  const tokens = []
  flattenChunks(where, tokens)
  const pairs = []
  let pendingColumn = null
  for (const token of tokens) {
    if (token.col !== undefined) {
      pendingColumn = token.col
      continue
    }
    if (pendingColumn !== null && token.val !== undefined) {
      pairs.push([pendingColumn, token.val])
      pendingColumn = null
    }
  }
  return pairs
}

function matchesAll(row, pairs) {
  return pairs.every(([key, value]) => row[key] === value)
}

/* ------------------------------------------------------------------ */
/* Raw SQL execution (UserCredit grant / refund shapes)                */
/* ------------------------------------------------------------------ */

const GRANT_SQL = /UPDATE\s+"UserCredit"\s+SET\s+"purchasedBalance"\s*=\s*"purchasedBalance"\s*\+\s*(\d+)\s*,\s*"remainingCredits"\s*=\s*"remainingCredits"\s*\+\s*(\d+)\s*,\s*"totalPaidCents"\s*=\s*"totalPaidCents"\s*\+\s*(\d+)\s*,\s*"lifetimeCreditsEarned"\s*=\s*"lifetimeCreditsEarned"\s*\+\s*(\d+)[\s\S]*?WHERE\s+"userId"\s*=\s*'([^']*)'/
const REFUND_SQL = /UPDATE\s+"UserCredit"\s+SET\s+"purchasedBalance"\s*=\s*"purchasedBalance"\s*-\s*(\d+)\s*,\s*"remainingCredits"\s*=\s*GREATEST\("remainingCredits"\s*-\s*(\d+),\s*0\)[\s\S]*?WHERE\s+"userId"\s*=\s*'([^']*)'/

function executeRawSql(sqlObject) {
  const text = renderSql(sqlObject)
  const grant = text.match(GRANT_SQL)
  if (grant) {
    applyUserCreditGrant(grant[5], Number(grant[1]), Number(grant[3]))
    return
  }
  const refund = text.match(REFUND_SQL)
  if (refund) {
    applyUserCreditRefund(refund[3], Number(refund[1]), 0)
    return
  }
  throw new Error(`mock-db: unsupported SQL execution: ${text.slice(0, 200)}`)
}

/* ------------------------------------------------------------------ */
/* Query builders                                                      */
/* ------------------------------------------------------------------ */

function findFirst(rows) {
  return async ({ where }) => {
    const pairs = wherePairs(where)
    return rows.find((row) => matchesAll(row, pairs)) ?? null
  }
}

function insertBuilder(tableName) {
  const rows = rowsFor(tableName)
  const detectConflict = (values) => {
    if (tableName === "CreditTopUp") {
      return topupRows.some(
        (row) => row.provider === values.provider && row.providerPaymentId === values.providerPaymentId,
      )
    }
    if (tableName === "CreditLedger" && values.idempotencyKey) {
      return ledgerRows.some((row) => row.idempotencyKey === values.idempotencyKey)
    }
    return false
  }

  return {
    // Drizzle inserts apply on .values() — .returning()/.onConflictDoNothing()
    // only shape the response, so the row is committed eagerly here.
    values: (vals) => {
      const conflict = detectConflict(vals)
      if (conflict) {
        return {
          returning: async () => [],
          onConflictDoNothing: async () => undefined,
        }
      }
      const row = { ...vals }
      rows.push(row)
      return {
        returning: async () => [row],
        onConflictDoNothing: async () => {},
      }
    },
  }
}

function updateBuilder(tableName) {
  const rows = rowsFor(tableName)
  return {
    set: (partial) => ({
      where: async (where) => {
        const pairs = wherePairs(where)
        for (const row of rows) {
          if (matchesAll(row, pairs)) {
            for (const [key, value] of Object.entries(partial)) {
              if (isSqlChunk(value)) {
                throw new Error(`mock-db: unsupported SQL expression in update set for ${tableName}.${key}`)
              }
              row[key] = value
            }
          }
        }
        // SQL UPDATE semantics: matching zero rows is not an error.
      },
    }),
  }
}

function selectBuilder(tableName) {
  const rows = rowsFor(tableName)
  const state = { where: null }
  const exec = () => {
    const filtered = state.where ? rows.filter((row) => matchesAll(row, state.where)) : [...rows]
    return filtered
  }
  return {
    where: (where) => {
      state.where = wherePairs(where)
      return {
        orderBy: () => ({
          limit: async (limit) => exec().slice(0, limit),
        }),
        limit: async (limit) => exec().slice(0, limit),
      }
    },
  }
}

/* ------------------------------------------------------------------ */
/* Database object                                                     */
/* ------------------------------------------------------------------ */

function makeDb() {
  return {
    query: {
      creditTopUps: { findFirst: findFirst(topupRows) },
      creditLedger: { findFirst: findFirst(ledgerRows) },
    },
    transaction: async (callback) => {
      const snapshot = {
        topups: structuredClone(topupRows),
        ledger: structuredClone(ledgerRows),
        accounts: new Map(
          [...accountsStore.entries()].map(([key, value]) => [key, structuredClone(value)]),
        ),
      }
      try {
        return await callback(makeDb())
      } catch (error) {
        topupRows.length = 0
        topupRows.push(...snapshot.topups)
        ledgerRows.length = 0
        ledgerRows.push(...snapshot.ledger)
        accountsStore.clear()
        for (const [key, value] of snapshot.accounts) accountsStore.set(key, value)
        throw error
      }
    },
    insert: (table) => insertBuilder(getTableName(table)),
    update: (table) => updateBuilder(getTableName(table)),
    select: () => ({
      from: (table) => selectBuilder(getTableName(table)),
    }),
    execute: async (sqlObject) => executeRawSql(sqlObject),
  }
}

export function getDb() {
  return makeDb()
}
