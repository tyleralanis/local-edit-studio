import { Platform } from "react-native";

import LocalPhotoEngine from "../../modules/local-photo-engine";
import { recolorHex, type LocalOperation } from "./localIntent";
import type { EditScope, MaskStroke, StudioImage } from "./types";

function webFilter(operation: LocalOperation, amount: number) {
  const percent = Math.round(amount * 100);
  switch (operation) {
    case "brighten": return `brightness(${100 + Math.round(percent * 0.45)}%)`;
    case "darken": return `brightness(${100 - Math.round(percent * 0.38)}%)`;
    case "contrast": return `contrast(${100 + Math.round(percent * 0.65)}%)`;
    case "vibrant": return `saturate(${100 + Math.round(percent * 0.9)}%) contrast(${100 + Math.round(percent * 0.15)}%)`;
    case "blackAndWhite": return "grayscale(100%) contrast(112%)";
    case "warm": return `sepia(${Math.round(percent * 0.32)}%) saturate(${100 + Math.round(percent * 0.18)}%)`;
    case "cool": return `sepia(${Math.round(percent * 0.12)}%) hue-rotate(165deg) saturate(${100 + Math.round(percent * 0.08)}%)`;
    case "blur": return `blur(${1 + amount * 12}px)`;
    case "sharpen": return `contrast(${100 + Math.round(percent * 0.24)}%) saturate(${100 + Math.round(percent * 0.1)}%)`;
    case "smooth": return `blur(${0.35 + amount * 1.1}px) brightness(${100 + Math.round(percent * 0.04)}%)`;
    case "cinematic": return `contrast(${100 + Math.round(percent * 0.22)}%) saturate(${100 - Math.round(percent * 0.14)}%) sepia(${Math.round(percent * 0.12)}%)`;
    case "remove": return `blur(${10 + amount * 28}px) saturate(92%)`;
    default: return `brightness(${100 + Math.round(percent * 0.04)}%) contrast(${100 + Math.round(percent * 0.12)}%) saturate(${100 + Math.round(percent * 0.15)}%)`;
  }
}

function recolorCanvas(
  context: CanvasRenderingContext2D,
  source: HTMLImageElement,
  width: number,
  height: number,
  color: string,
  amount: number,
) {
  context.drawImage(source, 0, 0, width, height);
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
  context.globalAlpha = 0.62 + amount * 0.34;
  context.globalCompositeOperation = luminance < 0.14 ? "multiply" : luminance > 0.86 ? "screen" : "color";
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
}

function loadWebImage(uri: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be prepared for the local edit."));
    image.src = uri;
  });
}

function drawMask(context: CanvasRenderingContext2D, width: number, height: number, strokes: MaskStroke[]) {
  context.clearRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    context.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
    context.strokeStyle = "white";
    context.fillStyle = "white";
    context.lineWidth = stroke.width * Math.min(width, height);
    context.beginPath();
    context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x * width, point.y * height);
    if (stroke.points.length === 1) {
      context.arc(stroke.points[0].x * width, stroke.points[0].y * height, context.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.stroke();
    }
  }
  context.globalCompositeOperation = "source-over";
}

function selectionBounds(width: number, height: number, strokes: MaskStroke[]) {
  const painted = strokes.filter((stroke) => !stroke.erase && stroke.points.length);
  if (!painted.length) return null;
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (const stroke of painted) {
    const radius = stroke.width * Math.min(width, height) * 0.6;
    for (const point of stroke.points) {
      left = Math.min(left, point.x * width - radius);
      top = Math.min(top, point.y * height - radius);
      right = Math.max(right, point.x * width + radius);
      bottom = Math.max(bottom, point.y * height + radius);
    }
  }
  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
    right: Math.min(width, right),
    bottom: Math.min(height, bottom),
  };
}

function cleanupOffset(width: number, height: number, strokes: MaskStroke[]) {
  const bounds = selectionBounds(width, height, strokes);
  if (!bounds) return { x: 0, y: 0 };
  const gap = Math.max(8, Math.min(width, height) * 0.015);
  const boxWidth = Math.max(gap, bounds.right - bounds.left);
  const boxHeight = Math.max(gap, bounds.bottom - bounds.top);
  const candidates = [
    { available: bounds.top, x: 0, y: Math.min(bounds.top, boxHeight + gap) },
    { available: height - bounds.bottom, x: 0, y: -Math.min(height - bounds.bottom, boxHeight + gap) },
    { available: bounds.left, x: Math.min(bounds.left, boxWidth + gap), y: 0 },
    { available: width - bounds.right, x: -Math.min(width - bounds.right, boxWidth + gap), y: 0 },
  ];
  return candidates.sort((a, b) => b.available - a.available)[0];
}

async function applyWebEdit(
  image: StudioImage,
  operation: LocalOperation,
  amount: number,
  strokes: MaskStroke[],
  scope: EditScope,
) {
  const source = await loadWebImage(image.uri);
  const result = document.createElement("canvas");
  const filtered = document.createElement("canvas");
  result.width = filtered.width = image.width;
  result.height = filtered.height = image.height;
  const resultContext = result.getContext("2d");
  const filteredContext = filtered.getContext("2d");
  if (!resultContext || !filteredContext) throw new Error("This browser cannot render local edits.");

  resultContext.drawImage(source, 0, 0, image.width, image.height);
  const targetColor = recolorHex(operation);
  if (targetColor) {
    recolorCanvas(filteredContext, source, image.width, image.height, targetColor, amount);
  } else if (operation === "remove" && scope === "selection") {
    const offset = cleanupOffset(image.width, image.height, strokes);
    filteredContext.filter = `blur(${0.5 + amount * 1.2}px)`;
    filteredContext.drawImage(source, offset.x, offset.y, image.width, image.height);
  } else {
    filteredContext.filter = webFilter(operation, amount);
    filteredContext.drawImage(source, 0, 0, image.width, image.height);
  }

  if (scope === "selection") {
    const mask = document.createElement("canvas");
    mask.width = image.width;
    mask.height = image.height;
    const maskContext = mask.getContext("2d");
    if (!maskContext) throw new Error("This browser cannot render the painted selection.");
    drawMask(maskContext, image.width, image.height, strokes);
    const featheredMask = document.createElement("canvas");
    featheredMask.width = image.width;
    featheredMask.height = image.height;
    const featheredContext = featheredMask.getContext("2d");
    if (!featheredContext) throw new Error("This browser cannot soften the painted selection.");
    featheredContext.filter = `blur(${Math.max(1.5, Math.min(image.width, image.height) * 0.0025)}px)`;
    featheredContext.drawImage(mask, 0, 0);
    filteredContext.globalCompositeOperation = "destination-in";
    filteredContext.drawImage(featheredMask, 0, 0);
  }

  resultContext.drawImage(filtered, 0, 0);
  return result.toDataURL("image/png", 1);
}

export async function applyLocalEdit(input: {
  image: StudioImage;
  operation: LocalOperation;
  amount: number;
  strokes: MaskStroke[];
  scope: EditScope;
}) {
  if (Platform.OS === "web") {
    return applyWebEdit(input.image, input.operation, input.amount, input.strokes, input.scope);
  }
  if (!LocalPhotoEngine) {
    throw new Error("Install the newest Edit Studio build to use credential-free local edits.");
  }
  return LocalPhotoEngine.apply(
    input.image.uri,
    input.operation,
    input.amount,
    JSON.stringify(input.strokes),
    input.scope === "whole",
  );
}
