export type XhsComment = {
  user: string;
  content: string;
  ipLocation?: string;
};

export type XhsNote = {
  title: string;
  author: string;
  desc: string;
  images: string[];
  imageCount: number;
  likedCount?: string | number;
  commentCount?: string | number;
  collectedCount?: string | number;
  comments: XhsComment[];
  url: string;
};

export type XhsImage = {
  url: string;
  base64: string;
  mime: string;
};

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

export async function fetchXhsNote(url: string): Promise<XhsNote> {
  const targetUrl = normalizeInputUrl(url);
  const response = await fetch(targetUrl, {
    redirect: "follow",
    headers: {
      "user-agent": MOBILE_UA,
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      referer: "https://www.xiaohongshu.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`XHS page request failed: ${response.status}`);
  }

  const finalUrl = response.url || targetUrl;
  const html = await response.text();
  const state = extractInitialState(html);
  const note = extractNoteFromState(state, finalUrl);

  if (!note.title && !note.desc && note.images.length === 0) {
    throw new Error("Could not find note data in __INITIAL_STATE__");
  }

  return note;
}

export async function fetchXhsImages(urls: string[]): Promise<XhsImage[]> {
  const uniqueUrls = [...new Set(urls.map(normalizeImageUrl).filter(Boolean))].slice(0, 12);
  const results = await Promise.all(uniqueUrls.map(fetchOneImage));
  return results.filter((image): image is XhsImage => Boolean(image));
}

function normalizeInputUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("URL must start with http:// or https://");
  }
  return trimmed;
}

function normalizeImageUrl(url: string): string {
  const cleaned = url.replace(/\\u002F/g, "/").trim();
  if (cleaned.startsWith("//")) return `https:${cleaned}`;
  return cleaned;
}

async function fetchOneImage(url: string): Promise<XhsImage | null> {
  const response = await fetch(url, {
    headers: {
      "user-agent": MOBILE_UA,
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      referer: "https://www.xiaohongshu.com/"
    }
  });

  if (!response.ok) return null;

  const mime = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > 8 * 1024 * 1024) return null;

  return {
    url,
    mime,
    base64: buffer.toString("base64")
  };
}

function extractInitialState(html: string): unknown {
  const marker = "window.__INITIAL_STATE__";
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error("window.__INITIAL_STATE__ not found");
  }

  const equalsIndex = html.indexOf("=", markerIndex);
  const objectStart = html.indexOf("{", equalsIndex);
  if (equalsIndex < 0 || objectStart < 0) {
    throw new Error("__INITIAL_STATE__ object start not found");
  }

  const objectText = readBalancedObject(html, objectStart)
    .replace(/undefined/g, "null")
    .replace(/\\u002F/g, "/");

  return JSON.parse(objectText);
}

function readBalancedObject(input: string, start: number): string {
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return input.slice(start, index + 1);
    }
  }

  throw new Error("__INITIAL_STATE__ object end not found");
}

function extractNoteFromState(state: unknown, url: string): XhsNote {
  const root = asRecord(state);
  const candidates = [
    getPath(root, ["noteData", "data", "noteData"]),
    getPath(root, ["noteData", "normalNotePreloadData"]),
    getPath(root, ["note", "noteDetailMap"]),
    findFirstRecord(root, looksLikeNote)
  ];

  const rawNote = candidates.map(unwrapNoteCandidate).find((item) => item && looksLikeNote(item));
  const note = asRecord(rawNote || {});
  const user = asRecord(firstValue(note, ["user", "userInfo", "author"]));
  const interactInfo = asRecord(firstValue(note, ["interactInfo", "interact_info"]));

  const images = extractImages(note);
  const comments = extractComments(root);

  return {
    title: asString(firstValue(note, ["title", "displayTitle"])),
    author: asString(firstValue(user, ["nickname", "name", "nickName"])),
    desc: asString(firstValue(note, ["desc", "description", "content"])),
    images,
    imageCount: images.length,
    likedCount: asCount(firstValue(interactInfo, ["likedCount", "liked_count", "likeCount"])),
    commentCount: asCount(firstValue(interactInfo, ["commentCount", "comment_count"])),
    collectedCount: asCount(firstValue(interactInfo, ["collectedCount", "collected_count", "collectCount"])),
    comments,
    url
  };
}

function unwrapNoteCandidate(candidate: unknown): Record<string, unknown> | null {
  const record = asRecord(candidate);
  if (looksLikeNote(record)) return record;

  const values = Object.values(record);
  for (const value of values) {
    const nested = asRecord(value);
    if (looksLikeNote(nested)) return nested;
    const note = asRecord(firstValue(nested, ["note", "noteCard", "noteData"]));
    if (looksLikeNote(note)) return note;
  }

  return null;
}

function looksLikeNote(value: unknown): value is Record<string, unknown> {
  const record = asRecord(value);
  return Boolean(
    firstValue(record, ["title", "displayTitle", "desc", "description", "imageList", "images"])
  );
}

function extractImages(note: Record<string, unknown>): string[] {
  const imageList = firstValue(note, ["imageList", "image_list", "images"]);
  if (!Array.isArray(imageList)) return [];

  return imageList
    .map((item) => {
      const image = asRecord(item);
      const candidates = [
        firstValue(image, ["url", "src", "traceId"]),
        getPath(image, ["urlDefault"]),
        getPath(image, ["urlPre"]),
        getPath(image, ["infoList", 0, "url"]),
        getPath(image, ["urlSize", "large"])
      ];
      return candidates.map(asString).find(Boolean) || "";
    })
    .map(normalizeImageUrl)
    .filter(Boolean);
}

function extractComments(root: Record<string, unknown>): XhsComment[] {
  const commentsNode =
    findFirstArray(root, (item) => {
      const record = asRecord(item);
      return Boolean(firstValue(record, ["content", "text"]) && firstValue(record, ["user", "userInfo"]));
    }) || [];

  return commentsNode.slice(0, 20).map((item) => {
    const comment = asRecord(item);
    const user = asRecord(firstValue(comment, ["user", "userInfo"]));
    return {
      user: asString(firstValue(user, ["nickname", "name", "nickName"])),
      content: asString(firstValue(comment, ["content", "text"])),
      ipLocation: asString(firstValue(comment, ["ipLocation", "ip_location"])) || undefined
    };
  });
}

function getPath(value: unknown, path: Array<string | number>): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (typeof key === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[key];
    } else {
      current = asRecord(current)[key];
    }
  }
  return current;
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function findFirstRecord(
  value: unknown,
  predicate: (item: unknown) => boolean,
  seen = new Set<unknown>()
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  if (predicate(value)) return asRecord(value);

  const children = Array.isArray(value) ? value : Object.values(asRecord(value));
  for (const child of children) {
    const found = findFirstRecord(child, predicate, seen);
    if (found) return found;
  }
  return null;
}

function findFirstArray(
  value: unknown,
  predicate: (item: unknown) => boolean,
  seen = new Set<unknown>()
): unknown[] | null {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value) && value.some(predicate)) return value;

  const children = Array.isArray(value) ? value : Object.values(asRecord(value));
  for (const child of children) {
    const found = findFirstArray(child, predicate, seen);
    if (found) return found;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function asCount(value: unknown): string | number | undefined {
  if (typeof value === "string" || typeof value === "number") return value;
  return undefined;
}
