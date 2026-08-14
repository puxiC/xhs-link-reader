import { timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export function requireApiToken(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.XHS_API_TOKEN;
  if (!expected) return true;

  const supplied = getSuppliedToken(req);
  if (tokensMatch(supplied, expected)) return true;

  res.status(401).json({ ok: false, error: "Unauthorized" });
  return false;
}

export function requireMcpToken(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.XHS_API_TOKEN;
  if (!expected) return true;

  const supplied = getSuppliedToken(req);
  if (tokensMatch(supplied, expected)) return true;

  res.status(401).json({
    jsonrpc: "2.0",
    error: {
      code: -32001,
      message: "Unauthorized"
    },
    id: null
  });
  return false;
}

function getSuppliedToken(req: VercelRequest): string {
  const queryToken = firstString(req.query.token);
  if (queryToken) return queryToken;

  const apiToken = firstString(req.headers["x-api-token"]);
  if (apiToken) return apiToken;

  const authorization = firstString(req.headers.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function tokensMatch(supplied: string, expected: string): boolean {
  if (!supplied) return false;

  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.byteLength !== expectedBuffer.byteLength) return false;

  return timingSafeEqual(suppliedBuffer, expectedBuffer);
}
