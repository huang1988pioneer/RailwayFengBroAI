import { handleError, sendJson } from "./_lib/dbStore.js";
import { uploadBufferToBucket } from "./_lib/bucket.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const { fields, file } = await readMultipart(req);
    if (!file) {
      sendJson(res, 400, { ok: false, error: "Missing file" });
      return;
    }

    const result = await uploadBufferToBucket(file, {
      module: fields.module,
      field: fields.field,
      requireBucket: String(fields.requireBucket || "") === "true",
    });
    sendJson(res, 201, result);
  } catch (error) {
    handleError(res, error);
  }
}

async function readMultipart(req) {
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) {
    const error = new Error("Missing multipart boundary");
    error.statusCode = 400;
    throw error;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  return parseMultipart(body, boundary);
}

function parseMultipart(body, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  let file = null;
  let cursor = 0;

  while (cursor < body.length) {
    const start = body.indexOf(delimiter, cursor);
    if (start < 0) break;
    const next = body.indexOf(delimiter, start + delimiter.length);
    if (next < 0) break;
    cursor = next;

    let part = body.subarray(start + delimiter.length, next);
    if (part.subarray(0, 2).toString() === "\r\n") part = part.subarray(2);
    if (part.subarray(0, 2).toString() === "--") continue;

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) continue;
    const headerText = part.subarray(0, headerEnd).toString("utf8");
    let content = part.subarray(headerEnd + 4);
    if (content.subarray(content.length - 2).toString() === "\r\n") content = content.subarray(0, content.length - 2);

    const name = headerText.match(/name="([^"]+)"/)?.[1];
    const filename = headerText.match(/filename="([^"]*)"/)?.[1];
    const type = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream";
    if (!name) continue;

    if (filename) {
      file = { name: filename, type, buffer: content };
    } else {
      fields[name] = content.toString("utf8");
    }
  }

  return { fields, file };
}
