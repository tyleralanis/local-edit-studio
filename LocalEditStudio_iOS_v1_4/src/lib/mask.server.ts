import type { MaskStroke } from "./types";

type MaskRaster = { width: number; height: number; data: Uint8Array };

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_IMAGE_EDGE = 4096;
const MAX_IMAGE_PIXELS = 16_000_000;

function paintCircle(raster: MaskRaster, centerX: number, centerY: number, radius: number, alpha: number) {
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(raster.width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(raster.height - 1, Math.ceil(centerY + radius));
  const radiusSquared = radius * radius;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy > radiusSquared) continue;
      const index = (raster.width * y + x) << 2;
      raster.data[index] = 0;
      raster.data[index + 1] = 0;
      raster.data[index + 2] = 0;
      raster.data[index + 3] = alpha;
    }
  }
}

function paintSegment(
  raster: MaskRaster,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  radius: number,
  alpha: number,
) {
  const distance = Math.hypot(endX - startX, endY - startY);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.45)));
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    paintCircle(
      raster,
      startX + (endX - startX) * progress,
      startY + (endY - startY) * progress,
      radius,
      alpha,
    );
  }
}

function readUint32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function pngChunk(type: string, data = new Uint8Array()) {
  const typeBytes = new TextEncoder().encode(type);
  const output = new Uint8Array(12 + data.length);
  writeUint32(output, 0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  writeUint32(output, output.length - 4, crc32(concatBytes([typeBytes, data])));
  return output;
}

async function deflate(bytes: Uint8Array) {
  const stream = new CompressionStream("deflate");
  const writer = stream.writable.getWriter();
  const buffer = new ArrayBuffer(bytes.byteLength);
  const copy: Uint8Array<ArrayBuffer> = new Uint8Array(buffer);
  copy.set(bytes);
  await writer.write(copy);
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export function readPngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw new Error("Invalid PNG signature.");
  }
  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_IMAGE_EDGE ||
    height > MAX_IMAGE_EDGE ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new Error("Unsupported PNG dimensions.");
  }
  return { width, height };
}

export async function renderMaskPng(width: number, height: number, strokes: MaskStroke[]) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Invalid mask dimensions.");
  }

  const raster: MaskRaster = { width, height, data: new Uint8Array(width * height * 4) };
  for (let index = 0; index < raster.data.length; index += 4) {
    raster.data[index + 3] = 255;
  }

  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    const radius = Math.max(1, Math.round((stroke.width * Math.min(width, height)) / 2));
    const alpha = stroke.erase ? 255 : 0;
    const pixelPoints = stroke.points.map((point) => ({
      x: Math.max(0, Math.min(width - 1, point.x * width)),
      y: Math.max(0, Math.min(height - 1, point.y * height)),
    }));

    paintCircle(raster, pixelPoints[0].x, pixelPoints[0].y, radius, alpha);
    for (let index = 1; index < pixelPoints.length; index += 1) {
      paintSegment(
        raster,
        pixelPoints[index - 1].x,
        pixelPoints[index - 1].y,
        pixelPoints[index].x,
        pixelPoints[index].y,
        radius,
        alpha,
      );
    }
  }

  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + width * 4);
    raw[rowOffset] = 0;
    raw.set(raster.data.subarray(y * width * 4, (y + 1) * width * 4), rowOffset + 1);
  }

  const header = new Uint8Array(13);
  writeUint32(header, 0, width);
  writeUint32(header, 4, height);
  header.set([8, 6, 0, 0, 0], 8);
  return concatBytes([PNG_SIGNATURE, pngChunk("IHDR", header), pngChunk("IDAT", await deflate(raw)), pngChunk("IEND")]);
}
