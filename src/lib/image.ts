export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_IMAGE_DIMENSION = 1600;

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be read"));
    };
    img.src = url;
  });

const toWebp = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));

/** Shrinks/encodes an oversized image to WEBP so the uploaded file stays under `maxBytes`. */
export const compressImage = async (file: File, maxBytes = MAX_IMAGE_SIZE): Promise<File> => {
  if (file.size <= maxBytes) return file;

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await toWebp(canvas, quality);
    if (blob && blob.size <= maxBytes) {
      return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: blob.type });
    }
  }
  throw new Error("Image is larger than 2MB even after compression");
};
