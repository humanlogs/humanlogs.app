import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerAccountRoutes } from "./services/account";
import { registerTranscriptionService } from "./services/transcription";
import { withCtx } from "./types";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(withCtx);

// Register services
const initServices = async () => {
  try {
    await registerAccountRoutes(app);
    await registerTranscriptionService(app);
    console.log("All services registered successfully");
  } catch (error) {
    console.error("Error registering services:", error);
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Backend server is running!" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Initialize services and start server
initServices().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
