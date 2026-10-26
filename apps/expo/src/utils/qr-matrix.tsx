import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

export function buildQrMatrix(seed: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  const drawFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[startY + r]![startX + c] = isBorder || isCenter;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    grid[6]![i] = i % 2 === 0;
    grid[i]![6] = i % 2 === 0;
  }

  // Alignment pattern
  const alignX = size - 7;
  const alignY = size - 7;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const isBorder = r === 0 || r === 4 || c === 0 || c === 4;
      const isCenter = r === 2 && c === 2;
      grid[alignY + r]![alignX + c] = isBorder || isCenter;
    }
  }

  // Deterministic hash based on seed string
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder1 = r < 8 && c < 8;
      const inFinder2 = r < 8 && c >= size - 8;
      const inFinder3 = r >= size - 8 && c < 8;
      const inAlign = r >= size - 8 && c >= size - 8;
      const isTiming = r === 6 || c === 6;
      if (inFinder1 || inFinder2 || inFinder3 || inAlign || isTiming) continue;

      hash ^= (r * 31 + c * 17) >>> 0;
      hash = Math.imul(hash, 16777619);
      grid[r]![c] = (hash & 1) === 1;
    }
  }

  return grid;
}

export function QrMatrixView({
  value,
  size = 200,
  darkColor = "#0F172A",
  lightColor = "#FFFFFF",
}: {
  value: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
}) {
  const matrix = useMemo(() => buildQrMatrix(value), [value]);
  const cellSize = Math.floor(size / 21);
  const containerSize = cellSize * 21;

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize + 16,
          height: containerSize + 16,
          backgroundColor: lightColor,
        },
      ]}
    >
      {matrix.map((row, rIdx) => (
        <View key={rIdx} style={{ flexDirection: "row", height: cellSize }}>
          {row.map((cell, cIdx) => (
            <View
              key={cIdx}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: cell ? darkColor : lightColor,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
});
