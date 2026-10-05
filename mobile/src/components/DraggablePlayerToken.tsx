import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Player } from '../types/database';

export interface TokenBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Props {
  player: Player;
  positionLabel: string;
  initialX: number;
  initialY: number;
  bounds: TokenBounds;
  onPositionChange: (playerId: string, newX: number, newY: number) => void;
}

export const DraggablePlayerToken: React.FC<Props> = ({
  player,
  positionLabel,
  initialX,
  initialY,
  bounds,
  onPositionChange,
}) => {
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);

  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  // Sincronizar si cambia la formación desde los botones superiores
  React.useEffect(() => {
    translateX.value = initialX;
    translateY.value = initialY;
  }, [initialX, initialY]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextX.value = translateX.value;
      contextY.value = translateY.value;
    })
    .onUpdate((event) => {
      // Posición absoluta real = punto de inicio + desplazamiento del dedo
      const nextX = contextX.value + event.translationX;
      const nextY = contextY.value + event.translationY;

      // Restringir posición dentro de los bordes del campo
      translateX.value = Math.min(Math.max(nextX, bounds.minX), bounds.maxX);
      translateY.value = Math.min(Math.max(nextY, bounds.minY), bounds.maxY);
    })
    .onEnd(() => {
      runOnJS(onPositionChange)(player.id, translateX.value, translateY.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.tokenContainer, animatedStyle]}>
        <View style={styles.badge}>
          <Text style={styles.ratingText}>{player.rating}</Text>
          <Text style={styles.posText}>{positionLabel}</Text>
        </View>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.name.split(' ').pop()}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  tokenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 54,
    zIndex: 10,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: '#00ff87',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#00ff87',
  },
  posText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  playerName: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
});