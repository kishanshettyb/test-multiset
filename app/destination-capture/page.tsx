"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  MultisetClient,
  XRSessionManager,
} from "@multisetai/vps/core";

import { ThreeAdapter } from "@multisetai/vps/three";

type Destination = {
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
  // --------------------------------------------------
  // DOM
  // --------------------------------------------------

  const containerRef =
    useRef<HTMLDivElement | null>(null);

  // --------------------------------------------------
  // Three.js
  // --------------------------------------------------

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null);

  const sceneRef =
    useRef<THREE.Scene | null>(null);

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(null);

  // --------------------------------------------------
  // MultiSet
  // --------------------------------------------------

  const adapterRef =
    useRef<ThreeAdapter | null>(null);

  const sessionRef =
    useRef<XRSessionManager | null>(null);

  /**
   * MultiSet:
   *
   * map coordinates -> world coordinates
   */
  const worldFromMapRef =
    useRef<THREE.Matrix4 | null>(null);

  /**
   * Latest camera position in MAP coordinates.
   */
  const currentMapPositionRef =
    useRef<THREE.Vector3 | null>(null);

  /**
   * Avoid React state updates on every XR frame.
   */
  const lastUiUpdateRef =
    useRef(0);

  // --------------------------------------------------
  // UI state
  // --------------------------------------------------

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

  const [destinations, setDestinations] =
    useState<Destination[]>([]);

  // --------------------------------------------------
  // Create destination ID
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
  // Generate DESTINATIONS code
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
  // Capture
  // --------------------------------------------------

  const captureDestination =
    useCallback(() => {
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
          "Enter destination name."
        );

        return;
      }

      const position =
        getCurrentMapPosition();

      if (!position) {
        alert(
          "Current map position is not available."
        );

        return;
      }

      const id =
        createId(name);

      if (!id) {
        alert(
          "Invalid destination name."
        );

        return;
      }

      const destination: Destination = {
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

          // Update existing destination
          if (existingIndex !== -1) {
            const updated = [
              ...previous,
            ];

            updated[existingIndex] =
              destination;

            return updated;
          }

          // Add new destination
          return [
            ...previous,
            destination,
          ];
        }
      );

      setDestinationName("");

      console.log(
        "Captured destination:",
        destination
      );
    }, [
      localized,
      destinationName,
      getCurrentMapPosition,
      createId,
    ]);

  // --------------------------------------------------
  // Delete destination
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
  // Clear
  // --------------------------------------------------

  const clearAll =
    useCallback(() => {
      if (
        destinations.length === 0
      ) {
        return;
      }

      if (
        !window.confirm(
          "Clear all destinations?"
        )
      ) {
        return;
      }

      setDestinations([]);
    }, [destinations.length]);

  // --------------------------------------------------
  // Copy
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
          "Copy failed:",
          error
        );

        alert(
          "Copy failed. Please copy manually."
        );
      }
    }, [generatedCode]);

  // ==================================================
  // MULTISET + THREE INITIALIZATION
  // ==================================================

  useEffect(() => {
    let disposed = false;

    const initialize =
      async () => {
        try {
          if (!containerRef.current) {
            return;
          }

          // ------------------------------------------
          // Check environment
          // ------------------------------------------

          if (
            !CLIENT_ID ||
            !CLIENT_SECRET ||
            !MAP_CODE
          ) {
            console.error(
              "Missing MultiSet environment variables."
            );

            setStatus(
              "Missing MultiSet configuration"
            );

            return;
          }

          setStatus(
            "Creating AR scene..."
          );

          // ------------------------------------------
          // Renderer
          // ------------------------------------------

          const renderer =
            new THREE.WebGLRenderer({
              antialias: true,
              alpha: true,
            });

          renderer.setPixelRatio(
            window.devicePixelRatio
          );

          renderer.setSize(
            window.innerWidth,
            window.innerHeight
          );

          /**
           * VERY IMPORTANT
           *
           * Required for WebXR.
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

          renderer.domElement.style.display =
            "block";

          containerRef.current.appendChild(
            renderer.domElement
          );

          rendererRef.current =
            renderer;

          // ------------------------------------------
          // Scene
          // ------------------------------------------

          const scene =
            new THREE.Scene();

          /**
           * VERY IMPORTANT
           *
           * Transparent background allows
           * the real AR camera feed to show.
           */
          scene.background = null;

          sceneRef.current =
            scene;

          // ------------------------------------------
          // Camera
          // ------------------------------------------

          const camera =
            new THREE.PerspectiveCamera(
              70,
              window.innerWidth /
                window.innerHeight,
              0.01,
              100
            );

          camera.position.set(
            0,
            0,
            0
          );

          scene.add(camera);

          cameraRef.current =
            camera;

          // ------------------------------------------
          // Light
          // ------------------------------------------

          scene.add(
            new THREE.AmbientLight(
              0xffffff,
              1
            )
          );

          // ------------------------------------------
          // MultiSet client
          // ------------------------------------------

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

          console.log(
            "MultiSet authorized"
          );

          // ------------------------------------------
          // XR Session
          // ------------------------------------------

          setStatus(
            "Creating XR session..."
          );

          /**
           * Keep this configuration minimal.
           *
           * These are the documented options.
           */
          const session =
            new XRSessionManager(
              renderer.getContext() as WebGL2RenderingContext,
              {
                client,

                autoLocalize: true,

                onLocalizationFailure:
                  (reason) => {
                    console.warn(
                      "Localization failed:",
                      reason
                    );

                    setLocalized(false);

                    setStatus(
                      "Localization failed — move camera around"
                    );
                  },

                onError:
                  (error) => {
                    console.error(
                      "MultiSet session error:",
                      error
                    );

                    setStatus(
                      "MultiSet session error"
                    );
                  },
              }
            );

          sessionRef.current =
            session;

          // ------------------------------------------
          // ThreeAdapter
          // ------------------------------------------

          const adapter =
            new ThreeAdapter({
              session,

              renderer,

              scene,

              camera,

              /**
               * We don't need map mesh for
               * destination capture.
               */
              showMesh: false,

              showGizmo: false,

              /**
               * Let MultiSet create the
               * official START AR button.
               */
              useDefaultButton: true,

              // --------------------------------------
              // Localization success
              // --------------------------------------

              onLocalizationSuccess:
                (
                  result,
                  worldFromMap
                ) => {
                  if (disposed) {
                    return;
                  }

                  console.log(
                    "================================"
                  );

                  console.log(
                    "MULTISET LOCALIZED"
                  );

                  console.log(
                    "Result:",
                    result
                  );

                  console.log(
                    "worldFromMap:",
                    worldFromMap
                  );

                  console.log(
                    "================================"
                  );

                  /**
                   * Save MAP -> WORLD matrix.
                   */
                  worldFromMapRef.current =
                    worldFromMap.clone();

                  setLocalized(true);

                  setStatus(
                    "Localized — walk to destination"
                  );
                },

              // --------------------------------------
              // XR frame
              // --------------------------------------

              onXRFrame:
                ({
                  deltaSeconds,
                }) => {
                  if (disposed) {
                    return;
                  }

                  if (
                    !worldFromMapRef.current
                  ) {
                    return;
                  }

                  /**
                   * Camera world position.
                   */
                  const worldPosition =
                    new THREE.Vector3();

                  camera.getWorldPosition(
                    worldPosition
                  );

                  /**
                   * MultiSet gives:
                   *
                   * MAP -> WORLD
                   *
                   * We need:
                   *
                   * WORLD -> MAP
                   */
                  const mapFromWorld =
                    worldFromMapRef.current
                      .clone()
                      .invert();

                  /**
                   * Convert camera world
                   * position into map coordinates.
                   */
                  const mapPosition =
                    worldPosition
                      .clone()
                      .applyMatrix4(
                        mapFromWorld
                      );

                  currentMapPositionRef.current =
                    mapPosition;

                  /**
                   * Don't update React state
                   * every frame.
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

          // ------------------------------------------
          // Initialize adapter
          // ------------------------------------------

          /**
           * IMPORTANT:
           *
           * Do NOT await this.
           *
           * MultiSet initializes its preview
           * and AR button here.
           */
          adapter.initialize();

          if (disposed) {
            return;
          }

          setStatus(
            "Ready — press START AR"
          );

          console.log(
            "MultiSet adapter initialized"
          );

          // ------------------------------------------
          // Resize
          // ------------------------------------------

          const handleResize =
            () => {
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

          // Save cleanup function
          (
            renderer as THREE.WebGLRenderer & {
              __captureCleanup?: () => void;
            }
          ).__captureCleanup =
            () => {
              window.removeEventListener(
                "resize",
                handleResize
              );
            };
        } catch (error) {
          console.error(
            "================================"
          );

          console.error(
            "DESTINATION CAPTURE ERROR"
          );

          console.error(
            error
          );

          console.error(
            "================================"
          );

          setStatus(
            error instanceof Error
              ? error.message
              : "Initialization failed"
          );
        }
      };

    void initialize();

    // ----------------------------------------------
    // Cleanup
    // ----------------------------------------------

    return () => {
      disposed = true;

      worldFromMapRef.current =
        null;

      currentMapPositionRef.current =
        null;

      // Adapter handles XR cleanup.
      if (adapterRef.current) {
        adapterRef.current.dispose();
      }

      adapterRef.current =
        null;

      sessionRef.current =
        null;

      const renderer =
        rendererRef.current;

      if (renderer) {
        (
          renderer as THREE.WebGLRenderer & {
            __captureCleanup?: () => void;
          }
        ).__captureCleanup?.();

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

  // ==================================================
  // UI
  // ==================================================

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
      {/* ============================================
          THREE / CAMERA
      ============================================= */}

      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
      />

      {/* ============================================
          UI
      ============================================= */}

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        {/* ------------------------------------------
            Header
        ------------------------------------------- */}

        <div
          style={{
            position: "absolute",

            top: 20,
            left: 20,
            right: 20,

            padding: 18,

            borderRadius: 18,

            background:
              "rgba(15,15,18,0.9)",

            backdropFilter:
              "blur(18px)",

            color: "#fff",

            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              fontSize: 21,
              fontWeight: 700,
              marginBottom: 7,
            }}
          >
            Destination Capture
          </div>

          <div
            style={{
              color: "#aaa",
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            {status}
          </div>

          <div
            style={{
              color: localized
                ? "#4ade80"
                : "#888",
              fontSize: 13,
            }}
          >
            ●{" "}
            {localized
              ? "Localized"
              : "Waiting for localization"}
          </div>
        </div>

        {/* ------------------------------------------
            Bottom panel
        ------------------------------------------- */}

        <div
          style={{
            position: "absolute",

            left: 20,
            right: 20,
            bottom: 20,

            maxHeight:
              "calc(100vh - 150px)",

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
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                color: "#777",
                marginBottom: 8,
              }}
            >
              CURRENT MAP POSITION
            </div>

            {currentPosition ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 18,
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
                  fontSize: 13,
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
              placeholder="Destination name"
              disabled={!localized}
              style={{
                flex: 1,
                minWidth: 0,

                padding:
                  "13px 14px",

                border:
                  "1px solid #444",

                borderRadius: 11,

                background: "#111",

                color: "#fff",

                outline: "none",

                fontSize: 14,
              }}
            />

            <button
              type="button"
              onClick={
                captureDestination
              }
              disabled={!localized}
              style={{
                border: "none",

                borderRadius: 11,

                padding:
                  "13px 16px",

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
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                marginBottom: 8,
              }}
            >
              <strong
                style={{
                  fontSize: 14,
                }}
              >
                Destinations (
                {destinations.length})
              </strong>

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
                Clear
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

                  justifyContent:
                    "space-between",

                  alignItems:
                    "center",

                  gap: 10,

                  padding:
                    "10px 12px",

                  marginBottom: 6,

                  borderRadius: 10,

                  background: "#111",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {destination.name}
                  </div>

                  <div
                    style={{
                      marginTop: 4,

                      color: "#888",

                      fontFamily:
                        "monospace",

                      fontSize: 11,
                    }}
                  >
                    X{" "}
                    {destination.position.x}
                    {"   "}
                    Y{" "}
                    {destination.position.y}
                    {"   "}
                    Z{" "}
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
                      "#ff7070",

                    cursor:
                      "pointer",
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
                marginTop: 16,
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
                <strong
                  style={{
                    fontSize: 14,
                  }}
                >
                  Generated Code
                </strong>

                <button
                  type="button"
                  onClick={copyCode}
                  style={{
                    border: "none",

                    borderRadius: 9,

                    padding:
                      "8px 12px",

                    background:
                      "#00bfff",

                    color: "#fff",

                    fontWeight: 700,

                    cursor: "pointer",
                  }}
                >
                  Copy Code
                </button>
              </div>

              <pre
                style={{
                  margin: 0,

                  padding: 14,

                  borderRadius: 12,

                  background:
                    "#050505",

                  color: "#9ff",

                  overflowX:
                    "auto",

                  fontSize: 11,

                  lineHeight: 1.55,

                  fontFamily:
                    "monospace",
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