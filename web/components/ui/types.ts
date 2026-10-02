export type RoomType =
  | "master"
  | "bedroom"
  | "bath"
  | "dressing"
  | "corridor"
  | "stair"
  | "terrace";

export interface ArchitecturalVolume {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  elevation: number;
  isCantilever?: boolean;
  hasGlazing?: boolean;
}

export interface SlabGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  elevation: number;
  thickness: number;
}

export interface WallSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  isExterior: boolean;
}
