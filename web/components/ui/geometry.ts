// ============================================================================
// AXONOMETRIC GEOMETRY
// ============================================================================


import {
  VILLA_SLABS,
  VILLA_VOLUMES,
} from "./geometry-data";

export { ACCENT, VILLA_VOLUMES, VILLA_WALLS } from "./geometry-data";

export function projectAxo(
  x: number,
  y: number,
  z: number,
  scale = 0.85,
  originX = 350,
  originY = 280,
) {
  const cos30 = 0.866;
  const sin30 = 0.5;

  const isoX =
    originX + (x - y) * cos30 * scale;

  const isoY =
    originY +
    (x + y) * sin30 * 0.5 * scale -
    z * scale;

  return {
    x: isoX,
    y: isoY,
  };
}

export function getAxoBoxPaths(
  x: number,
  y: number,
  width: number,
  depth: number,
  height: number,
  elevation: number,
  scale = 0.85,
  originX = 350,
  originY = 280,
) {
  const z0 = elevation;
  const z1 = elevation + height;

  const p0 = projectAxo(
    x,
    y,
    z0,
    scale,
    originX,
    originY,
  );

  const p2 = projectAxo(
    x + width,
    y + depth,
    z0,
    scale,
    originX,
    originY,
  );

  const p3 = projectAxo(
    x,
    y + depth,
    z0,
    scale,
    originX,
    originY,
  );

  const p4 = projectAxo(
    x,
    y,
    z1,
    scale,
    originX,
    originY,
  );

  const p5 = projectAxo(
    x + width,
    y,
    z1,
    scale,
    originX,
    originY,
  );

  const p6 = projectAxo(
    x + width,
    y + depth,
    z1,
    scale,
    originX,
    originY,
  );

  const p7 = projectAxo(
    x,
    y + depth,
    z1,
    scale,
    originX,
    originY,
  );

  return {
    top: `M ${p4.x} ${p4.y} L ${p5.x} ${p5.y} L ${p6.x} ${p6.y} L ${p7.x} ${p7.y} Z`,
    left: `M ${p4.x} ${p4.y} L ${p7.x} ${p7.y} L ${p3.x} ${p3.y} L ${p0.x} ${p0.y} Z`,
    right: `M ${p7.x} ${p7.y} L ${p6.x} ${p6.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} Z`,
  };
}

export const PRECOMPUTED_SLABS = VILLA_SLABS.map((slab) => ({
  ...slab,
  paths: getAxoBoxPaths(
    slab.x,
    slab.y,
    slab.width,
    slab.depth,
    slab.thickness,
    slab.elevation,
  ),
}));

export const PRECOMPUTED_VOLUMES = VILLA_VOLUMES.map((volume) => ({
  ...volume,
  paths: getAxoBoxPaths(
    volume.x,
    volume.y,
    volume.width,
    volume.depth,
    volume.height,
    volume.elevation,
  ),
}));

export const PRECOMPUTED_GLAZING = PRECOMPUTED_VOLUMES.filter(
  (volume) => volume.hasGlazing,
);
