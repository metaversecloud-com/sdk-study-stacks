import express from "express";
import {
  handleAnswerCard,
  handleCompleteSession,
  handleDeleteDeck,
  handleGetConfig,
  handleGetDeck,
  handleSaveDeck,
  handleStartSession,
} from "./controllers/index.js";
import { getVersion } from "@utils/getVersion.js";

const router = express.Router();
const SERVER_START_DATE = new Date();

router.get("/", (req, res) => {
  res.json({ message: "Hello from Study Stacks!" });
});

router.get("/system/health", (req, res) => {
  return res.json({
    appVersion: getVersion(),
    status: "OK",
    serverStartDate: SERVER_START_DATE,
    envs: {
      COMMIT_HASH: process.env.COMMIT_HASH ?? "NOT SET",
      BUILD_TIME: process.env.BUILD_TIME ?? "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
      INSTANCE_DOMAIN: process.env.INSTANCE_DOMAIN,
      INTERACTIVE_KEY: process.env.INTERACTIVE_KEY,
    },
  });
});

router.get("/config", handleGetConfig);

// Admin deck CRUD
router.post("/decks", handleSaveDeck);
router.delete("/decks/:deckId", handleDeleteDeck);

// Single deck (with mastery for this visitor)
router.get("/decks/:deckId", handleGetDeck);

// Study session
router.post("/session/start", handleStartSession);
router.post("/session/answer", handleAnswerCard);
router.post("/session/complete", handleCompleteSession);

export default router;
