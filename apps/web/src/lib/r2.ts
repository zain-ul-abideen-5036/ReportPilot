import "server-only";
import { AwsClient } from "aws4fetch";

/** Cloudflare R2 over its S3 API. Null when the four R2_* variables are not set. */
export function r2FromEnv() {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  const client = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
  const base = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
  return {
    async put(key: string, body: Uint8Array, contentType: string) {
      const res = await client.fetch(`${base}/${encodeURI(key)}`, { method: "PUT", body: body as unknown as BodyInit, headers: { "content-type": contentType } });
      if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
      return key;
    },
    async get(key: string) {
      const res = await client.fetch(`${base}/${encodeURI(key)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 read failed: ${res.status}`);
      return { body: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
    },
  };
}
