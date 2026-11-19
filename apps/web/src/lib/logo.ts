/**
 * Logos are downscaled in the browser before upload: at most 480 px wide,
 * PNG (or WebP if the PNG is large). A 2 MB photo becomes about 30 KB,
 * which keeps uploads fast and lets small deployments store it without R2.
 */
export async function downscaleLogo(file: File, maxWidth = 480): Promise<string> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error("Use a PNG, JPG, WebP or SVG file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("That file is over 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That image could not be read."));
      el.src = url;
    });
    const scale = Math.min(1, maxWidth / (img.naturalWidth || maxWidth));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((img.naturalWidth || maxWidth) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || maxWidth / 3) * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL("image/png");
    return png.length <= 150_000 ? png : canvas.toDataURL("image/webp", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
