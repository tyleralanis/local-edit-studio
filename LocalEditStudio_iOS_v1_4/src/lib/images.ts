import { Image, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

import type { StudioImage } from "./types";
import { createID } from "./ids";

const MAX_EDGE = 1536;
const STUDIO_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}edit-studio/`
  : null;

function getImageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

async function ensureDirectory() {
  if (!STUDIO_DIRECTORY) return;
  const info = await FileSystem.getInfoAsync(STUDIO_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(STUDIO_DIRECTORY, { intermediates: true });
  }
}

export async function prepareImage(uri: string, prefix = "source"): Promise<StudioImage> {
  const original = await getImageSize(uri);
  const maximumScale = MAX_EDGE / Math.max(original.width, original.height);
  const minimumScale = Math.sqrt(655_360 / Math.max(1, original.width * original.height));
  const scale = Math.min(maximumScale, Math.max(1, minimumScale));
  const width = Math.max(16, Math.round((original.width * scale) / 16) * 16);
  const height = Math.max(16, Math.round((original.height * scale) / 16) * 16);
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width, height } }],
    { compress: 1, format: ImageManipulator.SaveFormat.PNG },
  );

  if (Platform.OS === "web" || !STUDIO_DIRECTORY) {
    return { uri: result.uri, width, height, mimeType: "image/png" };
  }

  await ensureDirectory();
  const destination = `${STUDIO_DIRECTORY}${createID(prefix)}.png`;
  await FileSystem.copyAsync({ from: result.uri, to: destination });
  return { uri: destination, width, height, mimeType: "image/png" };
}

export async function saveGeneratedBase64(base64: string): Promise<StudioImage> {
  if (Platform.OS === "web" || !STUDIO_DIRECTORY) {
    const uri = `data:image/png;base64,${base64}`;
    const size = await getImageSize(uri);
    return { uri, width: size.width, height: size.height, mimeType: "image/png" };
  }
  await ensureDirectory();
  const destination = `${STUDIO_DIRECTORY}${createID("result")}.png`;
  await FileSystem.writeAsStringAsync(destination, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const size = await getImageSize(destination);
  return { uri: destination, width: size.width, height: size.height, mimeType: "image/png" };
}

export async function removeStudioFiles() {
  if (!STUDIO_DIRECTORY) return;
  const info = await FileSystem.getInfoAsync(STUDIO_DIRECTORY);
  if (info.exists) {
    await FileSystem.deleteAsync(STUDIO_DIRECTORY, { idempotent: true });
  }
}
