/**
 * In-memory replacement for `@/lib/db` used by the BYOK provider-required
 * behavioral tests. It understands exactly the drizzle call shapes used by
 * `src/lib/ai/byoai-provider.ts`:
 *   - db.query.aiProviderConfigs.findFirst/findMany({ where, orderBy, columns })
 *   - db.select({...}).from(appSettings).where(...).limit(...)
 *   - db.insert(...).values(...)[.onConflictDoUpdate(...)]
 *   - db.update(...).set(...).where(...)
 *   - db.delete(...).where(...).returning()
 * Any unsupported call throws loudly instead of silently faking success.
 */

import { Column, Param, getTableName } from "drizzle-orm"

export const providerRows = []
export const settingRows = []

export function resetAiMockState() {
  providerRows.length = 0
  settingRows.length = 0
}

function rowsFor(tableName) {
  if (tableName === "AiProviderConfig") return providerRows
  if (tableName === "AppSetting") return settingRows
  throw new Error(`mock-ai-db: unsupported table "${tableName}"`)
}

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

function wherePairs(where) {
  if (!where) return []
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

function columnDirection(orderBy) {
  const tokens = []
  flattenChunks(orderBy, tokens)
  const col = tokens.find((token) => token.col !== undefined)?.col ?? ""
  const descending = tokens.some((token) => token.str !== undefined && /desc/i.test(token.str))
  return { col, descending }
}

function sortedCopy(rows, orderBy) {
  const columns = Array.isArray(orderBy) ? orderBy.map(columnDirection) : []
  return [...rows].sort((a, b) => {
    for (const { col, descending } of columns) {
      const av = a[col]
      const bv = b[col]
      if (av === bv) continue
      const cmp = av > bv ? 1 : -1
      return descending ? -cmp : cmp
    }
    return 0
  })
}

function findFirst(rows) {
  return async ({ where }) => {
    const pairs = wherePairs(where)
    const row = rows.find((row) => matchesAll(row, pairs)) ?? null
    return row ? { ...row } : null
  }
}

function findMany(rows) {
  return async ({ where, orderBy } = {}) => {
    const pairs = wherePairs(where)
    const filtered = rows.filter((row) => matchesAll(row, pairs))
    return sortedCopy(filtered, orderBy).map((row) => ({ ...row }))
  }
}

function insertBuilder(tableName) {
  const rows = rowsFor(tableName)
  const keyColumn = tableName === "AppSetting" ? "key" : "id"
  return {
    values: (values) => {
      const row = { ...values }
      const key = row[keyColumn]
      const existingIndex = key !== undefined ? rows.findIndex((candidate) => candidate[keyColumn] === key) : -1
      if (existingIndex >= 0) rows[existingIndex] = row
      else rows.push(row)
      return {
        returning: async () => [{ ...row }],
        onConflictDoNothing: () => Promise.resolve([]),
        onConflictDoUpdate: ({ set }) => {
          for (const [column, value] of Object.entries(set)) row[column] = value
          return Promise.resolve([])
        },
        then: (onFulfilled, onRejected) => Promise.resolve([{ ...row }]).then(onFulfilled, onRejected),
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
                throw new Error(`mock-ai-db: unsupported SQL expression in update set for ${tableName}.${key}`)
              }
              row[key] = value
            }
          }
        }
      },
    }),
  }
}

function deleteBuilder(tableName) {
  const rows = rowsFor(tableName)
  return {
    where: async (where) => {
      const pairs = wherePairs(where)
      const removed = []
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (matchesAll(rows[index], pairs)) {
          removed.unshift({ ...rows[index] })
          rows.splice(index, 1)
        }
      }
      return removed
    },
  }
}

function selectBuilder(tableName) {
  const rows = rowsFor(tableName)
  const state = { where: null, orderBy: null }
  const exec = () => {
    const filtered = state.where ? rows.filter((row) => matchesAll(row, state.where)) : [...rows]
    return sortedCopy(filtered, state.orderBy)
  }
  return {
    where: (where) => {
      state.where = wherePairs(where)
      return {
        orderBy: (orderBy) => {
          state.orderBy = orderBy
          return {
            limit: async (limit) => exec().slice(0, limit),
          }
        },
        limit: async (limit) => exec().slice(0, limit),
      }
    },
    orderBy: (orderBy) => {
      state.orderBy = orderBy
      return {
        limit: async (limit) => exec().slice(0, limit),
      }
    },
    limit: async (limit) => exec().slice(0, limit),
  }
}

function makeDb() {
  return {
    query: {
      aiProviderConfigs: { findFirst: findFirst(providerRows), findMany: findMany(providerRows) },
      appSettings: { findFirst: findFirst(settingRows), findMany: findMany(settingRows) },
    },
    insert: (table) => insertBuilder(getTableName(table)),
    update: (table) => updateBuilder(getTableName(table)),
    delete: (table) => deleteBuilder(getTableName(table)),
    select: () => ({
      from: (table) => selectBuilder(getTableName(table)),
    }),
  }
}

export const db = makeDb()

export function getDb() {
  return makeDb()
}
