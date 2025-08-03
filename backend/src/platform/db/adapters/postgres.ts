import fs from "fs";
import _ from "lodash";
import { Pool, PoolClient } from "pg";
import { v4 } from "uuid";
import Framework from "../..";
import { Context } from "../../../types";
import { Logger } from "../../logger-db";
import {
  Condition,
  DbAdapterInterface,
  DbComparators,
  TableDefinition,
} from "../api";
import { getWhereClause } from "../utils";

export type ClientConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
};

export default class DbPostgres implements DbAdapterInterface {
  private client: PoolClient | null = null;
  private pool: Pool | null = null;
  private logger: Logger;
  private debug = true;
  private tablesDefinitions: { [key: string]: TableDefinition } = {};

  constructor(private database: string, private config: ClientConfig) {
    this.logger = Framework.LoggerDb.get("db-postgres");
  }

  async getPool() {
    return this.pool;
  }

  async init() {
    const dbConfig = {
      ...this.config,
      database: this.database,
      connectionTimeoutMillis: 29000, // connexion initiale (30 secondes)
      idleTimeoutMillis: 30000, // durée max d'inactivité (30 secondes)
      max: 10, // nombre max de connexions
      keepAlive: false,
      ...(this.config.host.includes("rds.amazonaws.com")
        ? {
            ssl: {
              requestCert: true,
              rejectUnauthorized: true,
              ca: fs
                .readFileSync(
                  __dirname + "/../../../../assets/ca/eu-west-3-bundle.pem"
                )
                .toString(),
            },
          }
        : {}),
    };

    this.pool = new Pool(dbConfig);
    this.client = await this.pool.connect();

    try {
      await this.query(null, this.client, `CREATE DATABASE ${this.database}`);
    } catch (e) {
      this.logger.info(null, `Database ${this.database} already exists`);
    }

    this.client.release();
    this.pool = new Pool(dbConfig);
    this.client = await this.pool.connect();
    this.logger.info(null, `Connected to database ${this.database}`);

    //Extensions
    this.client.query(`CREATE EXTENSION IF NOT EXISTS unaccent;`);
    this.client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    this.client
      .query(`CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS $$
    SELECT unaccent($1);
    $$ LANGUAGE SQL IMMUTABLE;`);

    setInterval(() => {
      this.client!.query("SELECT now()").catch((err) =>
        console.error("Keep-Alive Error:", err)
      );
    }, 60000); // Toutes les 60 secondes

    return this;
  }

  async query(
    ctx: Context | null,
    client: PoolClient | null,
    queryText: string,
    values?: any[]
  ) {
    if (!client) throw new Error("No database client provided");
    const start = Date.now();
    try {
      return await client.query(queryText, values);
    } finally {
      const end = Date.now();
      this.logger.info(
        ctx,
        `[${queryText}] ${end - start}ms`,
        this.debug ? values : null
      );
    }
  }

  async createTable(definition: TableDefinition) {
    const {
      name,
      pk,
      indexes,
      columns: keyValueColumns,
      auditable,
    } = definition;

    this.tablesDefinitions[name] = definition;
    const columns = Object.entries(keyValueColumns).map(([name, type]) => ({
      name,
      type,
    }));

    // Construct columns SQL
    const columnsSql = columns
      .map((col) => `${col.name} ${col.type}`)
      .join(", ");

    // Construct primary key SQL
    const primaryKeySql = `PRIMARY KEY (${pk.join(", ")})`;

    // Initial table creation SQL
    const createTableSql = `CREATE TABLE IF NOT EXISTS ${name} (${columnsSql}, ${primaryKeySql})`;

    await this.query(null, this.client, createTableSql);

    // Check and update column types if needed
    for (const col of columns) {
      try {
        await this.query(
          null,
          this.client,
          `ALTER TABLE ${name} ADD COLUMN ${col.name} ${col.type}`
        );
      } catch (error: any) {
        console.log(error.message);
        if (error.message.includes("column")) {
          // If the column exists, try updating its type (this may fail if there are incompatible data types)
          try {
            await this.query(
              null,
              this.client,
              `ALTER TABLE ${name} ALTER COLUMN ${col.name} TYPE ${col.type}`
            );
          } catch (typeError: any) {
            this.logger.info(
              null,
              `Couldn't update column type for ${col.name} in ${name}. Reason: ${typeError.message}`
            );
          }
        }
      }
    }

    // Create additional indexes
    if (indexes) {
      for (const indexDef of indexes) {
        if (typeof indexDef === "object") {
          const indexColumns = indexDef;
          const indexName = `${name}_${indexColumns.join("_")}_idx`;
          const createIndexSql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${name} (${indexColumns.join(
            ", "
          )})`;
          await this.query(null, this.client, createIndexSql);
        } else {
          const indexName = `${name}_${indexDef
            .toLocaleLowerCase()
            .replace(/[^a-z]/gm, "_")
            .replace(/_+/gm, "_")}_idx`;
          const createIndexSql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${name} ${indexDef}`;
          await this.query(null, this.client, createIndexSql);
        }
      }
    }

    // History table creation
    if (auditable) {
      const historyColumnsSql = columns
        .map((col) => `${col.name} ${col.type}`)
        .concat([
          "operation VARCHAR(16) NOT NULL",
          "operation_timestamp BIGINT NOT NULL DEFAULT 0",
        ])
        .join(", ");

      const createHistoryTableSql = `CREATE TABLE IF NOT EXISTS ${name}_history (${historyColumnsSql})`;

      await this.query(null, this.client, createHistoryTableSql);

      for (const col of columns) {
        try {
          await this.query(
            null,
            this.client,
            `ALTER TABLE ${name}_history ADD COLUMN ${col.name} ${col.type}`
          );
        } catch (error) {
          if (error.message.includes("column")) {
            // If the column exists in the history table, try updating its type
            try {
              await this.query(
                null,
                this.client,
                `ALTER TABLE ${name}_history ALTER COLUMN ${col.name} TYPE ${col.type}`
              );
            } catch (typeError) {
              this.logger.info(
                null,
                `Couldn't update column type for ${col.name} in ${name}_history. Reason: ${typeError.message}`
              );
            }
          }
        }
      }
    }

    this.logger.info(null, `Table ${name} has been set up or updated.`);
  }

  async custom<Entity>(ctx: Context, sql: string, values?: any[]) {
    const client = ctx.db_tnx?.client || this.client;
    const result = await this.query(ctx, client, sql, values);
    return result.rows as Entity[];
  }

  async insert<Entity>(ctx: Context, table: string, document: Entity) {
    // TODO fixme Would be better to prevent any columns of this type not by column name
    document = _.omit(document as any, ["searchable_tsvector"]) as Entity;

    // Make sure dates are sent as numbers
    const cols = this.tablesDefinitions[table]?.columns || {};
    for (const type of Object.keys(cols)) {
      if (cols[type] === "BIGINT") {
        if (document[type]) {
          document[type] = new Date(document[type]).getTime();
        }
      }
    }

    const client = ctx.db_tnx?.client || this.client;
    const columns = Object.keys(document);
    const values = Object.values(document);
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(",");

    const queryText = `INSERT INTO ${table} (${columns.join(
      ", "
    )}) VALUES (${placeholders})`;

    await this.query(ctx, client, queryText, values);
    this.logger.info(ctx, `Inserted document into ${table}`);

    return document;
  }

  async update<Entity>(
    ctx: Context,
    table: string,
    condition: Condition<Entity>,
    document: Entity,
    options: {
      triggers?: boolean;
    }
  ) {
    // TODO fixme Would be better to prevent any columns of this type not by column name
    document = _.omit(document as any, ["searchable_tsvector"]) as Entity;

    // Make sure dates are sent as numbers
    const cols = this.tablesDefinitions[table]?.columns || {};
    for (const type of Object.keys(cols)) {
      if (cols[type] === "BIGINT") {
        if (document[type]) {
          document[type] = new Date(document[type]).getTime();
        }
      }
    }

    const client = ctx.db_tnx?.client || this.client;
    const updates = Object.keys(document)
      .map((key, idx) => `${key} = $${idx + 1}`)
      .join(", ");
    const values = Object.values(document);

    const { clause: whereClause, values: newValues } = getWhereClause(
      condition,
      values.length
    );
    values.push(...newValues);

    const queryText = `UPDATE ${table} SET ${updates} ${whereClause}`;
    await this.query(ctx, client, queryText, values);
    this.logger.info(
      ctx,
      `Updated document in ${table} with condition ${JSON.stringify(condition)}`
    );
  }

  async delete<Entity>(
    ctx: Context,
    table: string,
    condition: Condition<Entity>,
    options?: { ignoreSingleCheck?: boolean }
  ) {
    const client = ctx.db_tnx?.client || this.client;
    const { clause: whereClause, values } = getWhereClause(condition);

    if (whereClause === "") {
      throw new Error("Delete without condition is not allowed");
    }

    const queryText = `DELETE FROM ${table} ${whereClause}`;
    await this.query(ctx, client, queryText, values);
    this.logger.info(
      ctx,
      `Deleted from ${table} with condition ${JSON.stringify(condition)}`
    );
  }

  async select<Entity>(
    ctx: Context,
    table: string,
    condition: Condition<Entity>,
    options: {
      comparator?: DbComparators;
      limit?: number;
      offset?: number;
      asc?: boolean;
      index?: string;
      count?: boolean;
    } = {
      comparator: "=",
      limit: 100,
      asc: true,
    }
  ) {
    const client = ctx.db_tnx?.client || this.client;

    if (
      ctx.role === "SYSTEM" &&
      (condition as any).sql &&
      (condition as any).values
    ) {
      const result = await this.query(
        ctx,
        client,
        (condition as any).sql,
        (condition as any).values
      );
      return result.rows as Entity[];
    }

    if (ctx.role !== "SYSTEM" && (condition as any).where) {
      delete (condition as any).where;
    }

    const { clause: whereClause, values } = getWhereClause(condition);

    const limitClause =
      (options.limit ? `LIMIT ${parseInt(options.limit as any)}` : "") +
      " " +
      (options.offset ? `OFFSET ${parseInt(options.offset as any)}` : "");

    let orderClause = options.index
      ? `ORDER BY ${(options.index || "id").replace(
          /;|DELETE |SELECT |UPDATE |DROP |TRUNCATE /gim,
          ""
        )} ${options.asc ? "ASC" : "DESC"}`
      : "";
    if (options.index?.indexOf(",") > -1) {
      const indexes = options.index
        .split(",")
        .map((a) => a.split(" ").map((b) => b.trim()));
      orderClause = `ORDER BY ${indexes
        .map(
          (a) =>
            `${a[0]} ${
              options.asc
                ? a[1] || "asc"
                : a[1]?.toLocaleLowerCase() === "desc"
                ? "asc"
                : "desc"
            }`
        )
        .join(", ")}`;
    }

    const select = !options.count ? "SELECT *" : "SELECT count(*) as total";
    const queryText = `${select} FROM ${table} ${whereClause} ${orderClause} ${limitClause}`;
    const result = await this.query(ctx, client, queryText, values);

    // Convert back dates to numbers instead of strings
    const cols = this.tablesDefinitions[table]?.columns || {};
    for (const type of Object.keys(cols)) {
      if (cols[type] === "BIGINT") {
        result.rows.forEach((row: any) => {
          if (row[type] && typeof row[type] === "string") {
            row[type] = parseInt(row[type]);
          }
        });
      }
    }

    return result.rows as Entity[];
  }

  async count<Entity>(
    ctx: Context,
    table: string,
    condition: Condition<Entity>
  ) {
    const tmp = await this.select<Entity>(ctx, table, condition, {
      count: true,
    });
    return parseInt(tmp[0]["total"]);
  }

  async selectOne<Entity>(
    ctx: Context,
    table: string,
    condition: Condition<Entity>,
    options?: { ignoreSingleCheck?: boolean; index?: string }
  ) {
    const list = await this.select<Entity>(ctx, table, condition, {
      index: options?.index,
    });

    if (!list || list.length === 0) return null;
    if (list.length > 1 && !options?.ignoreSingleCheck) {
      throw new Error(
        "Multiple results found when only 1 was expected (memory)"
      );
    }

    return list[0];
  }

  async transaction<T>(
    ctx: Context,
    executor: (ctx: Context) => Promise<T>
  ): Promise<T> {
    const tnx = ctx.db_tnx || { id: v4(), client: await this.pool.connect() };
    try {
      await tnx.client.query("BEGIN");
      const res = await executor({ ...ctx, db_tnx: tnx });
      await tnx.client.query("COMMIT");
      return res;
    } catch (e) {
      await tnx.client.query("ROLLBACK");
      this.logger.info(ctx, "ROLLBACK transaction " + e.message);
      throw e;
    } finally {
      if (!ctx.db_tnx) tnx.client.release();
    }
  }
}
