"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import ControlPanel from "./ControlPanel";

import {
  useCameraWidget,
} from "./useCameraWidget";

import type {
  CameraState,
  MultiAngleCameraHandle,
  SubjectFactory,
} from "./types";

import "./MultiAngleCamera.css";

export interface MultiAngleCameraProps {
  initialState?: Partial<CameraState>;

  onChange?: (
    state: CameraState
  ) => void;

  imageUrl?: string | null;

  className?: string;

  createSubject?: SubjectFactory;

  turntable?: boolean;

  displayMode?: "editor" | "camera";

  syncedState?: Partial<CameraState>;
}

const MultiAngleCamera =
  forwardRef<
    MultiAngleCameraHandle,
    MultiAngleCameraProps
  >(
    function MultiAngleCamera(
      {
        initialState,
        onChange,
        imageUrl = null,
        className = "",
        createSubject,
        turntable = false,
        displayMode = "editor",
        syncedState,
      },
      ref
    ) {
      const {
        containerRef,
        azimuth,
        elevation,
        distance,
        zoom,
        prompt,
        updateImage,
        setState,
        setCameraView,
        reset,
        replaceSubject,
        getState,
        capturePreview,
      } = useCameraWidget(
        {
          ...initialState,
          imageUrl:
            imageUrl ??
            initialState?.imageUrl ??
            null,
        },
        onChange,
        createSubject
      );

      const [
        cameraView,
        setCameraViewState,
      ] = useState(displayMode === "camera");

      /**
       * Apply external image.
       */
      useEffect(() => {
        if (
          imageUrl !==
          undefined
        ) {
          updateImage(
            imageUrl
          );
        }
      }, [
        imageUrl,
        updateImage,
      ]);

      useEffect(() => {
        setCameraView(displayMode === "camera");
      }, [displayMode, setCameraView]);

      useEffect(() => {
        if (syncedState) setState(syncedState);
      }, [syncedState, setState]);

      const updateEditorState = (next: Partial<CameraState>) => {
        setState(next);
        onChange?.(getState());
      };

      /**
       * Expose imperative API.
       */
      useImperativeHandle(
        ref,
        () => ({
          updateImage,

          setCameraView(
            enabled
          ) {
            setCameraViewState(
              enabled
            );

            setCameraView(
              enabled
            );
          },

          setState,

          getState,

          capturePreview,

          getPrompt() {
            return prompt;
          },

          reset,

          replaceSubject,

          cleanup() {
            // The hook's effect owns cleanup.
            // This method intentionally remains
            // available for API compatibility.
          },
        }),
        [
          updateImage,
          setCameraView,
          setState,
          getState,
          capturePreview,
          prompt,
          reset,
          replaceSubject,
        ]
      );

      return (
        <div
          className={`qwen-container ${className}`}
          data-view-mode={displayMode}
        >
          <div
            ref={containerRef}
            className="qwen-scene-canvas"
          />

          <div className="qwen-prompt-overlay">
            {prompt}
          </div>

          <button
            type="button"
            className={`qwen-camera-view-button ${
              cameraView
                ? "active"
                : ""
            }`}
            onClick={() => {
              const next =
                !cameraView;

              setCameraViewState(
                next
              );

              setCameraView(
                next
              );
            }}
          >
            {cameraView
              ? "Editor View"
              : "Camera View"}
          </button>

          {displayMode === "editor" && (
            <ControlPanel
              turntable={turntable}
              azimuth={azimuth}
              elevation={elevation}
              distance={distance}
              zoom={zoom}
              onAzimuthChange={(value) => updateEditorState({ azimuth: value })}
              onElevationChange={(value) => updateEditorState({ elevation: value })}
              onDistanceChange={(value) => updateEditorState({ distance: value })}
              onReset={reset}
            />
          )}

        </div>
      );
    }
  );

export default MultiAngleCamera;
