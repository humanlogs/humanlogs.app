import config from "config";
import { PlatformService } from "../types";
import DbPostgres, { ClientConfig } from "./adapters/postgres";
import { DbAdapterInterface } from "./api";

export default class Db implements PlatformService {
  private service: { [key: string]: DbAdapterInterface } = {};

  async init() {
    return this;
  }

  async getService() {
    const database: string = config.get<string>("db.database");

    if (!this.service[database]) {
      if (config.get<string>("db.type") === "postgres") {
        console.log("DB: Using Postgres");
        const client = config.get<ClientConfig>("db.postgres");
        this.service[database] = await new DbPostgres(database, client).init();
      }
    }

    return this.service[database];
  }
}
