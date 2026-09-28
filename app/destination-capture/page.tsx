// "use client";

// import {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from "react";

// import * as THREE from "three";

// import {
//   MultisetClient,
//   XRSessionManager,
// } from "@multisetai/vps/core";

// import { ThreeAdapter } from "@multisetai/vps/three";

// type Destination = {
//   id: string;
//   name: string;
//   position: {
//     x: number;
//     y: number;
//     z: number;
//   };
// };

// const MAP_CODE =
//   process.env.NEXT_PUBLIC_MULTISET_MAP_CODE ?? "";

// const CLIENT_ID =
//   process.env.NEXT_PUBLIC_MULTISET_CLIENT_ID ?? "";

// const CLIENT_SECRET =
//   process.env.NEXT_PUBLIC_MULTISET_CLIENT_SECRET ?? "";

// export default function DestinationCapturePage() {
//   // =========================================================
//   // DOM
//   // =========================================================

//   const containerRef =
//     useRef<HTMLDivElement | null>(null);

//   // =========================================================
//   // THREE
//   // =========================================================

//   const rendererRef =
//     useRef<THREE.WebGLRenderer | null>(null);

//   const sceneRef =
//     useRef<THREE.Scene | null>(null);

//   const cameraRef =
//     useRef<THREE.PerspectiveCamera | null>(null);

//   // =========================================================
//   // MULTISET
//   // =========================================================

//   const adapterRef =
//     useRef<ThreeAdapter | null>(null);

//   const sessionRef =
//     useRef<XRSessionManager | null>(null);

//   // MAP -> WORLD
//   const worldFromMapRef =
//     useRef<THREE.Matrix4 | null>(null);

//   // Current camera position in MAP coordinates
//   const currentMapPositionRef =
//     useRef<THREE.Vector3 | null>(null);

//   const lastUiUpdateRef =
//     useRef(0);

//   // =========================================================
//   // UI STATE
//   // =========================================================

//   const [status, setStatus] =
//     useState("Initializing...");

//   const [localized, setLocalized] =
//     useState(false);

//   const [destinationName, setDestinationName] =
//     useState("");

//   const [currentPosition, setCurrentPosition] =
//     useState<{
//       x: number;
//       y: number;
//       z: number;
//     } | null>(null);

//   const [destinations, setDestinations] =
//     useState<Destination[]>([]);

//   const [error, setError] =
//     useState("");

//   // =========================================================
//   // CREATE DESTINATION ID
//   // =========================================================

//   const createId = useCallback(
//     (name: string) => {
//       return name
//         .trim()
//         .toLowerCase()
//         .replace(/[^a-z0-9]+/g, "-")
//         .replace(/^-+|-+$/g, "");
//     },
//     []
//   );

//   // =========================================================
//   // GENERATED DESTINATION CODE
//   // =========================================================

//   const generatedCode = useMemo(() => {
//     if (destinations.length === 0) {
//       return `const DESTINATIONS: Destination[] = [];`;
//     }

//     const items = destinations
//       .map((destination) => {
//         const safeName =
//           destination.name.replace(
//             /'/g,
//             "\\'"
//           );

//         return `  {
//     id: '${destination.id}',
//     name: '${safeName}',
//     position: new THREE.Vector3(
//       ${destination.position.x},
//       ${destination.position.y},
//       ${destination.position.z}
//     ),
//   }`;
//       })
//       .join(",\n\n");

//     return `const DESTINATIONS: Destination[] = [

// ${items}

// ];`;
//   }, [destinations]);

//   // =========================================================
//   // CURRENT MAP POSITION
//   // =========================================================

//   const getCurrentMapPosition =
//     useCallback(() => {
//       const position =
//         currentMapPositionRef.current;

//       if (!position) {
//         return null;
//       }

//       return {
//         x: Number(
//           position.x.toFixed(3)
//         ),

//         y: Number(
//           position.y.toFixed(3)
//         ),

//         z: Number(
//           position.z.toFixed(3)
//         ),
//       };
//     }, []);

//   // =========================================================
//   // CAPTURE DESTINATION
//   // =========================================================

//   const captureDestination =
//     useCallback(() => {
//       if (!localized) {
//         alert(
//           "Please wait until MultiSet is localized."
//         );

//         return;
//       }

//       const name =
//         destinationName.trim();

//       if (!name) {
//         alert(
//           "Enter destination name."
//         );

//         return;
//       }

//       const position =
//         getCurrentMapPosition();

//       if (!position) {
//         alert(
//           "Current map position is not available."
//         );

//         return;
//       }

//       const destination: Destination = {
//         id: createId(name),

//         name,

//         position,
//       };

//       console.log(
//         "DESTINATION CAPTURED:",
//         destination
//       );

//       setDestinations(
//         (previous) => {
//           const existingIndex =
//             previous.findIndex(
//               (item) =>
//                 item.id ===
//                 destination.id
//             );

//           // Update existing destination
//           if (
//             existingIndex !== -1
//           ) {
//             const updated = [
//               ...previous,
//             ];

//             updated[
//               existingIndex
//             ] = destination;

//             return updated;
//           }

//           // Add new destination
//           return [
//             ...previous,
//             destination,
//           ];
//         }
//       );

//       setDestinationName("");
//     }, [
//       localized,
//       destinationName,
//       getCurrentMapPosition,
//       createId,
//     ]);

//   // =========================================================
//   // DELETE
//   // =========================================================

//   const deleteDestination =
//     useCallback(
//       (id: string) => {
//         setDestinations(
//           (previous) =>
//             previous.filter(
//               (item) =>
//                 item.id !== id
//             )
//         );
//       },
//       []
//     );

//   // =========================================================
//   // COPY JSON / CODE
//   // =========================================================

//   const copyCode =
//     useCallback(async () => {
//       try {
//         await navigator.clipboard.writeText(
//           generatedCode
//         );

//         alert(
//           "DESTINATIONS code copied."
//         );
//       } catch (error) {
//         console.error(
//           "Clipboard error:",
//           error
//         );

//         alert(
//           "Unable to copy. Please copy manually."
//         );
//       }
//     }, [generatedCode]);

//   // =========================================================
//   // INITIALIZE MULTISET
//   // =========================================================

//   useEffect(() => {
//     let disposed = false;

//     let resizeHandler:
//       | (() => void)
//       | null = null;

//     const initialize =
//       async () => {
//         try {
//           // -----------------------------------------------------
//           // CONTAINER
//           // -----------------------------------------------------

//           if (!containerRef.current) {
//             return;
//           }

//           // -----------------------------------------------------
//           // ENVIRONMENT
//           // -----------------------------------------------------

//           if (
//             !CLIENT_ID ||
//             !CLIENT_SECRET ||
//             !MAP_CODE
//           ) {
//             setStatus(
//               "Missing MultiSet environment variables."
//             );

//             return;
//           }

//           // -----------------------------------------------------
//           // WEBXR SUPPORT
//           // -----------------------------------------------------

//           setStatus(
//             "Checking WebXR support..."
//           );

//           const supported =
//             await ThreeAdapter.isSupported();

//           if (!supported) {
//             throw new Error(
//               "WebXR immersive AR is not supported on this device."
//             );
//           }

//           if (disposed) {
//             return;
//           }

//           // =====================================================
//           // RENDERER
//           // =====================================================

//           setStatus(
//             "Creating Three.js scene..."
//           );

//           const renderer =
//             new THREE.WebGLRenderer({
//               antialias: true,
//               alpha: true,
//             });

//           renderer.setPixelRatio(
//             Math.min(
//               window.devicePixelRatio,
//               2
//             )
//           );

//           renderer.setSize(
//             window.innerWidth,
//             window.innerHeight
//           );

//           // IMPORTANT
//           // Same as the working Kokarya page.
//           renderer.xr.enabled = true;

//           renderer.domElement.style.position =
//             "fixed";

//           renderer.domElement.style.left =
//             "0";

//           renderer.domElement.style.top =
//             "0";

//           renderer.domElement.style.width =
//             "100%";

//           renderer.domElement.style.height =
//             "100%";

//           renderer.domElement.style.zIndex =
//             "0";

//           containerRef.current.appendChild(
//             renderer.domElement
//           );

//           rendererRef.current =
//             renderer;

//           // =====================================================
//           // SCENE
//           // =====================================================

//           const scene =
//             new THREE.Scene();

//           // VERY IMPORTANT
//           // Do not give the scene a black background.
//           scene.background = null;

//           sceneRef.current =
//             scene;

//           // =====================================================
//           // CAMERA
//           // =====================================================

//           const camera =
//             new THREE.PerspectiveCamera(
//               70,

//               window.innerWidth /
//                 window.innerHeight,

//               0.01,

//               1000
//             );

//           scene.add(camera);

//           cameraRef.current =
//             camera;

//           // =====================================================
//           // LIGHT
//           // =====================================================

//           scene.add(
//             new THREE.AmbientLight(
//               0xffffff,
//               1
//             )
//           );

//           // =====================================================
//           // MULTISET CLIENT
//           // =====================================================

//           setStatus(
//             "Authorizing MultiSet..."
//           );

//           const client =
//             new MultisetClient({
//               clientId:
//                 CLIENT_ID,

//               clientSecret:
//                 CLIENT_SECRET,

//               mapType: "map",

//               code: MAP_CODE,
//             });

//           await client.authorize();

//           if (disposed) {
//             return;
//           }

//           console.log(
//             "MultiSet authorized"
//           );

//           // =====================================================
//           // XR SESSION
//           // =====================================================

//           setStatus(
//             "Starting MultiSet AR..."
//           );

//           const session =
//             new XRSessionManager(
//               renderer.getContext() as WebGL2RenderingContext,
//               {
//                 client,

//                 autoLocalize: true,

//                 confidenceCheck: true,

//                 onLocalizationSuccess:
//                   undefined,

//                 onLocalizationFailure:
//                   (reason) => {
//                     console.warn(
//                       "Localization failed:",
//                       reason
//                     );

//                     setLocalized(false);

//                     setStatus(
//                       "Localization failed — move camera around"
//                     );
//                   },

//                 onError:
//                   (error) => {
//                     console.error(
//                       "MultiSet session error:",
//                       error
//                     );

//                     setError(
//                       error instanceof Error
//                         ? error.message
//                         : String(error)
//                     );

//                     setStatus(
//                       "MultiSet error"
//                     );
//                   },
//               }
//             );

//           sessionRef.current =
//             session;

//           // =====================================================
//           // THREE ADAPTER
//           // =====================================================

//           const adapter =
//             new ThreeAdapter({
//               session,

//               renderer,

//               scene,

//               camera,

//               // IMPORTANT
//               showMesh: false,

//               showGizmo: false,

//               // IMPORTANT
//               // Let MultiSet create the AR button.
//               useDefaultButton: true,

//               // =================================================
//               // LOCALIZATION SUCCESS
//               // =================================================

//               onLocalizationSuccess:
//                 (
//                   result,
//                   worldFromMap
//                 ) => {
//                   if (disposed) {
//                     return;
//                   }

//                   console.log(
//                     "================================"
//                   );

//                   console.log(
//                     "MULTISET LOCALIZED"
//                   );

//                   console.log(
//                     "Result:",
//                     result
//                   );

//                   console.log(
//                     "worldFromMap:",
//                     worldFromMap
//                   );

//                   console.log(
//                     "================================"
//                   );

//                   // MAP -> WORLD
//                   worldFromMapRef.current =
//                     worldFromMap.clone();

//                   setLocalized(true);

//                   setStatus(
//                     "Localized — walk to destination"
//                   );
//                 },

//               // =================================================
//               // XR FRAME
//               // =================================================

//               onXRFrame:
//                 () => {
//                   if (disposed) {
//                     return;
//                   }

//                   if (
//                     !worldFromMapRef.current
//                   ) {
//                     return;
//                   }

//                   // ---------------------------------------------
//                   // CAMERA WORLD POSITION
//                   // ---------------------------------------------

//                   const worldPosition =
//                     new THREE.Vector3();

//                   camera.getWorldPosition(
//                     worldPosition
//                   );

//                   // ---------------------------------------------
//                   // WORLD -> MAP
//                   // ---------------------------------------------

//                   const mapFromWorld =
//                     worldFromMapRef.current
//                       .clone()
//                       .invert();

//                   const mapPosition =
//                     worldPosition
//                       .clone()
//                       .applyMatrix4(
//                         mapFromWorld
//                       );

//                   // ---------------------------------------------
//                   // STORE
//                   // ---------------------------------------------

//                   currentMapPositionRef.current =
//                     mapPosition;

//                   // ---------------------------------------------
//                   // UI UPDATE
//                   // ---------------------------------------------

//                   const now =
//                     performance.now();

//                   if (
//                     now -
//                       lastUiUpdateRef.current <
//                     100
//                   ) {
//                     return;
//                   }

//                   lastUiUpdateRef.current =
//                     now;

//                   setCurrentPosition({
//                     x: Number(
//                       mapPosition.x.toFixed(
//                         3
//                       )
//                     ),

//                     y: Number(
//                       mapPosition.y.toFixed(
//                         3
//                       )
//                     ),

//                     z: Number(
//                       mapPosition.z.toFixed(
//                         3
//                       )
//                     ),
//                   });
//                 },
//             });

//           adapterRef.current =
//             adapter;

//           // =====================================================
//           // START ADAPTER
//           // =====================================================

//           /**
//            * IMPORTANT
//            *
//            * This is the same initialization
//            * used by the working page.
//            */
//           await adapter.initialize();

//           if (disposed) {
//             return;
//           }

//           setStatus(
//             "Ready — press START AR"
//           );

//           console.log(
//             "Destination Capture ready"
//           );

//           // =====================================================
//           // RESIZE
//           // =====================================================

//           resizeHandler =
//             () => {
//               if (
//                 !rendererRef.current ||
//                 !cameraRef.current
//               ) {
//                 return;
//               }

//               const width =
//                 window.innerWidth;

//               const height =
//                 window.innerHeight;

//               cameraRef.current.aspect =
//                 width / height;

//               cameraRef.current.updateProjectionMatrix();

//               rendererRef.current.setSize(
//                 width,
//                 height
//               );
//             };

//           window.addEventListener(
//             "resize",
//             resizeHandler
//           );
//         } catch (error) {
//           console.error(
//             "Destination Capture initialization error:",
//             error
//           );

//           setError(
//             error instanceof Error
//               ? error.message
//               : String(error)
//           );

//           setStatus(
//             "Initialization failed"
//           );
//         }
//       };

//     initialize();

//     // =========================================================
//     // CLEANUP
//     // =========================================================

//     return () => {
//       disposed = true;

//       if (resizeHandler) {
//         window.removeEventListener(
//           "resize",
//           resizeHandler
//         );
//       }

//       try {
//         adapterRef.current?.dispose();
//       } catch {}

//       try {
//         if (
//           rendererRef.current
//             ?.domElement
//             .parentElement
//         ) {
//           rendererRef.current
//             .domElement
//             .parentElement
//             .removeChild(
//               rendererRef.current
//                 .domElement
//             );
//         }
//       } catch {}

//       try {
//         rendererRef.current?.dispose();
//       } catch {}

//       rendererRef.current = null;

//       sceneRef.current = null;

//       cameraRef.current = null;

//       adapterRef.current = null;

//       sessionRef.current = null;

//       worldFromMapRef.current =
//         null;

//       currentMapPositionRef.current =
//         null;
//     };
//   }, []);

//   // =========================================================
//   // UI
//   // =========================================================

//   return (
//     <main
//       style={{
//         position: "fixed",
//         inset: 0,
//         overflow: "hidden",

//         // UI background only.
//         // AR canvas is above/below independently.
//         background: "#000",

//         fontFamily:
//           "Arial, sans-serif",
//       }}
//     >
//       {/* =====================================================
//           AR CANVAS
//       ====================================================== */}

//       <div
//         ref={containerRef}
//         style={{
//           position: "fixed",
//           inset: 0,

//           width: "100%",
//           height: "100%",

//           zIndex: 0,

//           pointerEvents:
//             "auto",
//         }}
//       />

//       {/* =====================================================
//           TOP STATUS
//       ====================================================== */}

//       <div
//         style={{
//           position: "absolute",

//           top: 20,
//           left: 20,
//           right: 20,

//           zIndex: 10,

//           padding: 18,

//           borderRadius: 18,

//           background:
//             "rgba(20,20,24,0.92)",

//           backdropFilter:
//             "blur(18px)",

//           color: "#fff",

//           pointerEvents:
//             "none",
//         }}
//       >
//         <div
//           style={{
//             fontSize: 24,
//             fontWeight: 700,
//             marginBottom: 10,
//           }}
//         >
//           Destination Capture
//         </div>

//         <div
//           style={{
//             fontSize: 16,
//             color: "#ccc",
//           }}
//         >
//           {status}
//         </div>

//         {error && (
//           <div
//             style={{
//               marginTop: 10,
//               color: "#ff7070",
//               fontSize: 13,
//             }}
//           >
//             {error}
//           </div>
//         )}

//         <div
//           style={{
//             marginTop: 12,

//             color: localized
//               ? "#65f2a1"
//               : "#aaa",

//             fontSize: 15,

//             fontWeight: 600,
//           }}
//         >
//           {localized
//             ? "● Localized"
//             : "○ Waiting for localization"}
//         </div>
//       </div>

//       {/* =====================================================
//           BOTTOM PANEL
//       ====================================================== */}

//       <div
//         style={{
//           position: "absolute",

//           left: 20,
//           right: 20,
//           bottom: 20,

//           zIndex: 10,

//           maxHeight:
//             "50vh",

//           overflowY: "auto",

//           padding: 18,

//           borderRadius: 20,

//           background:
//             "rgba(15,15,18,0.94)",

//           backdropFilter:
//             "blur(20px)",

//           color: "#fff",
//         }}
//       >
//         {/* ===================================================
//             CURRENT POSITION
//         ==================================================== */}

//         <div
//           style={{
//             marginBottom: 18,
//           }}
//         >
//           <div
//             style={{
//               fontSize: 11,
//               fontWeight: 700,
//               letterSpacing: 1,
//               color: "#777",
//               marginBottom: 8,
//             }}
//           >
//             CURRENT MAP POSITION
//           </div>

//           {currentPosition ? (
//             <div
//               style={{
//                 display: "flex",
//                 gap: 20,
//                 fontFamily:
//                   "monospace",
//                 fontSize: 14,
//               }}
//             >
//               <span>
//                 X: {currentPosition.x}
//               </span>

//               <span>
//                 Y: {currentPosition.y}
//               </span>

//               <span>
//                 Z: {currentPosition.z}
//               </span>
//             </div>
//           ) : (
//             <div
//               style={{
//                 color: "#777",
//                 fontSize: 13,
//               }}
//             >
//               Start AR and localize
//               first.
//             </div>
//           )}
//         </div>

//         {/* ===================================================
//             INPUT
//         ==================================================== */}

//         <div
//           style={{
//             display: "flex",
//             gap: 8,
//             marginBottom: 16,
//           }}
//         >
//           <input
//             value={destinationName}
//             onChange={(event) =>
//               setDestinationName(
//                 event.target.value
//               )
//             }
//             onKeyDown={(event) => {
//               if (
//                 event.key === "Enter"
//               ) {
//                 captureDestination();
//               }
//             }}
//             placeholder="Destination name"
//             disabled={!localized}
//             style={{
//               flex: 1,
//               minWidth: 0,

//               padding:
//                 "13px 14px",

//               border:
//                 "1px solid #444",

//               borderRadius: 11,

//               background: "#111",

//               color: "#fff",

//               outline: "none",

//               fontSize: 14,
//             }}
//           />

//           <button
//             type="button"
//             onClick={
//               captureDestination
//             }
//             disabled={!localized}
//             style={{
//               border: "none",

//               borderRadius: 11,

//               padding:
//                 "13px 16px",

//               background:
//                 localized
//                   ? "#00bfff"
//                   : "#444",

//               color: "#fff",

//               fontWeight: 700,

//               cursor:
//                 localized
//                   ? "pointer"
//                   : "not-allowed",

//               whiteSpace:
//                 "nowrap",
//             }}
//           >
//             Capture
//           </button>
//         </div>

//         {/* ===================================================
//             DESTINATIONS
//         ==================================================== */}

//         {destinations.length >
//           0 && (
//           <>
//             <div
//               style={{
//                 marginBottom: 10,

//                 fontSize: 14,

//                 fontWeight: 700,
//               }}
//             >
//               Destinations (
//               {destinations.length})
//             </div>

//             {destinations.map(
//               (destination) => (
//                 <div
//                   key={
//                     destination.id
//                   }
//                   style={{
//                     display: "flex",

//                     justifyContent:
//                       "space-between",

//                     alignItems:
//                       "center",

//                     gap: 10,

//                     padding: 12,

//                     marginBottom: 7,

//                     borderRadius: 11,

//                     background: "#111",
//                   }}
//                 >
//                   <div>
//                     <div
//                       style={{
//                         fontWeight: 700,
//                         fontSize: 14,
//                       }}
//                     >
//                       {
//                         destination.name
//                       }
//                     </div>

//                     <div
//                       style={{
//                         marginTop: 5,

//                         fontFamily:
//                           "monospace",

//                         fontSize: 11,

//                         color: "#888",
//                       }}
//                     >
//                       X{" "}
//                       {
//                         destination
//                           .position
//                           .x
//                       }{" "}
//                       Y{" "}
//                       {
//                         destination
//                           .position
//                           .y
//                       }{" "}
//                       Z{" "}
//                       {
//                         destination
//                           .position
//                           .z
//                       }
//                     </div>
//                   </div>

//                   <button
//                     type="button"
//                     onClick={() =>
//                       deleteDestination(
//                         destination.id
//                       )
//                     }
//                     style={{
//                       border: "none",

//                       background:
//                         "transparent",

//                       color:
//                         "#ff7070",

//                       cursor:
//                         "pointer",
//                     }}
//                   >
//                     Delete
//                   </button>
//                 </div>
//               )
//             )}

//             {/* =================================================
//                 GENERATED CODE
//             ================================================== */}

//             <div
//               style={{
//                 marginTop: 18,
//               }}
//             >
//               <div
//                 style={{
//                   display: "flex",

//                   justifyContent:
//                     "space-between",

//                   alignItems:
//                     "center",

//                   marginBottom: 8,
//                 }}
//               >
//                 <div
//                   style={{
//                     fontSize: 14,
//                     fontWeight: 700,
//                   }}
//                 >
//                   Generated DESTINATIONS
//                 </div>

//                 <button
//                   type="button"
//                   onClick={copyCode}
//                   style={{
//                     border: "none",

//                     borderRadius: 9,

//                     padding:
//                       "8px 12px",

//                     background:
//                       "#00bfff",

//                     color: "#fff",

//                     fontWeight: 700,

//                     cursor:
//                       "pointer",
//                   }}
//                 >
//                   Copy
//                 </button>
//               </div>

//               <pre
//                 style={{
//                   margin: 0,

//                   padding: 14,

//                   borderRadius: 10,

//                   background:
//                     "#050505",

//                   color: "#9ff",

//                   fontFamily:
//                     "monospace",

//                   fontSize: 11,

//                   lineHeight: 1.5,

//                   overflowX:
//                     "auto",

//                   whiteSpace:
//                     "pre",
//                 }}
//               >
//                 {generatedCode}
//               </pre>
//             </div>
//           </>
//         )}
//       </div>
//     </main>
//   );
// }
'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import {
  MultisetClient,
  XRSessionManager,
} from '@multisetai/vps/core'

import {
  ThreeAdapter,
  MapSpace,
} from '@multisetai/vps/three'

import {
  Navigation,
  NavMeshPathfinder,
  buildPathRibbon,
} from '@multisetai/vps/navigation'

type Destination = {
  id: string
  name: string
  position: THREE.Vector3
}

const DESTINATIONS: Destination[] = [

  {
    id: 'entrance',
    name: 'Entrance',
    position: new THREE.Vector3(
      -0.149,
      -0.543,
      1.201
    ),
  },

  {
    id: 'pantry',
    name: 'Pantry',
    position: new THREE.Vector3(
      0.607,
      -0.493,
      6.68
    ),
  },

  {
    id: 'cabin-1',
    name: 'Cabin 1',
    position: new THREE.Vector3(
      4.758,
      -0.47,
      1.897
    ),
  },

  {
    id: 'cabin-2',
    name: 'Cabin 2',
    position: new THREE.Vector3(
      8.962,
      -0.488,
      1.736
    ),
  },

  {
    id: 'meeting-room',
    name: 'Meeting room',
    position: new THREE.Vector3(
      11.588,
      -0.468,
      1.757
    ),
  }

];

export default function KokaryaFullMapPage() {
  const containerRef =
    useRef<HTMLDivElement | null>(null)

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null)

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const mapSpaceRef =
    useRef<MapSpace | null>(null)

  const pathfinderRef =
    useRef<NavMeshPathfinder | null>(null)

  const navigationRef =
    useRef<Navigation | null>(null)

  const pathMeshRef =
    useRef<THREE.Mesh | null>(null)

  const [status, setStatus] =
    useState('Initializing...')

  const [localized, setLocalized] =
    useState(false)

  const [groupCount, setGroupCount] =
    useState<number | null>(null)

  const [distance, setDistance] =
    useState<number | null>(null)

  const [selectedDestination, setSelectedDestination] =
    useState('')

  const [pathVisible, setPathVisible] =
    useState(false)

  const [error, setError] =
    useState('')

  useEffect(() => {
    let disposed = false

    let renderer:
      THREE.WebGLRenderer | null = null

    let scene:
      THREE.Scene | null = null

    let camera:
      THREE.PerspectiveCamera | null = null

    let adapter:
      ThreeAdapter | null = null

    let mapSpace:
      MapSpace | null = null

    let pathfinder:
      NavMeshPathfinder | null = null

    let navigation:
      Navigation | null = null

    let resizeHandler:
      (() => void) | null = null

    // =========================================================
    // MAIN INITIALIZATION
    // =========================================================

    const init = async () => {
      try {
        // -----------------------------------------------------
        // 1. CONTAINER
        // -----------------------------------------------------

        if (!containerRef.current) {
          throw new Error(
            'AR container not available.'
          )
        }

        // -----------------------------------------------------
        // 2. WEBXR SUPPORT
        // -----------------------------------------------------

        setStatus(
          'Checking WebXR support...'
        )

        const supported =
          await ThreeAdapter.isSupported()

        if (!supported) {
          throw new Error(
            'WebXR immersive AR is not supported on this device.'
          )
        }

        if (disposed) return

        // -----------------------------------------------------
        // 3. ENVIRONMENT VARIABLES
        // -----------------------------------------------------

        const clientId =
          process.env
            .NEXT_PUBLIC_MULTISET_CLIENT_ID

        const clientSecret =
          process.env
            .NEXT_PUBLIC_MULTISET_CLIENT_SECRET

        const mapCode =
          process.env
            .NEXT_PUBLIC_MULTISET_MAP_CODE

        if (
          !clientId ||
          !clientSecret ||
          !mapCode
        ) {
          throw new Error(
            'Missing MultiSet environment variables.'
          )
        }

        // -----------------------------------------------------
        // 4. MULTISET CLIENT
        // -----------------------------------------------------

        setStatus(
          'Connecting to MultiSet...'
        )

        const client =
          new MultisetClient({
            clientId,
            clientSecret,
            mapType: 'map',
            code: mapCode,
          })

        await client.authorize()

        if (disposed) return

        console.log(
          '[Kokarya] MultiSet authorized'
        )

        // -----------------------------------------------------
        // 5. THREE RENDERER
        // -----------------------------------------------------

        renderer =
          new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
          })

        renderer.setPixelRatio(
          Math.min(
            window.devicePixelRatio,
            2
          )
        )

        renderer.setSize(
          window.innerWidth,
          window.innerHeight
        )

        renderer.xr.enabled = true

        /*
         * IMPORTANT:
         *
         * Transparent canvas allows
         * the real camera feed to show.
         */

        renderer.setClearColor(
          0x000000,
          0
        )

        renderer.domElement.style.position =
          'fixed'

        renderer.domElement.style.left =
          '0'

        renderer.domElement.style.top =
          '0'

        renderer.domElement.style.width =
          '100%'

        renderer.domElement.style.height =
          '100%'

        renderer.domElement.style.zIndex =
          '0'

        containerRef.current.appendChild(
          renderer.domElement
        )

        rendererRef.current =
          renderer

        // -----------------------------------------------------
        // 6. SCENE
        // -----------------------------------------------------

        scene =
          new THREE.Scene()

        scene.background = null

        // -----------------------------------------------------
        // 7. CAMERA
        // -----------------------------------------------------

        camera =
          new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
              window.innerHeight,
            0.01,
            1000
          )

        scene.add(camera)

        // -----------------------------------------------------
        // 8. LIGHT
        // -----------------------------------------------------

        scene.add(
          new THREE.AmbientLight(
            0xffffff,
            1
          )
        )

        // -----------------------------------------------------
        // 9. MAP SPACE
        // -----------------------------------------------------

        mapSpace =
          new MapSpace(
            new THREE.Object3D()
          )

        mapSpaceRef.current =
          mapSpace

        scene.add(
          mapSpace.object
        )

        console.log(
          '[Kokarya] MapSpace created'
        )

        // -----------------------------------------------------
        // 10. LOAD NAVMESH GLB
        // -----------------------------------------------------

        setStatus(
          'Loading NavMesh...'
        )

        const loader =
          new GLTFLoader()

        /*
         * CHANGE THIS ONLY IF YOUR FILE
         * HAS A DIFFERENT NAME.
         */

        const gltf =
          await loader.loadAsync(
            '/navigation/kokarya-nav-mesh.glb'
          )

        if (disposed) return

        const navMesh =
          gltf.scene

        /*
         * NavMesh belongs under MapSpace.
         */

        mapSpace.object.add(
          navMesh
        )

        /*
         * VERY IMPORTANT:
         *
         * Do NOT display the raw NavMesh.
         *
         * The black polygons you previously
         * saw were this geometry.
         */

        navMesh.visible = false

        // -----------------------------------------------------
        // 11. DEBUG NAVMESH BOUNDS
        // -----------------------------------------------------

        const bounds =
          new THREE.Box3().setFromObject(
            navMesh
          )

        const center =
          bounds.getCenter(
            new THREE.Vector3()
          )

        const size =
          bounds.getSize(
            new THREE.Vector3()
          )

        console.log(
          '[Kokarya] NavMesh center:',
          center
        )

        console.log(
          '[Kokarya] NavMesh size:',
          size
        )

        console.log(
          '[Kokarya] NavMesh min:',
          bounds.min
        )

        console.log(
          '[Kokarya] NavMesh max:',
          bounds.max
        )

        // -----------------------------------------------------
        // 12. NAVMESH PATHFINDER
        // -----------------------------------------------------

        setStatus(
          'Creating NavMesh Pathfinder...'
        )

        pathfinder =
          await NavMeshPathfinder.fromObject3D(
            navMesh,
            {
              space:
                mapSpace.object,
            }
          )

        if (disposed) return

        pathfinderRef.current =
          pathfinder

        setGroupCount(
          pathfinder.groupCount
        )

        console.log(
          '[Kokarya] NavMesh groups:',
          pathfinder.groupCount
        )

        // -----------------------------------------------------
        // 13. XR SESSION
        // -----------------------------------------------------

        setStatus(
          'Creating AR session...'
        )

        const session =
          new XRSessionManager(
            renderer.getContext() as WebGL2RenderingContext,
            {
              client,

              autoLocalize: true,

              onLocalizationFailure:
                (reason) => {
                  console.warn(
                    '[Kokarya] Localization failed:',
                    reason
                  )

                  setStatus(
                    'Localization failed'
                  )
                },

              onError:
                (sessionError) => {
                  console.error(
                    '[Kokarya] XR error:',
                    sessionError
                  )

                  setError(
                    sessionError instanceof
                      Error
                      ? sessionError.message
                      : String(sessionError)
                  )
                },
            }
          )

        // -----------------------------------------------------
        // 14. PATH MATERIAL
        // -----------------------------------------------------

        const pathMaterial =
          new THREE.MeshBasicMaterial({
            color: 0x00d9ff,

            transparent: true,

            opacity: 0.9,

            side:
              THREE.DoubleSide,

            depthWrite: false,
          })

        // -----------------------------------------------------
        // 15. PATH MESH
        // -----------------------------------------------------

        const pathMesh =
          new THREE.Mesh(
            new THREE.BufferGeometry(),
            pathMaterial
          )

        pathMesh.frustumCulled =
          false

        pathMesh.visible =
          false

        mapSpace.object.add(
          pathMesh
        )

        pathMeshRef.current =
          pathMesh

        // -----------------------------------------------------
        // 16. THREE ADAPTER
        // -----------------------------------------------------

        adapter =
          new ThreeAdapter({
            session,

            renderer,

            scene,

            camera,

            /*
             * We don't want MultiSet's
             * map mesh covering our AR view.
             */

            showMesh: false,

            showGizmo: false,

            onLocalizationSuccess:
              (
                result,
                worldFromMap
              ) => {
                console.log(
                  '================================'
                )

                console.log(
                  '[Kokarya] LOCALIZED'
                )

                console.log(
                  '[Kokarya] Confidence:',
                  result.localizeData.confidence
                )

                console.log(
                  '[Kokarya] worldFromMap:',
                  worldFromMap
                )

                console.log(
                  '================================'
                )

                setLocalized(
                  true
                )

                setStatus(
                  'Localized successfully!'
                )

                /*
                 * IMPORTANT:
                 *
                 * We do NOT automatically
                 * start navigation here.
                 *
                 * The user selects a destination
                 * from the UI.
                 */
              },
          })

        adapterRef.current =
          adapter

        // -----------------------------------------------------
        // 17. CONNECT MAP SPACE
        // -----------------------------------------------------

        mapSpace.connect(
          adapter
        )

        console.log(
          '[Kokarya] MapSpace connected'
        )

        // -----------------------------------------------------
        // 18. CREATE NAVIGATION
        // -----------------------------------------------------

        setStatus(
          'Creating navigation...'
        )

        navigation =
          await Navigation.create({
            adapter,

            mapSpace,

            pathfinder,

            pois:
              DESTINATIONS,
          })

        if (disposed) return

        navigationRef.current =
          navigation

        console.log(
          '[Kokarya] Navigation created'
        )

        // -----------------------------------------------------
        // 19. PATH UPDATED
        // -----------------------------------------------------

        navigation.on(
          'pathUpdated',
          ({
            corners,
            remainingDistance,
          }) => {
            console.log(
              '================================'
            )

            console.log(
              '[Kokarya] PATH UPDATED'
            )

            console.log(
              '[Kokarya] Corner count:',
              corners.length
            )

            console.log(
              '[Kokarya] Corners:',
              corners
            )

            console.log(
              '[Kokarya] Remaining distance:',
              remainingDistance
            )

            console.log(
              '================================'
            )

            setDistance(
              remainingDistance
            )

            if (
              corners.length < 2
            ) {
              pathMesh.visible =
                false

              setPathVisible(
                false
              )

              return
            }

            // Dispose previous geometry.
            pathMesh.geometry.dispose()

            /*
             * Generate visible navigation ribbon.
             */

            pathMesh.geometry =
              buildPathRibbon(
                corners,
                {
                  width:
                    0.35,

                  heightAboveFloor:
                    0.15,

                  cornerRadius:
                    0.4,

                  cornerSegments:
                    4,
                }
              )

            pathMesh.visible =
              true

            setPathVisible(
              true
            )

            console.log(
              '[Kokarya] CYAN PATH RENDERED'
            )
          }
        )

        // -----------------------------------------------------
        // 20. ARRIVED
        // -----------------------------------------------------

        navigation.on(
          'arrived',
          (poi) => {
            console.log(
              '[Kokarya] ARRIVED:',
              poi.name
            )

            setStatus(
              `Arrived at ${poi.name}`
            )

            setDistance(
              0
            )

            pathMesh.visible =
              false

            setPathVisible(
              false
            )
          }
        )

        // -----------------------------------------------------
        // 21. UNREACHABLE
        // -----------------------------------------------------

        navigation.on(
          'unreachable',
          (poi) => {
            console.warn(
              '[Kokarya] UNREACHABLE:',
              poi.name
            )

            setStatus(
              `No route to ${poi.name}`
            )

            pathMesh.visible =
              false

            setPathVisible(
              false
            )
          }
        )

        // -----------------------------------------------------
        // 22. INITIALIZE ADAPTER
        // -----------------------------------------------------

        await adapter.initialize()

        if (disposed) return

        setStatus(
          'Ready — tap START AR'
        )

        console.log(
          '[Kokarya] Ready'
        )

        // -----------------------------------------------------
        // 23. RESIZE
        // -----------------------------------------------------

        resizeHandler =
          () => {
            if (
              !renderer ||
              !camera
            ) {
              return
            }

            camera.aspect =
              window.innerWidth /
              window.innerHeight

            camera.updateProjectionMatrix()

            renderer.setSize(
              window.innerWidth,
              window.innerHeight
            )
          }

        window.addEventListener(
          'resize',
          resizeHandler
        )

      } catch (err) {
        console.error(
          '[Kokarya] Initialization error:',
          err
        )

        setError(
          err instanceof Error
            ? err.message
            : String(err)
        )

        setStatus(
          'Initialization failed'
        )
      }
    }

    init()

    // =========================================================
    // CLEANUP
    // =========================================================

    return () => {
      disposed = true

      if (resizeHandler) {
        window.removeEventListener(
          'resize',
          resizeHandler
        )
      }

      try {
        adapter?.dispose()
      } catch {}

      try {
        pathfinder?.dispose()
      } catch {}

      try {
        mapSpace?.dispose()
      } catch {}

      if (pathMeshRef.current) {
        pathMeshRef.current.geometry.dispose()

        const material =
          pathMeshRef.current.material

        if (
          material instanceof
          THREE.Material
        ) {
          material.dispose()
        }
      }

      if (
        renderer &&
        renderer.domElement.parentElement
      ) {
        renderer.domElement.parentElement.removeChild(
          renderer.domElement
        )
      }

      renderer?.dispose()

      navigationRef.current =
        null

      pathfinderRef.current =
        null

      mapSpaceRef.current =
        null

      adapterRef.current =
        null

      rendererRef.current =
        null
    }
  }, [])

  // =========================================================
  // START NAVIGATION
  // =========================================================

  const startNavigation = (
    destination: Destination
  ) => {
    const navigation =
      navigationRef.current

    if (!navigation) {
      console.warn(
        '[Kokarya] Navigation not ready'
      )

      return
    }

    if (!localized) {
      setStatus(
        'Please localize first'
      )

      return
    }

    console.log(
      '[Kokarya] Starting navigation to:',
      destination.name
    )

    console.log(
      '[Kokarya] Destination coordinate:',
      destination.position
    )

    setSelectedDestination(
      destination.id
    )

    setStatus(
      `Navigating to ${destination.name}...`
    )

    /*
     * This is the actual MultiSet
     * navigation call.
     */

    navigation.setDestination(
      destination.id
    )
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      {/* ===================================================
          THREE.JS
      =================================================== */}

      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* ===================================================
          TOP STATUS
      =================================================== */}

      <div
        style={{
          position: 'fixed',

          top: 16,
          left: 16,
          right: 16,

          zIndex: 20,

          padding:
            '16px 18px',

          borderRadius: 20,

          background:
            'rgba(20,20,24,0.84)',

          backdropFilter:
            'blur(16px)',

          WebkitBackdropFilter:
            'blur(16px)',

          color: '#fff',

          fontFamily:
            'Arial, sans-serif',

          pointerEvents:
            'none',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          Kokarya Full Map
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 15,
          }}
        >
          {status}
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            opacity: 0.7,
          }}
        >
          NavMesh groups:{' '}
          {groupCount ??
            'loading...'}
        </div>

        <div
          style={{
            marginTop: 5,
            fontSize: 13,
            color:
              localized
                ? '#75ffae'
                : '#ffd866',
          }}
        >
          ●{' '}
          {localized
            ? 'Localized'
            : 'Not localized'}
        </div>

        {distance !== null && (
          <div
            style={{
              marginTop: 5,
              fontSize: 13,
              opacity: 0.75,
            }}
          >
            Distance:{' '}
            {distance.toFixed(1)} m
          </div>
        )}

        {pathVisible && (
          <div
            style={{
              marginTop: 5,
              fontSize: 13,
              color: '#00d9ff',
            }}
          >
            ● Navigation path active
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: 8,
              borderRadius: 8,
              background:
                'rgba(255,0,0,0.15)',
              color: '#ff9b9b',
              fontSize: 12,
              wordBreak:
                'break-word',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* ===================================================
          DESTINATION LIST
      =================================================== */}

      <div
        style={{
          position: 'fixed',

          left: 16,
          right: 16,
          bottom: 24,

          zIndex: 20,

          display: 'flex',

          gap: 8,

          overflowX: 'auto',

          padding:
            '8px 2px',

          pointerEvents:
            'auto',
        }}
      >
        {DESTINATIONS.map(
          (destination) => (
            <button
              key={
                destination.id
              }
              type="button"
              disabled={!localized}
              onClick={() =>
                startNavigation(
                  destination
                )
              }
              style={{
                flexShrink: 0,

                padding:
                  '12px 16px',

                borderRadius: 14,

                border:
                  selectedDestination ===
                  destination.id
                    ? '2px solid #00d9ff'
                    : '1px solid rgba(255,255,255,0.3)',

                background:
                  selectedDestination ===
                  destination.id
                    ? 'rgba(0,217,255,0.2)'
                    : 'rgba(20,20,24,0.85)',

                color: '#fff',

                fontSize: 14,

                cursor:
                  localized
                    ? 'pointer'
                    : 'not-allowed',

                opacity:
                  localized
                    ? 1
                    : 0.5,

                backdropFilter:
                  'blur(12px)',

                WebkitBackdropFilter:
                  'blur(12px)',
              }}
            >
              {destination.name}
            </button>
          )
        )}
      </div>
    </main>
  )
}