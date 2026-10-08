/**
 * Utilities for image processing, background removal, and color keying.
 */

export interface ColorKeyParams {
  targetR: number;
  targetG: number;
  targetB: number;
  tolerance: number; // 0 - 100
  feather: number;   // 0 - 5
  mode: 'flood' | 'global';
}

/**
 * Load an image URL or base64 into an HTMLImageElement safely with crossOrigin
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Auto-detect the likely background color by sampling the image corners and borders
 */
export function detectBackgroundColor(ctx: CanvasRenderingContext2D, width: number, height: number): { r: number; g: number; b: number } {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Sample corner points and border pixels
  const sampleCoords = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
    [Math.floor(width / 2), height - 1],
  ];

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (const [x, y] of sampleCoords) {
    const idx = (y * width + x) * 4;
    rSum += data[idx];
    gSum += data[idx + 1];
    bSum += data[idx + 2];
    count++;
  }

  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  };
}

/**
 * Color distance calculation in RGB space (0 to 441.67)
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Perform background removal on a canvas context
 */
export function removeBackgroundOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: ColorKeyParams
): ImageData {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  // Scaled max distance (tolerance 0-100 mapped to ~0-260)
  const maxThreshold = (params.tolerance / 100) * 260;
  const featherDist = Math.max(5, params.feather * 12);

  const { targetR, targetG, targetB, mode } = params;

  if (mode === 'flood') {
    // Flood fill from all 4 borders
    const visited = new Uint8Array(totalPixels);
    const queue: number[] = [];

    // Push boundary pixels into queue
    for (let x = 0; x < width; x++) {
      queue.push(x); // top row
      queue.push((height - 1) * width + x); // bottom row
      visited[x] = 1;
      visited[(height - 1) * width + x] = 1;
    }
    for (let y = 0; y < height; y++) {
      const idxLeft = y * width;
      const idxRight = y * width + (width - 1);
      if (!visited[idxLeft]) {
        queue.push(idxLeft);
        visited[idxLeft] = 1;
      }
      if (!visited[idxRight]) {
        queue.push(idxRight);
        visited[idxRight] = 1;
      }
    }

    let head = 0;
    while (head < queue.length) {
      const pixelIdx = queue[head++];
      const byteIdx = pixelIdx * 4;

      const r = data[byteIdx];
      const g = data[byteIdx + 1];
      const b = data[byteIdx + 2];

      const dist = colorDistance(r, g, b, targetR, targetG, targetB);

      if (dist <= maxThreshold) {
        // Set alpha to 0 or soft feather
        if (dist > maxThreshold - featherDist && featherDist > 0) {
          const factor = (dist - (maxThreshold - featherDist)) / featherDist;
          data[byteIdx + 3] = Math.round(255 * factor);
        } else {
          data[byteIdx + 3] = 0;
        }

        // Check 4 neighbors
        const px = pixelIdx % width;
        const py = Math.floor(pixelIdx / width);

        const neighbors = [
          px > 0 ? pixelIdx - 1 : -1,
          px < width - 1 ? pixelIdx + 1 : -1,
          py > 0 ? pixelIdx - width : -1,
          py < height - 1 ? pixelIdx + width : -1,
        ];

        for (const n of neighbors) {
          if (n !== -1 && !visited[n]) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }
    }
  } else {
    // Global color key
    for (let i = 0; i < totalPixels; i++) {
      const byteIdx = i * 4;
      const r = data[byteIdx];
      const g = data[byteIdx + 1];
      const b = data[byteIdx + 2];

      const dist = colorDistance(r, g, b, targetR, targetG, targetB);

      if (dist <= maxThreshold) {
        if (dist > maxThreshold - featherDist && featherDist > 0) {
          const factor = (dist - (maxThreshold - featherDist)) / featherDist;
          data[byteIdx + 3] = Math.round(255 * factor);
        } else {
          data[byteIdx + 3] = 0;
        }
      }
    }
  }

  return imgData;
}

/**
 * Optimizes and resizes an uploaded image file from PC or smartphone
 * to fit high-definition TV displays (max 1920px) while maintaining crisp visual quality
 * and keeping the file size small (100-300KB) to prevent localStorage quota issues.
 */
export async function compressAndResizeImage(
  file: File,
  maxDimension = 1920,
  quality = 0.88
): Promise<{ dataUrl: string; type: 'image' | 'video'; sizeKb: number }> {
  // If it's a video, read directly as dataURL
  if (file.type.startsWith('video/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve({
          dataUrl: res,
          type: 'video',
          sizeKb: Math.round(res.length / 1024),
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  // If it's an image, resize using an offscreen canvas
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Scale down if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          // Fallback to raw dataURL if context fails
          const raw = e.target?.result as string;
          resolve({
            dataUrl: raw,
            type: 'image',
            sizeKb: Math.round(raw.length / 1024),
          });
          return;
        }

        // High quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Preserve PNG transparency if the source was a PNG, otherwise use JPEG for optimal size
        const isPng = file.type === 'image/png';
        const mimeType = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        resolve({
          dataUrl,
          type: 'image',
          sizeKb: Math.round(dataUrl.length / 1024),
        });
      };
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
