"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  CameraEngine,
} from "./CameraEngine";

import type {
  CameraState,
  SubjectFactory,
} from "./types";

export function useCameraWidget(
  initialState: Partial<CameraState> = {},
  onExternalStateChange?: (
    state: CameraState
  ) => void,
  createSubject?: SubjectFactory
) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const widgetRef =
    useRef<CameraEngine | null>(
      null
    );

  const onExternalChangeRef =
    useRef(
      onExternalStateChange
    );

  const updatingFromExternal =
    useRef(false);

  const [
    azimuth,
    setAzimuth,
  ] = useState(
    initialState.azimuth ?? 0
  );

  const [
    elevation,
    setElevation,
  ] = useState(
    initialState.elevation ?? 0
  );

  const [
    distance,
    setDistance,
  ] = useState(
    initialState.distance ?? 5
  );

  const [height, setHeight] = useState(
    initialState.height ?? (initialState.target?.y ?? 0.5) + (initialState.distance ?? 5) * Math.tan(((initialState.elevation ?? 0) * Math.PI) / 180)
  );
  const [target, setTarget] = useState(initialState.target ?? { x: 0, y: 0.5, z: 0 });
  const [fov, setFov] = useState(initialState.fov ?? 45);
  const [roll, setRoll] = useState(initialState.roll ?? 0);
  const [zoom, setZoom] = useState(initialState.zoom ?? 1);

  const [
    imageUrl,
    setImageUrl,
  ] =
    useState<string | null>(
      initialState.imageUrl ??
        null
    );

  const [
    prompt,
    setPrompt,
  ] = useState(
    "<sks> front view eye-level shot medium shot"
  );

  useEffect(() => {
    onExternalChangeRef.current =
      onExternalStateChange;
  }, [
    onExternalStateChange,
  ]);

  const notifyParent =
    useCallback(
      (
        next: CameraState
      ) => {
        onExternalChangeRef.current?.(
          next
        );
      },
      []
    );

  const initScene =
    useCallback(() => {
      if (
        !containerRef.current
      ) {
        return;
      }

      if (
        widgetRef.current
      ) {
        return;
      }

      const widget =
        new CameraEngine({
          container:
            containerRef.current,

          initialState: {
            azimuth,
            elevation,
            distance,
            height,
            target,
            fov,
            roll,
            zoom,
            projection: "perspective",
            imageUrl,
          },

          createSubject,

onStateChange: (next) => {
  if (
    updatingFromExternal.current
  ) {
    return;
  }

  setAzimuth(
    next.azimuth
  );

  setElevation(
    next.elevation
  );

  setDistance(
    next.distance
  );

  setHeight(next.height);
  setTarget(next.target);
  setFov(next.fov);
  setRoll(next.roll);
  setZoom(next.zoom);

  setImageUrl(
    next.imageUrl
  );

  setPrompt(
    widget.getPrompt()
  );

  notifyParent(
    next
  );
},
        });

      widgetRef.current =
        widget;

      setPrompt(
        widget.getPrompt()
      );
    }, [
      azimuth,
      elevation,
      distance,
      imageUrl,
      createSubject,
      notifyParent,
    ]);

  useEffect(() => {
    initScene();

    return () => {
      widgetRef.current?.dispose();

      widgetRef.current =
        null;
    };
  }, []);

  /**
   * External state synchronization.
   *
   * This is the React equivalent of the
   * guard flags in the original Vue composable.
   */
  const setState =
    useCallback(
      (
        next: Partial<CameraState>
      ) => {
        const widget =
          widgetRef.current;

        if (!widget) {
          return;
        }

        updatingFromExternal.current =
          true;

        widget.setState(
          next
        );

        const current =
          widget.getState();

        setAzimuth(
          current.azimuth
        );

        setElevation(
          current.elevation
        );

        setDistance(
          current.distance
        );

        setHeight(current.height);
        setTarget(current.target);
        setFov(current.fov);
        setRoll(current.roll);
        setZoom(current.zoom);

        setImageUrl(
          current.imageUrl
        );

        setPrompt(
          widget.getPrompt()
        );

        updatingFromExternal.current =
          false;
      },
      []
    );

  const updateImage =
    useCallback(
      (
        url: string | null
      ) => {
        setImageUrl(url);

        widgetRef.current?.updateImage(
          url
        );
      },
      []
    );

  const setCameraView =
    useCallback(
      (
        enabled: boolean
      ) => {
        widgetRef.current?.setCameraView(
          enabled
        );
      },
      []
    );

  const reset =
    useCallback(() => {
      const widget =
        widgetRef.current;

      if (!widget) {
        return;
      }

      updatingFromExternal.current =
        true;

      widget.resetToDefaults();

      const current =
        widget.getState();

      setAzimuth(
        current.azimuth
      );

      setElevation(
        current.elevation
      );

      setDistance(
        current.distance
      );

      setHeight(current.height);
      setTarget(current.target);
      setFov(current.fov);
      setRoll(current.roll);
      setZoom(current.zoom);

      setPrompt(
        widget.getPrompt()
      );

      updatingFromExternal.current =
        false;

      notifyParent(
        current
      );
    }, [notifyParent]);

  const replaceSubject =
    useCallback(
      (
        factory: SubjectFactory
      ) => {
        widgetRef.current?.replaceSubject(
          factory
        );
      },
      []
    );

  const getState =
    useCallback(() => {
      return (
        widgetRef.current?.getState() ?? {
          azimuth,
          elevation,
          distance,
          height,
          target,
          fov,
          roll,
          zoom,
          projection: "perspective",
          imageUrl,
        }
      );
    }, [
      azimuth,
      elevation,
      distance,
      height,
      target,
      fov,
      roll,
      zoom,
      imageUrl,
    ]);

  const capturePreview =
    useCallback(() => widgetRef.current?.capturePreview() ?? null, []);

  return {
    containerRef,

    azimuth,

    elevation,

    distance,

    zoom,

    imageUrl,

    prompt,

    initScene,

    setState,

    updateImage,

    setCameraView,

    reset,

    replaceSubject,

    getState,

    capturePreview,

    widgetRef,

    updatingFromExternal,
  };
}
