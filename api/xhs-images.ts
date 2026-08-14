import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchXhsImages } from "../src/xhs.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const urls = Array.isArray(req.body?.urls)
      ? (req.body.urls as unknown[]).filter((url): url is string => typeof url === "string")
      : [];
    if (urls.length === 0) return res.status(400).json({ ok: false, error: "Missing urls" });

    const images = await fetchXhsImages(urls);
    return res.status(200).json({ ok: true, images });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
