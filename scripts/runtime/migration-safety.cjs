const MIGRATION_LIMITS = Object.freeze({
  connectionTimeoutMillis: 10_000,
  lockTimeoutMillis: 3_000,
  statementTimeoutMillis: 60_000,
  transactionTimeoutMillis: 120_000,
  idleTimeoutMillis: 30_000,
  cleanupTimeoutMillis: 5_000,
});

function safetyError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

// Error messages/detail/queries can contain credentials or row values. Log codes only.
function safeFailure(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const allowed = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "MIGRATION_TRANSACTION_TIMEOUT",
    "MIGRATION_CLEANUP_TIMEOUT",
    "MIGRATION_DATABASE_REQUIRED",
    "MIGRATION_VERSION_UNSUPPORTED",
  ]);
  return {
    code: /^[0-9A-Z]{5}$/.test(code) || allowed.has(code) ? code : "MIGRATION_FAILED",
  };
}

/** One connection, one transaction, no retries. Limits never affect app connections. */
async function runMigration(client, migrate, { limits = MIGRATION_LIMITS, log = () => {} } = {}) {
  let connected = false;
  let transaction = false;
  let stage = "connect";
  let originalFailure;
  let timer;
  let expire;
  let rejectConnection;
  const connectionFailure = new Promise((_, reject) => {
    rejectConnection = reject;
  });
  const onError = (error) => rejectConnection(error);
  client.on("error", onError);
  // end() destroys an active pg query's connection; PostgreSQL rolls back an open
  // transaction on disconnect. A rejected query Promise alone is not cancellation.
  const stop = () => client.end();
  let ending;
  const end = () => (ending ||= stop());
  const run = async () => {
    await client.connect();
    connected = true;
    clearTimeout(timer);
    timer = setTimeout(expire, limits.transactionTimeoutMillis);
    stage = "configure";
    await client.query(
      "SELECT set_config('lock_timeout', $1, false), set_config('statement_timeout', $2, false), set_config('idle_in_transaction_session_timeout', $3, false)",
      [limits.lockTimeoutMillis, limits.statementTimeoutMillis, limits.idleTimeoutMillis].map(
        String,
      ),
    );
    const result = await client.query(
      "SELECT current_setting('server_version_num')::integer AS version",
    );
    const version = Number(result.rows[0]?.version);
    if (!Number.isInteger(version) || version < 120000)
      throw safetyError("MIGRATION_VERSION_UNSUPPORTED");
    const nativeTransactionTimeout = version >= 170000;
    if (nativeTransactionTimeout) {
      await client.query("SELECT set_config('transaction_timeout', $1, false)", [
        String(limits.transactionTimeoutMillis),
      ]);
      // Let PostgreSQL terminate first; retain a bounded transport-failure fallback.
      clearTimeout(timer);
      timer = setTimeout(expire, limits.transactionTimeoutMillis + limits.cleanupTimeoutMillis);
    }
    log("Migration compatibility", { serverVersionNum: version, nativeTransactionTimeout });
    stage = "begin";
    await client.query("BEGIN");
    transaction = true;
    stage = "migrate";
    await migrate(client);
    stage = "commit";
    await client.query("COMMIT");
    transaction = false;
  };
  // Includes configuration/transaction work plus the bounded connection attempt.
  // Also protects PostgreSQL 12–16, where transaction_timeout is unavailable.
  const deadline = new Promise((_, reject) => {
    expire = () => {
      reject(safetyError("MIGRATION_TRANSACTION_TIMEOUT"));
      void end().catch(() => {});
    };
    timer = setTimeout(expire, limits.connectionTimeoutMillis + limits.transactionTimeoutMillis);
  });
  try {
    await Promise.race([run(), connectionFailure, deadline]);
  } catch (error) {
    originalFailure = error;
    // Preserve the original object/SQLSTATE even if timeout already closed pg.
    log("Migration failed", {
      stage,
      ...safeFailure(error),
      commitOutcomeUnknown: stage === "commit",
    });
    if (connected && transaction && !ending) {
      try {
        let rollbackTimer;
        try {
          await Promise.race([
            client.query("ROLLBACK"),
            new Promise((_, reject) => {
              rollbackTimer = setTimeout(() => {
                reject(safetyError("MIGRATION_CLEANUP_TIMEOUT"));
                void end().catch(() => {});
              }, limits.cleanupTimeoutMillis);
            }),
          ]);
        } finally {
          clearTimeout(rollbackTimer);
        }
      } catch (rollbackError) {
        log("Migration rollback unavailable; connection closes", safeFailure(rollbackError));
      }
    }
    throw error;
  } finally {
    clearTimeout(timer);
    let cleanupTimer;
    try {
      await Promise.race([
        end(),
        new Promise((_, reject) => {
          cleanupTimer = setTimeout(
            () => reject(safetyError("MIGRATION_CLEANUP_TIMEOUT")),
            limits.cleanupTimeoutMillis,
          );
        }),
      ]);
    } catch (cleanupError) {
      log("Migration connection cleanup failed", safeFailure(cleanupError));
      // Preserve any existing exception; a cleanup failure must also fail success.
      if (!originalFailure) throw cleanupError;
    } finally {
      clearTimeout(cleanupTimer);
    }
  }
}

module.exports = { MIGRATION_LIMITS, runMigration, safeFailure, safetyError };
