// Shrink a photo in the browser before it is sent, so phone photos upload quickly.
// The server still checks and re-encodes every photo; this only saves bandwidth.

export const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;
// Bigger files are refused before decoding, so a huge file cannot freeze the page.
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

export class PhotoError extends Error {}

async function decode(file) {
  // createImageBitmap applies the EXIF orientation, so photos stay upright.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall back to an <img>, which decodes some formats createImageBitmap does not.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError("This photo could not be prepared."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new PhotoError("This photo could not be read."));
    reader.readAsDataURL(blob);
  });
}

// { blob, dataUrl, previewUrl, width, height, bytes } for a picked image file, as a JPEG
// at most MAX_SIDE pixels on its long side. Call URL.revokeObjectURL(previewUrl) when done.
export async function shrinkPhoto(file) {
  if (file.type && !file.type.startsWith("image/")) {
    throw new PhotoError("Only photos can be added.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new PhotoError("This photo is too large. Pick one under 30 MB.");
  }
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new PhotoError("This photo could not be opened. Try a JPEG, PNG, or WebP photo.");
  }
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  // JPEG has no transparency; give see-through PNGs a white background.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  const blob = await toBlob(canvas);
  return {
    blob,
    dataUrl: await readAsDataUrl(blob),
    previewUrl: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
    bytes: blob.size,
  };
}
