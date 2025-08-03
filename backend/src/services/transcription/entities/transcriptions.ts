import { TableDefinition } from "../../../platform/db/api";
import { columnsFromEntity } from "../../../platform/db/utils";

export class TranscriptionType {
  id = "string";
  name = "string";
  audio_file = "string"; // S3 key for the audio file
  audio_length = 0; // in seconds
  content: any = {}; // JSON content for transcription result
  created_at = 0;
  updated_at = 0;
  deleted = false;
  owner_id = "string"; // reference to account id
  state = "missing_audio"; // "missing_audio", "transcribing", "ready"
}

export const TranscriptionDefinition: TableDefinition = {
  name: "transcriptions",
  columns: {
    ...columnsFromEntity(TranscriptionType),
  },
  pk: ["id"],
};
