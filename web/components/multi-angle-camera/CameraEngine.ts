import * as THREE from "three";

import type {
  CameraState,
  CameraWidgetOptions,
  SubjectFactory,
} from "./types";

export class CameraEngine {
  private readonly container: HTMLElement;

  private readonly onStateChange?:
    | ((state: CameraState) => void)
    | undefined;

  private state: CameraState;

  private scene!: THREE.Scene;

  private camera!: THREE.PerspectiveCamera;

  private previewCamera!: THREE.PerspectiveCamera;

  private renderer!: THREE.WebGLRenderer;

  private activeCamera!:
    THREE.PerspectiveCamera;

  private cameraIndicator!: THREE.Mesh;

  private camGlow!: THREE.Mesh;

  private azimuthHandle!: THREE.Mesh;

  private azGlow!: THREE.Mesh;

  private elevationHandle!: THREE.Mesh;

  private elGlow!: THREE.Mesh;

  private distanceHandle!: THREE.Mesh;

  private distGlow!: THREE.Mesh;

  private glowRing!: THREE.Mesh;

  private imagePlane!: THREE.Mesh;

  private imageFrame!: THREE.LineSegments;

  private planeMat!: THREE.MeshBasicMaterial;

  private imageTexture:
    THREE.Texture | null = null;

  private distanceTube:
    THREE.Mesh | null = null;

  private azimuthRing!: THREE.Mesh;

  private elevationArc!: THREE.Mesh;

  private gridHelper!: THREE.GridHelper;

  private readonly CENTER =
    new THREE.Vector3(
      0,
      0.5,
      0
    );

  private readonly AZIMUTH_RADIUS = 1.8;

  private readonly ELEVATION_RADIUS = 1.4;

  private readonly ELEV_ARC_X = -0.8;

  private liveAzimuth = 0;

  private liveElevation = 0;

  private liveDistance = 5;

  private zoomDragStartY = 0;

  private zoomDragStartValue = 1;

  private isDragging = false;

  private dragTarget:
    | "azimuth"
    | "elevation"
    | "zoom"
    | null = null;

  private hoveredHandle:
    | {
        mesh: THREE.Mesh;
        glow: THREE.Mesh;
        name:
          | "azimuth"
          | "elevation"
          | "zoom";
      }
    | null = null;

  private readonly raycaster =
    new THREE.Raycaster();

  private readonly mouse =
    new THREE.Vector2();

  private useCameraView = false;

  private isOrbitDragging = false;

  private pointerCameraMode: "target" | "roll" | null = null;

  private specialDragStartX = 0;

  private specialDragStartY = 0;

  private specialStartRoll = 0;

  private specialStartTarget = { x: 0, y: 0, z: 0 };

  private orbitStartX = 0;

  private orbitStartY = 0;

  private orbitStartAzimuth = 0;

  private orbitStartElevation = 0;

  private animationId:
    number | null = null;

  private time = 0;

  private resizeObserver:
    ResizeObserver | null = null;

  private subjectRoot:
    THREE.Object3D | null = null;

  private subjectFactory:
    SubjectFactory | null = null;

  private disposed = false;

  constructor(
    options: CameraWidgetOptions & {
      createSubject?: SubjectFactory;
    }
  ) {
    this.container =
      options.container;

    this.onStateChange =
      options.onStateChange;

    this.subjectFactory =
      options.createSubject ??
      null;

    this.state = {
      azimuth:
        normalizeAzimuth(
          options.initialState
            ?.azimuth ?? 0
        ),

      elevation:
        clamp(
          options.initialState
            ?.elevation ?? 0,
          -30,
          60
        ),

      distance:
        clamp(
          options.initialState
            ?.distance ?? 5,
          1,
          10
        ),

      target: {
        x: options.initialState?.target?.x ?? this.CENTER.x,
        y: options.initialState?.target?.y ?? this.CENTER.y,
        z: options.initialState?.target?.z ?? this.CENTER.z,
      },

      height: options.initialState?.height ?? (options.initialState?.target?.y ?? this.CENTER.y) + (options.initialState?.distance ?? 5) * Math.tan((options.initialState?.elevation ?? 0) * Math.PI / 180),

      fov: clamp(options.initialState?.fov ?? 45, 20, 100),
      roll: clamp(options.initialState?.roll ?? 0, -180, 180),
      zoom: clamp(options.initialState?.zoom ?? 1, 0.5, 3),
      projection: "perspective",

      imageUrl:
        options.initialState
          ?.imageUrl ??
        null,
    };

    this.liveAzimuth =
      this.state.azimuth;

    this.liveElevation =
      this.state.elevation;

    this.liveDistance =
      this.state.distance;

    this.initThreeJS();

    this.bindEvents();

    this.animate();

    if (this.state.imageUrl) {
      this.updateImage(
        this.state.imageUrl
      );
    }
  }

  private initThreeJS(): void {
    const width =
      this.container.clientWidth ||
      300;

    const height =
      this.container.clientHeight ||
      300;

    this.scene =
      new THREE.Scene();

    this.scene.background =
      new THREE.Color(
        0x0a0a0f
      );

    this.camera =
      new THREE.PerspectiveCamera(
        45,
        width / height,
        0.1,
        1000
      );

    this.camera.position.set(
      4,
      3.5,
      4
    );

    this.camera.lookAt(
      0,
      0.3,
      0
    );

    this.previewCamera =
      new THREE.PerspectiveCamera(
        this.state.fov,
        width / height,
        0.1,
        100
      );

    this.activeCamera =
      this.camera;

    this.renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });

    this.renderer.setSize(
      width,
      height,
      false
    );

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio ||
          1,
        2
      )
    );

    this.renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    const canvas =
      this.renderer.domElement;

    canvas.style.position =
      "absolute";

    canvas.style.top = "0";

    canvas.style.left = "0";

    canvas.style.width =
      "100%";

    canvas.style.height =
      "100%";

    canvas.style.display =
      "block";

    canvas.style.touchAction =
      "none";

    this.container.appendChild(
      canvas
    );

    const ambientLight =
      new THREE.AmbientLight(
        0xffffff,
        0.4
      );

    this.scene.add(
      ambientLight
    );

    const mainLight =
      new THREE.DirectionalLight(
        0xffffff,
        0.8
      );

    mainLight.position.set(
      5,
      10,
      5
    );

    this.scene.add(
      mainLight
    );

    const fillLight =
      new THREE.DirectionalLight(
        0xe93d82,
        0.3
      );

    fillLight.position.set(
      -5,
      5,
      -5
    );

    this.scene.add(
      fillLight
    );

    this.gridHelper =
      new THREE.GridHelper(
        5,
        20,
        0x1a1a2e,
        0x12121a
      );

    this.gridHelper.position.y =
      -0.01;

    this.scene.add(
      this.gridHelper
    );

    this.createSubject();

    this.createGlowRing();

    this.createCameraIndicator();

    this.createAzimuthRing();

    this.createElevationArc();

    this.createDistanceHandle();

    this.updateVisuals();
  }

  private createGridTexture():
    THREE.CanvasTexture {
    const canvas =
      document.createElement(
        "canvas"
      );

    const size = 256;

    canvas.width = size;

    canvas.height = size;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "Unable to create 2D canvas context."
      );
    }

    ctx.fillStyle =
      "#1a1a2a";

    ctx.fillRect(
      0,
      0,
      size,
      size
    );

    ctx.strokeStyle =
      "#2a2a3a";

    ctx.lineWidth = 1;

    const gridSize = 16;

    for (
      let i = 0;
      i <= size;
      i += gridSize
    ) {
      ctx.beginPath();

      ctx.moveTo(
        i,
        0
      );

      ctx.lineTo(
        i,
        size
      );

      ctx.stroke();

      ctx.beginPath();

      ctx.moveTo(
        0,
        i
      );

      ctx.lineTo(
        size,
        i
      );

      ctx.stroke();
    }

    const texture =
      new THREE.CanvasTexture(
        canvas
      );

    texture.wrapS =
      THREE.RepeatWrapping;

    texture.wrapT =
      THREE.RepeatWrapping;

    texture.repeat.set(
      4,
      4
    );

    texture.needsUpdate =
      true;

    return texture;
  }

  /** Create a two-sided reference board for image-driven camera control. */
  private createSubject(): void {
    if (
      this.subjectFactory
    ) {
      this.subjectRoot =
        this.subjectFactory(
          this.scene,
          this.CENTER
        );

      this.scene.add(
        this.subjectRoot
      );

      return;
    }

    const cardThickness = 0.02;

    const cardGeo =
      new THREE.BoxGeometry(
        1.2,
        1.2,
        cardThickness
      );

    const frontMat =
      new THREE.MeshBasicMaterial(
        {
          color: 0x3a3a4a,
          side: THREE.DoubleSide,
        }
      );

    const edgeMat =
      new THREE.MeshBasicMaterial(
        {
          color: 0x1a1a2a,
        }
      );

    const backMat =
      new THREE.MeshBasicMaterial({
        color: 0x22222e,
      });

    const cardMaterials = [
      edgeMat,
      edgeMat,
      edgeMat,
      edgeMat,
      frontMat,
      backMat,
    ];

    this.imagePlane =
      new THREE.Mesh(
        cardGeo,
        cardMaterials
      );

    this.imagePlane.position.copy(
      this.CENTER
    );

    this.scene.add(
      this.imagePlane
    );

    this.planeMat =
      frontMat;

    const frameGeo =
      new THREE.EdgesGeometry(
        cardGeo
      );

    const frameMat =
      new THREE.LineBasicMaterial(
        {
          color: 0xe93d82,
        }
      );

    this.imageFrame =
      new THREE.LineSegments(
        frameGeo,
        frameMat
      );

    this.imageFrame.position.copy(
      this.CENTER
    );

    this.scene.add(
      this.imageFrame
    );

  }

  private createGlowRing(): void {
    const glowRingGeo =
      new THREE.RingGeometry(
        0.55,
        0.58,
        64
      );

    const glowRingMat =
      new THREE.MeshBasicMaterial(
        {
          color: 0xe93d82,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
        }
      );

    this.glowRing =
      new THREE.Mesh(
        glowRingGeo,
        glowRingMat
      );

    this.glowRing.position.set(
      0,
      0.01,
      0
    );

    this.glowRing.rotation.x =
      -Math.PI / 2;

    this.scene.add(
      this.glowRing
    );
  }

  private createCameraIndicator(): void {
    const camGeo =
      new THREE.ConeGeometry(
        0.15,
        0.4,
        4
      );

    const camMat =
      new THREE.MeshStandardMaterial(
        {
          color: 0xe93d82,
          emissive: 0xe93d82,
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2,
        }
      );

    this.cameraIndicator =
      new THREE.Mesh(
        camGeo,
        camMat
      );

    this.scene.add(
      this.cameraIndicator
    );

    const camGlowGeo =
      new THREE.SphereGeometry(
        0.08,
        16,
        16
      );

    const camGlowMat =
      new THREE.MeshBasicMaterial(
        {
          color: 0xff6ba8,
          transparent: true,
          opacity: 0.8,
        }
      );

    this.camGlow =
      new THREE.Mesh(
        camGlowGeo,
        camGlowMat
      );

    this.scene.add(
      this.camGlow
    );
  }

  private createAzimuthRing(): void {
    const azRingGeo =
      new THREE.TorusGeometry(
        this.AZIMUTH_RADIUS,
        0.04,
        16,
        100
      );

    const azRingMat =
      new THREE.MeshBasicMaterial(
        {
          color: 0xe93d82,
          transparent: true,
          opacity: 0.7,
        }
      );

    this.azimuthRing =
      new THREE.Mesh(
        azRingGeo,
        azRingMat
      );

    this.azimuthRing.rotation.x =
      Math.PI / 2;

    this.scene.add(
      this.azimuthRing
    );

    const azHandleGeo =
      new THREE.SphereGeometry(
        0.16,
        32,
        32
      );

    const azHandleMat =
      new THREE.MeshStandardMaterial(
        {
          color: 0xe93d82,
          emissive: 0xe93d82,
          emissiveIntensity: 0.6,
          metalness: 0.3,
          roughness: 0.4,
        }
      );

    this.azimuthHandle =
      new THREE.Mesh(
        azHandleGeo,
        azHandleMat
      );

    this.scene.add(
      this.azimuthHandle
    );

    const azGlowGeo =
      new THREE.SphereGeometry(
        0.22,
        16,
        16
      );

    const azGlowMat =
      new THREE.MeshBasicMaterial(
        {
          color: 0xe93d82,
          transparent: true,
          opacity: 0.2,
        }
      );

    this.azGlow =
      new THREE.Mesh(
        azGlowGeo,
        azGlowMat
      );

    this.scene.add(
      this.azGlow
    );
  }

  private createElevationArc(): void {
    const arcPoints:
      THREE.Vector3[] = [];

    for (
      let i = 0;
      i <= 32;
      i++
    ) {
      const angle =
        (-30 +
          (90 * i) / 32) *
        (Math.PI / 180);

      arcPoints.push(
        new THREE.Vector3(
          this.ELEV_ARC_X,

          this.ELEVATION_RADIUS *
              Math.sin(angle) +
            this.CENTER.y,

          this.ELEVATION_RADIUS *
            Math.cos(angle)
        )
      );
    }

    const arcCurve =
      new THREE.CatmullRomCurve3(
        arcPoints
      );

    const elArcGeo =
      new THREE.TubeGeometry(
        arcCurve,
        32,
        0.04,
        8,
        false
      );

    const elArcMat =
      new THREE.MeshBasicMaterial(
        {
          color: 0x00ffd0,
          transparent: true,
          opacity: 0.8,
        }
      );

    this.elevationArc =
      new THREE.Mesh(
        elArcGeo,
        elArcMat
      );

    this.scene.add(
      this.elevationArc
    );

    const elHandleGeo =
      new THREE.SphereGeometry(
        0.16,
        32,
        32
      );

    const elHandleMat =
      new THREE.MeshStandardMaterial(
        {
          color: 0x00ffd0,
          emissive: 0x00ffd0,
          emissiveIntensity: 0.6,
          metalness: 0.3,
          roughness: 0.4,
        }
      );

    this.elevationHandle =
      new THREE.Mesh(
        elHandleGeo,
        elHandleMat
      );

    this.scene.add(
      this.elevationHandle
    );

    const elGlowGeo =
      new THREE.SphereGeometry(
        0.22,
        16,
        16
      );

    const elGlowMat =
      new THREE.MeshBasicMaterial(
        {
          color: 0x00ffd0,
          transparent: true,
          opacity: 0.2,
        }
      );

    this.elGlow =
      new THREE.Mesh(
        elGlowGeo,
        elGlowMat
      );

    this.scene.add(
      this.elGlow
    );
  }

  private createDistanceHandle(): void {
    const distHandleGeo =
      new THREE.SphereGeometry(
        0.12,
        32,
        32
      );

    const distHandleMat =
      new THREE.MeshStandardMaterial(
        {
          color: 0xffb800,
          emissive: 0xffb800,
          emissiveIntensity: 0.7,
          metalness: 0.5,
          roughness: 0.3,
        }
      );

    this.distanceHandle =
      new THREE.Mesh(
        distHandleGeo,
        distHandleMat
      );

    this.scene.add(
      this.distanceHandle
    );

    const distGlowGeo =
      new THREE.SphereGeometry(
        0.17,
        16,
        16
      );

    const distGlowMat =
      new THREE.MeshBasicMaterial(
        {
          color: 0xffb800,
          transparent: true,
          opacity: 0.25,
        }
      );

    this.distGlow =
      new THREE.Mesh(
        distGlowGeo,
        distGlowMat
      );

    this.scene.add(
      this.distGlow
    );
  }

  private updateDistanceLine(
    start: THREE.Vector3,
    end: THREE.Vector3
  ): void {
    if (
      this.distanceTube
    ) {
      this.scene.remove(
        this.distanceTube
      );

      this.distanceTube.geometry.dispose();

      const material =
        this.distanceTube.material;

      if (
        Array.isArray(material)
      ) {
        material.forEach((m) =>
          m.dispose()
        );
      } else {
        material.dispose();
      }

      this.distanceTube =
        null;
    }

    const path =
      new THREE.LineCurve3(
        start,
        end
      );

    const tubeGeo =
      new THREE.TubeGeometry(
        path,
        1,
        0.004,
        8,
        false
      );

    const tubeMat =
      new THREE.MeshBasicMaterial(
        {
          color: 0xffb800,
          transparent: true,
          opacity: 0.8,
        }
      );

    this.distanceTube =
      new THREE.Mesh(
        tubeGeo,
        tubeMat
      );

    this.scene.add(
      this.distanceTube
    );
  }

  private updateVisuals(): void {
    const target = new THREE.Vector3(
      this.state.target.x,
      this.state.target.y,
      this.state.target.z
    );
    this.azimuthRing.position.copy(target);
    const azRad =
      (this.liveAzimuth *
        Math.PI) /
      180;

    const elRad =
      (this.liveElevation *
        Math.PI) /
      180;

    const visualDist = this.liveDistance;

    const camX =
      target.x + visualDist *
      Math.sin(azRad);

    const camY =
      target.y +
      visualDist * Math.tan(elRad);

    const camZ =
      target.z + visualDist *
      Math.cos(azRad);

    this.state.height = camY;

    this.cameraIndicator.position.set(
      camX,
      camY,
      camZ
    );
this.camera.position.set(
  camX,
  camY,
  camZ
);

this.camera.lookAt(target);
this.camera.rotateZ(
  THREE.MathUtils.degToRad(
    this.state.roll
  )
);

this.camera.fov = this.state.fov;
this.camera.zoom = this.state.zoom;
this.camera.updateProjectionMatrix();
    this.cameraIndicator.lookAt(
      target
    );

    this.cameraIndicator.rotateX(
      Math.PI / 2
    );

    this.camGlow.position.copy(
      this.cameraIndicator.position
    );

    const azX =
      target.x + this.AZIMUTH_RADIUS *
      Math.sin(azRad);

    const azZ =
      target.z + this.AZIMUTH_RADIUS *
      Math.cos(azRad);

    this.azimuthHandle.position.set(
      azX,
      target.y,
      azZ
    );

    this.azGlow.position.copy(
      this.azimuthHandle.position
    );

    const elY =
      target.y +
      this.ELEVATION_RADIUS *
        Math.sin(elRad);

    const elZ =
      this.ELEVATION_RADIUS *
      Math.cos(elRad);

    this.elevationHandle.position.set(
      target.x + this.ELEV_ARC_X,
      elY,
      target.z + elZ
    );

    this.elGlow.position.copy(
      this.elevationHandle.position
    );

    const zoomT =
      0.15 +
      ((this.state.zoom - 0.5) / 2.5) *
        0.7;

    this.distanceHandle.position
      .copy(
        target
      )
      .lerp(
        this.cameraIndicator.position,
        zoomT
      );

    this.distGlow.position.copy(
      this.distanceHandle.position
    );

























    
/* ============================================================
   APPLY CAMERA TRANSFORM
   ============================================================ */

this.camera.position.set(
  camX,
  camY,
  camZ
);

this.camera.lookAt(target);

this.camera.rotateZ(
  THREE.MathUtils.degToRad(
    this.state.roll
  )
);

this.camera.fov =
  this.state.fov;

this.camera.zoom =
  this.state.zoom;

this.camera.updateProjectionMatrix();

/* ============================================================
   PREVIEW CAMERA
   ============================================================ */

this.previewCamera.position.set(
  camX,
  camY,
  camZ
);

this.previewCamera.lookAt(
  target
);

this.previewCamera.rotateZ(
  THREE.MathUtils.degToRad(
    this.state.roll
  )
);

this.previewCamera.fov =
  this.state.fov;

this.previewCamera.zoom =
  this.state.zoom;

this.previewCamera.updateProjectionMatrix();
  }

  private bindEvents(): void {
    const canvas =
      this.renderer.domElement;

    canvas.addEventListener(
      "pointerdown",
      this.onPointerDown
    );

    canvas.addEventListener(
      "pointermove",
      this.onPointerMove
    );

    canvas.addEventListener(
      "pointerup",
      this.onPointerUp
    );

    canvas.addEventListener(
      "pointercancel",
      this.onPointerUp
    );

    canvas.addEventListener(
      "pointerleave",
      this.onPointerLeave
    );

    canvas.addEventListener(
      "wheel",
      this.onWheel,
      {
        passive: false,
      }
    );

    this.resizeObserver =
      new ResizeObserver(() => {
        this.onResize();
      });

    this.resizeObserver.observe(
      this.container
    );
  }

  private getMousePos(
    event: PointerEvent
  ): void {
    const rect =
      this.renderer.domElement.getBoundingClientRect();

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return;
    }

    this.mouse.x =
      ((event.clientX -
        rect.left) /
        rect.width) *
        2 -
      1;

    this.mouse.y =
      -(
        ((event.clientY -
          rect.top) /
          rect.height) *
          2 -
        1
      );
  }

  private setHandleScale(
    handle: THREE.Mesh,
    glow: THREE.Mesh | null,
    scale: number
  ): void {
    handle.scale.setScalar(
      scale
    );

    if (glow) {
      glow.scale.setScalar(
        scale
      );
    }
  }

  private getHandles() {
    return [
      {
        mesh:
          this.azimuthHandle,
        glow:
          this.azGlow,
        name: "azimuth" as const,
      },

      {
        mesh:
          this.elevationHandle,
        glow:
          this.elGlow,
        name: "elevation" as const,
      },

      {
        mesh:
          this.distanceHandle,
        glow:
          this.distGlow,
        name: "zoom" as const,
      },
    ];
  }

  private findHandle(
    pointer: THREE.Vector2
  ) {
    this.raycaster.setFromCamera(
      pointer,
      this.camera
    );

    for (
      const handle of this.getHandles()
    ) {
      if (
        this.raycaster.intersectObject(
          handle.mesh,
          false
        ).length > 0
      ) {
        return handle;
      }
    }

    return null;
  }

  private setAzimuthFromPoint(point: THREE.Vector3): void {
    const dx = point.x - this.state.target.x;
    const dz = point.z - this.state.target.z;
    if (Math.hypot(dx, dz) < 1e-4) return;

    const angle = normalizeAzimuth(
      THREE.MathUtils.radToDeg(Math.atan2(dx, dz))
    );
    this.liveAzimuth = angle;
    this.state.azimuth = Math.round(angle) % 360;
    this.updateVisuals();
    this.notifyStateChange();
  }

  private onPointerDown = (
    event: PointerEvent
  ): void => {
    if (this.disposed) {
      return;
    }

    this.getMousePos(
      event
    );

    const canvas =
      this.renderer.domElement;

    try {
      canvas.setPointerCapture(
        event.pointerId
      );
    } catch {
      // Some browsers may not support capture here.
    }

    /**
     * Camera view mode:
     * drag the preview camera directly.
     */
    if (
      this.useCameraView
    ) {
      this.isOrbitDragging =
        true;

      this.orbitStartX =
        event.clientX;

      this.orbitStartY =
        event.clientY;

      this.orbitStartAzimuth =
        this.liveAzimuth;

      this.orbitStartElevation =
        this.liveElevation;

      canvas.style.cursor =
        "grabbing";

      return;
    }

    if (event.altKey || event.shiftKey) {
      this.pointerCameraMode = event.altKey ? "roll" : "target";
      this.specialDragStartX = event.clientX;
      this.specialDragStartY = event.clientY;
      this.specialStartRoll = this.state.roll;
      this.specialStartTarget = { ...this.state.target };
      canvas.style.cursor = "grabbing";
      return;
    }

    this.raycaster.setFromCamera(
      this.mouse,
      this.camera
    );

    const handle =
      this.findHandle(
        this.mouse
      );

    if (!handle) {
      const ringHit = this.azimuthRing.visible
        ? this.raycaster.intersectObject(this.azimuthRing, false)[0]
        : undefined;
      if (!ringHit) return;

      this.isDragging = true;
      this.dragTarget = "azimuth";
      this.setAzimuthFromPoint(ringHit.point);
      canvas.style.cursor = "grabbing";
      return;
    }

    this.isDragging =
      true;

    this.dragTarget =
      handle.name;

    if (handle.name === "zoom") {
      this.zoomDragStartY = event.clientY;
      this.zoomDragStartValue = this.state.zoom;
    }

    this.setHandleScale(
      handle.mesh,
      handle.glow,
      1.3
    );

    canvas.style.cursor =
      "grabbing";
  };

  private onPointerMove = (
    event: PointerEvent
  ): void => {
    if (this.disposed) {
      return;
    }

    this.getMousePos(
      event
    );

    /**
     * CAMERA VIEW ORBIT
     */
    if (
      this.useCameraView &&
      this.isOrbitDragging
    ) {
      const deltaX =
        event.clientX -
        this.orbitStartX;

      const deltaY =
        event.clientY -
        this.orbitStartY;

      const sensitivity =
        0.5;

      let newAzimuth =
        this.orbitStartAzimuth -
        deltaX *
          sensitivity;

      newAzimuth =
        normalizeAzimuth(
          newAzimuth
        );

      let newElevation =
        this.orbitStartElevation +
        deltaY *
          sensitivity;

      newElevation =
        clamp(
          newElevation,
          -30,
          60
        );

      this.liveAzimuth =
        newAzimuth;

      this.liveElevation =
        newElevation;

      this.state.azimuth =
        Math.round(
          newAzimuth
        );

      this.state.elevation =
        Math.round(
          newElevation
        );

      this.updateVisuals();

      this.notifyStateChange();

      return;
    }

    if (this.pointerCameraMode === "roll") {
      this.state.roll = clamp(this.specialStartRoll + (event.clientX - this.specialDragStartX) * 0.5, -180, 180);
      this.updateVisuals();
      this.notifyStateChange();
      return;
    }

    if (this.pointerCameraMode === "target") {
      const height = this.renderer.domElement.clientHeight || 1;
      const horizontalFov = THREE.MathUtils.degToRad(this.state.fov / this.state.zoom);
      const worldUnitsPerPixel = (2 * this.state.distance * Math.tan(horizontalFov / 2)) / height;
      const azimuth = THREE.MathUtils.degToRad(this.state.azimuth);
      const rightX = Math.cos(azimuth);
      const rightZ = -Math.sin(azimuth);
      const deltaX = (event.clientX - this.specialDragStartX) * worldUnitsPerPixel;
      const deltaY = (event.clientY - this.specialDragStartY) * worldUnitsPerPixel;
      this.state.target = {
        x: this.specialStartTarget.x - deltaX * rightX,
        y: this.specialStartTarget.y + deltaY,
        z: this.specialStartTarget.z - deltaX * rightZ,
      };
      this.updateVisuals();
      this.notifyStateChange();
      return;
    }

    this.raycaster.setFromCamera(
      this.mouse,
      this.camera
    );

    /**
     * HOVER
     */
    if (
      !this.isDragging
    ) {
      const found =
        this.findHandle(
          this.mouse
        );

      if (
        this.hoveredHandle &&
        (
          !found ||
          found.mesh !==
            this.hoveredHandle.mesh
        )
      ) {
        this.setHandleScale(
          this.hoveredHandle.mesh,
          this.hoveredHandle.glow,
          1
        );

        this.hoveredHandle =
          null;
      }

      if (found) {
        this.setHandleScale(
          found.mesh,
          found.glow,
          1.15
        );

        this.hoveredHandle =
          found;

        this.renderer
          .domElement
          .style.cursor =
          "grab";
      } else {
        this.renderer
          .domElement
          .style.cursor =
          "default";
      }

      return;
    }

    /**
     * AZIMUTH
     */
    if (
      this.dragTarget ===
      "azimuth"
    ) {
      const plane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -this.state.target.y
      );
      const intersect = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, intersect)) {
        this.setAzimuthFromPoint(intersect);
      }

      return;
    }

    /**
     * ELEVATION
     */
    if (
      this.dragTarget ===
      "elevation"
    ) {
      const plane =
        new THREE.Plane(
          new THREE.Vector3(
            1,
            0,
            0
          ),
          -(this.state.target.x + this.ELEV_ARC_X)
        );

      const intersect =
        new THREE.Vector3();

      if (
        this.raycaster.ray.intersectPlane(
          plane,
          intersect
        )
      ) {
        const relY =
          intersect.y -
          this.state.target.y;

        const relZ =
          intersect.z - this.state.target.z;

        let angle =
          THREE.MathUtils.radToDeg(
            Math.atan2(
              relY,
              relZ
            )
          );

        angle =
          clamp(
            angle,
            -30,
            60
          );

        this.liveElevation =
          angle;

        this.state.elevation =
          Math.round(
            angle
          );

        this.updateVisuals();

        this.notifyStateChange();
      }

      return;
    }

    /**
     * ZOOM
     */
    if (
      this.dragTarget ===
      "zoom"
    ) {
      const canvasHeight = Math.max(this.renderer.domElement.clientHeight, 1);
      const zoomPerPixel = 2.5 / canvasHeight;
      this.state.zoom = clamp(
        this.zoomDragStartValue -
          (event.clientY - this.zoomDragStartY) * zoomPerPixel,
        0.5,
        3
      );

      this.updateVisuals();

      this.notifyStateChange();
    }
  };

  private onPointerUp = (
    event?: PointerEvent
  ): void => {
    if (event) {
      try {
        this.renderer.domElement.releasePointerCapture(
          event.pointerId
        );
      } catch {
        // Ignore.
      }
    }

    if (
      this.isOrbitDragging
    ) {
      this.isOrbitDragging =
        false;

      this.renderer.domElement.style.cursor =
        this.useCameraView
          ? "grab"
          : "default";

      return;
    }

    this.pointerCameraMode = null;

    if (
      this.isDragging
    ) {
      this.getHandles().forEach(
        (handle) => {
          this.setHandleScale(
            handle.mesh,
            handle.glow,
            1
          );
        }
      );
    }

    this.isDragging =
      false;

    this.dragTarget =
      null;

    this.renderer.domElement.style.cursor =
      this.useCameraView
        ? "grab"
        : "default";
  };

  private onPointerLeave = (): void => {
    if (
      this.isDragging ||
      this.isOrbitDragging ||
      this.pointerCameraMode !== null
    ) {
      return;
    }

    if (
      this.hoveredHandle
    ) {
      this.setHandleScale(
        this.hoveredHandle.mesh,
        this.hoveredHandle.glow,
        1
      );

      this.hoveredHandle =
        null;
    }

    this.renderer.domElement.style.cursor =
      this.useCameraView
        ? "grab"
        : "default";
  };

  private onWheel = (
    event: WheelEvent
  ): void => {
    event.preventDefault();

    const sensitivity =
      0.003;

    if (event.ctrlKey) {
      this.state.fov = clamp(this.state.fov + event.deltaY * 0.02, 20, 100);
    } else {
      this.state.zoom = clamp(
        this.state.zoom - event.deltaY * sensitivity,
        0.5,
        3
      );
    }

    this.updateVisuals();

    this.notifyStateChange();
  };

  private onResize = (): void => {
    if (this.disposed) {
      return;
    }

    const width =
      this.container.clientWidth;

    const height =
      this.container.clientHeight;

    if (
      width === 0 ||
      height === 0
    ) {
      return;
    }

    this.camera.aspect =
      width / height;

    this.camera.updateProjectionMatrix();

    this.previewCamera.aspect =
      width / height;

    this.previewCamera.updateProjectionMatrix();

    this.renderer.setSize(
      width,
      height,
      false
    );

    this.updateVisuals();
  };

  private animate = (): void => {
    if (this.disposed) {
      return;
    }

    this.animationId =
      window.requestAnimationFrame(
        this.animate
      );

    this.time += 0.01;

    const pulse =
      1 +
      Math.sin(
        this.time * 2
      ) *
        0.03;

    this.camGlow.scale.setScalar(
      pulse
    );

    if (this.glowRing.visible) {
      this.glowRing.rotation.z += 0.003;
    }

    this.renderer.render(
      this.scene,
      this.activeCamera
    );
  };

  private notifyStateChange(): void {
    this.onStateChange?.(this.getState());
  }

  public generatePrompt(): string {
    const hAngle =
      normalizeAzimuth(
        this.state.azimuth
      );

    let hDirection =
      "front view";

    if (
      hAngle < 22.5 ||
      hAngle >= 337.5
    ) {
      hDirection =
        "front view";
    } else if (
      hAngle < 67.5
    ) {
      hDirection =
        "front-right quarter view";
    } else if (
      hAngle < 112.5
    ) {
      hDirection =
        "right side view";
    } else if (
      hAngle < 157.5
    ) {
      hDirection =
        "back-right quarter view";
    } else if (
      hAngle < 202.5
    ) {
      hDirection =
        "back view";
    } else if (
      hAngle < 247.5
    ) {
      hDirection =
        "back-left quarter view";
    } else if (
      hAngle < 292.5
    ) {
      hDirection =
        "left side view";
    } else {
      hDirection =
        "front-left quarter view";
    }

    let vDirection =
      "eye-level shot";

    if (
      this.state.elevation <
      -15
    ) {
      vDirection =
        "low-angle shot";
    } else if (
      this.state.elevation <
      15
    ) {
      vDirection =
        "eye-level shot";
    } else if (
      this.state.elevation <
      45
    ) {
      vDirection =
        "elevated shot";
    } else {
      vDirection =
        "high-angle shot";
    }

    let distance =
      "medium shot";

    if (
      this.state.distance <
      2
    ) {
      distance =
        "close-up";
    } else if (
      this.state.distance <=
      6
    ) {
      distance =
        "medium shot";
    } else {
      distance =
        "wide shot";
    }

    return `<sks> ${hDirection} ${vDirection} ${distance}`;
  }

  public getPrompt(): string {
    return this.generatePrompt();
  }

  public getState(): CameraState {
    return {
      ...this.state,
      target: { ...this.state.target },
    };
  }

  public capturePreview(): string {
    const wasCameraView = this.useCameraView;
    this.setCameraView(true);
    try {
      this.updateVisuals();
      this.renderer.render(this.scene, this.previewCamera);
      return this.renderer.domElement.toDataURL("image/png");
    } finally {
      this.setCameraView(wasCameraView);
      this.renderer.render(this.scene, this.activeCamera);
    }
  }

  public setState(
    newState: Partial<CameraState>
  ): void {
    if (newState.target) {
      this.state.target = {
        x: Number.isFinite(newState.target.x) ? newState.target.x : this.state.target.x,
        y: Number.isFinite(newState.target.y) ? newState.target.y : this.state.target.y,
        z: Number.isFinite(newState.target.z) ? newState.target.z : this.state.target.z,
      };
    }

    if (
      typeof newState.azimuth ===
      "number"
    ) {
      this.state.azimuth =
        normalizeAzimuth(
          newState.azimuth
        );

      this.liveAzimuth =
        this.state.azimuth;
    }

    if (
      typeof newState.elevation ===
      "number"
    ) {
      this.state.elevation =
        clamp(
          newState.elevation,
          -30,
          60
        );

      this.liveElevation =
        this.state.elevation;
    }

    if (
      typeof newState.distance ===
      "number"
    ) {
      this.state.distance =
        clamp(
          newState.distance,
          1,
          10
        );

      this.liveDistance =
        this.state.distance;
    }

    if (typeof newState.height === "number" && newState.elevation === undefined) {
      this.state.elevation = clamp(
        THREE.MathUtils.radToDeg(Math.atan((newState.height - this.state.target.y) / this.state.distance)),
        -30,
        60
      );
      this.liveElevation = this.state.elevation;
    }

    if (typeof newState.fov === "number") this.state.fov = clamp(newState.fov, 20, 100);
    if (typeof newState.roll === "number") this.state.roll = clamp(newState.roll, -180, 180);
    if (typeof newState.zoom === "number") this.state.zoom = clamp(newState.zoom, 0.5, 3);

    if (
      newState.imageUrl !==
      undefined && newState.imageUrl !== this.state.imageUrl
    ) {
      this.state.imageUrl =
        newState.imageUrl;

      this.updateImage(
        newState.imageUrl
      );
    }

    this.updateVisuals();
  }

  public resetToDefaults(): void {
    this.state.azimuth = 0;

    this.state.elevation = 0;

    this.state.distance = 5;
    this.state.target = { x: this.CENTER.x, y: this.CENTER.y, z: this.CENTER.z };
    this.state.fov = 45;
    this.state.roll = 0;
    this.state.zoom = 1;

    this.liveAzimuth = 0;

    this.liveElevation = 0;

    this.liveDistance = 5;

    this.updateVisuals();

    this.notifyStateChange();
  }

  public setCameraView(
    enabled: boolean
  ): void {
    this.useCameraView =
      enabled;

    this.isOrbitDragging =
      false;

    if (enabled) {
      this.activeCamera =
        this.previewCamera;

      this.azimuthRing.visible =
        false;

      this.azimuthHandle.visible =
        false;

      this.azGlow.visible =
        false;

      this.elevationArc.visible =
        false;

      this.elevationHandle.visible =
        false;

      this.elGlow.visible =
        false;

      this.distanceHandle.visible =
        false;

      this.distGlow.visible =
        false;

      if (
        this.distanceTube
      ) {
        this.distanceTube.visible =
          false;
      }

      this.cameraIndicator.visible =
        false;

      this.camGlow.visible =
        false;

      this.glowRing.visible =
        false;

      this.gridHelper.visible =
        false;

      if (this.imageFrame) {
        this.imageFrame.visible = false;
      }

      this.renderer.domElement.style.cursor =
        "grab";
    } else {
      this.activeCamera =
        this.camera;

      this.azimuthRing.visible =
        true;

      this.azimuthHandle.visible =
        true;

      this.azGlow.visible =
        true;

      this.elevationArc.visible =
        true;

      this.elevationHandle.visible =
        true;

      this.elGlow.visible =
        true;

      this.distanceHandle.visible =
        true;

      this.distGlow.visible =
        true;

      if (
        this.distanceTube
      ) {
        this.distanceTube.visible =
          true;
      }

      this.cameraIndicator.visible =
        true;

      this.camGlow.visible =
        true;

      this.glowRing.visible =
        true;

      this.gridHelper.visible =
        true;

      if (this.imageFrame) {
        this.imageFrame.visible = true;
      }

      this.renderer.domElement.style.cursor =
        "default";
    }
  }

  public updateImage(
    url: string | null
  ): void {
    if (
      !this.planeMat ||
      !this.imagePlane ||
      !this.imageFrame
    ) {
      return;
    }

    if (
      this.imageTexture
    ) {
      this.imageTexture.dispose();

      this.imageTexture =
        null;
    }

    if (!url) {
      this.planeMat.map =
        null;

      this.planeMat.color.set(
        0x3a3a4a
      );

      this.planeMat.needsUpdate =
        true;

      this.imagePlane.scale.set(
        1,
        1,
        1
      );

      this.imageFrame.scale.set(
        1,
        1,
        1
      );

      return;
    }

    const img =
      new Image();

    if (
      !url.startsWith("data:")
    ) {
      img.crossOrigin =
        "anonymous";
    }

    img.onload = () => {
      if (this.disposed) {
        return;
      }

      const texture =
        new THREE.Texture(
          img
        );

      texture.colorSpace =
        THREE.SRGBColorSpace;

      texture.needsUpdate =
        true;

      this.imageTexture =
        texture;

      this.planeMat.map =
        texture;

      this.planeMat.color.set(
        0xffffff
      );

      this.planeMat.needsUpdate =
        true;

      const aspect =
        img.width /
        img.height;

      const maxSize = 1.5;

      let scaleX: number;

      let scaleY: number;

      if (
        aspect > 1
      ) {
        scaleX =
          maxSize;

        scaleY =
          maxSize /
          aspect;
      } else {
        scaleY =
          maxSize;

        scaleX =
          maxSize *
          aspect;
      }

      this.imagePlane.scale.set(
        scaleX,
        scaleY,
        1
      );

      this.imageFrame.scale.set(
        scaleX,
        scaleY,
        1
      );
    };

    img.onerror = () => {
      if (this.disposed) {
        return;
      }

      this.planeMat.map =
        null;

      this.planeMat.color.set(
        0xe93d82
      );

      this.planeMat.needsUpdate =
        true;
    };

    img.src = url;
  }

  public replaceSubject(
    factory: SubjectFactory
  ): void {
    if (
      this.subjectRoot
    ) {
      this.scene.remove(
        this.subjectRoot
      );

      this.disposeObject(
        this.subjectRoot
      );

      this.subjectRoot =
        null;
    }

    this.subjectFactory =
      factory;

    this.subjectRoot =
      factory(
        this.scene,
        this.CENTER
      );

    this.scene.add(
      this.subjectRoot
    );

    this.updateVisuals();
  }

  private disposeObject(
    root: THREE.Object3D
  ) {
    root.traverse(
      (object) => {
        const mesh =
          object as THREE.Mesh;

        if (
          mesh.geometry
        ) {
          mesh.geometry.dispose();
        }

        const material =
          mesh.material;

        if (
          Array.isArray(material)
        ) {
          material.forEach(
            (item) =>
              item.dispose()
          );
        } else if (
          material
        ) {
          material.dispose();
        }
      }
    );
  }

  public dispose(): void {
    if (
      this.disposed
    ) {
      return;
    }

    this.disposed =
      true;

    if (
      this.animationId !==
      null
    ) {
      window.cancelAnimationFrame(
        this.animationId
      );

      this.animationId =
        null;
    }

    const canvas =
      this.renderer.domElement;

    canvas.removeEventListener(
      "pointerdown",
      this.onPointerDown
    );

    canvas.removeEventListener(
      "pointermove",
      this.onPointerMove
    );

    canvas.removeEventListener(
      "pointerup",
      this.onPointerUp
    );

    canvas.removeEventListener(
      "pointercancel",
      this.onPointerUp
    );

    canvas.removeEventListener(
      "pointerleave",
      this.onPointerLeave
    );

    canvas.removeEventListener(
      "wheel",
      this.onWheel
    );

    this.resizeObserver?.disconnect();

    this.resizeObserver =
      null;

    if (
      this.imageTexture
    ) {
      this.imageTexture.dispose();

      this.imageTexture =
        null;
    }

    this.disposeObject(
      this.scene
    );

    this.renderer.dispose();

    if (
      canvas.parentElement ===
      this.container
    ) {
      canvas.parentElement.removeChild(
        canvas
      );
    }
  }
}

function normalizeAzimuth(
  value: number
): number {
  const result =
    value % 360;

  return result < 0
    ? result + 360
    : result;
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  );
}
