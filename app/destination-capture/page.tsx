"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  MultisetClient,
  XRSessionManager,
} from "@multisetai/vps/core";

import { ThreeAdapter } from "@multisetai/vps/three";

type CapturedDestination = {
  id: string;
  name: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
};

const MAP_CODE =
  process.env.NEXT_PUBLIC_MULTISET_MAP_CODE ?? "";

const CLIENT_ID =
  process.env.NEXT_PUBLIC_MULTISET_CLIENT_ID ?? "";

const CLIENT_SECRET =
  process.env.NEXT_PUBLIC_MULTISET_CLIENT_SECRET ?? "";

export default function DestinationCapturePage() {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null);

  const sceneRef =
    useRef<THREE.Scene | null>(null);

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(null);

  const adapterRef =
    useRef<ThreeAdapter | null>(null);

  const sessionRef =
    useRef<XRSessionManager | null>(null);

  /**
   * MultiSet gives us this matrix after localization.
   *
   * map -> world
   */
  const worldFromMapRef =
    useRef<THREE.Matrix4 | null>(null);

  /**
   * Current device position in MAP coordinates.
   *
   * Updated every XR frame.
   */
  const currentMapPositionRef =
    useRef<THREE.Vector3 | null>(null);

  const [status, setStatus] =
    useState("Initializing...");

  const [localized, setLocalized] =
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
    destinations,
    setDestinations,
  ] = useState<CapturedDestination[]>([]);

  // --------------------------------------------------
  // Create safe ID
  // --------------------------------------------------

  const createId = useCallback(
    (name: string) => {
      return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    },
    []
  );

  // --------------------------------------------------
  // Generated TypeScript code
  // --------------------------------------------------

  const generatedCode = useMemo(() => {
    if (destinations.length === 0) {
      return `const DESTINATIONS: Destination[] = [];`;
    }

    const items = destinations
      .map((destination) => {
        const safeName =
          destination.name.replace(
            /'/g,
            "\\'"
          );

        return `  {
    id: '${destination.id}',
    name: '${safeName}',
    position: new THREE.Vector3(
      ${destination.position.x},
      ${destination.position.y},
      ${destination.position.z}
    ),
  }`;
      })
      .join(",\n\n");

    return `const DESTINATIONS: Destination[] = [

${items}

];`;
  }, [destinations]);

  // --------------------------------------------------
  // Get current MAP position
  // --------------------------------------------------

  const getCurrentMapPosition =
    useCallback(() => {
      const position =
        currentMapPositionRef.current;

      if (!position) {
        return null;
      }

      return {
        x: Number(
          position.x.toFixed(3)
        ),

        y: Number(
          position.y.toFixed(3)
        ),

        z: Number(
          position.z.toFixed(3)
        ),
      };
    }, []);

  // --------------------------------------------------
  // Capture destination
  // --------------------------------------------------

  const captureDestination = useCallback(() => {
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

    const position =
      getCurrentMapPosition();

    if (!position) {
      alert(
        "Current map position is not available yet."
      );

      return;
    }

    const id =
      createId(name);

    if (!id) {
      alert(
        "Please enter a valid destination name."
      );

      return;
    }

    const destination: CapturedDestination = {
      id,
      name,
      position,
    };

    setDestinations(
      (previous) => {
        const existingIndex =
          previous.findIndex(
            (item) =>
              item.id === id
          );

        /**
         * If destination already exists,
         * replace its coordinates.
         */
        if (existingIndex !== -1) {
          const updated = [
            ...previous,
          ];

          updated[existingIndex] =
            destination;

          return updated;
        }

        return [
          ...previous,
          destination,
        ];
      }
    );

    setDestinationName("");

    console.log(
      "[Destination Capture]",
      destination
    );
  }, [
    localized,
    destinationName,
    getCurrentMapPosition,
    createId,
  ]);

  // --------------------------------------------------
  // Delete one
  // --------------------------------------------------

  const deleteDestination =
    useCallback(
      (id: string) => {
        setDestinations(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        );
      },
      []
    );

  // --------------------------------------------------
  // Clear all
  // --------------------------------------------------

  const clearAll =
    useCallback(() => {
      if (destinations.length === 0) {
        return;
      }

      const confirmed =
        window.confirm(
          "Clear all captured destinations?"
        );

      if (!confirmed) {
        return;
      }

      setDestinations([]);
    }, [destinations.length]);

  // --------------------------------------------------
  // Copy generated code
  // --------------------------------------------------

  const copyCode =
    useCallback(async () => {
      try {
        await navigator.clipboard.writeText(
          generatedCode
        );

        alert(
          "DESTINATIONS code copied."
        );
      } catch (error) {
        console.error(
          "Clipboard error:",
          error
        );

        alert(
          "Unable to copy. Please copy the code manually."
        );
      }
    }, [generatedCode]);

  // --------------------------------------------------
  // MultiSet initialization
  // --------------------------------------------------

  useEffect(() => {
    let disposed = false;

    const initialize =
      async () => {
        try {
          if (!containerRef.current) {
            return;
          }

          if (
            !CLIENT_ID ||
            !CLIENT_SECRET ||
            !MAP_CODE
          ) {
            setStatus(
              "Missing MultiSet environment variables."
            );

            console.error(
              "Missing MultiSet environment variables."
            );

            return;
          }

          setStatus(
            "Creating Three.js scene..."
          );

          // ----------------------------------------
          // Renderer
          // ----------------------------------------

          const renderer =
            new THREE.WebGLRenderer({
              antialias: true,
              alpha: true,
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

          /**
           * IMPORTANT
           *
           * WebXR must be enabled.
           */
          renderer.xr.enabled = true;

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

          // ----------------------------------------
          // Scene
          // ----------------------------------------

          const scene =
            new THREE.Scene();

          /**
           * Transparent scene so the
           * real camera feed remains visible.
           */
          scene.background = null;

          sceneRef.current =
            scene;

          // ----------------------------------------
          // Camera
          // ----------------------------------------

          const camera =
            new THREE.PerspectiveCamera(
              70,
              window.innerWidth /
                window.innerHeight,
              0.01,
              1000
            );

          scene.add(camera);

          cameraRef.current =
            camera;

          // ----------------------------------------
          // Light
          // ----------------------------------------

          scene.add(
            new THREE.AmbientLight(
              0xffffff,
              1
            )
          );

          // ----------------------------------------
          // MultiSet Client
          // ----------------------------------------

          setStatus(
            "Authorizing MultiSet..."
          );

          const client =
            new MultisetClient({
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,

              mapType: "map",

              code: MAP_CODE,
            });

          await client.authorize();

          if (disposed) {
            return;
          }

          // ----------------------------------------
          // XR Session
          // ----------------------------------------

          setStatus(
            "Starting MultiSet AR..."
          );

          const session =
            new XRSessionManager(
              renderer.getContext() as WebGL2RenderingContext,
              {
                client,

                autoLocalize: true,

                /**
                 * Keep these values aligned with
                 * the working Kokarya page.
                 */
                confidenceCheck: true,

                onLocalizationSuccess:
                  undefined,

                onLocalizationFailure:
                  (reason) => {
                    console.warn(
                      "Localization failed:",
                      reason
                    );

                    setLocalized(false);

                    setStatus(
                      "Localization failed"
                    );
                  },

                onError:
                  (error) => {
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

          sessionRef.current =
            session;

          // ----------------------------------------
          // ThreeAdapter
          // ----------------------------------------

          const adapter =
            new ThreeAdapter({
              session,

              renderer,

              scene,

              camera,

              /**
               * We don't need the downloaded
               * visual map mesh on this page.
               */
              showMesh: false,

              showGizmo: false,

              /**
               * Keep the built-in AR button.
               */
              useDefaultButton: true,

              onLocalizationSuccess:
                (
                  result,
                  worldFromMap
                ) => {
                  if (disposed) {
                    return;
                  }

                  console.log(
                    "MultiSet localized",
                    result
                  );

                  console.log(
                    "worldFromMap:",
                    worldFromMap
                  );

                  /**
                   * Store the latest
                   * map -> world transform.
                   */
                  worldFromMapRef.current =
                    worldFromMap.clone();

                  setLocalized(true);

                  setStatus(
                    "Localized — walk to a destination"
                  );
                },

              /**
               * IMPORTANT:
               *
               * ThreeAdapter synchronizes
               * the camera before this callback.
               *
               * We use the camera's current
               * world position and transform
               * it back into MAP space.
               */
              onXRFrame:
                () => {
                  if (
                    disposed ||
                    !worldFromMapRef.current
                  ) {
                    return;
                  }

                  if (!localized) {
                    return;
                  }

                  const cameraWorldPosition =
                    new THREE.Vector3();

                  camera.getWorldPosition(
                    cameraWorldPosition
                  );

                  /**
                   * worldFromMap:
                   *
                   * MAP -> WORLD
                   *
                   * Therefore:
                   *
                   * inverse(worldFromMap):
                   *
                   * WORLD -> MAP
                   */
                  const mapFromWorld =
                    worldFromMapRef.current
                      .clone()
                      .invert();

                  const mapPosition =
                    cameraWorldPosition
                      .clone()
                      .applyMatrix4(
                        mapFromWorld
                      );

                  currentMapPositionRef.current =
                    mapPosition;

                  /**
                   * Don't React-update the UI
                   * every XR frame.
                   *
                   * Update roughly every
                   * 100ms instead.
                   */
                  const now =
                    performance.now();

                  if (
                    now -
                      lastUiUpdateRef.current <
                    100
                  ) {
                    return;
                  }

                  lastUiUpdateRef.current =
                    now;

                  setCurrentPosition({
                    x: Number(
                      mapPosition.x.toFixed(3)
                    ),

                    y: Number(
                      mapPosition.y.toFixed(3)
                    ),

                    z: Number(
                      mapPosition.z.toFixed(3)
                    ),
                  });
                },
            });

          adapterRef.current =
            adapter;

          // ----------------------------------------
          // Start adapter
          // ----------------------------------------

          await adapter.initialize();

          if (disposed) {
            return;
          }

          setStatus(
            "Ready — press START AR"
          );

          // ----------------------------------------
          // Resize
          // ----------------------------------------

          const handleResize =
            () => {
              if (
                !rendererRef.current ||
                !cameraRef.current
              ) {
                return;
              }

              const width =
                window.innerWidth;

              const height =
                window.innerHeight;

              cameraRef.current.aspect =
                width / height;

              cameraRef.current.updateProjectionMatrix();

              rendererRef.current.setSize(
                width,
                height
              );
            };

          window.addEventListener(
            "resize",
            handleResize
          );

          // Cleanup attached to renderer.
          (
            renderer as THREE.WebGLRenderer & {
              __destinationCaptureCleanup?: () => void;
            }
          ).__destinationCaptureCleanup =
            () => {
              window.removeEventListener(
                "resize",
                handleResize
              );
            };
        } catch (error) {
          console.error(
            "Destination Capture initialization error:",
            error
          );

          setStatus(
            error instanceof Error
              ? error.message
              : "MultiSet initialization failed"
          );
        }
      };

    void initialize();

    return () => {
      disposed = true;

      /**
       * Clear references.
       */
      currentMapPositionRef.current =
        null;

      worldFromMapRef.current =
        null;

      /**
       * Adapter owns the XR render
       * lifecycle.
       */
      adapterRef.current?.dispose();

      adapterRef.current =
        null;

      sessionRef.current =
        null;

      const renderer =
        rendererRef.current;

      if (renderer) {
        (
          renderer as THREE.WebGLRenderer & {
            __destinationCaptureCleanup?: () => void;
          }
        ).__destinationCaptureCleanup?.();

        renderer.dispose();

        if (
          renderer.domElement.parentElement
        ) {
          renderer.domElement.parentElement.removeChild(
            renderer.domElement
          );
        }
      }

      rendererRef.current =
        null;

      sceneRef.current =
        null;

      cameraRef.current =
        null;
    };
  }, []);

  /**
   * Timestamp used to avoid calling
   * React setState on every XR frame.
   */
  const lastUiUpdateRef =
    useRef(0);

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
      {/* -----------------------------------------
          AR / Three.js
      ------------------------------------------ */}

      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
        }}
      />

      {/* -----------------------------------------
          UI
      ------------------------------------------ */}

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        {/* Header */}

        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            right: 20,

            padding: 18,

            borderRadius: 18,

            background:
              "rgba(15,15,18,0.90)",

            backdropFilter:
              "blur(18px)",

            color: "#fff",

            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Destination Capture
          </div>

          <div
            style={{
              fontSize: 14,
              color: "#aaa",
              marginBottom: 10,
            }}
          >
            {status}
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              fontSize: 13,
            }}
          >
            <span
              style={{
                color: localized
                  ? "#4ade80"
                  : "#aaa",
              }}
            >
              ●{" "}
              {localized
                ? "Localized"
                : "Not localized"}
            </span>

            {currentPosition && (
              <span
                style={{
                  color: "#9ca3af",
                }}
              >
                Position available
              </span>
            )}
          </div>
        </div>

        {/* Bottom panel */}

        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 20,

            maxHeight:
              "calc(100vh - 160px)",

            overflowY: "auto",

            padding: 18,

            borderRadius: 20,

            background:
              "rgba(15,15,18,0.94)",

            backdropFilter:
              "blur(20px)",

            color: "#fff",

            pointerEvents: "auto",
          }}
        >
          {/* Current position */}

          <div
            style={{
              marginBottom: 15,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#888",
                letterSpacing: 1,
                marginBottom: 7,
              }}
            >
              CURRENT MAP COORDINATE
            </div>

            {currentPosition ? (
              <div
                style={{
                  display: "flex",
                  gap: 18,
                  flexWrap: "wrap",
                  fontFamily:
                    "monospace",
                  fontSize: 14,
                }}
              >
                <span>
                  X: {currentPosition.x}
                </span>

                <span>
                  Y: {currentPosition.y}
                </span>

                <span>
                  Z: {currentPosition.z}
                </span>
              </div>
            ) : (
              <div
                style={{
                  color: "#777",
                  fontSize: 14,
                }}
              >
                Start AR and localize first.
              </div>
            )}
          </div>

          {/* Input */}

          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 16,
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
              disabled={!localized}
              placeholder="Destination name"
              style={{
                flex: 1,
                minWidth: 0,

                padding:
                  "13px 14px",

                borderRadius: 11,

                border:
                  "1px solid #444",

                background: "#111",

                color: "#fff",

                fontSize: 15,

                outline: "none",
              }}
            />

            <button
              type="button"
              onClick={
                captureDestination
              }
              disabled={!localized}
              style={{
                padding:
                  "13px 16px",

                border: "none",

                borderRadius: 11,

                background:
                  localized
                    ? "#00bfff"
                    : "#444",

                color: "#fff",

                fontWeight: 700,

                cursor:
                  localized
                    ? "pointer"
                    : "not-allowed",

                whiteSpace:
                  "nowrap",
              }}
            >
              Capture
            </button>
          </div>

          {/* Destination count */}

          {destinations.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Captured (
                {destinations.length})
              </div>

              <button
                type="button"
                onClick={clearAll}
                style={{
                  border:
                    "1px solid #444",

                  borderRadius: 8,

                  padding:
                    "6px 10px",

                  background:
                    "transparent",

                  color: "#aaa",

                  cursor: "pointer",
                }}
              >
                Clear All
              </button>
            </div>
          )}

          {/* Destination list */}

          {destinations.map(
            (destination) => (
              <div
                key={destination.id}
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",

                  gap: 12,

                  padding:
                    "10px 12px",

                  marginBottom: 6,

                  borderRadius: 10,

                  background: "#111",
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 3,
                    }}
                  >
                    {destination.name}
                  </div>

                  <div
                    style={{
                      color: "#888",
                      fontFamily:
                        "monospace",
                      fontSize: 11,
                    }}
                  >
                    {destination.position.x}
                    {"  "}
                    {destination.position.y}
                    {"  "}
                    {destination.position.z}
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
                      "#ff6b6b",
                    cursor:
                      "pointer",
                    flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              </div>
            )
          )}

          {/* Generated code */}

          {destinations.length > 0 && (
            <div
              style={{
                marginTop: 15,
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
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  Copy-paste code
                </div>

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

                  background: "#050505",

                  color: "#9ff",

                  fontFamily:
                    "monospace",

                  fontSize: 12,

                  lineHeight: 1.55,

                  overflowX:
                    "auto",

                  whiteSpace: "pre",
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