import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Canvas,
  Rect,
  Circle,
  Line,
  Paint,
  vec,
  Group,
} from '@shopify/react-native-skia';

interface PitchCanvasProps {
  width: number;
  height: number;
}

/**
 * Lienzo 2D de Alta Definición renderizado con aceleración por GPU mediante Skia.
 * Dibuja el césped con patrón de franjas y las líneas reglamentarias de una cancha de fútbol.
 */
export const PitchCanvas: React.FC<PitchCanvasProps> = ({ width, height }) => {
  const padding = 14;
  const pitchWidth = width - padding * 2;
  const pitchHeight = height - padding * 2;

  const centerX = width / 2;
  const centerY = height / 2;
  const centerRadius = pitchWidth * 0.16;

  // Parámetros de Áreas de Penalti y Portería
  const penaltyWidth = pitchWidth * 0.52;
  const penaltyHeight = pitchHeight * 0.16;
  const goalAreaWidth = pitchWidth * 0.28;
  const goalAreaHeight = pitchHeight * 0.07;

  // Franjas de césped (8 franjas horizontales)
  const numStripes = 8;
  const stripeHeight = pitchHeight / numStripes;

  return (
    <View style={[styles.container, { width, height }]}>
      <Canvas style={{ width, height }}>
        {/* Fondo verde base oscuro */}
        <Rect x={0} y={0} width={width} height={height} color="#154726" />

        {/* Franjas de césped alternadas */}
        {Array.from({ length: numStripes }).map((_, index) => {
          if (index % 2 === 0) return null;
          return (
            <Rect
              key={index}
              x={padding}
              y={padding + index * stripeHeight}
              width={pitchWidth}
              height={stripeHeight}
              color="#1a552e"
            />
          );
        })}

        {/* LÍNEAS DEL CAMPO (Color blanco tiza con opacidad táctica) */}
        <Group>
          {/* Perímetro Exterior */}
          <Rect
            x={padding}
            y={padding}
            width={pitchWidth}
            height={pitchHeight}
            color="rgba(255, 255, 255, 0.75)"
            style="stroke"
            strokeWidth={2}
          />

          {/* Línea Central */}
          <Line
            p1={vec(padding, centerY)}
            p2={vec(width - padding, centerY)}
            color="rgba(255, 255, 255, 0.75)"
            strokeWidth={2}
          />

          {/* Círculo Central y Punto Central */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={centerRadius}
            color="rgba(255, 255, 255, 0.75)"
            style="stroke"
            strokeWidth={2}
          />
          <Circle cx={centerX} cy={centerY} r={3} color="rgba(255, 255, 255, 0.85)" />

          {/* --- ÁREA SUPERIOR (Portería 1) --- */}
          <Rect
            x={centerX - penaltyWidth / 2}
            y={padding}
            width={penaltyWidth}
            height={penaltyHeight}
            color="rgba(255, 255, 255, 0.75)"
            style="stroke"
            strokeWidth={2}
          />
          <Rect
            x={centerX - goalAreaWidth / 2}
            y={padding}
            width={goalAreaWidth}
            height={goalAreaHeight}
            color="rgba(255, 255, 255, 0.75)"
            style="stroke"
            strokeWidth={2}
          />
          {/* Punto de Penalti Superior */}
          <Circle
            cx={centerX}
            cy={padding + penaltyHeight * 0.72}
            r={2.5}
            color="rgba(255, 255, 255, 0.85)"
          />

          {/* --- ÁREA INFERIOR (Portería 2) --- */}
          <Rect
            x={centerX - penaltyWidth / 2}
            y={padding + pitchHeight - penaltyHeight}
            width={penaltyWidth}
            height={penaltyHeight}
            color="rgba(255, 255, 255, 0.75)"
            style="stroke"
            strokeWidth={2}
          />
          <Rect
            x={centerX - goalAreaWidth / 2}
            y={padding + pitchHeight - goalAreaHeight}
            width={goalAreaWidth}
            height={goalAreaHeight}
            color="rgba(255, 255, 255, 0.75)"
            style="stroke"
            strokeWidth={2}
          />
          {/* Punto de Penalti Inferior */}
          <Circle
            cx={centerX}
            cy={padding + pitchHeight - penaltyHeight * 0.72}
            r={2.5}
            color="rgba(255, 255, 255, 0.85)"
          />
        </Group>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#00ff87',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
});
