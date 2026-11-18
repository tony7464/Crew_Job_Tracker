// Shrink a photo in the browser before it is sent, so phone photos upload quickly.
// Each photo is redrawn on a canvas and saved as a new JPEG, so nothing from the original
// file's metadata (EXIF: GPS position, device, time) is sent.

export const MAX_SIDE = 1600;
// Job photos sent straight to storage: a larger photo, plus a small one for grids.
export const FULL_SIDE = 2048;
export const THUMB_SIDE = 400;
const JPEG_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;
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

function toBlob(canvas, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError("This photo could not be prepared."))),
      "image/jpeg",
      quality,
    );
  });
}

// source drawn on a new canvas, at most maxSide pixels on its long side.
function drawScaled(source, width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  // JPEG has no transparency; give see-through PNGs a white background.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
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
// at most maxSide pixels on its long side. Call URL.revokeObjectURL(previewUrl) when done.
// thumbSide: also make a small JPEG, returned as thumb: { blob, width, height }.
export async function shrinkPhoto(file, { maxSide = MAX_SIDE, thumbSide = 0 } = {}) {
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
  const canvas = drawScaled(source, width, height, maxSide);
  source.close?.();
  const blob = await toBlob(canvas);
  let thumb = null;
  if (thumbSide) {
    const small = drawScaled(canvas, canvas.width, canvas.height, thumbSide);
    thumb = { blob: await toBlob(small, THUMB_QUALITY), width: small.width, height: small.height };
  }
  return {
    blob,
    thumb,
    dataUrl: await readAsDataUrl(blob),
    previewUrl: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
    bytes: blob.size,
  };
}
