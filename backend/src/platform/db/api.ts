import { PoolClient } from "pg";
import { Context } from "../../types";
import { PlatformService } from "../types";

export type TableDefinition = {
  name: string;
  columns: { [key: string]: string };
  pk: string[];
  indexes?: (string | string[])[];
  auditable?: boolean;
};

export type RestTableDefinition = TableDefinition & {
  columns: { [key: string]: string; client_id: string; id: string };
};

export type TransactionExecutor = { id: string; client: PoolClient };

export type Condition<T> =
  | { where: string; values: any[] }
  | { sql: string; values: any[] }
  | Partial<T>
  | {
      [key: string]: string | string[];
    };

export type DbTableIndex = [string, "number" | "string"][];

export type DbComparators = ">" | "<" | "=" | "<=" | ">=" | "begins_with";

export type TransactionOperation<Entity> = {
  operation: "insert" | "update" | "delete";
  ctx: Context;
  table: string;
  document: Entity;
  condition: Condition<Entity>;
};

export interface DbAdapterInterface extends PlatformService {
  getPool(): any;

  createTable(definition: TableDefinition): Promise<void>;

  custom<Entity>(ctx: Context, sql: string, values?: any[]): Promise<Entity[]>;

  insert<Entity>(
    ctx: Context,
    table: string,
    document: Entity,
    options?: { triggers?: boolean }
  ): Promise<Entity>;

  update<Entity>(
    ctx: Context,
    table: string,
    condition: Condition<Entity>,
    document: Partial<Entity>,
    options?: { triggers?: boolean }
  ): Promise<void>;

  select<Entity>(
    ctx: Context,
    table: string,
    condition: Condition<Entity>,
    options?: {
      comparator?: DbComparators;
      limit?: number;
      offset?: number;
      asc?: boolean;
      index?: string;
    }
  ): Promise<Entity[]>;

  count<Entity>(
    ctx: Context,
    table: string,
    condition: Condition<Entity>
  ): Promise<number>;

  selectOne<Entity>(
    ctx: Context,
    table: string,
    condition: Condition<Entity>,
    options?: { ignoreSingleCheck?: boolean; index?: string; retry?: number }
  ): Promise<Entity>;

  delete<Entity>(
    ctx: Context,
    table: string,
    condition: Condition<Entity>,
    options?: { ignoreSingleCheck?: boolean }
  ): Promise<void>;

  transaction<T>(
    ctx: Context,
    executor: (ctx: Context) => Promise<T>
  ): Promise<T>;
}
