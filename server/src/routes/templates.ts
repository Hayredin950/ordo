import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireUser } from "./auth.js";

export const templatesRouter = Router();

const publishSchema = z.object({
  name: z.string().min(1).max(80),
  blocks: z.array(z.record(z.unknown())).min(1).max(40),
});

templatesRouter.get("/public", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, author_name, name, blocks, copies, created_at
       FROM public_templates
      ORDER BY created_at DESC
      LIMIT 100`,
  );
  res.json({ templates: rows });
});

templatesRouter.post("/publish", requireUser, async (req: any, res) => {
  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid template" });
  const { rows } = await pool.query(
    `INSERT INTO public_templates (author_id, author_name, name, blocks)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, blocks, copies, created_at`,
    [req.user.id, req.user.name || req.user.email.split("@")[0], parsed.data.name, JSON.stringify(parsed.data.blocks)],
  );
  res.json({ template: rows[0] });
});

templatesRouter.post("/:id/copy", requireUser, async (req: any, res) => {
  const { rows } = await pool.query<{ name: string; blocks: unknown }>(
    `UPDATE public_templates SET copies = copies + 1
      WHERE id = $1
      RETURNING name, blocks`,
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Template not found" });
  res.json({ name: rows[0].name, blocks: rows[0].blocks });
});
