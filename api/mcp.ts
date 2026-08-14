import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireMcpToken } from "../src/auth.js";
import { createXhsMcpServer } from "../src/mcp.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    });
  }

  if (!requireMcpToken(req, res)) return;

  const server = createXhsMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error"
        },
        id: null
      });
    }
  } finally {
    await transport.close();
    await server.close();
  }
}

function setCorsHeaders(res: VercelResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader(
    "access-control-allow-headers",
    [
      "accept",
      "authorization",
      "content-type",
      "last-event-id",
      "mcp-protocol-version",
      "mcp-session-id",
      "x-api-token"
    ].join(", ")
  );
  res.setHeader("access-control-expose-headers", "mcp-session-id");
}
