import * as THREE from "three";

import type { SubjectFactory } from "../multi-angle-camera/types";

/* ============================================================
   REALISTIC ARCHITECTURAL APARTMENT
   Isometric / Cutaway / Furnished Floor Plan
   ============================================================ */

const COLORS = {
  /* Architecture */
  concrete: 0xd9d5cd,
  wall: 0xe8e4dc,
  wallInner: 0xd6d1c8,
  wallAccent: 0xc8c1b7,

  /* Floors */
  parquet: 0x9a6b43,
  parquetLight: 0xb78758,
  parquetDark: 0x70472d,
  tile: 0xd7d7d3,
  tileDark: 0xbfc0bd,
  marble: 0xe4e1d9,

  /* Wood */
  oak: 0x9a653e,
  oakLight: 0xc18a5b,
  walnut: 0x5d3927,
  woodDark: 0x3f291f,

  /* Furniture */
  fabric: 0xc7c4bd,
  fabricLight: 0xe0ddd6,
  fabricDark: 0x77736e,
  leather: 0x68483a,

  /* Metal */
  black: 0x202124,
  metal: 0x777a7d,
  metalDark: 0x37393b,
  brass: 0xa67c42,

  /* Kitchen */
  kitchen: 0xe3e0d8,
  kitchenDark: 0xb8b3aa,
  countertop: 0xd8d5ce,

  /* Bathroom */
  ceramic: 0xf4f3ef,
  bathroomTile: 0xd5d9d9,
  bathroomDark: 0x8d9494,

  /* Glass */
  glass: 0x9bcbd2,

  /* Decoration */
  green: 0x4f7048,
  greenLight: 0x78936a,
  rug: 0xb9a89a,
  rugDark: 0x8c7a6d,

  white: 0xf7f5f0,
  blackSoft: 0x171819,
};

/* ============================================================
   MATERIAL CACHE
   ============================================================ */

const MATERIAL_CACHE = new Map<
  string,
  THREE.MeshStandardMaterial
>();

function material(
  name: string,
  color: number,
  roughness = 0.7,
  metalness = 0,
) {
  const key = `${name}-${color}-${roughness}-${metalness}`;

  const cached = MATERIAL_CACHE.get(key);

  if (cached) {
    return cached;
  }

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });

  MATERIAL_CACHE.set(key, mat);

  return mat;
}

/* ============================================================
   BASIC GEOMETRY
   ============================================================ */

function box(
  width: number,
  height: number,
  depth: number,
  mat: THREE.Material,
) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    mat,
  );
}

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  mat: THREE.Material,
  segments = 24,
) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      segments,
    ),
    mat,
  );
}

function sphere(
  radius: number,
  mat: THREE.Material,
  widthSegments = 16,
  heightSegments = 12,
) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(
      radius,
      widthSegments,
      heightSegments,
    ),
    mat,
  );
}

/* ============================================================
   ADD HELPERS
   ============================================================ */

function addBox(
  group: THREE.Group,
  options: {
    width: number;
    height: number;
    depth: number;
    x: number;
    y: number;
    z: number;
    material: THREE.Material;
    castShadow?: boolean;
    receiveShadow?: boolean;
  },
) {
  const mesh = box(
    options.width,
    options.height,
    options.depth,
    options.material,
  );

  mesh.position.set(
    options.x,
    options.y,
    options.z,
  );

  mesh.castShadow =
    options.castShadow ?? true;

  mesh.receiveShadow =
    options.receiveShadow ?? true;

  group.add(mesh);

  return mesh;
}

/* ============================================================
   ARCHITECTURAL WALL
   ============================================================ */

function addWall(
  group: THREE.Group,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  mat: THREE.Material,
) {
  return addBox(group, {
    width,
    height,
    depth,
    x,
    y: height / 2,
    z,
    material: mat,
  });
}

/* ============================================================
   LOW CUTAWAY WALL
   ============================================================ */

function addLowWall(
  group: THREE.Group,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  mat: THREE.Material,
) {
  return addWall(
    group,
    x,
    z,
    width,
    depth,
    height,
    mat,
  );
}

/* ============================================================
   SKIRTING
   ============================================================ */

function addSkirting(
  group: THREE.Group,
  x: number,
  z: number,
  width: number,
  depth: number,
  y: number,
) {
  return addBox(group, {
    width,
    height: 0.018,
    depth,
    x,
    y,
    z,
    material: material(
      "skirting",
      COLORS.wallAccent,
      0.8,
    ),
  });
}

/* ============================================================
   FLOOR PLANKS
   ============================================================ */

function addParquetFloor(
  group: THREE.Group,
  x: number,
  z: number,
  width: number,
  depth: number,
) {
  const base = addBox(group, {
    width,
    height: 0.018,
    depth,
    x,
    y: 0.029,
    z,
    material: material(
      "parquet-base",
      COLORS.parquet,
      0.78,
    ),
  });

  base.castShadow = false;

  const plankMat = material(
    "parquet-lines",
    COLORS.parquetDark,
    0.86,
  );

  const plankWidth = 0.085;

  for (
    let px = x - width / 2 + plankWidth;
    px < x + width / 2;
    px += plankWidth
  ) {
    const line = box(
      0.004,
      0.0015,
      depth - 0.012,
      plankMat,
    );

    line.position.set(
      px,
      0.039,
      z,
    );

    line.castShadow = false;
    line.receiveShadow = true;

    group.add(line);
  }

  return base;
}

/* ============================================================
   TILE FLOOR
   ============================================================ */

function addTileFloor(
  group: THREE.Group,
  x: number,
  z: number,
  width: number,
  depth: number,
) {
  const tileMat = material(
    "bathroom-tile",
    COLORS.tile,
    0.72,
  );

  const tile = addBox(group, {
    width,
    height: 0.02,
    depth,
    x,
    y: 0.031,
    z,
    material: tileMat,
  });

  tile.castShadow = false;

  const grout = material(
    "grout",
    COLORS.tileDark,
    0.9,
  );

  const step = 0.075;

  for (
    let px = x - width / 2 + step;
    px < x + width / 2;
    px += step
  ) {
    const line = box(
      0.002,
      0.001,
      depth,
      grout,
    );

    line.position.set(
      px,
      0.043,
      z,
    );

    line.castShadow = false;

    group.add(line);
  }

  for (
    let pz = z - depth / 2 + step;
    pz < z + depth / 2;
    pz += step
  ) {
    const line = box(
      width,
      0.001,
      0.002,
      grout,
    );

    line.position.set(
      x,
      0.043,
      pz,
    );

    line.castShadow = false;

    group.add(line);
  }

  return tile;
}

/* ============================================================
   WINDOW
   ============================================================ */

function addWindow(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  rotationY = 0,
) {
  const windowGroup = new THREE.Group();

  windowGroup.position.set(
    x,
    y,
    z,
  );

  windowGroup.rotation.y =
    rotationY;

  const frameMat = material(
    "window-frame",
    COLORS.black,
    0.3,
    0.75,
  );

  const glassMat =
    new THREE.MeshPhysicalMaterial({
      color: COLORS.glass,
      transparent: true,
      opacity: 0.32,
      roughness: 0.08,
      metalness: 0.05,
      transmission: 0.15,
    });

  const glass = box(
    width,
    height,
    0.006,
    glassMat,
  );

  glass.castShadow = false;
  glass.receiveShadow = false;

  windowGroup.add(glass);

  const frame = 0.012;

  const top = box(
    width,
    frame,
    0.018,
    frameMat,
  );

  top.position.y =
    height / 2;

  windowGroup.add(top);

  const bottom = box(
    width,
    frame,
    0.018,
    frameMat,
  );

  bottom.position.y =
    -height / 2;

  windowGroup.add(bottom);

  const left = box(
    frame,
    height,
    0.018,
    frameMat,
  );

  left.position.x =
    -width / 2;

  windowGroup.add(left);

  const right = box(
    frame,
    height,
    0.018,
    frameMat,
  );

  right.position.x =
    width / 2;

  windowGroup.add(right);

  /* Central mullion */

  const centerFrame = box(
    frame * 0.75,
    height,
    0.02,
    frameMat,
  );

  windowGroup.add(centerFrame);

  group.add(windowGroup);

  return windowGroup;
}

/* ============================================================
   DOOR
   ============================================================ */

function addDoor(
  group: THREE.Group,
  x: number,
  z: number,
  rotationY = 0,
) {
  const doorGroup = new THREE.Group();

  doorGroup.position.set(
    x,
    0,
    z,
  );

  doorGroup.rotation.y =
    rotationY;

  const doorMat = material(
    "door",
    COLORS.walnut,
    0.58,
  );

  const frameMat = material(
    "door-frame",
    COLORS.wallAccent,
    0.75,
  );

  const handleMat = material(
    "door-handle",
    COLORS.brass,
    0.22,
    0.8,
  );

  const door = box(
    0.14,
    0.28,
    0.018,
    doorMat,
  );

  door.position.y =
    0.14;

  doorGroup.add(door);

  const frameLeft = box(
    0.018,
    0.31,
    0.028,
    frameMat,
  );

  frameLeft.position.set(
    -0.079,
    0.155,
    0,
  );

  doorGroup.add(frameLeft);

  const frameRight = frameLeft.clone();

  frameRight.position.x =
    0.079;

  doorGroup.add(frameRight);

  const handle = sphere(
    0.009,
    handleMat,
    12,
    8,
  );

  handle.position.set(
    0.045,
    0.14,
    0.015,
  );

  doorGroup.add(handle);

  group.add(doorGroup);

  return doorGroup;
}

/* ============================================================
   RUG
   ============================================================ */

function addRug(
  group: THREE.Group,
  x: number,
  z: number,
  width: number,
  depth: number,
  rotationY = 0,
) {
  const rugGroup = new THREE.Group();

  rugGroup.position.set(
    x,
    0,
    z,
  );

  rugGroup.rotation.y =
    rotationY;

  const rugMat = material(
    "rug",
    COLORS.rug,
    0.98,
  );

  const rug = box(
    width,
    0.006,
    depth,
    rugMat,
  );

  rug.position.y =
    0.044;

  rugGroup.add(rug);

  const borderMat = material(
    "rug-border",
    COLORS.rugDark,
    0.98,
  );

  const borderTop = box(
    width,
    0.002,
    0.008,
    borderMat,
  );

  borderTop.position.set(
    0,
    0.049,
    depth / 2 - 0.006,
  );

  rugGroup.add(borderTop);

  const borderBottom =
    borderTop.clone();

  borderBottom.position.z =
    -depth / 2 + 0.006;

  rugGroup.add(borderBottom);

  group.add(rugGroup);

  return rugGroup;
}

/* ============================================================
   SOFA
   ============================================================ */

function addSofa(
  group: THREE.Group,
  x: number,
  z: number,
  rotationY = 0,
) {
  const sofaGroup = new THREE.Group();

  sofaGroup.position.set(
    x,
    0,
    z,
  );

  sofaGroup.rotation.y =
    rotationY;

  const fabric = material(
    "sofa-fabric",
    COLORS.fabric,
    0.92,
  );

  const fabricLight = material(
    "sofa-cushion",
    COLORS.fabricLight,
    0.94,
  );

  const dark = material(
    "sofa-feet",
    COLORS.black,
    0.4,
    0.25,
  );

  /* Main base */

  const base = box(
    0.43,
    0.075,
    0.18,
    fabric,
  );

  base.position.y =
    0.082;

  sofaGroup.add(base);

  /* Back */

  const back = box(
    0.43,
    0.16,
    0.052,
    fabric,
  );

  back.position.set(
    0,
    0.17,
    -0.066,
  );

  sofaGroup.add(back);

  /* Arms */

  for (
    const px of [-0.215, 0.215]
  ) {
    const arm = box(
      0.045,
      0.12,
      0.18,
      fabric,
    );

    arm.position.set(
      px,
      0.13,
      0,
    );

    sofaGroup.add(arm);
  }

  /* Seat cushions */

  for (
    const px of [-0.145, 0, 0.145]
  ) {
    const cushion = box(
      0.125,
      0.042,
      0.135,
      fabricLight,
    );

    cushion.position.set(
      px,
      0.135,
      0.01,
    );

    sofaGroup.add(cushion);
  }

  /* Back cushions */

  for (
    const px of [-0.145, 0, 0.145]
  ) {
    const cushion = box(
      0.115,
      0.09,
      0.025,
      fabricLight,
    );

    cushion.position.set(
      px,
      0.205,
      -0.047,
    );

    sofaGroup.add(cushion);
  }

  /* Feet */

  for (
    const px of [-0.17, 0.17]
  ) {
    for (
      const pz of [-0.065, 0.065]
    ) {
      const foot = cylinder(
        0.007,
        0.007,
        0.025,
        dark,
        10,
      );

      foot.position.set(
        px,
        0.025,
        pz,
      );

      sofaGroup.add(foot);
    }
  }

  group.add(sofaGroup);

  return sofaGroup;
}

/* ============================================================
   COFFEE TABLE
   ============================================================ */

function addCoffeeTable(
  group: THREE.Group,
  x: number,
  z: number,
) {
  const table = new THREE.Group();

  table.position.set(
    x,
    0,
    z,
  );

  const wood = material(
    "coffee-table-wood",
    COLORS.oakLight,
    0.48,
  );

  const metal = material(
    "coffee-table-metal",
    COLORS.black,
    0.25,
    0.8,
  );

  const top = box(
    0.22,
    0.025,
    0.125,
    wood,
  );

  top.position.y =
    0.115;

  table.add(top);

  for (
    const px of [-0.085, 0.085]
  ) {
    for (
      const pz of [-0.04, 0.04]
    ) {
      const leg = cylinder(
        0.005,
        0.005,
        0.105,
        metal,
        10,
      );

      leg.position.set(
        px,
        0.055,
        pz,
      );

      table.add(leg);
    }
  }

  /* Decorative book */

  const book = box(
    0.055,
    0.008,
    0.035,
    material(
      "coffee-book",
      COLORS.wallAccent,
      0.9,
    ),
  );

  book.position.set(
    -0.025,
    0.132,
    0,
  );

  table.add(book);

  group.add(table);

  return table;
}

/* ============================================================
   TV UNIT
   ============================================================ */

function addTVUnit(
  group: THREE.Group,
  x: number,
  z: number,
  rotationY = 0,
) {
  const tvGroup = new THREE.Group();

  tvGroup.position.set(
    x,
    0,
    z,
  );

  tvGroup.rotation.y =
    rotationY;

  const wood = material(
    "tv-wood",
    COLORS.walnut,
    0.56,
  );

  const screenMat =
    new THREE.MeshStandardMaterial({
      color: 0x101214,
      roughness: 0.12,
      metalness: 0.35,
    });

  const cabinet = box(
    0.3,
    0.07,
    0.06,
    wood,
  );

  cabinet.position.y =
    0.06;

  tvGroup.add(cabinet);

  const screen = box(
    0.26,
    0.15,
    0.018,
    screenMat,
  );

  screen.position.y =
    0.17;

  tvGroup.add(screen);

  const stand = box(
    0.08,
    0.015,
    0.025,
    COLORS.black
      ? material(
          "tv-stand",
          COLORS.black,
          0.3,
          0.7,
        )
      : wood,
  );

  stand.position.y =
    0.09;

  tvGroup.add(stand);

  group.add(tvGroup);

  return tvGroup;
}

/* ============================================================
   DINING TABLE
   ============================================================ */

function addDiningTable(
  group: THREE.Group,
  x: number,
  z: number,
) {
  const dining = new THREE.Group();

  dining.position.set(
    x,
    0,
    z,
  );

  const wood = material(
    "dining-wood",
    COLORS.oak,
    0.48,
  );

  const metal = material(
    "dining-metal",
    COLORS.black,
    0.25,
    0.75,
  );

  const top = box(
    0.27,
    0.032,
    0.145,
    wood,
  );

  top.position.y =
    0.205;

  dining.add(top);

  for (
    const [px, pz] of [
      [-0.105, -0.05],
      [0.105, -0.05],
      [-0.105, 0.05],
      [0.105, 0.05],
    ]
  ) {
    const leg = cylinder(
      0.006,
      0.006,
      0.195,
      metal,
      10,
    );

    leg.position.set(
      px,
      0.1,
      pz,
    );

    dining.add(leg);
  }

  /* Chairs */

  const chairPositions = [
    [-0.17, 0],
    [0.17, 0],
    [0, -0.095],
    [0, 0.095],
  ];

  for (
    const [px, pz] of chairPositions
  ) {
    const chair = addChair(
      px,
      pz,
    );

    dining.add(chair);
  }

  group.add(dining);

  return dining;
}

function addChair(
  x: number,
  z: number,
) {
  const chair =
    new THREE.Group();

  chair.position.set(
    x,
    0,
    z,
  );

  const wood = material(
    "chair-wood",
    COLORS.oak,
    0.58,
  );

  const seat = box(
    0.065,
    0.028,
    0.065,
    wood,
  );

  seat.position.y =
    0.105;

  chair.add(seat);

  const back = box(
    0.065,
    0.085,
    0.018,
    wood,
  );

  back.position.set(
    0,
    0.16,
    -0.026,
  );

  chair.add(back);

  for (
    const px of [-0.025, 0.025]
  ) {
    for (
      const pz of [-0.025, 0.025]
    ) {
      const leg = cylinder(
        0.004,
        0.004,
        0.095,
        wood,
        8,
      );

      leg.position.set(
        px,
        0.047,
        pz,
      );

      chair.add(leg);
    }
  }

  return chair;
}

/* ============================================================
   KITCHEN
   ============================================================ */

function addKitchen(
  group: THREE.Group,
  x: number,
  z: number,
) {
  const kitchen =
    new THREE.Group();

  kitchen.position.set(
    x,
    0,
    z,
  );

  const cabinet = material(
    "kitchen-cabinet",
    COLORS.kitchen,
    0.62,
  );

  const cabinetDark = material(
    "kitchen-dark",
    COLORS.kitchenDark,
    0.68,
  );

  const counter = material(
    "kitchen-counter",
    COLORS.countertop,
    0.3,
  );

  const metal = material(
    "kitchen-metal",
    COLORS.metal,
    0.22,
    0.78,
  );

  /* Lower cabinets */

  const lower = box(
    0.38,
    0.11,
    0.12,
    cabinet,
  );

  lower.position.y =
    0.06;

  kitchen.add(lower);

  /* Cabinet divisions */

  for (
    const px of [-0.095, 0, 0.095]
  ) {
    const seam = box(
      0.003,
      0.095,
      0.001,
      cabinetDark,
    );

    seam.position.set(
      px,
      0.06,
      -0.061,
    );

    kitchen.add(seam);
  }

  /* Countertop */

  const top = box(
    0.405,
    0.022,
    0.135,
    counter,
  );

  top.position.y =
    0.126;

  kitchen.add(top);

  /* Sink */

  const sink = box(
    0.085,
    0.008,
    0.06,
    material(
      "sink",
      COLORS.metal,
      0.16,
      0.85,
    ),
  );

  sink.position.set(
    -0.1,
    0.142,
    -0.005,
  );

  kitchen.add(sink);

  /* Faucet */

  const faucet = cylinder(
    0.005,
    0.005,
    0.045,
    metal,
    12,
  );

  faucet.position.set(
    -0.1,
    0.165,
    0.025,
  );

  kitchen.add(faucet);

  const faucetTop = cylinder(
    0.004,
    0.004,
    0.035,
    metal,
    12,
  );

  faucetTop.rotation.z =
    Math.PI / 2;

  faucetTop.position.set(
    -0.082,
    0.185,
    0.025,
  );

  kitchen.add(faucetTop);

  /* Hob */

  const hob = box(
    0.11,
    0.006,
    0.065,
    material(
      "hob",
      COLORS.black,
      0.18,
      0.45,
    ),
  );

  hob.position.set(
    0.095,
    0.142,
    0,
  );

  kitchen.add(hob);

  /* Burners */

  for (
    const [px, pz] of [
      [0.07, -0.018],
      [0.12, -0.018],
      [0.07, 0.018],
      [0.12, 0.018],
    ]
  ) {
    const burner =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.013,
          0.013,
          0.003,
          20,
        ),
        metal,
      );

    burner.position.set(
      px,
      0.148,
      pz,
    );

    kitchen.add(burner);
  }

  /* Upper cabinets */

  const upper = box(
    0.36,
    0.115,
    0.055,
    cabinet,
  );

  upper.position.set(
    0,
    0.255,
    -0.035,
  );

  kitchen.add(upper);

  /* Island */

  const island = box(
    0.25,
    0.1,
    0.11,
    cabinetDark,
  );

  island.position.set(
    0,
    0.05,
    0.145,
  );

  kitchen.add(island);

  const islandTop = box(
    0.265,
    0.018,
    0.125,
    counter,
  );

  islandTop.position.set(
    0,
    0.109,
    0.145,
  );

  kitchen.add(islandTop);

  group.add(kitchen);

  return kitchen;
}

/* ============================================================
   BED
   ============================================================ */

function addBed(
  group: THREE.Group,
  x: number,
  z: number,
  rotationY = 0,
) {
  const bedGroup =
    new THREE.Group();

  bedGroup.position.set(
    x,
    0,
    z,
  );

  bedGroup.rotation.y =
    rotationY;

  const wood = material(
    "bed-wood",
    COLORS.walnut,
    0.6,
  );

  const mattressMat = material(
    "mattress",
    COLORS.white,
    0.92,
  );

  const duvetMat = material(
    "duvet",
    COLORS.fabricLight,
    0.96,
  );

  const pillowMat = material(
    "pillow",
    COLORS.white,
    0.95,
  );

  /* Base */

  const base = box(
    0.27,
    0.055,
    0.31,
    wood,
  );

  base.position.y =
    0.06;

  bedGroup.add(base);

  /* Mattress */

  const mattress = box(
    0.25,
    0.065,
    0.29,
    mattressMat,
  );

  mattress.position.y =
    0.115;

  bedGroup.add(mattress);

  /* Duvet */

  const duvet = box(
    0.245,
    0.025,
    0.18,
    duvetMat,
  );

  duvet.position.set(
    0,
    0.158,
    0.035,
  );

  bedGroup.add(duvet);

  /* Headboard */

  const headboard = box(
    0.29,
    0.22,
    0.028,
    wood,
  );

  headboard.position.set(
    0,
    0.16,
    -0.155,
  );

  bedGroup.add(headboard);

  /* Pillows */

  for (
    const px of [-0.075, 0.075]
  ) {
    const pillow = box(
      0.085,
      0.027,
      0.055,
      pillowMat,
    );

    pillow.position.set(
      px,
      0.155,
      -0.09,
    );

    bedGroup.add(pillow);
  }

  group.add(bedGroup);

  return bedGroup;
}

/* ============================================================
   BED SIDE TABLE
   ============================================================ */

function addBedsideTable(
  group: THREE.Group,
  x: number,
  z: number,
) {
  const table =
    new THREE.Group();

  table.position.set(
    x,
    0,
    z,
  );

  const wood = material(
    "bedside-wood",
    COLORS.walnut,
    0.55,
  );

  const metal = material(
    "bedside-metal",
    COLORS.black,
    0.3,
    0.7,
  );

  const body = box(
    0.065,
    0.07,
    0.065,
    wood,
  );

  body.position.y =
    0.065;

  table.add(body);

  for (
    const px of [-0.023, 0.023]
  ) {
    const leg = cylinder(
      0.004,
      0.004,
      0.055,
      metal,
      8,
    );

    leg.position.set(
      px,
      0.027,
      0,
    );

    table.add(leg);
  }

  const lampBase = cylinder(
    0.014,
    0.014,
    0.006,
    metal,
    16,
  );

  lampBase.position.y =
    0.105;

  table.add(lampBase);

  const lamp = sphere(
    0.018,
    material(
      "lamp-shade",
      COLORS.white,
      0.75,
    ),
  );

  lamp.scale.set(
    1,
    0.7,
    1,
  );

  lamp.position.y =
    0.13;

  table.add(lamp);

  group.add(table);

  return table;
}

/* ============================================================
   BATHROOM
   ============================================================ */

function addBathroom(
  group: THREE.Group,
  x: number,
  z: number,
) {
  const bath =
    new THREE.Group();

  bath.position.set(
    x,
    0,
    z,
  );

  const ceramic = material(
    "bath-ceramic",
    COLORS.ceramic,
    0.22,
  );

  const dark = material(
    "bath-metal",
    COLORS.bathroomDark,
    0.25,
    0.7,
  );

  /* Shower base */

  const showerBase = box(
    0.17,
    0.018,
    0.16,
    material(
      "shower-floor",
      COLORS.bathroomTile,
      0.62,
    ),
  );

  showerBase.position.set(
    -0.08,
    0.055,
    0,
  );

  bath.add(showerBase);

  /* Shower glass */

  const glassMat =
    new THREE.MeshPhysicalMaterial({
      color: COLORS.glass,
      transparent: true,
      opacity: 0.22,
      roughness: 0.05,
      transmission: 0.2,
    });

  const glass = box(
    0.008,
    0.19,
    0.16,
    glassMat,
  );

  glass.position.set(
    0.01,
    0.15,
    0,
  );

  glass.castShadow = false;

  bath.add(glass);

  /* Shower column */

  const column = cylinder(
    0.005,
    0.005,
    0.14,
    dark,
    12,
  );

  column.position.set(
    -0.13,
    0.13,
    0,
  );

  bath.add(column);

  /* Vanity */

  const vanity = box(
    0.15,
    0.075,
    0.065,
    ceramic,
  );

  vanity.position.set(
    0.12,
    0.065,
    -0.035,
  );

  bath.add(vanity);

  /* Sink */

  const sink = box(
    0.11,
    0.015,
    0.05,
    ceramic,
  );

  sink.position.set(
    0.12,
    0.11,
    -0.035,
  );

  bath.add(sink);

  /* Mirror */

  const mirror = box(
    0.11,
    0.105,
    0.006,
    material(
      "mirror",
      0x9aa5a8,
      0.08,
      0.45,
    ),
  );

  mirror.position.set(
    0.12,
    0.185,
    -0.07,
  );

  bath.add(mirror);

  /* Toilet */

  const toiletBase = cylinder(
    0.035,
    0.04,
    0.045,
    ceramic,
    24,
  );

  toiletBase.position.set(
    0.13,
    0.055,
    0.065,
  );

  bath.add(toiletBase);

  const toiletSeat = cylinder(
    0.028,
    0.032,
    0.012,
    ceramic,
    24,
  );

  toiletSeat.position.set(
    0.13,
    0.085,
    0.065,
  );

  bath.add(toiletSeat);

  group.add(bath);

  return bath;
}

/* ============================================================
   PLANT
   ============================================================ */

function addPlant(
  group: THREE.Group,
  x: number,
  z: number,
) {
  const plant =
    new THREE.Group();

  plant.position.set(
    x,
    0,
    z,
  );

  const potMat = material(
    "plant-pot",
    0x8a6048,
    0.82,
  );

  const leafMat = material(
    "plant-leaf",
    COLORS.green,
    0.95,
  );

  const pot = cylinder(
    0.032,
    0.04,
    0.055,
    potMat,
    20,
  );

  pot.position.y =
    0.027;

  plant.add(pot);

  for (
    let i = 0;
    i < 9;
    i++
  ) {
    const leaf = sphere(
      0.032,
      i % 2 === 0
        ? leafMat
        : material(
            "plant-light",
            COLORS.greenLight,
            0.95,
          ),
      12,
      8,
    );

    const angle =
      (i / 9) *
      Math.PI *
      2;

    leaf.scale.set(
      0.55,
      1.5,
      0.28,
    );

    leaf.position.set(
      Math.cos(angle) * 0.035,
      0.085 +
        (i % 3) * 0.018,
      Math.sin(angle) * 0.035,
    );

    leaf.rotation.y =
      angle;

    plant.add(leaf);
  }

  group.add(plant);

  return plant;
}

/* ============================================================
   CEILING LIGHT FIXTURE
   ============================================================ */

function addCeilingFixture(
  group: THREE.Group,
  x: number,
  z: number,
) {
  const fixture =
    new THREE.Group();

  fixture.position.set(
    x,
    0.255,
    z,
  );

  const metal = material(
    "ceiling-light-metal",
    COLORS.black,
    0.28,
    0.7,
  );

  const lightMat =
    new THREE.MeshStandardMaterial({
      color: 0xfff4d8,
      roughness: 0.35,
      emissive: 0xffe8b5,
      emissiveIntensity: 0.18,
    });

  const base = cylinder(
    0.018,
    0.018,
    0.008,
    metal,
    20,
  );

  fixture.add(base);

  const lamp = sphere(
    0.024,
    lightMat,
    16,
    10,
  );

  lamp.scale.y = 0.55;

  lamp.position.y =
    -0.018;

  fixture.add(lamp);

  group.add(fixture);

  return fixture;
}

/* ============================================================
   BOOKS
   ============================================================ */

function addBooks(
  group: THREE.Group,
  x: number,
  z: number,
) {
  const books =
    new THREE.Group();

  books.position.set(
    x,
    0,
    z,
  );

  const colors = [
    0x77706a,
    0x9b806a,
    0x646e72,
  ];

  colors.forEach(
    (color, index) => {
      const book = box(
        0.055,
        0.009,
        0.035,
        material(
          `book-${index}`,
          color,
          0.9,
        ),
      );

      book.position.set(
        0,
        0.012 +
          index * 0.01,
        0,
      );

      book.rotation.y =
        index * 0.12;

      books.add(book);
    },
  );

  group.add(books);

  return books;
}

/* ============================================================
   MAIN APARTMENT
   ============================================================ */

export const createApartmentSubject: SubjectFactory =
  (_scene, center) => {
    const apartment =
      new THREE.Group();

    apartment.name =
      "RealisticApartmentCutaway";

    /* ========================================================
       NORMALIZED DIMENSIONS
       ======================================================== */

    const outerWidth = 1.42;
    const outerDepth = 1.20;

    /*
      Important:
      Walls are intentionally lower than a normal
      3D room.

      This creates the architectural cutaway effect.
    */

    const wallHeight = 0.30;
    const lowWallHeight = 0.145;

    const wallThickness = 0.035;

    const wallMat = material(
      "architectural-wall",
      COLORS.wall,
      0.84,
    );

    const innerWallMat = material(
      "inner-wall",
      COLORS.wallInner,
      0.86,
    );

    /* ========================================================
       FLOOR BASE
       ======================================================== */

    const floor = box(
      outerWidth,
      0.04,
      outerDepth,
      material(
        "floor-base",
        COLORS.concrete,
        0.88,
      ),
    );

    floor.position.set(
      0,
      0,
      0,
    );

    floor.receiveShadow = true;

    apartment.add(floor);

    /* ========================================================
       ROOM FLOORING
       ======================================================== */

    /*
      Living room
    */

    addParquetFloor(
      apartment,
      -0.28,
      0.27,
      0.70,
      0.55,
    );

    /*
      Bedroom
    */

    addParquetFloor(
      apartment,
      0.47,
      -0.31,
      0.43,
      0.47,
    );

    /*
      Kitchen
    */

    addTileFloor(
      apartment,
      -0.45,
      -0.38,
      0.42,
      0.30,
    );

    /*
      Bathroom
    */

    addTileFloor(
      apartment,
      0.17,
      -0.48,
      0.28,
      0.23,
    );

    /* ========================================================
       BACK WALL
       ======================================================== */

    addWall(
      apartment,
      0,
      -outerDepth / 2,
      outerWidth,
      wallThickness,
      wallHeight,
      wallMat,
    );

    /* ========================================================
       LEFT WALL
       ======================================================== */

    addWall(
      apartment,
      -outerWidth / 2,
      0,
      wallThickness,
      outerDepth,
      wallHeight,
      wallMat,
    );

    /* ========================================================
       RIGHT WALL
       ======================================================== */

    addWall(
      apartment,
      outerWidth / 2,
      -0.04,
      wallThickness,
      outerDepth - 0.08,
      wallHeight,
      wallMat,
    );

    /* ========================================================
       FRONT WALL
       ======================================================== */

    /*
      Instead of a complete front wall,
      we use low sections.

      This is one of the main differences
      between this version and the old model.
    */

    addLowWall(
      apartment,
      -0.53,
      outerDepth / 2,
      0.34,
      wallThickness,
      lowWallHeight,
      wallMat,
    );

    addLowWall(
      apartment,
      0.56,
      outerDepth / 2,
      0.38,
      wallThickness,
      lowWallHeight,
      wallMat,
    );

    /* ========================================================
       INTERNAL PARTITIONS
       ======================================================== */

    /*
      Bedroom wall
    */

    addLowWall(
      apartment,
      0.24,
      -0.17,
      wallThickness,
      0.55,
      lowWallHeight,
      innerWallMat,
    );

    /*
      Kitchen separation
    */

    addLowWall(
      apartment,
      -0.26,
      -0.28,
      0.46,
      wallThickness,
      lowWallHeight,
      innerWallMat,
    );

    /*
      Bathroom
    */

    addLowWall(
      apartment,
      0.10,
      -0.44,
      0.27,
      wallThickness,
      lowWallHeight,
      innerWallMat,
    );

    /* ========================================================
       SKIRTING
       ======================================================== */

    addSkirting(
      apartment,
      0,
      -outerDepth / 2 + 0.022,
      outerWidth - 0.08,
      0.012,
      0.065,
    );

    addSkirting(
      apartment,
      -outerWidth / 2 + 0.022,
      0,
      0.012,
      outerDepth - 0.08,
      0.065,
    );

    /* ========================================================
       WINDOWS
       ======================================================== */

    addWindow(
      apartment,
      -0.48,
      0.20,
      outerDepth / 2 + 0.004,
      0.28,
      0.13,
      0,
    );

    addWindow(
      apartment,
      0.13,
      0.20,
      -outerDepth / 2 - 0.004,
      0.30,
      0.13,
      0,
    );

    addWindow(
      apartment,
      -outerWidth / 2 - 0.004,
      0.19,
      0.20,
      0.24,
      0.13,
      Math.PI / 2,
    );

    /* ========================================================
       DOORS
       ======================================================== */

    addDoor(
      apartment,
      0.24,
      0.09,
    );

    addDoor(
      apartment,
      -0.26,
      -0.28,
      Math.PI / 2,
    );

    /* ========================================================
       LIVING ROOM
       ======================================================== */

    addRug(
      apartment,
      -0.28,
      0.28,
      0.45,
      0.28,
    );

    addSofa(
      apartment,
      -0.31,
      0.29,
      Math.PI,
    );

    addCoffeeTable(
      apartment,
      -0.31,
      0.07,
    );

    addTVUnit(
      apartment,
      -0.31,
      0.50,
      0,
    );

    addBooks(
      apartment,
      -0.25,
      0.50,
    );

    /* ========================================================
       DINING
       ======================================================== */

    addDiningTable(
      apartment,
      0.25,
      0.28,
    );

    /* ========================================================
       KITCHEN
       ======================================================== */

    addKitchen(
      apartment,
      -0.46,
      -0.39,
    );

    /* ========================================================
       BEDROOM
       ======================================================== */

    addRug(
      apartment,
      0.47,
      -0.29,
      0.30,
      0.35,
    );

    addBed(
      apartment,
      0.49,
      -0.34,
      Math.PI,
    );

    addBedsideTable(
      apartment,
      0.31,
      -0.34,
    );

    addBedsideTable(
      apartment,
      0.67,
      -0.34,
    );

    /* ========================================================
       BATHROOM
       ======================================================== */

    addBathroom(
      apartment,
      0.16,
      -0.48,
    );

    /* ========================================================
       PLANTS
       ======================================================== */

    addPlant(
      apartment,
      -0.57,
      0.47,
    );

    addPlant(
      apartment,
      0.60,
      0.46,
    );

    /* ========================================================
       DECORATIVE LIGHTS
       ======================================================== */

    addCeilingFixture(
      apartment,
      -0.28,
      0.25,
    );

    addCeilingFixture(
      apartment,
      0.48,
      -0.30,
    );

    addCeilingFixture(
      apartment,
      -0.46,
      -0.39,
    );

    /* ========================================================
       FINAL CENTERING
       ======================================================== */

    apartment.position.copy(
      center,
    );

    /*
      Keep the apartment very slightly
      above the camera's normalized origin.
    */

    apartment.position.y =
      -0.01;

    /* ========================================================
       SHADOW CONFIGURATION
       ======================================================== */

    apartment.traverse(
      (object) => {
        const mesh =
          object as THREE.Mesh;

        if (!mesh.isMesh) {
          return;
        }

        /*
          Important for realistic architectural
          visualization.
        */

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        /*
          Avoid unnecessary shadows
          from transparent glass.
        */

        if (
          mesh.material &&
          !Array.isArray(mesh.material)
        ) {
          const material =
            mesh.material as THREE.Material;

          if (
            material.transparent
          ) {
            mesh.castShadow = false;
          }
        }
      },
    );

    return apartment;
  };

export default createApartmentSubject;