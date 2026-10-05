import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Player } from '../types/database';

export interface TokenBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface DraggablePlayerTokenProps {
  player: Player;
  positionLabel: string;
  initialX: number;
  initialY: number;
  bounds: TokenBounds;
  onPositionChange: (playerId: string, newX: number, newY: number) => void;
}

const TOKEN_SIZE = 46;

/**
 * Ficha de Jugador con Drag & Drop Absoluto a 60 FPS.
 * Implementa Gesture.Pan() con restricciones de límites de pantalla (Bounding Box Clamping)
 * y ejecución nativa en el UI Thread de Reanimated.
 */
export const DraggablePlayerToken: React.FC<DraggablePlayerTokenProps> = ({
  player,
  positionLabel,
  initialX,
  initialY,
  bounds,
  onPositionChange,
}) => {
  // Coordenadas absolutas animadas en el UI Thread
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(false);

  // Valores auxiliares para rastrear el inicio del gesto
  const startX = useSharedValue(initialX);
  const startY = useSharedValue(initialY);

  // Sincronizar si cambia initialX o initialY (ej: al cambiar de formación táctica)
  React.useEffect(() => {
    translateX.value = withSpring(initialX, { damping: 15, stiffness: 120 });
    translateY.value = withSpring(initialY, { damping: 15, stiffness: 120 });
  }, [initialX, initialY, translateX, translateY]);

  // Paleta de colores según la posición en la cancha
  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'GK':
        return '#f43f5e'; // Rojo/Rosa (Portero)
      case 'CB':
      case 'LB':
      case 'RB':
        return '#f59e0b'; // Naranja/Amarillo (Defensas)
      case 'CDM':
      case 'CM':
      case 'CAM':
        return '#00b4d8'; // Cyan/Azul (Centrocampistas)
      default:
        return '#00ff87'; // Verde Neón (Delanteros / Extremos)
    }
  };

  const posColor = getPositionColor(positionLabel || player.position);

  // Gesto Pan de react-native-gesture-handler (Reanimated 3 Worklet)
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = translateX.value;
      startY.value = translateY.value;
      isDragging.value = true;
      scale.value = withTiming(1.2, { duration: 150 });
    })
    .onUpdate((event) => {
      'worklet';
      // Cálculo de nueva posición con restricción estricta de límites (Clamp)
      const rawX = startX.value + event.translationX;
      const rawY = startY.value + event.translationY;

      // Restricción matemática de Bounding Box a 60 FPS
      const clampedX = Math.min(Math.max(rawX, bounds.minX), bounds.maxX);
      const clampedY = Math.min(Math.max(rawY, bounds.minY), bounds.maxY);

      translateX.value = clampedX;
      translateY.value = clampedY;
    })
    .onEnd(() => {
      'worklet';
      isDragging.value = false;
      scale.value = withSpring(1, { damping: 12 });

      // Notificar al hilo de JavaScript las coordenadas finales normalizadas
      runOnJS(onPositionChange)(player.id, translateX.value, translateY.value);
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      zIndex: isDragging.value ? 999 : 10,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.tokenContainer, animatedStyle]}>
        {/* Círculo Principal de la Ficha */}
        <View style={[styles.circleBadge, { borderColor: posColor }]}>
          <Text style={[styles.ratingText, { color: posColor }]}>{player.rating}</Text>
          <Text style={styles.posLabelText}>{positionLabel || player.position}</Text>
        </View>

        {/* Nombre del Jugador en etiqueta inferior */}
        <View style={styles.nameTag}>
          <Text style={styles.nameText} numberOfLines={1}>
            {player.name.split(' ').pop()}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  tokenContainer: {
    position: 'absolute',
    width: TOKEN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBadge: {
    width: TOKEN_SIZE,
    height: TOKEN_SIZE,
    borderRadius: TOKEN_SIZE / 2,
    backgroundColor: '#0f172a',
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 14,
  },
  posLabelText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 1,
  },
  nameTag: {
    backgroundColor: 'rgba(7, 10, 15, 0.9)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 2,
    maxWidth: 75,
  },
  nameText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
});
