import { z } from "zod";

export const boardNameSchema = z.string().trim().min(1).max(120);
export const boardDescriptionSchema = z.string().max(2000);

export const columnNameSchema = z.string().trim().min(1).max(80);

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected format: #RRGGBB");

export const issueTitleSchema = z.string().trim().min(1).max(200);
export const issueDescriptionSchema = z.string().max(8000);

export const commentContentSchema = z.string().trim().min(1).max(4000);
