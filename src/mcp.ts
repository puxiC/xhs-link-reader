import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchXhsImages, fetchXhsNote } from "./xhs.js";

export function createXhsMcpServer() {
  const server = new McpServer({
    name: "xhs-link-reader",
    version: "0.1.0"
  });

  server.tool(
    "xhs_card",
    "Read a Xiaohongshu note URL and return title, author, text, image URLs, metrics, and comments.",
    {
      url: z.string().url()
    },
    async ({ url }) => {
      const note = await readCard(url);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: true, note }, null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    "xhs_images",
    "Download Xiaohongshu image URLs and return base64 image payloads.",
    {
      urls: z.array(z.string().url()).min(1).max(12)
    },
    async ({ urls }) => {
      const images = await readImages(urls);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: true, images }, null, 2)
          }
        ]
      };
    }
  );

  return server;
}

async function readCard(url: string) {
  const baseUrl = process.env.XHS_API_BASE_URL;
  if (!baseUrl) return fetchXhsNote(url);

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/xhs-card`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url })
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || "xhs-card failed");
  return payload.note;
}

async function readImages(urls: string[]) {
  const baseUrl = process.env.XHS_API_BASE_URL;
  if (!baseUrl) return fetchXhsImages(urls);

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/xhs-images`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ urls })
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || "xhs-images failed");
  return payload.images;
}
