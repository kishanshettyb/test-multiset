"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  // =========================================================
  // DOM
  // =========================================================

  const containerRef =
    useRef<HTMLDivElement | null>(null);

  // =========================================================
  // THREE
  // =========================================================

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null);

  const sceneRef =
    useRef<THREE.Scene | null>(null);

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(null);

  // =========================================================
  // MULTISET
  // =========================================================

  const adapterRef =
    useRef<ThreeAdapter | null>(null);

  const sessionRef =
    useRef<XRSessionManager | null>(null);

  // MAP -> WORLD
  const worldFromMapRef =
    useRef<THREE.Matrix4 | null>(null);

  // Current camera position in MAP coordinates
  const currentMapPositionRef =
    useRef<THREE.Vector3 | null>(null);

  const lastUiUpdateRef =
    useRef(0);

  // =========================================================
  // UI STATE
  // =========================================================

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

  const [error, setError] =
    useState("");

  // =========================================================
  // CREATE DESTINATION ID
  // =========================================================

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

  // =========================================================
  // GENERATED DESTINATION CODE
  // =========================================================

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

  // =========================================================
  // CURRENT MAP POSITION
  // =========================================================

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

  // =========================================================
  // CAPTURE DESTINATION
  // =========================================================

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

      const destination: Destination = {
        id: createId(name),

        name,

        position,
      };

      console.log(
        "DESTINATION CAPTURED:",
        destination
      );

      setDestinations(
        (previous) => {
          const existingIndex =
            previous.findIndex(
              (item) =>
                item.id ===
                destination.id
            );

          // Update existing destination
          if (
            existingIndex !== -1
          ) {
            const updated = [
              ...previous,
            ];

            updated[
              existingIndex
            ] = destination;

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
    }, [
      localized,
      destinationName,
      getCurrentMapPosition,
      createId,
    ]);

  // =========================================================
  // DELETE
  // =========================================================

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

  // =========================================================
  // COPY JSON / CODE
  // =========================================================

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
          "Unable to copy. Please copy manually."
        );
      }
    }, [generatedCode]);

  // =========================================================
  // INITIALIZE MULTISET
  // =========================================================

  useEffect(() => {
    let disposed = false;

    let resizeHandler:
      | (() => void)
      | null = null;

    const initialize =
      async () => {
        try {
          // -----------------------------------------------------
          // CONTAINER
          // -----------------------------------------------------

          if (!containerRef.current) {
            return;
          }

          // -----------------------------------------------------
          // ENVIRONMENT
          // -----------------------------------------------------

          if (
            !CLIENT_ID ||
            !CLIENT_SECRET ||
            !MAP_CODE
          ) {
            setStatus(
              "Missing MultiSet environment variables."
            );

            return;
          }

          // -----------------------------------------------------
          // WEBXR SUPPORT
          // -----------------------------------------------------

          setStatus(
            "Checking WebXR support..."
          );

          const supported =
            await ThreeAdapter.isSupported();

          if (!supported) {
            throw new Error(
              "WebXR immersive AR is not supported on this device."
            );
          }

          if (disposed) {
            return;
          }

          // =====================================================
          // RENDERER
          // =====================================================

          setStatus(
            "Creating Three.js scene..."
          );

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

          // IMPORTANT
          // Same as the working Kokarya page.
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

          // =====================================================
          // SCENE
          // =====================================================

          const scene =
            new THREE.Scene();

          // VERY IMPORTANT
          // Do not give the scene a black background.
          scene.background = null;

          sceneRef.current =
            scene;

          // =====================================================
          // CAMERA
          // =====================================================

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

          // =====================================================
          // LIGHT
          // =====================================================

          scene.add(
            new THREE.AmbientLight(
              0xffffff,
              1
            )
          );

          // =====================================================
          // MULTISET CLIENT
          // =====================================================

          setStatus(
            "Authorizing MultiSet..."
          );

          const client =
            new MultisetClient({
              clientId:
                CLIENT_ID,

              clientSecret:
                CLIENT_SECRET,

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

          // =====================================================
          // XR SESSION
          // =====================================================

          setStatus(
            "Starting MultiSet AR..."
          );

          const session =
            new XRSessionManager(
              renderer.getContext() as WebGL2RenderingContext,
              {
                client,

                autoLocalize: true,

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
                      "Localization failed — move camera around"
                    );
                  },

                onError:
                  (error) => {
                    console.error(
                      "MultiSet session error:",
                      error
                    );

                    setError(
                      error instanceof Error
                        ? error.message
                        : String(error)
                    );

                    setStatus(
                      "MultiSet error"
                    );
                  },
              }
            );

          sessionRef.current =
            session;

          // =====================================================
          // THREE ADAPTER
          // =====================================================

          const adapter =
            new ThreeAdapter({
              session,

              renderer,

              scene,

              camera,

              // IMPORTANT
              showMesh: false,

              showGizmo: false,

              // IMPORTANT
              // Let MultiSet create the AR button.
              useDefaultButton: true,

              // =================================================
              // LOCALIZATION SUCCESS
              // =================================================

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

                  // MAP -> WORLD
                  worldFromMapRef.current =
                    worldFromMap.clone();

                  setLocalized(true);

                  setStatus(
                    "Localized — walk to destination"
                  );
                },

              // =================================================
              // XR FRAME
              // =================================================

              onXRFrame:
                () => {
                  if (disposed) {
                    return;
                  }

                  if (
                    !worldFromMapRef.current
                  ) {
                    return;
                  }

                  // ---------------------------------------------
                  // CAMERA WORLD POSITION
                  // ---------------------------------------------

                  const worldPosition =
                    new THREE.Vector3();

                  camera.getWorldPosition(
                    worldPosition
                  );

                  // ---------------------------------------------
                  // WORLD -> MAP
                  // ---------------------------------------------

                  const mapFromWorld =
                    worldFromMapRef.current
                      .clone()
                      .invert();

                  const mapPosition =
                    worldPosition
                      .clone()
                      .applyMatrix4(
                        mapFromWorld
                      );

                  // ---------------------------------------------
                  // STORE
                  // ---------------------------------------------

                  currentMapPositionRef.current =
                    mapPosition;

                  // ---------------------------------------------
                  // UI UPDATE
                  // ---------------------------------------------

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
                      mapPosition.x.toFixed(
                        3
                      )
                    ),

                    y: Number(
                      mapPosition.y.toFixed(
                        3
                      )
                    ),

                    z: Number(
                      mapPosition.z.toFixed(
                        3
                      )
                    ),
                  });
                },
            });

          adapterRef.current =
            adapter;

          // =====================================================
          // START ADAPTER
          // =====================================================

          /**
           * IMPORTANT
           *
           * This is the same initialization
           * used by the working page.
           */
          await adapter.initialize();

          if (disposed) {
            return;
          }

          setStatus(
            "Ready — press START AR"
          );

          console.log(
            "Destination Capture ready"
          );

          // =====================================================
          // RESIZE
          // =====================================================

          resizeHandler =
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
            resizeHandler
          );
        } catch (error) {
          console.error(
            "Destination Capture initialization error:",
            error
          );

          setError(
            error instanceof Error
              ? error.message
              : String(error)
          );

          setStatus(
            "Initialization failed"
          );
        }
      };

    initialize();

    // =========================================================
    // CLEANUP
    // =========================================================

    return () => {
      disposed = true;

      if (resizeHandler) {
        window.removeEventListener(
          "resize",
          resizeHandler
        );
      }

      try {
        adapterRef.current?.dispose();
      } catch {}

      try {
        if (
          rendererRef.current
            ?.domElement
            .parentElement
        ) {
          rendererRef.current
            .domElement
            .parentElement
            .removeChild(
              rendererRef.current
                .domElement
            );
        }
      } catch {}

      try {
        rendererRef.current?.dispose();
      } catch {}

      rendererRef.current = null;

      sceneRef.current = null;

      cameraRef.current = null;

      adapterRef.current = null;

      sessionRef.current = null;

      worldFromMapRef.current =
        null;

      currentMapPositionRef.current =
        null;
    };
  }, []);

  // =========================================================
  // UI
  // =========================================================

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",

        // UI background only.
        // AR canvas is above/below independently.
        background: "#000",

        fontFamily:
          "Arial, sans-serif",
      }}
    >
      {/* =====================================================
          AR CANVAS
      ====================================================== */}

      <div
        ref={containerRef}
        style={{
          position: "fixed",
          inset: 0,

          width: "100%",
          height: "100%",

          zIndex: 0,

          pointerEvents:
            "auto",
        }}
      />

      {/* =====================================================
          TOP STATUS
      ====================================================== */}

      <div
        style={{
          position: "absolute",

          top: 20,
          left: 20,
          right: 20,

          zIndex: 10,

          padding: 18,

          borderRadius: 18,

          background:
            "rgba(20,20,24,0.92)",

          backdropFilter:
            "blur(18px)",

          color: "#fff",

          pointerEvents:
            "none",
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          Destination Capture
        </div>

        <div
          style={{
            fontSize: 16,
            color: "#ccc",
          }}
        >
          {status}
        </div>

        {error && (
          <div
            style={{
              marginTop: 10,
              color: "#ff7070",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 12,

            color: localized
              ? "#65f2a1"
              : "#aaa",

            fontSize: 15,

            fontWeight: 600,
          }}
        >
          {localized
            ? "● Localized"
            : "○ Waiting for localization"}
        </div>
      </div>

      {/* =====================================================
          BOTTOM PANEL
      ====================================================== */}

      <div
        style={{
          position: "absolute",

          left: 20,
          right: 20,
          bottom: 20,

          zIndex: 10,

          maxHeight:
            "50vh",

          overflowY: "auto",

          padding: 18,

          borderRadius: 20,

          background:
            "rgba(15,15,18,0.94)",

          backdropFilter:
            "blur(20px)",

          color: "#fff",
        }}
      >
        {/* ===================================================
            CURRENT POSITION
        ==================================================== */}

        <div
          style={{
            marginBottom: 18,
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
                gap: 20,
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
              Start AR and localize
              first.
            </div>
          )}
        </div>

        {/* ===================================================
            INPUT
        ==================================================== */}

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

        {/* ===================================================
            DESTINATIONS
        ==================================================== */}

        {destinations.length >
          0 && (
          <>
            <div
              style={{
                marginBottom: 10,

                fontSize: 14,

                fontWeight: 700,
              }}
            >
              Destinations (
              {destinations.length})
            </div>

            {destinations.map(
              (destination) => (
                <div
                  key={
                    destination.id
                  }
                  style={{
                    display: "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "center",

                    gap: 10,

                    padding: 12,

                    marginBottom: 7,

                    borderRadius: 11,

                    background: "#111",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {
                        destination.name
                      }
                    </div>

                    <div
                      style={{
                        marginTop: 5,

                        fontFamily:
                          "monospace",

                        fontSize: 11,

                        color: "#888",
                      }}
                    >
                      X{" "}
                      {
                        destination
                          .position
                          .x
                      }{" "}
                      Y{" "}
                      {
                        destination
                          .position
                          .y
                      }{" "}
                      Z{" "}
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

            {/* =================================================
                GENERATED CODE
            ================================================== */}

            <div
              style={{
                marginTop: 18,
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
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  Generated DESTINATIONS
                </div>

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

                    cursor:
                      "pointer",
                  }}
                >
                  Copy
                </button>
              </div>

              <pre
                style={{
                  margin: 0,

                  padding: 14,

                  borderRadius: 10,

                  background:
                    "#050505",

                  color: "#9ff",

                  fontFamily:
                    "monospace",

                  fontSize: 11,

                  lineHeight: 1.5,

                  overflowX:
                    "auto",

                  whiteSpace:
                    "pre",
                }}
              >
                {generatedCode}
              </pre>
            </div>
          </>
        )}
      </div>
    </main>
  );
}