import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireApiToken } from "../src/auth.js";
import { fetchXhsNote } from "../src/xhs.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!requireApiToken(req, res)) return;

  try {
    const url = typeof req.body?.url === "string" ? req.body.url : "";
    if (!url) return res.status(400).json({ ok: false, error: "Missing url" });

    const note = await fetchXhsNote(url);
    return res.status(200).json({ ok: true, note });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
