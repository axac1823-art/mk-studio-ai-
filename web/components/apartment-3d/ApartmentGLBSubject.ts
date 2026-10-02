import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import type { SubjectFactory } from "../multi-angle-camera/types";

export interface ApartmentGLBOptions {
  url?: string;
  targetSize?: number;
  onLoaded?: (model: THREE.Object3D) => void;
  onError?: (error: unknown) => void;
}

export function createApartmentGLBSubject(
  options: ApartmentGLBOptions = {}
): SubjectFactory {
  const {
    url = "/models/apartment.glb",
    targetSize = 1.2,
    onLoaded,
    onError,
  } = options;

  return (_scene, center) => {
    const root = new THREE.Group();

    root.name = "ApartmentGLBSubject";

    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        model.name = "ApartmentModel";

        // Prepare meshes for Three.js rendering.
        model.traverse((object) => {
          const mesh =
            object as THREE.Mesh;

          if (!mesh.isMesh) {
            return;
          }

          mesh.castShadow = true;
          mesh.receiveShadow = true;

          const material =
            mesh.material;

          if (Array.isArray(material)) {
            material.forEach((mat) => {
              mat.needsUpdate = true;
            });
          } else if (material) {
            material.needsUpdate = true;
          }
        });

        /*
         * ---------------------------------------------------------
         * 1. Calculate original bounds
         * ---------------------------------------------------------
         */

        const initialBox =
          new THREE.Box3().setFromObject(
            model
          );

        const initialSize =
          new THREE.Vector3();

        const initialCenter =
          new THREE.Vector3();

        initialBox.getSize(
          initialSize
        );

        initialBox.getCenter(
          initialCenter
        );

        const maxDimension =
          Math.max(
            initialSize.x,
            initialSize.y,
            initialSize.z
          );

        if (
          !Number.isFinite(
            maxDimension
          ) ||
          maxDimension <= 0
        ) {
          onError?.(
            new Error(
              "The GLB model has an invalid bounding box."
            )
          );

          return;
        }

        /*
         * ---------------------------------------------------------
         * 2. Normalize model size
         *
         * CameraEngine currently operates in a small
         * normalized 3D space, so we adapt the GLB here.
         * ---------------------------------------------------------
         */

        const scale =
          targetSize /
          maxDimension;

        model.scale.setScalar(
          scale
        );

        /*
         * ---------------------------------------------------------
         * 3. Recalculate bounds after scaling
         * ---------------------------------------------------------
         */

        const scaledBox =
          new THREE.Box3().setFromObject(
            model
          );

        const scaledCenter =
          new THREE.Vector3();

        scaledBox.getCenter(
          scaledCenter
        );

        /*
         * ---------------------------------------------------------
         * 4. Center the apartment horizontally
         * ---------------------------------------------------------
         */

        model.position.x -=
          scaledCenter.x;

        model.position.z -=
          scaledCenter.z;

        /*
         * ---------------------------------------------------------
         * 5. Put the floor on Y = 0
         * ---------------------------------------------------------
         */

        const floorBox =
          new THREE.Box3().setFromObject(
            model
          );

        model.position.y -=
          floorBox.min.y;

        /*
         * ---------------------------------------------------------
         * 6. Move model toward the camera target.
         *
         * CameraEngine uses CENTER = (0, 0.5, 0).
         * We leave the model near the scene origin.
         * ---------------------------------------------------------
         */

        model.position.x +=
          center.x;

        model.position.z +=
          center.z;

        root.add(model);

        onLoaded?.(model);
      },

      undefined,

      (error) => {
        console.error(
          "Failed to load apartment GLB:",
          error
        );

        onError?.(error);
      }
    );

    /*
     * Return the Group immediately.
     *
     * CameraEngine does not need to wait for
     * the asynchronous GLB request.
     */
    return root;
  };
}

export default createApartmentGLBSubject;