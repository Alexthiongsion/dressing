const normalizedImageCache = new Map();

const createNormalizedImage = async imageUrl => {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Image indisponible");
  const bitmap = await createImageBitmap(await response.blob());
  const analysisScale = Math.min(1, 520 / Math.max(bitmap.width, bitmap.height));
  const analysisWidth = Math.max(1, Math.round(bitmap.width * analysisScale));
  const analysisHeight = Math.max(1, Math.round(bitmap.height * analysisScale));
  const analysisCanvas = document.createElement("canvas");
  analysisCanvas.width = analysisWidth;
  analysisCanvas.height = analysisHeight;
  const analysisContext = analysisCanvas.getContext("2d", { willReadFrequently: true });
  analysisContext.drawImage(bitmap, 0, 0, analysisWidth, analysisHeight);
  const pixels = analysisContext.getImageData(0, 0, analysisWidth, analysisHeight).data;
  let left = analysisWidth, top = analysisHeight, right = -1, bottom = -1;

  for (let y = 0; y < analysisHeight; y += 1) {
    for (let x = 0; x < analysisWidth; x += 1) {
      if (pixels[(y * analysisWidth + x) * 4 + 3] < 12) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    bitmap.close();
    return imageUrl;
  }

  const padding = Math.max(2, Math.round(Math.max(right - left, bottom - top) * 0.035));
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(analysisWidth - 1, right + padding);
  bottom = Math.min(analysisHeight - 1, bottom + padding);
  const sourceX = left / analysisScale;
  const sourceY = top / analysisScale;
  const sourceWidth = (right - left + 1) / analysisScale;
  const sourceHeight = (bottom - top + 1) / analysisScale;
  const outputScale = Math.min(1, 1200 / Math.max(sourceWidth, sourceHeight));
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = Math.max(1, Math.round(sourceWidth * outputScale));
  outputCanvas.height = Math.max(1, Math.round(sourceHeight * outputScale));
  outputCanvas.getContext("2d").drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputCanvas.width, outputCanvas.height);
  bitmap.close();
  const normalizedBlob = await new Promise(resolve => outputCanvas.toBlob(resolve, "image/png", 1));
  return normalizedBlob ? URL.createObjectURL(normalizedBlob) : imageUrl;
};

export const getNormalizedClothingImage = imageUrl => {
  if (!imageUrl) return Promise.resolve("");
  if (!normalizedImageCache.has(imageUrl)) {
    normalizedImageCache.set(imageUrl, createNormalizedImage(imageUrl).catch(() => imageUrl));
  }
  return normalizedImageCache.get(imageUrl);
};

export const defaultImageDisplay = { scale: 1, offsetX: 0, offsetY: 0 };
