import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AwsClient } from "aws4fetch";

/**
 * Where PDFs go. Cloudflare R2 in production (10 GB free, no egress fees),
 * the local output/ folder for demo runs and dry runs.
 */
export interface FileStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<string>;
  get?(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
}

export function localStore(root = "output"): FileStore {
  return {
    async put(key, body) {
      const path = join(root, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
      return path;
    },
    async get(key) {
      try {
        return { body: new Uint8Array(await readFile(join(root, key))), contentType: key.endsWith(".svg") ? "image/svg+xml" : "image/png" };
      } catch {
        return null;
      }
    },
  };
}

export function r2Store(env: { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string }): FileStore {
  const client = new AwsClient({ accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey, service: "s3", region: "auto" });
  const base = `https://${env.accountId}.r2.cloudflarestorage.com/${env.bucket}`;
  return {
    async put(key, body, contentType) {
      const res = await client.fetch(`${base}/${encodeURI(key)}`, {
        method: "PUT",
        body: body as unknown as BodyInit,
        headers: { "content-type": contentType, "cache-control": "private, max-age=0" },
      });
      if (!res.ok) throw new Error(`R2 upload failed: ${res.status} ${await res.text()}`);
      return key;
    },
    async get(key) {
      const res = await client.fetch(`${base}/${encodeURI(key)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 read failed: ${res.status}`);
      return { body: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
    },
  };
}

/** reports/<org>/<site>/<period>/v<version>.pdf — versioned so re-renders never overwrite a sent file. */
export function pdfKey(orgId: string, siteId: string, period: string, version: number): string {
  return `reports/${orgId}/${siteId}/${period}/v${version}.pdf`;
}

/**
 * Logos are stored either as an R2 key or, without R2, as a small data:
 * URL. The PDF embeds them as data: URLs so rendering never depends on a
 * network fetch from inside Chromium.
 */
export function logoResolver(files: FileStore) {
  const cache = new Map<string, string | null>();
  return async (key: string | null): Promise<string | null> => {
    if (!key) return null;
    if (key.startsWith("data:")) return key;
    if (cache.has(key)) return cache.get(key)!;
    const file = await files.get?.(key).catch(() => null);
    const url = file ? `data:${file.contentType};base64,${Buffer.from(file.body).toString("base64")}` : null;
    cache.set(key, url);
    return url;
  };
}
