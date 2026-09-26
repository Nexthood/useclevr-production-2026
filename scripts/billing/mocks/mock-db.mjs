/**
 * In-memory replacement for `@/lib/db` used by the credit-topup behavioral
 * tests. It understands exactly the drizzle call shapes used by
 * `src/lib/billing/credit-topup-service.ts` and
 * `src/lib/billing/credit-engine.ts`:
 *   - db.query.<table>.findFirst({ where })      (eq / and(eq, eq) filters)
 *   - db.transaction(cb) with snapshot rollback on throw
 *   - tx.insert(table).values(...)[.returning()][.onConflictDoNothing()]
 *   - tx.update(table).set(...).where(eq(table.col, val))
 *   - tx.execute(sql`UPDATE "UserCredit" ...`)   (grant / refund / reserve /
 *     finalize shapes)
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
export const userCreditRows = []
export const profileRows = []
export const subscriptionPlanRows = []

export function resetMockDb() {
  topupRows.length = 0
  ledgerRows.length = 0
}

export function resetAllMockState() {
  topupRows.length = 0
  ledgerRows.length = 0
  userCreditRows.length = 0
  profileRows.length = 0
  subscriptionPlanRows.length = 0
}

function rowsFor(tableName) {
  if (tableName === "CreditTopUp") return topupRows
  if (tableName === "CreditLedger") return ledgerRows
  if (tableName === "UserCredit") return userCreditRows
  if (tableName === "Profile") return profileRows
  if (tableName === "SubscriptionPlan") return subscriptionPlanRows
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
const RESERVE_SQL = /UPDATE\s+"UserCredit"\s+SET\s+"reservedCredits"\s*=\s*"reservedCredits"\s*\+\s*(\d+)\s*,\s*"updatedAt"\s*=\s*'[^']*'\s*WHERE\s+"userId"\s*=\s*'([^']*)'\s*AND\s+\("remainingCredits"\s*-\s*"reservedCredits"\)\s*>=\s*(\d+)\s*RETURNING\s+"remainingCredits",\s*"reservedCredits"/
const FINALIZE_SQL = /UPDATE\s+"UserCredit"\s+SET\s+"reservedCredits"\s*=\s*GREATEST\(0,\s*"reservedCredits"\s*-\s*(\d+)\)\s*,\s*"remainingCredits"\s*=\s*"remainingCredits"\s*-\s*(\d+)\s*,\s*"usedCredits"\s*=\s*"usedCredits"\s*\+\s*(\d+)\s*,\s*"lifetimeCreditsUsed"\s*=\s*"lifetimeCreditsUsed"\s*\+\s*(\d+)\s*,\s*"includedBalance"\s*=\s*GREATEST\(0,\s*"includedBalance"\s*-\s*(\d+)\)\s*,\s*"purchasedBalance"\s*=\s*CASE\s+WHEN\s+"includedBalance"\s*>=\s*(\d+)\s+THEN\s+"purchasedBalance"\s+ELSE\s+"purchasedBalance"\s*-\s*GREATEST\(0,\s*(\d+)\s*-\s*"includedBalance"\)\s+END\s*,\s*"updatedAt"\s*=\s*'[^']*'\s+WHERE\s+"userId"\s*=\s*'([^']*)'\s+AND\s+\("remainingCredits"\s*-\s*"reservedCredits"\s*\+\s*(\d+)\)\s*>=\s*(\d+)\s+RETURNING/
const RELEASE_SQL = /UPDATE\s+"UserCredit"\s+SET\s+"reservedCredits"\s*=\s*GREATEST\(0,\s*"reservedCredits"\s*-\s*(\d+)\)\s*,\s*"updatedAt"\s*=\s*'[^']*'\s+WHERE\s+"userId"\s*=\s*'([^']*)'/

function applyUserCreditFinalization(userId, reservedCredits, debitedCredits) {
  const account = userCreditRows.find((row) => row.userId === userId)
  if (!account) return []
  if ((account.remainingCredits ?? 0) - (account.reservedCredits ?? 0) + reservedCredits < debitedCredits) return []
  account.reservedCredits = Math.max(0, (account.reservedCredits ?? 0) - reservedCredits)
  account.remainingCredits = (account.remainingCredits ?? 0) - debitedCredits
  account.usedCredits = (account.usedCredits ?? 0) + debitedCredits
  account.lifetimeCreditsUsed = (account.lifetimeCreditsUsed ?? 0) + debitedCredits
  const includedBefore = account.includedBalance ?? 0
  const includedAfter = Math.max(0, includedBefore - debitedCredits)
  account.includedBalance = includedAfter
  // Included credits are consumed first; only the overflow beyond the
  // included balance draws on the purchased balance, on every plan tier.
  account.purchasedBalance = Math.max(
    0,
    (account.purchasedBalance ?? 0) - Math.max(0, debitedCredits - includedBefore),
  )
  return [
    {
      remainingCredits: account.remainingCredits,
      usedCredits: account.usedCredits,
      includedBalance: account.includedBalance,
      purchasedBalance: account.purchasedBalance,
    },
  ]
}

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
  const release = text.match(RELEASE_SQL)
  if (release) {
    const userId = release[2]
    const releasedCredits = Number(release[1])
    const account = userCreditRows.find((row) => row.userId === userId)
    if (account) {
      account.reservedCredits = Math.max(0, (account.reservedCredits ?? 0) - releasedCredits)
    }
    return
  }
  const reserve = text.match(RESERVE_SQL)
  if (reserve) {
    const userId = reserve[2]
    const estimatedCredits = Number(reserve[1])
    // Match the engine guard: reservations draw from remaining credits on
    // every plan tier. Purchased credits stay consumable on Free, so there is
    // no tier-specific allowance clause. Groups: 1=estimate, 2=userId,
    // 3=remainingAvailable.
    const account = userCreditRows.find((row) => row.userId === userId)
    if (!account) return []
    const remainingAvailable = (account.remainingCredits ?? 0) - (account.reservedCredits ?? 0)
    if (remainingAvailable < estimatedCredits) return []
    account.reservedCredits = (account.reservedCredits ?? 0) + estimatedCredits
    return [{ remainingCredits: account.remainingCredits, reservedCredits: account.reservedCredits }]
  }
  const finalize = text.match(FINALIZE_SQL)
  if (finalize) {
    const userId = finalize[8]
    const reservedCredits = Number(finalize[1])
    const debitedCredits = Number(finalize[2])
    return applyUserCreditFinalization(userId, reservedCredits, debitedCredits)
  }
  throw new Error(`mock-db: unsupported SQL execution: ${text.slice(0, 200)}`)
}

/* ------------------------------------------------------------------ */
/* Query builders                                                      */
/* ------------------------------------------------------------------ */

function findFirst(rows) {
  return async ({ where }) => {
    const pairs = wherePairs(where)
    const row = rows.find((row) => matchesAll(row, pairs)) ?? null
    // Return a snapshot, like a real Postgres read: later UPDATEs must not
    // mutate an object a caller already holds as its "previous state"
    // (drizzle/Postgres never alias the stored row into query results).
    return row ? { ...row } : null
  }
}

function findMany(rows) {
  return async ({ where }) => {
    const pairs = wherePairs(where)
    return rows.filter((row) => matchesAll(row, pairs)).map((row) => ({ ...row }))
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
    // only shape the response, so the row is committed eagerly here. Arrays
    // insert one row per element (bulk values).
    values: (vals) => {
      const rowsToInsert = Array.isArray(vals) ? vals : [vals]
      const insertedRows = []
      for (const single of rowsToInsert) {
        const conflict = detectConflict(single)
        if (conflict) continue
        const row = { ...single }
        rows.push(row)
        insertedRows.push(row)
      }
      return {
        returning: async () => insertedRows,
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
      creditTopUps: { findFirst: findFirst(topupRows), findMany: findMany(topupRows) },
      creditLedger: { findFirst: findFirst(ledgerRows), findMany: findMany(ledgerRows) },
      userCredits: { findFirst: findFirst(userCreditRows), findMany: findMany(userCreditRows) },
      profiles: { findFirst: findFirst(profileRows), findMany: findMany(profileRows) },
      subscriptionPlans: { findFirst: findFirst(subscriptionPlanRows), findMany: findMany(subscriptionPlanRows) },
    },
    transaction: async (callback) => {
      const snapshot = {
        topups: structuredClone(topupRows),
        ledger: structuredClone(ledgerRows),
        credits: structuredClone(userCreditRows),
        profiles: structuredClone(profileRows),
        plans: structuredClone(subscriptionPlanRows),
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
        userCreditRows.length = 0
        userCreditRows.push(...snapshot.credits)
        profileRows.length = 0
        profileRows.push(...snapshot.profiles)
        subscriptionPlanRows.length = 0
        subscriptionPlanRows.push(...snapshot.plans)
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
