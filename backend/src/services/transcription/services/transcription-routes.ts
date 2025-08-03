import { Express } from "express";
import Framework from "../../../platform";
import { Context, createContext, CtxReq } from "../../../types";
import { TranscriptionType } from "../entities/transcriptions";
import { checkAuthenticated } from "../../account/services/register";
import { v4 as uuidv4 } from "uuid";

export const registerTranscriptionRoutes = async (app: Express) => {
  const db = await Framework.Db.getService();

  // Get all transcriptions for the authenticated user
  app.get(
    "/api/transcriptions",
    checkAuthenticated,
    async (req: CtxReq, res) => {
      try {
        const ctx = req.ctx;
        const search = req.query.search as string;

        let transcriptions;
        if (search) {
          transcriptions = await db.select<TranscriptionType>(
            ctx,
            "transcriptions",
            {
              owner_id: req.user.id,
              deleted: false,
              name: search, // You might need to implement a like search differently depending on your DB
            }
          );
        } else {
          transcriptions = await db.select<TranscriptionType>(
            ctx,
            "transcriptions",
            {
              owner_id: req.user.id,
              deleted: false,
            }
          );
        }

        // Sort by updated_at descending (most recent first)
        transcriptions.sort((a, b) => b.updated_at - a.updated_at);

        res.json(transcriptions);
      } catch (error) {
        console.error("Error fetching transcriptions:", error);
        res.status(500).json({ error: "Failed to fetch transcriptions" });
      }
    }
  );

  // Get a specific transcription
  app.get(
    "/api/transcriptions/:id",
    checkAuthenticated,
    async (req: CtxReq, res) => {
      try {
        const ctx = req.ctx;
        const transcription = await db.selectOne<TranscriptionType>(
          ctx,
          "transcriptions",
          {
            id: req.params.id,
            owner_id: req.user.id,
            deleted: false,
          }
        );

        if (!transcription) {
          return res.status(404).json({ error: "Transcription not found" });
        }

        res.json(transcription);
      } catch (error) {
        console.error("Error fetching transcription:", error);
        res.status(500).json({ error: "Failed to fetch transcription" });
      }
    }
  );

  // Create a new transcription
  app.post(
    "/api/transcriptions",
    checkAuthenticated,
    async (req: CtxReq, res) => {
      try {
        const ctx = req.ctx;
        const { name } = req.body;

        if (!name) {
          return res.status(400).json({ error: "Name is required" });
        }

        const transcription: TranscriptionType = {
          id: uuidv4(),
          name,
          audio_file: "",
          audio_length: 0,
          content: {},
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted: false,
          owner_id: req.user.id,
          state: "missing_audio",
        };

        await db.insert(ctx, "transcriptions", transcription);
        res.json(transcription);
      } catch (error) {
        console.error("Error creating transcription:", error);
        res.status(500).json({ error: "Failed to create transcription" });
      }
    }
  );

  // Update a transcription
  app.put(
    "/api/transcriptions/:id",
    checkAuthenticated,
    async (req: CtxReq, res) => {
      try {
        const ctx = req.ctx;
        const { name, audio_file, audio_length, content, state } = req.body;

        const transcription = await db.selectOne<TranscriptionType>(
          ctx,
          "transcriptions",
          {
            id: req.params.id,
            owner_id: req.user.id,
            deleted: false,
          }
        );

        if (!transcription) {
          return res.status(404).json({ error: "Transcription not found" });
        }

        const updates: Partial<TranscriptionType> = {
          updated_at: Date.now(),
        };

        if (name !== undefined) updates.name = name;
        if (audio_file !== undefined) updates.audio_file = audio_file;
        if (audio_length !== undefined) updates.audio_length = audio_length;
        if (content !== undefined) updates.content = content;
        if (state !== undefined) updates.state = state;

        await db.update<TranscriptionType>(
          ctx,
          "transcriptions",
          { id: req.params.id },
          updates
        );

        const updatedTranscription = await db.selectOne<TranscriptionType>(
          ctx,
          "transcriptions",
          {
            id: req.params.id,
          }
        );

        res.json(updatedTranscription);
      } catch (error) {
        console.error("Error updating transcription:", error);
        res.status(500).json({ error: "Failed to update transcription" });
      }
    }
  );

  // Delete a transcription (soft delete)
  app.delete(
    "/api/transcriptions/:id",
    checkAuthenticated,
    async (req: CtxReq, res) => {
      try {
        const ctx = req.ctx;
        const transcription = await db.selectOne<TranscriptionType>(
          ctx,
          "transcriptions",
          {
            id: req.params.id,
            owner_id: req.user.id,
            deleted: false,
          }
        );

        if (!transcription) {
          return res.status(404).json({ error: "Transcription not found" });
        }

        await db.update<TranscriptionType>(
          ctx,
          "transcriptions",
          { id: req.params.id },
          {
            deleted: true,
            updated_at: Date.now(),
          }
        );

        res.json({ message: "Transcription deleted successfully" });
      } catch (error) {
        console.error("Error deleting transcription:", error);
        res.status(500).json({ error: "Failed to delete transcription" });
      }
    }
  );

  // Upload audio file endpoint (using S3)
  app.post(
    "/api/transcriptions/:id/upload",
    checkAuthenticated,
    async (req: CtxReq, res) => {
      try {
        const ctx = req.ctx;
        const transcription = await db.selectOne<TranscriptionType>(
          ctx,
          "transcriptions",
          {
            id: req.params.id,
            owner_id: req.user.id,
            deleted: false,
          }
        );

        if (!transcription) {
          return res.status(404).json({ error: "Transcription not found" });
        }

        // Generate a signed URL for S3 upload
        const s3 = await Framework.S3.getService();
        const key = `transcriptions/${req.user.id}/${
          req.params.id
        }/${Date.now()}.mp3`;

        const uploadUrl = await s3.getSignedUploadUrl(
          key,
          "audio/mpeg",
          60 * 5
        ); // 5 minutes

        res.json({
          uploadUrl,
          key,
        });
      } catch (error) {
        console.error("Error generating upload URL:", error);
        res.status(500).json({ error: "Failed to generate upload URL" });
      }
    }
  );
};
