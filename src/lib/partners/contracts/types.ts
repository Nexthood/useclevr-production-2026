import type { getDb } from "@/lib/db";
export type ContractDatabase = NonNullable<ReturnType<typeof getDb>>;
export type ContractDb =
  ContractDatabase | Parameters<Parameters<ContractDatabase["transaction"]>[0]>[0];
