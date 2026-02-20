export type MirrorType = 'PLANE' | 'CONCAVE' | 'CONVEX';

export interface Point {
  x: number;
  y: number;
}

export interface Ray {
  points: Point[];
  type: 'REAL' | 'VIRTUAL';
}

export interface SimulationState {
  mirrorType: MirrorType;
  focalLength: number; // Positive for concave, negative for convex
  objectDistance: number; // Always positive (left of mirror)
  objectHeight: number;
}

export const calculateImageDistance = (objDist: number, f: number): number => {
  if (objDist === f) return Infinity;
  return (objDist * f) / (objDist - f);
};

export const calculateObjectDistance = (di: number, f: number): number => {
  if (di === f) return Infinity;
  return (di * f) / (di - f);
};

export const calculateImage = (state: SimulationState) => {
  const { mirrorType, focalLength, objectDistance, objectHeight } = state;

  if (mirrorType === 'PLANE') {
    return {
      imageDistance: -objectDistance,
      imageHeight: objectHeight,
      magnification: 1,
      isReal: false,
    };
  }

  const di = calculateImageDistance(objectDistance, focalLength);
  const magnification = -di / objectDistance;
  const imageHeight = magnification * objectHeight;

  return {
    imageDistance: di,
    imageHeight: imageHeight,
    magnification: magnification,
    isReal: di > 0,
  };
};
