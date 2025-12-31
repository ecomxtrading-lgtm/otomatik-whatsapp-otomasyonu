import path from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import webhookRoutes from "./routes/webhooks";
import panelRoutes from "./routes/panel";
import { registerRetryJob } from "./cron/retry";
import { logger } from "./utils/logger";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.use("/webhook", webhookRoutes);
app.use("/api", panelRoutes);

app.get("/panel", (_req, res) => {
  res.sendFile(path.join(publicDir, "panel.html"));
});

app.get("/", (_req, res) => res.redirect("/panel"));

registerRetryJob();

app.listen(port, () => {
  logger.info(`Server ${port} portunda calisiyor`);
});



