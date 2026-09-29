"use client";

import React from "react";

interface ControlPanelProps {
  azimuth: number;
  elevation: number;
  distance: number;
  zoom: number;
  turntable?: boolean;

  onAzimuthChange: (
    value: number
  ) => void;

  onElevationChange: (
    value: number
  ) => void;

  onDistanceChange: (
    value: number
  ) => void;

  onReset: () => void;
}

const AZIMUTH_OPTIONS = [
  [0, "Front view"],
  [45, "Front-right quarter"],
  [90, "Right side"],
  [135, "Back-right quarter"],
  [180, "Back view"],
  [225, "Back-left quarter"],
  [270, "Left side"],
  [315, "Front-left quarter"],
] as const;

const ELEVATION_OPTIONS = [
  [-30, "Low-angle shot"],
  [0, "Eye-level shot"],
  [30, "Elevated shot"],
  [60, "High-angle shot"],
] as const;

const DISTANCE_OPTIONS = [
  [1, "Close-up"],
  [4, "Medium shot"],
  [8, "Wide shot"],
] as const;

function closestAzimuth(
  value: number
): number {
  let closest: number =
    AZIMUTH_OPTIONS[0][0];

  let minDiff =
    Infinity;

  for (
    const [candidate] of
      AZIMUTH_OPTIONS
  ) {
    let diff =
      Math.abs(
        value - candidate
      );

    diff = Math.min(
      diff,
      Math.abs(
        value -
          candidate -
          360
      ),
      Math.abs(
        value -
          candidate +
          360
      )
    );

    if (
      diff < minDiff
    ) {
      minDiff = diff;
      closest = candidate;
    }
  }

  return closest;
}

function closestElevation(
  value: number
): number {
  let closest: number =
    ELEVATION_OPTIONS[0][0];

  let minDiff =
    Math.abs(
      value -
        closest
    );

  for (
    const [candidate] of
      ELEVATION_OPTIONS
  ) {
    const diff =
      Math.abs(
        value -
          candidate
      );

    if (
      diff < minDiff
    ) {
      minDiff = diff;
      closest = candidate;
    }
  }

  return closest;
}

function closestDistance(
  value: number
): number {
  if (value < 2) {
    return 1;
  }

  if (value < 6) {
    return 4;
  }

  return 8;
}

export default function ControlPanel(
  props: ControlPanelProps
) {
  return (
    <div className="qwen-control-panel">
      <div className="qwen-info-row">
        <div className="qwen-control">
          <span className="qwen-label qwen-azimuth">
            {props.turntable ? "Rotation" : "Horizontal"}
          </span>

          {props.turntable ? (
            <input
              aria-label="Rotate product through 360 degrees"
              className="qwen-turntable-slider"
              type="range"
              min="0"
              max="359.9"
              step="0.1"
              value={props.azimuth}
              onChange={(event) =>
                props.onAzimuthChange(
                  Number(event.target.value)
                )
              }
            />
          ) : (
            <select
              className="qwen-dropdown qwen-azimuth"
              value={closestAzimuth(props.azimuth)}
              onChange={(event) =>
                props.onAzimuthChange(Number(event.target.value))
              }
            >
              {AZIMUTH_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="qwen-control">
          <span className="qwen-label qwen-elevation">
            Vertical
          </span>

          <select
            className="qwen-dropdown qwen-elevation"
            value={closestElevation(
              props.elevation
            )}
            onChange={(event) =>
              props.onElevationChange(
                Number(
                  event.target
                    .value
                )
              )
            }
          >
            {ELEVATION_OPTIONS.map(
              ([
                value,
                label,
              ]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="qwen-control">
          <span className="qwen-label qwen-distance">
            Distance
          </span>

          <select
            className="qwen-dropdown qwen-distance"
            value={closestDistance(
              props.distance
            )}
            onChange={(event) =>
              props.onDistanceChange(
                Number(
                  event.target
                    .value
                )
              )
            }
          >
            {DISTANCE_OPTIONS.map(
              ([
                value,
                label,
              ]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div className="qwen-info-row qwen-values-row">
        <div className="qwen-param">
          <div className="qwen-value qwen-azimuth">
            {Math.round(
              props.azimuth
            )}
            °
          </div>
        </div>

        <div className="qwen-param">
          <div className="qwen-value qwen-elevation">
            {Math.round(
              props.elevation
            )}
            °
          </div>
        </div>

        <div className="qwen-param">
          <div className="qwen-value qwen-distance">
            <span title="Zoom">{props.zoom.toFixed(1)}×</span>
          </div>
        </div>

        <button
          type="button"
          className="qwen-reset"
          title="Reset"
          onClick={
            props.onReset
          }
        >
          ↶
        </button>
      </div>
    </div>
  );
}
