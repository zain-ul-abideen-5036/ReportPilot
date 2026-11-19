import { r2FromEnv } from "@/lib/r2";

export const runtime = "nodejs";

/** Agency and client logos stored in R2. Logos are not secret; only keys under logos/ are served. */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!/^logos\/[\w-]+\/[\w.-]+\.(png|webp|jpe?g)$/.test(key)) return new Response("Not found", { status: 404 });
  const r2 = r2FromEnv();
  const file = await r2?.get(key).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(file.body), { headers: { "content-type": file.contentType, "cache-control": "public, max-age=3600" } });
}
