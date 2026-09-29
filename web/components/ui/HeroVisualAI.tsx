"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  Ref,
} from "react";

import { MultiAngleCamera } from "@/components/multi-angle-camera";

import type {
  CameraState,
  MultiAngleCameraHandle,
  SubjectFactory,
} from "@/components/multi-angle-camera";

type NodeId = "source" | "editor" | "live";

type NodePosition = {
  left: number;
  top: number;
};

type NodePositions = Record<
  NodeId,
  NodePosition
>;

type DragStart = {
  id: NodeId;
  pointerX: number;
  pointerY: number;
  left: number;
  top: number;
};

/* ============================================================
   NODE HEADER
   ============================================================ */

const NodeHeader = ({
  children,
  onPointerDown,
}: {
  children: string;
  onPointerDown?: (
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;
}) => (
  <div
    className={`hero-node-header ${
      onPointerDown
        ? "hero-node-header-draggable"
        : ""
    }`}
    onPointerDown={onPointerDown}
  >
    <span
      className="hero-node-dot"
      aria-hidden="true"
    />

    <span>{children}</span>

    <span
      className="hero-node-dot"
      aria-hidden="true"
    />
  </div>
);

/* ============================================================
   SOURCE NODE
   ============================================================ */

function SourceNode({
  onDragStart,
}: {
  onDragStart?: (
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;
}) {
  return (
    <div className="hero-node hero-input-node">
      <NodeHeader
        onPointerDown={onDragStart}
      >
        Reference Image
      </NodeHeader>

      <div className="hero-source-preview">
        <img
          src="/image.png"
          alt="Reference image of the subject"
        />

        <span className="hero-node-chip">
          REFERENCE / SUBJECT
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   CAMERA NODE
   ============================================================ */

function CameraNode({
  mode,
  cameraState,
  onCameraChange,
  onDragStart,
  cameraRef,
  generatedImage,
  onImageError,
  renderStatus,
  renderError,
  createSubject,
}: {
  mode: "editor" | "camera";

  cameraState: CameraState;

  onCameraChange?: (
    state: CameraState
  ) => void;

  onDragStart?: (
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;

  cameraRef?: Ref<MultiAngleCameraHandle>;

  generatedImage?: string | null;

  onImageError?: () => void;

  renderStatus?:
    | "idle"
    | "waiting"
    | "error";

  renderError?: string | null;

  createSubject?: SubjectFactory;
}) {
  const isCameraView =
    mode === "camera";

  return (
    <div
      className={`hero-node ${
        isCameraView
          ? "hero-live-node"
          : "hero-editor-node"
      }`}
    >
      <NodeHeader
        onPointerDown={onDragStart}
      >
        {isCameraView
          ? "Live Camera View"
          : "Editor View"}
      </NodeHeader>

      <div
        className={`hero-angle-body ${
          isCameraView &&
          generatedImage
            ? "hero-angle-body--rendered"
            : ""
        }`}
      >
        <MultiAngleCamera
          ref={cameraRef}
          className="multi-angle-camera--hero"
          initialState={cameraState}
          imageUrl="/image.png"
          displayMode={mode}
          turntable={!isCameraView}
          syncedState={
            isCameraView
              ? cameraState
              : undefined
          }
          onChange={
            isCameraView
              ? undefined
              : onCameraChange
          }
          createSubject={createSubject}
        />

        {isCameraView &&
          generatedImage && (
            <img
              className="hero-ai-render"
              src={generatedImage}
              alt="Live camera preview of the reference subject"
              onError={onImageError}
            />
          )}

        {isCameraView &&
          renderStatus &&
          renderStatus !== "idle" && (
            <span
              className={`hero-render-status hero-render-status--${renderStatus}`}
            >
              {renderStatus === "waiting"
                ? "Generating new view..."
                : "Image unavailable"}
            </span>
          )}

        {isCameraView &&
          renderError && (
            <span className="hero-render-error">
              {renderError}
            </span>
          )}
      </div>
    </div>
  );
}

/* ============================================================
   HERO VISUAL AI
   ============================================================ */

export default function HeroVisualAI({
  createSubject,
}: {
  createSubject?: SubjectFactory;
}) {
  const stageRef =
    useRef<HTMLDivElement>(null);

  const workspaceRef =
    useRef<HTMLElement>(null);

  const dragRef =
    useRef<DragStart | null>(null);

  const [positions, setPositions] =
    useState<NodePositions>({
      source: {
        left: 0,
        top: 16,
      },

      editor: {
        left: 23,
        top: 29,
      },

      live: {
        left: 66,
        top: 14,
      },
    });

  /* ==========================================================
     CAMERA STATE
     ========================================================== */

  const [cameraState, setCameraState] =
    useState<CameraState>({
      azimuth: 45,

      elevation: 27,

      distance: 4,

      height:
        0.5 +
        4 *
          Math.tan(
            (27 * Math.PI) / 180
          ),

      target: {
        x: 0,
        y: 0.5,
        z: 0,
      },

      fov: 45,

      roll: 0,

      zoom: 1,

      projection: "perspective",

      imageUrl: "/image.png",
    });

  /*
   * IMPORTANT:
   *
   * Do NOT use:
   * useRef(cameraState).current
   *
   * because that freezes the first state.
   */

  const liveCameraState =
    cameraState;

  const desktopEditorRef =
    useRef<MultiAngleCameraHandle>(
      null
    );

  const mobileEditorRef =
    useRef<MultiAngleCameraHandle>(
      null
    );

  const renderTimerRef =
    useRef<number | null>(null);

  const renderInFlightRef =
    useRef(false);

  const latestCameraRef =
    useRef<CameraState>(
      cameraState
    );

  const lastRequestedCameraRef =
    useRef<string | null>(null);

  const [
    generatedImage,
    setGeneratedImage,
  ] = useState<string | null>(
    "/image.png"
  );

  const [
    renderStatus,
    setRenderStatus,
  ] = useState<
    "idle" | "waiting" | "error"
  >("idle");

  const [
    renderError,
    setRenderError,
  ] = useState<string | null>(
    null
  );

  /* ==========================================================
     CAMERA KEY
     ========================================================== */

  const getOutputAspectRatio = (): string => {
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    const selector = isMobile
      ? ".hero-mobile-live .hero-angle-body"
      : ".hero-position-output .hero-angle-body";
    const output = workspaceRef.current?.querySelector<HTMLElement>(selector);
    if (!output || output.clientWidth === 0 || output.clientHeight === 0) return "4:3";

    const ratio = output.clientWidth / output.clientHeight;
    const supported: Array<[string, number]> = [
      ["1:1", 1],
      ["4:3", 4 / 3],
      ["16:9", 16 / 9],
      ["3:4", 3 / 4],
      ["9:16", 9 / 16],
    ];
    return supported.reduce((best, candidate) =>
      Math.abs(Math.log(ratio / candidate[1])) < Math.abs(Math.log(ratio / best[1]))
        ? candidate
        : best
    )[0];
  };

  const cameraKey = (
    state: CameraState
  ) =>
    JSON.stringify({
      azimuth: state.azimuth,

      elevation: state.elevation,

      distance: state.distance,

      height: state.height,

      target: state.target,

      fov: state.fov,

      roll: state.roll,

      zoom: state.zoom,

      projection:
        state.projection,
    });

  /* ==========================================================
     POLL RENDER
     ========================================================== */

  const pollRender = async (
    jobId: string
  ): Promise<string> => {
    for (
      let attempt = 0;
      attempt < 90;
      attempt += 1
    ) {
      await new Promise(
        (resolve) =>
          window.setTimeout(
            resolve,
            2000
          )
      );

      const response =
        await fetch(
          `/api/demo/camera-render?id=${encodeURIComponent(
            jobId
          )}`,
          {
            cache: "no-store",
          }
        );

      if (!response.ok) {
        throw new Error(
          "Could not check the camera render."
        );
      }

      const result =
        (await response.json()) as {
          status: string;
          outputUrl?: string;
          error?: string;
        };

      if (
        result.status === "done" &&
        result.outputUrl
      ) {
        return result.outputUrl;
      }

      if (
        result.status === "error"
      ) {
        throw new Error(
          result.error ||
            "Image generation failed."
        );
      }
    }

    throw new Error(
      "Image generation took too long. Move the camera to try again."
    );
  };

  /* ==========================================================
     RUN CAMERA RENDER
     ========================================================== */

  const runCameraRender = async (
    state: CameraState
  ) => {
    if (
      renderInFlightRef.current
    ) {
      return;
    }

    const key =
      cameraKey(state);

    if (
      key ===
      lastRequestedCameraRef.current
    ) {
      return;
    }

    renderInFlightRef.current =
      true;

    lastRequestedCameraRef.current =
      key;

    setRenderError(null);

    setRenderStatus(
      "waiting"
    );

    try {
      /*
       * PRIMARY REFERENCE
       */

      const reference =
        await fetch(
          "/image.png",
          {
            cache:
              "force-cache",
          }
        );

      if (!reference.ok) {
        throw new Error(
          "Could not load the reference image."
        );
      }

      const form =
        new FormData();

      const subjectBlob = await reference.blob();

      /*
       * CAMERA GUIDE
       */

      const editorRef =
        window.matchMedia(
          "(max-width: 900px)"
        ).matches
          ? mobileEditorRef
          : desktopEditorRef;

      const cameraGuide =
        editorRef.current?.capturePreview();

      if (!cameraGuide) {
        throw new Error(
          "The editor camera guide is not ready yet."
        );
      }

      const guideBlob =
        await (
          await fetch(
            cameraGuide
          )
        ).blob();

      form.append(
        "cameraGuide",
        guideBlob,
        "camera-guide.png"
      );
      form.append(
        "image",
        subjectBlob,
        "reference.png"
      );
      form.append(
        "aspectRatio",
        getOutputAspectRatio()
      );

      /*
       * CAMERA STATE
       */

      form.append(
        "cameraState",
        JSON.stringify(
          state
        )
      );

      /*
       * REQUEST
       */

      const response =
        await fetch(
          "/api/demo/camera-render",
          {
            method: "POST",

            body: form,
          }
        );

      const started =
        (await response.json()) as {
          jobId?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !started.jobId
      ) {
        throw new Error(
          started.error ||
            "Could not start image generation."
        );
      }

      /*
       * WAIT FOR OUTPUT
       */

      const outputUrl =
        await pollRender(
          started.jobId
        );

      setGeneratedImage(
        outputUrl
      );

      setRenderStatus(
        "idle"
      );

      setRenderError(null);
    } catch (error) {
      setRenderStatus(
        "error"
      );

      setRenderError(
        error instanceof Error
          ? error.message
          : "Image generation failed."
      );
    } finally {
      renderInFlightRef.current =
        false;

      /*
       * If the user moved the
       * camera again while AI
       * generation was running,
       * render the newest state.
       */

      if (
        cameraKey(
          latestCameraRef.current
        ) !==
        lastRequestedCameraRef.current
      ) {
        if (
          renderTimerRef.current
        ) {
          window.clearTimeout(
            renderTimerRef.current
          );
        }

        renderTimerRef.current =
          window.setTimeout(
            () => {
              void runCameraRender(
                latestCameraRef.current
              );
            },
            900
          );
      }
    }
  };

  /* ==========================================================
     CAMERA CHANGE
     ========================================================== */

  const handleCameraChange = (
    next: CameraState
  ) => {
    setCameraState(next);

    latestCameraRef.current =
      next;

    setRenderError(null);

    setRenderStatus(
      "waiting"
    );

    if (
      renderTimerRef.current
    ) {
      window.clearTimeout(
        renderTimerRef.current
      );
    }

    renderTimerRef.current =
      window.setTimeout(
        () => {
          void runCameraRender(
            latestCameraRef.current
          );
        },
        900
      );
  };

  /* ==========================================================
     IMAGE ERROR
     ========================================================== */

  const handlePreviewImageError =
    () => {
      setRenderStatus(
        "error"
      );

      setRenderError(
        "Could not load the generated image."
      );
    };

  /* ==========================================================
     CLEANUP
     ========================================================== */

  useEffect(() => {
    return () => {
      if (
        renderTimerRef.current
      ) {
        window.clearTimeout(
          renderTimerRef.current
        );
      }
    };
  }, []);

  /* ==========================================================
     NODE DRAG
     ========================================================== */

  const startDrag =
    (id: NodeId) =>
    (
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (
        event.button !== 0
      ) {
        return;
      }

      event.preventDefault();

      event.currentTarget.setPointerCapture(
        event.pointerId
      );

      dragRef.current = {
        id,

        pointerX:
          event.clientX,

        pointerY:
          event.clientY,

        ...positions[id],
      };
    };

  const moveNode = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const drag =
      dragRef.current;

    const bounds =
      stageRef.current?.getBoundingClientRect();

    if (
      !drag ||
      !bounds
    ) {
      return;
    }

    const size = {
      source: {
        width: 18,
        height: 34,
      },

      editor: {
        width: 38,
        height: 64,
      },

      live: {
        width: 34,
        height: 62,
      },
    }[drag.id];

    const left =
      Math.max(
        0,
        Math.min(
          100 - size.width,
          drag.left +
            ((event.clientX -
              drag.pointerX) /
              bounds.width) *
              100
        )
      );

    const top =
      Math.max(
        0,
        Math.min(
          100 - size.height,
          drag.top +
            ((event.clientY -
              drag.pointerY) /
              bounds.height) *
              100
        )
      );

    setPositions(
      (current) => ({
        ...current,

        [drag.id]: {
          left,
          top,
        },
      })
    );
  };

  const endDrag = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (
      dragRef.current
    ) {
      const header =
        event.target as HTMLElement;

      if (
        header.hasPointerCapture?.(
          event.pointerId
        )
      ) {
        header.releasePointerCapture(
          event.pointerId
        );
      }

      dragRef.current =
        null;
    }
  };

  /* ==========================================================
     NODE BOUNDS
     ========================================================== */

  const nodeBounds = (
    id: NodeId
  ) => {
    const dimensions = {
      source: {
        width: 18,
        height: 34,
      },

      editor: {
        width: 38,
        height: 64,
      },

      live: {
        width: 34,
        height: 62,
      },
    }[id];

    const position =
      positions[id];

    return {
      left:
        (position.left /
          100) *
        950,

      right:
        ((position.left +
          dimensions.width) /
          100) *
        950,

      centerY:
        ((position.top +
          dimensions.height /
            2) /
          100) *
        440,
    };
  };

  /* ==========================================================
     WIRES
     ========================================================== */

  const wirePath = (
    from: NodeId,
    to: NodeId
  ) => {
    const start =
      nodeBounds(from);

    const end =
      nodeBounds(to);

    const middle =
      (start.right +
        end.left) /
      2;

    return `M ${start.right} ${start.centerY} C ${middle} ${start.centerY}, ${middle} ${end.centerY}, ${end.left} ${end.centerY}`;
  };

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <section
      id="one-capture"
      data-circuit-section="one-capture"
      ref={workspaceRef}
      className="hero-visual-ai"
      aria-labelledby="hero-visual-ai-title"
    >
      <div className="hero-visual-ai-title">
        <p className="hero-eyebrow">
          A new way to see your design
        </p>

        <h2 id="hero-visual-ai-title">
          One scene.
          <br />
          <span>
            Every angle.
          </span>
        </h2>
      </div>

      {/* ======================================================
          DESKTOP
          ====================================================== */}

      <div className="hero-desktop-wrap">
        <div
          className="hero-desktop-stage"
          ref={stageRef}
          onPointerMove={
            moveNode
          }
          onPointerUp={
            endDrag
          }
          onPointerCancel={
            endDrag
          }
        >
          <div
            className="hero-wires"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 950 440"
              preserveAspectRatio="none"
            >
              <path
                className="hero-wire-base"
                d={wirePath(
                  "source",
                  "editor"
                )}
              />

              <path
                className="hero-wire-base"
                d={wirePath(
                  "editor",
                  "live"
                )}
              />

              <path
                className="hero-wire-pulse"
                d={wirePath(
                  "source",
                  "editor"
                )}
              />

              <path
                className="hero-wire-pulse hero-wire-pulse--delay"
                d={wirePath(
                  "editor",
                  "live"
                )}
              />
            </svg>
          </div>

          {/* SOURCE */}

          <div
            className="hero-position hero-position-input"
            style={{
              left: `${positions.source.left}%`,
              top: `${positions.source.top}%`,
            }}
          >
            <SourceNode
              onDragStart={startDrag(
                "source"
              )}
            />
          </div>

          {/* EDITOR */}

          <div
            className="hero-position hero-position-angle"
            style={{
              left: `${positions.editor.left}%`,
              top: `${positions.editor.top}%`,
            }}
          >
            <CameraNode
              mode="editor"
              cameraState={
                cameraState
              }
              onCameraChange={
                handleCameraChange
              }
              onDragStart={startDrag(
                "editor"
              )}
              cameraRef={
                desktopEditorRef
              }
              createSubject={
                createSubject
              }
            />
          </div>

          {/* LIVE */}

          <div
            className="hero-position hero-position-output"
            style={{
              left: `${positions.live.left}%`,
              top: `${positions.live.top}%`,
            }}
          >
            <CameraNode
              mode="camera"
              cameraState={
                liveCameraState
              }
              onDragStart={startDrag(
                "live"
              )}
              generatedImage={
                generatedImage
              }
              onImageError={
                handlePreviewImageError
              }
              renderStatus={
                renderStatus
              }
              renderError={
                renderError
              }
              createSubject={
                createSubject
              }
            />
          </div>
        </div>
      </div>

      {/* ======================================================
          MOBILE
          ====================================================== */}

      <div className="hero-mobile">
        <div className="hero-mobile-workspace">
          <div className="hero-mobile-camera">
            <CameraNode
              mode="editor"
              cameraState={
                cameraState
              }
              onCameraChange={
                handleCameraChange
              }
              cameraRef={
                mobileEditorRef
              }
              createSubject={
                createSubject
              }
            />
          </div>

          <div className="hero-mobile-source">
            <SourceNode />
          </div>
        </div>

        <div
          className="hero-mobile-connector"
          aria-hidden="true"
        />

        <div className="hero-mobile-live">
          <CameraNode
            mode="camera"
            cameraState={
              liveCameraState
            }
            generatedImage={
              generatedImage
            }
            onImageError={
              handlePreviewImageError
            }
            renderStatus={
              renderStatus
            }
            renderError={
              renderError
            }
            createSubject={
              createSubject
            }
          />
        </div>
      </div>
    </section>
  );
}
