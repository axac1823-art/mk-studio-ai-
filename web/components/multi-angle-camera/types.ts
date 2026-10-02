import type * as THREE from "three";

export interface CameraState {
  azimuth: number;
  elevation: number;
  distance: number;
  height: number;
  target: { x: number; y: number; z: number };
  fov: number;
  roll: number;
  zoom: number;
  projection: "perspective";
  imageUrl: string | null;
}

export interface CameraWidgetOptions {
  container: HTMLElement;
  initialState?: Partial<CameraState>;
  onStateChange?: (state: CameraState) => void;
}

export type SubjectFactory = (
  scene: THREE.Scene,
  center: THREE.Vector3
) => THREE.Object3D;

export interface MultiAngleCameraHandle {
  updateImage(url: string | null): void;
  setCameraView(enabled: boolean): void;
  setState(state: Partial<CameraState>): void;
  getState(): CameraState;
  getPrompt(): string;
  capturePreview(): string | null;
  reset(): void;
  replaceSubject(factory: SubjectFactory): void;
  cleanup(): void;
}
