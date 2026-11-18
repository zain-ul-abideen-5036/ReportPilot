import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AwsClient } from "aws4fetch";

/**
 * Where PDFs go. Cloudflare R2 in production (10 GB free, no egress fees),
 * the local output/ folder for demo runs and dry runs.
 */
export interface FileStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<string>;
}

export function localStore(root = "output"): FileStore {
  return {
    async put(key, body) {
      const path = join(root, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
      return path;
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
  };
}

/** reports/<org>/<site>/<period>/v<version>.pdf — versioned so re-renders never overwrite a sent file. */
export function pdfKey(orgId: string, siteId: string, period: string, version: number): string {
  return `reports/${orgId}/${siteId}/${period}/v${version}.pdf`;
}
