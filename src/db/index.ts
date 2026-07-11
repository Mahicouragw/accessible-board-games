import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __accessibleBoardGamesPool?: Pool;
  __accessibleBoardGamesDb?: ReturnType<typeof drizzle>;
};

function createMockDb() {
  // For Vercel build without DATABASE_URL and for local single-player mode
  // Returns empty results instead of crashing, allowing static build to succeed
  console.warn("⚠️ DATABASE_URL not set - running in single-player/demo mode (build will succeed)");

  const mockChain = {
    from: () => mockChain,
    where: () => mockChain,
    limit: () => Promise.resolve([]),
    select: () => mockChain,
    update: () => mockChain,
    set: () => mockChain,
    insert: () => mockChain,
    values: () => mockChain,
    returning: () => Promise.resolve([]),
    then: (resolve: any) => resolve([]),
    catch: () => mockChain,
  };

  // Make chain thenable
  const thenable = new Proxy(mockChain, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: any) => resolve([]);
      }
      if (prop in target) {
        return (target as any)[prop];
      }
      return () => thenable;
    },
  });

  const mockDb = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "select") return () => thenable;
        if (prop === "insert") return () => thenable;
        if (prop === "update") return () => thenable;
        if (prop === "delete") return () => thenable;
        return () => thenable;
      },
    }
  ) as ReturnType<typeof drizzle>;

  return mockDb;
}

function getPool() {
  if (!databaseUrl) {
    return null as unknown as Pool;
  }
  if (globalForDb.__accessibleBoardGamesPool) {
    return globalForDb.__accessibleBoardGamesPool;
  }
  try {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    pool.on("error", (err) => {
      console.error("PG Pool error", err);
    });
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__accessibleBoardGamesPool = pool;
    }
    return pool;
  } catch (e) {
    console.error("Failed to create PG pool", e);
    return null as unknown as Pool;
  }
}

function getDb() {
  if (!databaseUrl) {
    return createMockDb();
  }
  if (globalForDb.__accessibleBoardGamesDb) {
    return globalForDb.__accessibleBoardGamesDb;
  }
  try {
    const pool = getPool();
    if (!pool) return createMockDb();
    const dbInstance = drizzle(pool);
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__accessibleBoardGamesDb = dbInstance;
    }
    return dbInstance;
  } catch (e) {
    console.error("Failed to create drizzle db", e);
    return createMockDb();
  }
}

export const pool = getPool();
export const db = getDb();

export const isDbConfigured = () => !!databaseUrl;

export function requireDb() {
  if (!databaseUrl) {
    console.warn("DATABASE_URL missing - API will return demo mode");
  }
  return getDb();
}
