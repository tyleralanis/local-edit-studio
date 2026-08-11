import { Platform } from "react-native";

import type { EditResponse, MaskStroke, Quality, StudioImage } from "./types";

const configuredURL = process.env.EXPO_PUBLIC_EDIT_API_URL?.trim();

function endpoint() {
  if (configuredURL) return configuredURL;
  return "/api/edit";
}

async function appendImage(form: FormData, name: string, image: StudioImage) {
  if (Platform.OS === "web") {
    const blob = await fetch(image.uri).then((response) => response.blob());
    form.append(name, blob, `${name}.png`);
    return;
  }
  form.append(name, {
      uri: image.uri,
      name: `${name}.png`,
      type: "image/png",
    } as unknown as Blob);
}

export async function requestEdit(input: {
  image: StudioImage;
  reference: StudioImage | null;
  prompt: string;
  negativePrompt: string;
  mode: string;
  preserve: number;
  quality: Quality;
  scope: "selection" | "whole";
  strokes: MaskStroke[];
  clientID: string;
  signal?: AbortSignal;
}) {
  const form = new FormData();
  await appendImage(form, "image", input.image);
  if (input.reference) await appendImage(form, "reference", input.reference);
  form.append("prompt", input.prompt);
  form.append("negativePrompt", input.negativePrompt);
  form.append("mode", input.mode);
  form.append("preserve", String(input.preserve));
  form.append("quality", input.quality);
  form.append("scope", input.scope);
  form.append("strokes", JSON.stringify(input.strokes));
  form.append("clientID", input.clientID);
  form.append("adultConsent", "true");

  const response = await fetch(endpoint(), {
    method: "POST",
    headers: { Accept: "application/json" },
    body: form,
    signal: input.signal,
  });
  const data = (await response.json()) as EditResponse;
  if (!response.ok || !data.imageBase64) {
    throw new Error(data.error || "The image edit failed. Please try again.");
  }
  return data;
}
