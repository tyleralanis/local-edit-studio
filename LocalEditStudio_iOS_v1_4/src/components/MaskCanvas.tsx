import { memo, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, Mask, Path, Rect } from "react-native-svg";

import { createID } from "@/lib/ids";
import { colors, radii } from "@/lib/theme";
import type { MaskStroke, Point, StudioImage } from "@/lib/types";

function pathFor(stroke: MaskStroke, width: number, height: number) {
  if (!stroke.points.length) return "";
  return stroke.points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x * width} ${point.y * height}`)
    .join(" ");
}

function MaskPaths({ strokes, width, height }: { strokes: MaskStroke[]; width: number; height: number }) {
  const minimum = Math.min(width, height);
  return strokes.map((stroke) => (
    <Path
      key={stroke.id}
      d={pathFor(stroke, width, height)}
      fill="none"
      stroke={stroke.erase ? "black" : "white"}
      strokeWidth={Math.max(2, stroke.width * minimum)}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));
}

export const MaskCanvas = memo(function MaskCanvas({
  image,
  strokes,
  onChange,
  brushWidth,
  erasing,
  enabled,
}: {
  image: StudioImage;
  strokes: MaskStroke[];
  onChange: (next: MaskStroke[]) => void;
  brushWidth: number;
  erasing: boolean;
  enabled: boolean;
}) {
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const [active, setActive] = useState<MaskStroke | null>(null);
  const activeRef = useRef<MaskStroke | null>(null);
  const lastPointRef = useRef<Point | null>(null);

  const pointFromEvent = (locationX: number, locationY: number): Point => ({
    x: Math.max(0, Math.min(1, locationX / layout.width)),
    y: Math.max(0, Math.min(1, locationY / layout.height)),
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: () => enabled,
        onPanResponderGrant: (event) => {
          const point = pointFromEvent(event.nativeEvent.locationX, event.nativeEvent.locationY);
          const stroke: MaskStroke = {
            id: createID("stroke"),
            points: [point],
            width: brushWidth,
            erase: erasing,
          };
          activeRef.current = stroke;
          lastPointRef.current = point;
          setActive(stroke);
        },
        onPanResponderMove: (event) => {
          const current = activeRef.current;
          const last = lastPointRef.current;
          if (!current || !last) return;
          const point = pointFromEvent(event.nativeEvent.locationX, event.nativeEvent.locationY);
          if (Math.hypot(point.x - last.x, point.y - last.y) < 0.004) return;
          const next = { ...current, points: [...current.points, point] };
          activeRef.current = next;
          lastPointRef.current = point;
          setActive(next);
        },
        onPanResponderRelease: () => {
          const finished = activeRef.current;
          if (finished?.points.length) onChange([...strokes, finished]);
          activeRef.current = null;
          lastPointRef.current = null;
          setActive(null);
        },
        onPanResponderTerminate: () => {
          activeRef.current = null;
          lastPointRef.current = null;
          setActive(null);
        },
      }),
    [brushWidth, enabled, erasing, layout.height, layout.width, onChange, strokes],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    setLayout({
      width: Math.max(1, event.nativeEvent.layout.width),
      height: Math.max(1, event.nativeEvent.layout.height),
    });
  };
  const visibleStrokes = active ? [...strokes, active] : strokes;

  return (
    <View
      onLayout={onLayout}
      style={[styles.container, { aspectRatio: image.width / image.height }]}
      {...(enabled ? panResponder.panHandlers : {})}
    >
      <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} />
      <Svg width="100%" height="100%" viewBox={`0 0 ${layout.width} ${layout.height}`} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="selection-mask">
            <Rect x="0" y="0" width={layout.width} height={layout.height} fill="black" />
            <MaskPaths strokes={visibleStrokes} width={layout.width} height={layout.height} />
          </Mask>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={layout.width}
          height={layout.height}
          fill="rgba(129,89,255,0.52)"
          mask="url(#selection-mask)"
        />
      </Svg>
      {enabled && !strokes.length && !active ? (
        <View pointerEvents="none" style={styles.hint}>
          <Text style={styles.hintText}>Paint over what you want to change</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxHeight: 520,
    minHeight: 220,
    overflow: "hidden",
    borderRadius: radii.large,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(9,9,13,0.78)",
    alignItems: "center",
  },
  hintText: { color: colors.text, fontSize: 13, fontWeight: "700" },
});
