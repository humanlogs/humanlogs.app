import DbService from "./db";
import LoggerDbService from "./logger-db";
import I18nService from "./i18n";
import PushEMailService from "./push-email";
import S3Service from "./s3";
import CronService from "./cron";
import LockService from "./lock";
import MQService from "./mq";
import SocketService from "./socket";
import RedisService from "./redis";

export default class Framework {
  public static Db: DbService;
  public static LoggerDb: LoggerDbService;
  public static PushEMail: PushEMailService;
  public static I18n: I18nService;
  public static S3: S3Service;
  public static Cron: typeof CronService;
  public static Lock: LockService;
  public static MQ: MQService;
  public static Socket: SocketService;
  public static Redis: RedisService;

  static async init() {
    console.log("Initializing platform services...");

    Framework.Db = await new DbService().init();
    Framework.LoggerDb = await new LoggerDbService().init();
    Framework.PushEMail = await new PushEMailService().init();
    Framework.I18n = await new I18nService().init();
    Framework.S3 = await new S3Service().init();
    Framework.Cron = CronService;
    Framework.Redis = await new RedisService().init();
    Framework.Lock = await new LockService().init(Framework.Redis);
    Framework.MQ = await new MQService().init();
    Framework.Socket = await new SocketService().init();

    await Framework.Db.getService();

    console.log("Finished initializing platform services...");
  }
}
