import { hasPaintedSelection } from "@/lib/mask";
import { readPngDimensions, renderMaskPng } from "@/lib/mask.server";
import { evaluatePrompt } from "@/lib/policy";
import { buildGenerationPrompt } from "@/lib/prompts";
import type { EditMode, MaskStroke, Quality } from "@/lib/types";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const OPENAI_EDIT_URL = "https://api.openai.com/v1/images/edits";
type ServerFormDataEntry = string | File;
type ServerFormData = { get(name: string): ServerFormDataEntry | null };

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function parseStrokes(value: ServerFormDataEntry | null): MaskStroke[] {
  if (typeof value !== "string") return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.length > 300) throw new Error("Invalid mask data.");

  return parsed.map((item) => {
    const stroke = item as Partial<MaskStroke>;
    if (!Array.isArray(stroke.points) || stroke.points.length > 5000) {
      throw new Error("Invalid mask stroke.");
    }
    return {
      id: String(stroke.id || "stroke"),
      erase: Boolean(stroke.erase),
      width: Math.max(0.002, Math.min(0.5, Number(stroke.width) || 0.05)),
      points: stroke.points.map((point) => ({
        x: Math.max(0, Math.min(1, Number(point.x) || 0)),
        y: Math.max(0, Math.min(1, Number(point.y) || 0)),
      })),
    };
  });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function providerMessage(payload: Record<string, any>) {
  const error = payload.error;
  if (error?.code === "moderation_blocked") {
    return "This edit could not be completed under the image provider's safety requirements. Try a non-explicit retouch or a different permitted edit.";
  }
  if (error?.code === "rate_limit_exceeded") {
    return "The generation service is busy. Wait a moment and try again.";
  }
  if (error?.code === "insufficient_quota") {
    return "The generation service has reached its billing limit. Contact the app owner.";
  }
  return "The generation service could not complete this edit. Try again or simplify the request.";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "Generation is not configured on the server yet.", code: "missing_server_key" }, 503);
  }

  try {
    const incoming = (await request.formData()) as unknown as ServerFormData;
    if (incoming.get("adultConsent") !== "true") {
      return json({ error: "Complete the 18+ and consent check before generating.", code: "consent_required" }, 403);
    }

    const image = incoming.get("image");
    const reference = incoming.get("reference");
    if (!(image instanceof File)) {
      return json({ error: "Choose a source image first.", code: "missing_image" }, 400);
    }
    if (image.size > MAX_UPLOAD_BYTES || (reference instanceof File && reference.size > MAX_UPLOAD_BYTES)) {
      return json({ error: "The selected image is too large. Choose a smaller file.", code: "file_too_large" }, 413);
    }

    const rawPrompt = String(incoming.get("prompt") || "").trim();
    const decision = evaluatePrompt(rawPrompt);
    if (!decision.allowed) {
      return json({ error: decision.message, code: decision.code }, 400);
    }

    const mode = (["retouch", "replace", "creative"].includes(String(incoming.get("mode")))
      ? String(incoming.get("mode"))
      : "retouch") as EditMode;
    const quality = (["draft", "standard", "high"].includes(String(incoming.get("quality")))
      ? String(incoming.get("quality"))
      : "standard") as Quality;
    const scope = incoming.get("scope") === "whole" ? "whole" : "selection";
    const preserve = Math.max(0, Math.min(1, Number(incoming.get("preserve")) || 0.7));
    const strokes = parseStrokes(incoming.get("strokes"));
    if (scope === "selection" && !hasPaintedSelection(strokes)) {
      return json({ error: "Paint over the area you want changed, or choose Whole image.", code: "mask_required" }, 400);
    }

    const imageBytes = new Uint8Array(await image.arrayBuffer());
    let dimensions: { width: number; height: number };
    try {
      dimensions = readPngDimensions(imageBytes);
    } catch {
      return json({ error: "The source image could not be read as a PNG.", code: "invalid_image" }, 400);
    }

    const prompt = buildGenerationPrompt({
      prompt: rawPrompt,
      negativePrompt: String(incoming.get("negativePrompt") || ""),
      mode,
      preserve,
      selectedArea: scope === "selection",
      hasReference: reference instanceof File,
    });

    const upstreamBody = new FormData();
    upstreamBody.append("model", "gpt-image-2");
    upstreamBody.append("image[]", new Blob([toArrayBuffer(imageBytes)], { type: "image/png" }), "source.png");
    if (reference instanceof File) {
      const referenceBytes = new Uint8Array(await reference.arrayBuffer());
      upstreamBody.append("image[]", new Blob([toArrayBuffer(referenceBytes)], { type: "image/png" }), "reference.png");
    }
    if (scope === "selection") {
      const maskBytes = await renderMaskPng(dimensions.width, dimensions.height, strokes);
      upstreamBody.append("mask", new Blob([toArrayBuffer(maskBytes)], { type: "image/png" }), "mask.png");
    }
    upstreamBody.append("prompt", prompt);
    upstreamBody.append("quality", quality === "draft" ? "low" : quality === "high" ? "high" : "medium");
    upstreamBody.append("output_format", "png");
    upstreamBody.append("moderation", "auto");
    upstreamBody.append("user", String(incoming.get("clientID") || "anonymous").slice(0, 128));

    const upstream = await fetch(OPENAI_EDIT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamBody,
    });
    const payload = (await upstream.json()) as Record<string, any>;
    if (!upstream.ok) {
      console.error("Image edit failed", {
        status: upstream.status,
        code: payload.error?.code,
        requestID: upstream.headers.get("x-request-id"),
      });
      return json({ error: providerMessage(payload), code: payload.error?.code || "provider_error" }, upstream.status);
    }

    const imageBase64 = payload.data?.[0]?.b64_json;
    if (!imageBase64) {
      return json({ error: "The generation service returned no image.", code: "empty_result" }, 502);
    }
    return json({ imageBase64, mimeType: "image/png" });
  } catch (error) {
    console.error("Edit route error", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "The edit request could not be processed.", code: "request_error" }, 500);
  }
}
