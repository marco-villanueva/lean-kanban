import express from "express";
import cors from "cors";
import { migrate } from "./db.js";
import { boardsRouter } from "./boards.js";
import { columnsRouter } from "./columns.js";
import { issuesRouter } from "./issues.js";
import { commentsRouter } from "./comments.js";
import { importExportRouter } from "./import-export.js";

migrate();

export const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Basic logging: method path status duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/boards", boardsRouter);
app.use("/api", columnsRouter);
app.use("/api", issuesRouter);
app.use("/api", commentsRouter);
app.use("/api", importExportRouter);

app.use((req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `Not found: ${req.method} ${req.path}` } });
});

const port = Number(process.env.PORT ?? 3001);
if (process.env.VITEST !== "true" && process.argv[1]?.endsWith("app.ts")) {
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}
