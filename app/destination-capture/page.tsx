"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import {
  MultisetClient,
  XRSessionManager,
} from "@multisetai/vps/core";

import {
  ThreeAdapter,
  MapSpace,
} from "@multisetai/vps/three";

import {
  Navigation,
  NavMeshPathfinder,
} from "@multisetai/vps/navigation";

type Destination = {
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
};

const NAVMESH_URL = "/models/kokarya-navmesh.glb";

export default function DestinationCapturePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null);

  const sceneRef =
    useRef<THREE.Scene | null>(null);

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(null);

  const adapterRef =
    useRef<ThreeAdapter | null>(null);

  const navigationRef =
    useRef<Navigation | null>(null);

  const pathfinderRef =
    useRef<NavMeshPathfinder | null>(null);

  const mapSpaceRef =
    useRef<MapSpace | null>(null);

  const animationFrameRef =
    useRef<number | null>(null);

  const [status, setStatus] =
    useState("Preparing...");

  const [localized, setLocalized] =
    useState(false);

  const [navMeshReady, setNavMeshReady] =
    useState(false);

  const [destinationName, setDestinationName] =
    useState("");

  const [currentPosition, setCurrentPosition] =
    useState<{
      x: number;
      y: number;
      z: number;
    } | null>(null);

  const [
    capturedDestinations,
    setCapturedDestinations,
  ] = useState<Destination[]>([]);

  // --------------------------------------------------
  // Generate the copy-paste TypeScript code
  // --------------------------------------------------

  const generatedCode =
    `const DESTINATIONS: Destination[] = [\n\n` +
    capturedDestinations
      .map(
        (destination) => `  {
    id: '${destination.id}',
    name: '${destination.name.replace(/'/g, "\\'")}',
    position: new THREE.Vector3(
      ${destination.position.x},
      ${destination.position.y},
      ${destination.position.z}
    ),
  }`
      )
      .join(",\n\n") +
    `\n];`;

  // --------------------------------------------------
  // Create safe ID
  // --------------------------------------------------

  const createId = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  // --------------------------------------------------
  // Get current viewer position
  // --------------------------------------------------

  const updateCurrentPosition = () => {
    const navigation =
      navigationRef.current;

    const pathfinder =
      pathfinderRef.current;

    if (!navigation || !pathfinder) {
      return;
    }

    if (!localized) {
      return;
    }

    const viewerPosition =
      navigation.getViewerMapPosition();

    if (!viewerPosition) {
      return;
    }

    // Project the camera position onto
    // the walkable NavMesh.
    const navMeshPosition =
      pathfinder.clampToNavMesh(
        viewerPosition
      );

    if (!navMeshPosition) {
      return;
    }

    setCurrentPosition({
      x: Number(
        navMeshPosition.x.toFixed(3)
      ),

      y: Number(
        navMeshPosition.y.toFixed(3)
      ),

      z: Number(
        navMeshPosition.z.toFixed(3)
      ),
    });
  };

  // --------------------------------------------------
  // Capture destination
  // --------------------------------------------------

  const captureDestination = () => {
    const navigation =
      navigationRef.current;

    const pathfinder =
      pathfinderRef.current;

    if (!navigation) {
      alert(
        "Navigation is not ready."
      );

      return;
    }

    if (!pathfinder) {
      alert(
        "NavMesh is not ready."
      );

      return;
    }

    if (!localized) {
      alert(
        "Please wait until MultiSet is localized."
      );

      return;
    }

    const name =
      destinationName.trim();

    if (!name) {
      alert(
        "Enter a destination name."
      );

      return;
    }

    // Get current camera/viewer position
    // in MultiSet map coordinates.
    const viewerPosition =
      navigation.getViewerMapPosition();

    if (!viewerPosition) {
      alert(
        "Current map position is not available."
      );

      return;
    }

    // Snap to the walkable NavMesh.
    const navMeshPosition =
      pathfinder.clampToNavMesh(
        viewerPosition
      );

    if (!navMeshPosition) {
      alert(
        "You are not close enough to the NavMesh. Move onto the walkable floor and try again."
      );

      return;
    }

    const destination: Destination = {
      id: createId(name),

      name,

      position: {
        x: Number(
          navMeshPosition.x.toFixed(3)
        ),

        y: Number(
          navMeshPosition.y.toFixed(3)
        ),

        z: Number(
          navMeshPosition.z.toFixed(3)
        ),
      },
    };

    // Check duplicate ID
    const duplicate =
      capturedDestinations.some(
        (item) =>
          item.id === destination.id
      );

    if (duplicate) {
      const shouldReplace =
        window.confirm(
          `"${name}" already exists.\n\nDo you want to replace its coordinate?`
        );

      if (!shouldReplace) {
        return;
      }

      setCapturedDestinations(
        (previous) =>
          previous.map((item) =>
            item.id === destination.id
              ? destination
              : item
          )
      );
    } else {
      setCapturedDestinations(
        (previous) => [
          ...previous,
          destination,
        ]
      );
    }

    setDestinationName("");

    setCurrentPosition({
      x: destination.position.x,
      y: destination.position.y,
      z: destination.position.z,
    });

    console.log(
      "[Destination Capture]",
      destination
    );
  };

  // --------------------------------------------------
  // Copy generated code
  // --------------------------------------------------

  const copyCode = async () => {
    if (
      capturedDestinations.length === 0
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        generatedCode
      );

      alert(
        "DESTINATIONS code copied!"
      );
    } catch (error) {
      console.error(
        "Clipboard error:",
        error
      );

      alert(
        "Unable to copy automatically."
      );
    }
  };

  // --------------------------------------------------
  // Delete destination
  // --------------------------------------------------

  const deleteDestination = (
    id: string
  ) => {
    setCapturedDestinations(
      (previous) =>
        previous.filter(
          (item) => item.id !== id
        )
    );
  };

  // --------------------------------------------------
  // Clear all
  // --------------------------------------------------

  const clearAll = () => {
    if (
      capturedDestinations.length === 0
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete all captured destinations?"
      );

    if (!confirmed) {
      return;
    }

    setCapturedDestinations([]);
  };

  // --------------------------------------------------
  // Initialize MultiSet + Three.js
  // --------------------------------------------------

  useEffect(() => {
    let disposed = false;

    const initialize = async () => {
      try {
        setStatus(
          "Initializing MultiSet..."
        );

        if (!containerRef.current) {
          return;
        }

        // ------------------------------------------
        // Scene
        // ------------------------------------------

        const scene =
          new THREE.Scene();

        scene.background = null;

        sceneRef.current = scene;

        // ------------------------------------------
        // Camera
        // ------------------------------------------

        const camera =
          new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
              window.innerHeight,
            0.01,
            1000
          );

        cameraRef.current = camera;

        // ------------------------------------------
        // Renderer
        // ------------------------------------------

        const renderer =
          new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference:
              "high-performance",
          });

        renderer.setPixelRatio(
          Math.min(
            window.devicePixelRatio,
            2
          )
        );

        renderer.setSize(
          window.innerWidth,
          window.innerHeight
        );

        renderer.xr.enabled = false;

        renderer.domElement.style.position =
          "fixed";

        renderer.domElement.style.left =
          "0";

        renderer.domElement.style.top =
          "0";

        renderer.domElement.style.width =
          "100%";

        renderer.domElement.style.height =
          "100%";

        renderer.domElement.style.zIndex =
          "0";

        containerRef.current.appendChild(
          renderer.domElement
        );

        rendererRef.current =
          renderer;

        // ------------------------------------------
        // Lighting
        // ------------------------------------------

        const ambientLight =
          new THREE.AmbientLight(
            0xffffff,
            1
          );

        scene.add(ambientLight);

        const directionalLight =
          new THREE.DirectionalLight(
            0xffffff,
            1
          );

        directionalLight.position.set(
          5,
          10,
          5
        );

        scene.add(
          directionalLight
        );

        // ------------------------------------------
        // MultiSet Client
        // ------------------------------------------

        const clientId =
          process.env
            .NEXT_PUBLIC_MULTISET_CLIENT_ID;

        const clientSecret =
          process.env
            .NEXT_PUBLIC_MULTISET_CLIENT_SECRET;

        const mapCode =
          process.env
            .NEXT_PUBLIC_MULTISET_MAP_CODE;

        if (
          !clientId ||
          !clientSecret ||
          !mapCode
        ) {
          throw new Error(
            "Missing MultiSet environment variables."
          );
        }

        const client =
          new MultisetClient({
            clientId,
            clientSecret,
            mapType: "map-set",
            code: mapCode,
          });

        setStatus(
          "Authorizing MultiSet..."
        );

        await client.authorize();

        if (disposed) {
          return;
        }

        // ------------------------------------------
        // XR Session
        // ------------------------------------------

        const session =
          new XRSessionManager(
            renderer.getContext() as WebGL2RenderingContext,
            {
              client,

              autoLocalize: true,

              relocalization: true,

              onLocalizationSuccess:
                undefined,

              onLocalizationFailure:
                (reason) => {
                  console.warn(
                    "Localization failed:",
                    reason
                  );

                  setStatus(
                    "Localization failed"
                  );

                  setLocalized(false);
                },

              onError: (error) => {
                console.error(
                  "MultiSet session error:",
                  error
                );

                setStatus(
                  "MultiSet error"
                );
              },
            }
          );

        // ------------------------------------------
        // Three Adapter
        // ------------------------------------------

        const adapter =
          new ThreeAdapter({
            session,
            renderer,
            scene,
            camera,

            showMesh: false,

            showGizmo: false,

            useDefaultButton: true,

            onLocalizationSuccess:
              () => {
                console.log(
                  "Localized successfully"
                );

                setLocalized(true);

                setStatus(
                  "Localized successfully"
                );
              },

            onXRFrame:
              ({ deltaSeconds }) => {
                // Navigation.update() is normally
                // handled by Navigation itself.
                void deltaSeconds;
              },
          });

        adapterRef.current =
          adapter;

        // IMPORTANT:
        // ThreeAdapter must be initialized.
        adapter.initialize();

        // ------------------------------------------
        // MapSpace
        // ------------------------------------------

        const mapSpace =
          new MapSpace(
            new THREE.Object3D()
          );

        scene.add(
          mapSpace.object
        );

        mapSpace.connect(
          adapter
        );

        mapSpaceRef.current =
          mapSpace;

        // ------------------------------------------
        // Load NavMesh GLB
        // ------------------------------------------

        setStatus(
          "Loading NavMesh..."
        );

        const loader =
          new GLTFLoader();

        const gltf =
          await loader.loadAsync(
            NAVMESH_URL
          );

        if (disposed) {
          return;
        }

        const navMeshObject =
          gltf.scene;

        navMeshObject.visible =
          false;

        // Keep the navmesh under MapSpace.
        mapSpace.object.add(
          navMeshObject
        );

        console.log(
          "NavMesh loaded:",
          navMeshObject
        );

        // ------------------------------------------
        // Build Pathfinder
        // ------------------------------------------

        const pathfinder =
          await NavMeshPathfinder.fromObject3D(
            navMeshObject,
            {
              space:
                mapSpace.object,
            }
          );

        if (disposed) {
          return;
        }

        pathfinderRef.current =
          pathfinder;

        setNavMeshReady(true);

        console.log(
          "NavMesh groups:",
          pathfinder.groupCount
        );

        // ------------------------------------------
        // Navigation
        // ------------------------------------------
        //
        // We create Navigation even though this
        // page does not navigate anywhere.
        //
        // We use it for:
        //
        // getViewerMapPosition()
        //
        // which gives the current device position
        // in MultiSet map coordinates.
        // ------------------------------------------

        const navigation =
          await Navigation.create({
            adapter,
            mapSpace,
            pathfinder,
            pois: [],
          });

        if (disposed) {
          return;
        }

        navigationRef.current =
          navigation;

        setStatus(
          "Ready — start AR"
        );

        // ------------------------------------------
        // Resize
        // ------------------------------------------

        const handleResize = () => {
          const width =
            window.innerWidth;

          const height =
            window.innerHeight;

          camera.aspect =
            width / height;

          camera.updateProjectionMatrix();

          renderer.setSize(
            width,
            height
          );
        };

        window.addEventListener(
          "resize",
          handleResize
        );

        // ------------------------------------------
        // Preview render loop
        // ------------------------------------------

        const renderLoop = () => {
          if (disposed) {
            return;
          }

          renderer.render(
            scene,
            camera
          );

          // Update the displayed current
          // coordinate while localized.
          if (localized) {
            updateCurrentPosition();
          }

          animationFrameRef.current =
            requestAnimationFrame(
              renderLoop
            );
        };

        renderLoop();

        // Store cleanup function
        (
          renderer as THREE.WebGLRenderer & {
            __destinationCleanup?: () => void;
          }
        ).__destinationCleanup = () => {
          window.removeEventListener(
            "resize",
            handleResize
          );
        };
      } catch (error) {
        console.error(
          "Destination Capture initialization failed:",
          error
        );

        setStatus(
          error instanceof Error
            ? error.message
            : "Initialization failed"
        );
      }
    };

    void initialize();

    return () => {
      disposed = true;

      if (
        animationFrameRef.current
      ) {
        cancelAnimationFrame(
          animationFrameRef.current
        );
      }

      navigationRef.current?.dispose();

      pathfinderRef.current?.dispose();

      mapSpaceRef.current?.dispose();

      adapterRef.current?.dispose();

      const renderer =
        rendererRef.current;

      if (renderer) {
        (
          renderer as THREE.WebGLRenderer & {
            __destinationCleanup?: () => void;
          }
        ).__destinationCleanup?.();

        renderer.dispose();

        if (
          renderer.domElement.parentElement
        ) {
          renderer.domElement.parentElement.removeChild(
            renderer.domElement
          );
        }
      }
    };
  }, []);

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#000",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      {/* Three.js / AR */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
        }}
      />

      {/* UI overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        {/* Header */}
        <div
          style={{
            margin: 20,
            padding: 20,
            borderRadius: 20,
            background:
              "rgba(20,20,24,0.92)",
            color: "#fff",
            backdropFilter:
              "blur(20px)",
            pointerEvents: "auto",
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: 26,
            }}
          >
            Destination Capture
          </h1>

          <div
            style={{
              fontSize: 15,
              color: "#bbb",
              marginBottom: 8,
            }}
          >
            {status}
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              fontSize: 14,
            }}
          >
            <span
              style={{
                color: localized
                  ? "#6cffae"
                  : "#aaa",
              }}
            >
              ●{" "}
              {localized
                ? "Localized"
                : "Not localized"}
            </span>

            <span
              style={{
                color: navMeshReady
                  ? "#6cffae"
                  : "#aaa",
              }}
            >
              ●{" "}
              {navMeshReady
                ? "NavMesh ready"
                : "NavMesh loading"}
            </span>
          </div>
        </div>

        {/* Capture panel */}
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 20,
            maxHeight:
              "calc(100vh - 180px)",
            overflowY: "auto",
            padding: 18,
            borderRadius: 20,
            background:
              "rgba(20,20,24,0.94)",
            backdropFilter:
              "blur(20px)",
            color: "#fff",
            pointerEvents: "auto",
          }}
        >
          {/* Current coordinate */}

          <div
            style={{
              marginBottom: 15,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#999",
                marginBottom: 5,
              }}
            >
              CURRENT MAP COORDINATE
            </div>

            {currentPosition ? (
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  fontFamily:
                    "monospace",
                  fontSize: 14,
                }}
              >
                <span>
                  X:{" "}
                  {currentPosition.x}
                </span>

                <span>
                  Y:{" "}
                  {currentPosition.y}
                </span>

                <span>
                  Z:{" "}
                  {currentPosition.z}
                </span>
              </div>
            ) : (
              <div
                style={{
                  color: "#777",
                  fontSize: 14,
                }}
              >
                Start AR and localize to
                see your position.
              </div>
            )}
          </div>

          {/* Destination input */}

          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 15,
            }}
          >
            <input
              value={destinationName}
              onChange={(event) =>
                setDestinationName(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  captureDestination();
                }
              }}
              placeholder="Destination name e.g. Panetry"
              disabled={!localized}
              style={{
                flex: 1,
                minWidth: 0,
                padding:
                  "13px 14px",
                borderRadius: 12,
                border:
                  "1px solid #444",
                background: "#111",
                color: "#fff",
                outline: "none",
                fontSize: 15,
              }}
            />

            <button
              type="button"
              onClick={
                captureDestination
              }
              disabled={
                !localized ||
                !navMeshReady
              }
              style={{
                border: "none",
                borderRadius: 12,
                padding:
                  "13px 18px",
                background:
                  localized &&
                  navMeshReady
                    ? "#00bfff"
                    : "#444",
                color: "#fff",
                fontWeight: 700,
                cursor:
                  localized &&
                  navMeshReady
                    ? "pointer"
                    : "not-allowed",
                whiteSpace:
                  "nowrap",
              }}
            >
              Capture & Add
            </button>
          </div>

          {/* Destination list */}

          {capturedDestinations.length >
            0 && (
            <div
              style={{
                marginBottom: 15,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  marginBottom: 8,
                }}
              >
                <strong>
                  Captured Destinations (
                  {
                    capturedDestinations.length
                  }
                  )
                </strong>

                <button
                  type="button"
                  onClick={clearAll}
                  style={{
                    border:
                      "1px solid #555",
                    borderRadius: 8,
                    padding:
                      "7px 10px",
                    background:
                      "transparent",
                    color: "#aaa",
                    cursor:
                      "pointer",
                  }}
                >
                  Clear All
                </button>
              </div>

              {capturedDestinations.map(
                (destination) => (
                  <div
                    key={
                      destination.id
                    }
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                      gap: 10,
                      padding:
                        "10px 12px",
                      marginBottom: 6,
                      borderRadius: 10,
                      background:
                        "#111",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                        }}
                      >
                        {
                          destination.name
                        }
                      </div>

                      <div
                        style={{
                          color: "#999",
                          fontFamily:
                            "monospace",
                          fontSize: 12,
                          marginTop: 3,
                        }}
                      >
                        {
                          destination
                            .position
                            .x
                        }
                        {"  "}
                        {
                          destination
                            .position
                            .y
                        }
                        {"  "}
                        {
                          destination
                            .position
                            .z
                        }
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        deleteDestination(
                          destination.id
                        )
                      }
                      style={{
                        border: "none",
                        background:
                          "transparent",
                        color:
                          "#ff7777",
                        cursor:
                          "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {/* Generated code */}

          {capturedDestinations.length >
            0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  marginBottom: 8,
                }}
              >
                <strong>
                  Copy-paste code
                </strong>

                <button
                  type="button"
                  onClick={copyCode}
                  style={{
                    border: "none",
                    borderRadius: 9,
                    padding:
                      "8px 13px",
                    background:
                      "#00bfff",
                    color: "#fff",
                    fontWeight: 700,
                    cursor:
                      "pointer",
                  }}
                >
                  Copy Code
                </button>
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: 15,
                  borderRadius: 12,
                  background:
                    "#080808",
                  color: "#9ff",
                  overflowX:
                    "auto",
                  fontSize: 12,
                  lineHeight: 1.55,
                  whiteSpace:
                    "pre",
                }}
              >
                {generatedCode}
              </pre>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}