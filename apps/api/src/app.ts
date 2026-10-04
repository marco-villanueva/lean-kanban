import express, { type ErrorRequestHandler } from "express";
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
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Not found: ${req.method} ${req.path}`,
    },
  });
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Invalid JSON body",
      },
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error",
    },
  });
};

app.use(errorHandler);
