import { Express } from "express";
import Framework from "../../platform";
import { TranscriptionDefinition } from "./entities/transcriptions";
import { registerTranscriptionRoutes } from "./services/transcription-routes";

export const registerTranscriptionService = async (app: Express) => {
  await registerTranscriptionRoutes(app);

  const db = await Framework.Db.getService();
  await db.createTable(TranscriptionDefinition);
};
