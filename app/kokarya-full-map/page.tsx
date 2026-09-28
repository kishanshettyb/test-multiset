// 'use client'

// import { useEffect, useRef, useState } from 'react'
// import * as THREE from 'three'
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// import {
//   MultisetClient,
//   XRSessionManager,
// } from '@multisetai/vps/core'

// import {
//   ThreeAdapter,
//   MapSpace,
// } from '@multisetai/vps/three'

// import {
//   Navigation,
//   NavMeshPathfinder,
//   buildPathRibbon,
// } from '@multisetai/vps/navigation'

// type Destination = {
//   id: string
//   name: string
//   position: THREE.Vector3
// }

// const DESTINATIONS: Destination[] = [

//   {
//     id: 'entrance',
//     name: 'Entrance',
//     position: new THREE.Vector3(
//       -0.149,
//       -0.543,
//       1.201
//     ),
//   },

//   {
//     id: 'pantry',
//     name: 'Pantry',
//     position: new THREE.Vector3(
//       0.607,
//       -0.493,
//       6.68
//     ),
//   },

//   {
//     id: 'cabin-1',
//     name: 'Cabin 1',
//     position: new THREE.Vector3(
//       4.758,
//       -0.47,
//       1.897
//     ),
//   },

//   {
//     id: 'cabin-2',
//     name: 'Cabin 2',
//     position: new THREE.Vector3(
//       8.962,
//       -0.488,
//       1.736
//     ),
//   },

//   {
//     id: 'meeting-room',
//     name: 'Meeting room',
//     position: new THREE.Vector3(
//       11.588,
//       -0.468,
//       1.757
//     ),
//   }

// ];

// export default function KokaryaFullMapPage() {
//   const containerRef =
//     useRef<HTMLDivElement | null>(null)

//   const rendererRef =
//     useRef<THREE.WebGLRenderer | null>(null)

//   const adapterRef =
//     useRef<ThreeAdapter | null>(null)

//   const mapSpaceRef =
//     useRef<MapSpace | null>(null)

//   const pathfinderRef =
//     useRef<NavMeshPathfinder | null>(null)

//   const navigationRef =
//     useRef<Navigation | null>(null)

//   const pathMeshRef =
//     useRef<THREE.Mesh | null>(null)

//   const [status, setStatus] =
//     useState('Initializing...')

//   const [localized, setLocalized] =
//     useState(false)

//   const [groupCount, setGroupCount] =
//     useState<number | null>(null)

//   const [distance, setDistance] =
//     useState<number | null>(null)

//   const [selectedDestination, setSelectedDestination] =
//     useState('')

//   const [pathVisible, setPathVisible] =
//     useState(false)

//   const [error, setError] =
//     useState('')

//   useEffect(() => {
//     let disposed = false

//     let renderer:
//       THREE.WebGLRenderer | null = null

//     let scene:
//       THREE.Scene | null = null

//     let camera:
//       THREE.PerspectiveCamera | null = null

//     let adapter:
//       ThreeAdapter | null = null

//     let mapSpace:
//       MapSpace | null = null

//     let pathfinder:
//       NavMeshPathfinder | null = null

//     let navigation:
//       Navigation | null = null

//     let resizeHandler:
//       (() => void) | null = null

//     // =========================================================
//     // MAIN INITIALIZATION
//     // =========================================================

//     const init = async () => {
//       try {
//         // -----------------------------------------------------
//         // 1. CONTAINER
//         // -----------------------------------------------------

//         if (!containerRef.current) {
//           throw new Error(
//             'AR container not available.'
//           )
//         }

//         // -----------------------------------------------------
//         // 2. WEBXR SUPPORT
//         // -----------------------------------------------------

//         setStatus(
//           'Checking WebXR support...'
//         )

//         const supported =
//           await ThreeAdapter.isSupported()

//         if (!supported) {
//           throw new Error(
//             'WebXR immersive AR is not supported on this device.'
//           )
//         }

//         if (disposed) return

//         // -----------------------------------------------------
//         // 3. ENVIRONMENT VARIABLES
//         // -----------------------------------------------------

//         const clientId =
//           process.env
//             .NEXT_PUBLIC_MULTISET_CLIENT_ID

//         const clientSecret =
//           process.env
//             .NEXT_PUBLIC_MULTISET_CLIENT_SECRET

//         const mapCode =
//           process.env
//             .NEXT_PUBLIC_MULTISET_MAP_CODE

//         if (
//           !clientId ||
//           !clientSecret ||
//           !mapCode
//         ) {
//           throw new Error(
//             'Missing MultiSet environment variables.'
//           )
//         }

//         // -----------------------------------------------------
//         // 4. MULTISET CLIENT
//         // -----------------------------------------------------

//         setStatus(
//           'Connecting to MultiSet...'
//         )

//         const client =
//           new MultisetClient({
//             clientId,
//             clientSecret,
//             mapType: 'map',
//             code: mapCode,
//           })

//         await client.authorize()

//         if (disposed) return

//         console.log(
//           '[Kokarya] MultiSet authorized'
//         )

//         // -----------------------------------------------------
//         // 5. THREE RENDERER
//         // -----------------------------------------------------

//         renderer =
//           new THREE.WebGLRenderer({
//             antialias: true,
//             alpha: true,
//           })

//         renderer.setPixelRatio(
//           Math.min(
//             window.devicePixelRatio,
//             2
//           )
//         )

//         renderer.setSize(
//           window.innerWidth,
//           window.innerHeight
//         )

//         renderer.xr.enabled = true

//         /*
//          * IMPORTANT:
//          *
//          * Transparent canvas allows
//          * the real camera feed to show.
//          */

//         renderer.setClearColor(
//           0x000000,
//           0
//         )

//         renderer.domElement.style.position =
//           'fixed'

//         renderer.domElement.style.left =
//           '0'

//         renderer.domElement.style.top =
//           '0'

//         renderer.domElement.style.width =
//           '100%'

//         renderer.domElement.style.height =
//           '100%'

//         renderer.domElement.style.zIndex =
//           '0'

//         containerRef.current.appendChild(
//           renderer.domElement
//         )

//         rendererRef.current =
//           renderer

//         // -----------------------------------------------------
//         // 6. SCENE
//         // -----------------------------------------------------

//         scene =
//           new THREE.Scene()

//         scene.background = null

//         // -----------------------------------------------------
//         // 7. CAMERA
//         // -----------------------------------------------------

//         camera =
//           new THREE.PerspectiveCamera(
//             70,
//             window.innerWidth /
//               window.innerHeight,
//             0.01,
//             1000
//           )

//         scene.add(camera)

//         // -----------------------------------------------------
//         // 8. LIGHT
//         // -----------------------------------------------------

//         scene.add(
//           new THREE.AmbientLight(
//             0xffffff,
//             1
//           )
//         )

//         // -----------------------------------------------------
//         // 9. MAP SPACE
//         // -----------------------------------------------------

//         mapSpace =
//           new MapSpace(
//             new THREE.Object3D()
//           )

//         mapSpaceRef.current =
//           mapSpace

//         scene.add(
//           mapSpace.object
//         )

//         console.log(
//           '[Kokarya] MapSpace created'
//         )

//         // -----------------------------------------------------
//         // 10. LOAD NAVMESH GLB
//         // -----------------------------------------------------

//         setStatus(
//           'Loading NavMesh...'
//         )

//         const loader =
//           new GLTFLoader()

//         /*
//          * CHANGE THIS ONLY IF YOUR FILE
//          * HAS A DIFFERENT NAME.
//          */

//         const gltf =
//           await loader.loadAsync(
//             '/navigation/kokarya-nav-mesh.glb'
//           )

//         if (disposed) return

//         const navMesh =
//           gltf.scene

//         /*
//          * NavMesh belongs under MapSpace.
//          */

//         mapSpace.object.add(
//           navMesh
//         )

//         /*
//          * VERY IMPORTANT:
//          *
//          * Do NOT display the raw NavMesh.
//          *
//          * The black polygons you previously
//          * saw were this geometry.
//          */

//         navMesh.visible = false

//         // -----------------------------------------------------
//         // 11. DEBUG NAVMESH BOUNDS
//         // -----------------------------------------------------

//         const bounds =
//           new THREE.Box3().setFromObject(
//             navMesh
//           )

//         const center =
//           bounds.getCenter(
//             new THREE.Vector3()
//           )

//         const size =
//           bounds.getSize(
//             new THREE.Vector3()
//           )

//         console.log(
//           '[Kokarya] NavMesh center:',
//           center
//         )

//         console.log(
//           '[Kokarya] NavMesh size:',
//           size
//         )

//         console.log(
//           '[Kokarya] NavMesh min:',
//           bounds.min
//         )

//         console.log(
//           '[Kokarya] NavMesh max:',
//           bounds.max
//         )

//         // -----------------------------------------------------
//         // 12. NAVMESH PATHFINDER
//         // -----------------------------------------------------

//         setStatus(
//           'Creating NavMesh Pathfinder...'
//         )

//         pathfinder =
//           await NavMeshPathfinder.fromObject3D(
//             navMesh,
//             {
//               space:
//                 mapSpace.object,
//             }
//           )

//         if (disposed) return

//         pathfinderRef.current =
//           pathfinder

//         setGroupCount(
//           pathfinder.groupCount
//         )

//         console.log(
//           '[Kokarya] NavMesh groups:',
//           pathfinder.groupCount
//         )

//         // -----------------------------------------------------
//         // 13. XR SESSION
//         // -----------------------------------------------------

//         setStatus(
//           'Creating AR session...'
//         )

//         const session =
//           new XRSessionManager(
//             renderer.getContext() as WebGL2RenderingContext,
//             {
//               client,

//               autoLocalize: true,

//               onLocalizationFailure:
//                 (reason) => {
//                   console.warn(
//                     '[Kokarya] Localization failed:',
//                     reason
//                   )

//                   setStatus(
//                     'Localization failed'
//                   )
//                 },

//               onError:
//                 (sessionError) => {
//                   console.error(
//                     '[Kokarya] XR error:',
//                     sessionError
//                   )

//                   setError(
//                     sessionError instanceof
//                       Error
//                       ? sessionError.message
//                       : String(sessionError)
//                   )
//                 },
//             }
//           )

//         // -----------------------------------------------------
//         // 14. PATH MATERIAL
//         // -----------------------------------------------------

//         const pathMaterial =
//           new THREE.MeshBasicMaterial({
//             color: 0x00d9ff,

//             transparent: true,

//             opacity: 0.9,

//             side:
//               THREE.DoubleSide,

//             depthWrite: false,
//           })

//         // -----------------------------------------------------
//         // 15. PATH MESH
//         // -----------------------------------------------------

//         const pathMesh =
//           new THREE.Mesh(
//             new THREE.BufferGeometry(),
//             pathMaterial
//           )

//         pathMesh.frustumCulled =
//           false

//         pathMesh.visible =
//           false

//         mapSpace.object.add(
//           pathMesh
//         )

//         pathMeshRef.current =
//           pathMesh

//         // -----------------------------------------------------
//         // 16. THREE ADAPTER
//         // -----------------------------------------------------

//         adapter =
//           new ThreeAdapter({
//             session,

//             renderer,

//             scene,

//             camera,

//             /*
//              * We don't want MultiSet's
//              * map mesh covering our AR view.
//              */

//             showMesh: false,

//             showGizmo: false,

//             onLocalizationSuccess:
//               (
//                 result,
//                 worldFromMap
//               ) => {
//                 console.log(
//                   '================================'
//                 )

//                 console.log(
//                   '[Kokarya] LOCALIZED'
//                 )

//                 console.log(
//                   '[Kokarya] Confidence:',
//                   result.localizeData.confidence
//                 )

//                 console.log(
//                   '[Kokarya] worldFromMap:',
//                   worldFromMap
//                 )

//                 console.log(
//                   '================================'
//                 )

//                 setLocalized(
//                   true
//                 )

//                 setStatus(
//                   'Localized successfully!'
//                 )

//                 /*
//                  * IMPORTANT:
//                  *
//                  * We do NOT automatically
//                  * start navigation here.
//                  *
//                  * The user selects a destination
//                  * from the UI.
//                  */
//               },
//           })

//         adapterRef.current =
//           adapter

//         // -----------------------------------------------------
//         // 17. CONNECT MAP SPACE
//         // -----------------------------------------------------

//         mapSpace.connect(
//           adapter
//         )

//         console.log(
//           '[Kokarya] MapSpace connected'
//         )

//         // -----------------------------------------------------
//         // 18. CREATE NAVIGATION
//         // -----------------------------------------------------

//         setStatus(
//           'Creating navigation...'
//         )

//         navigation =
//           await Navigation.create({
//             adapter,

//             mapSpace,

//             pathfinder,

//             pois:
//               DESTINATIONS,
//           })

//         if (disposed) return

//         navigationRef.current =
//           navigation

//         console.log(
//           '[Kokarya] Navigation created'
//         )

//         // -----------------------------------------------------
//         // 19. PATH UPDATED
//         // -----------------------------------------------------

//         navigation.on(
//           'pathUpdated',
//           ({
//             corners,
//             remainingDistance,
//           }) => {
//             console.log(
//               '================================'
//             )

//             console.log(
//               '[Kokarya] PATH UPDATED'
//             )

//             console.log(
//               '[Kokarya] Corner count:',
//               corners.length
//             )

//             console.log(
//               '[Kokarya] Corners:',
//               corners
//             )

//             console.log(
//               '[Kokarya] Remaining distance:',
//               remainingDistance
//             )

//             console.log(
//               '================================'
//             )

//             setDistance(
//               remainingDistance
//             )

//             if (
//               corners.length < 2
//             ) {
//               pathMesh.visible =
//                 false

//               setPathVisible(
//                 false
//               )

//               return
//             }

//             // Dispose previous geometry.
//             pathMesh.geometry.dispose()

//             /*
//              * Generate visible navigation ribbon.
//              */

//             pathMesh.geometry =
//               buildPathRibbon(
//                 corners,
//                 {
//                   width:
//                     0.35,

//                   heightAboveFloor:
//                     0.15,

//                   cornerRadius:
//                     0.4,

//                   cornerSegments:
//                     4,
//                 }
//               )

//             pathMesh.visible =
//               true

//             setPathVisible(
//               true
//             )

//             console.log(
//               '[Kokarya] CYAN PATH RENDERED'
//             )
//           }
//         )

//         // -----------------------------------------------------
//         // 20. ARRIVED
//         // -----------------------------------------------------

//         navigation.on(
//           'arrived',
//           (poi) => {
//             console.log(
//               '[Kokarya] ARRIVED:',
//               poi.name
//             )

//             setStatus(
//               `Arrived at ${poi.name}`
//             )

//             setDistance(
//               0
//             )

//             pathMesh.visible =
//               false

//             setPathVisible(
//               false
//             )
//           }
//         )

//         // -----------------------------------------------------
//         // 21. UNREACHABLE
//         // -----------------------------------------------------

//         navigation.on(
//           'unreachable',
//           (poi) => {
//             console.warn(
//               '[Kokarya] UNREACHABLE:',
//               poi.name
//             )

//             setStatus(
//               `No route to ${poi.name}`
//             )

//             pathMesh.visible =
//               false

//             setPathVisible(
//               false
//             )
//           }
//         )

//         // -----------------------------------------------------
//         // 22. INITIALIZE ADAPTER
//         // -----------------------------------------------------

//         await adapter.initialize()

//         if (disposed) return

//         setStatus(
//           'Ready — tap START AR'
//         )

//         console.log(
//           '[Kokarya] Ready'
//         )

//         // -----------------------------------------------------
//         // 23. RESIZE
//         // -----------------------------------------------------

//         resizeHandler =
//           () => {
//             if (
//               !renderer ||
//               !camera
//             ) {
//               return
//             }

//             camera.aspect =
//               window.innerWidth /
//               window.innerHeight

//             camera.updateProjectionMatrix()

//             renderer.setSize(
//               window.innerWidth,
//               window.innerHeight
//             )
//           }

//         window.addEventListener(
//           'resize',
//           resizeHandler
//         )

//       } catch (err) {
//         console.error(
//           '[Kokarya] Initialization error:',
//           err
//         )

//         setError(
//           err instanceof Error
//             ? err.message
//             : String(err)
//         )

//         setStatus(
//           'Initialization failed'
//         )
//       }
//     }

//     init()

//     // =========================================================
//     // CLEANUP
//     // =========================================================

//     return () => {
//       disposed = true

//       if (resizeHandler) {
//         window.removeEventListener(
//           'resize',
//           resizeHandler
//         )
//       }

//       try {
//         adapter?.dispose()
//       } catch {}

//       try {
//         pathfinder?.dispose()
//       } catch {}

//       try {
//         mapSpace?.dispose()
//       } catch {}

//       if (pathMeshRef.current) {
//         pathMeshRef.current.geometry.dispose()

//         const material =
//           pathMeshRef.current.material

//         if (
//           material instanceof
//           THREE.Material
//         ) {
//           material.dispose()
//         }
//       }

//       if (
//         renderer &&
//         renderer.domElement.parentElement
//       ) {
//         renderer.domElement.parentElement.removeChild(
//           renderer.domElement
//         )
//       }

//       renderer?.dispose()

//       navigationRef.current =
//         null

//       pathfinderRef.current =
//         null

//       mapSpaceRef.current =
//         null

//       adapterRef.current =
//         null

//       rendererRef.current =
//         null
//     }
//   }, [])

//   // =========================================================
//   // START NAVIGATION
//   // =========================================================

//   const startNavigation = (
//     destination: Destination
//   ) => {
//     const navigation =
//       navigationRef.current

//     if (!navigation) {
//       console.warn(
//         '[Kokarya] Navigation not ready'
//       )

//       return
//     }

//     if (!localized) {
//       setStatus(
//         'Please localize first'
//       )

//       return
//     }

//     console.log(
//       '[Kokarya] Starting navigation to:',
//       destination.name
//     )

//     console.log(
//       '[Kokarya] Destination coordinate:',
//       destination.position
//     )

//     setSelectedDestination(
//       destination.id
//     )

//     setStatus(
//       `Navigating to ${destination.name}...`
//     )

//     /*
//      * This is the actual MultiSet
//      * navigation call.
//      */

//     navigation.setDestination(
//       destination.id
//     )
//   }

//   // =========================================================
//   // UI
//   // =========================================================

//   return (
//     <main
//       style={{
//         position: 'fixed',
//         inset: 0,
//         overflow: 'hidden',
//         background: 'transparent',
//       }}
//     >
//       {/* ===================================================
//           THREE.JS
//       =================================================== */}

//       <div
//         ref={containerRef}
//         style={{
//           position: 'fixed',
//           inset: 0,
//           zIndex: 1,
//           pointerEvents: 'none',
//         }}
//       />

//       {/* ===================================================
//           TOP STATUS
//       =================================================== */}

//       <div
//         style={{
//           position: 'fixed',

//           top: 16,
//           left: 16,
//           right: 16,

//           zIndex: 20,

//           padding:
//             '16px 18px',

//           borderRadius: 20,

//           background:
//             'rgba(20,20,24,0.84)',

//           backdropFilter:
//             'blur(16px)',

//           WebkitBackdropFilter:
//             'blur(16px)',

//           color: '#fff',

//           fontFamily:
//             'Arial, sans-serif',

//           pointerEvents:
//             'none',
//         }}
//       >
//         <div
//           style={{
//             fontSize: 24,
//             fontWeight: 700,
//           }}
//         >
//           Kokarya Full Map
//         </div>

//         <div
//           style={{
//             marginTop: 6,
//             fontSize: 15,
//           }}
//         >
//           {status}
//         </div>

//         <div
//           style={{
//             marginTop: 6,
//             fontSize: 13,
//             opacity: 0.7,
//           }}
//         >
//           NavMesh groups:{' '}
//           {groupCount ??
//             'loading...'}
//         </div>

//         <div
//           style={{
//             marginTop: 5,
//             fontSize: 13,
//             color:
//               localized
//                 ? '#75ffae'
//                 : '#ffd866',
//           }}
//         >
//           ●{' '}
//           {localized
//             ? 'Localized'
//             : 'Not localized'}
//         </div>

//         {distance !== null && (
//           <div
//             style={{
//               marginTop: 5,
//               fontSize: 13,
//               opacity: 0.75,
//             }}
//           >
//             Distance:{' '}
//             {distance.toFixed(1)} m
//           </div>
//         )}

//         {pathVisible && (
//           <div
//             style={{
//               marginTop: 5,
//               fontSize: 13,
//               color: '#00d9ff',
//             }}
//           >
//             ● Navigation path active
//           </div>
//         )}

//         {error && (
//           <div
//             style={{
//               marginTop: 10,
//               padding: 8,
//               borderRadius: 8,
//               background:
//                 'rgba(255,0,0,0.15)',
//               color: '#ff9b9b',
//               fontSize: 12,
//               wordBreak:
//                 'break-word',
//             }}
//           >
//             {error}
//           </div>
//         )}
//       </div>

//       {/* ===================================================
//           DESTINATION LIST
//       =================================================== */}

//       <div
//         style={{
//           position: 'fixed',

//           left: 16,
//           right: 16,
//           bottom: 24,

//           zIndex: 20,

//           display: 'flex',

//           gap: 8,

//           overflowX: 'auto',

//           padding:
//             '8px 2px',

//           pointerEvents:
//             'auto',
//         }}
//       >
//         {DESTINATIONS.map(
//           (destination) => (
//             <button
//               key={
//                 destination.id
//               }
//               type="button"
//               disabled={!localized}
//               onClick={() =>
//                 startNavigation(
//                   destination
//                 )
//               }
//               style={{
//                 flexShrink: 0,

//                 padding:
//                   '12px 16px',

//                 borderRadius: 14,

//                 border:
//                   selectedDestination ===
//                   destination.id
//                     ? '2px solid #00d9ff'
//                     : '1px solid rgba(255,255,255,0.3)',

//                 background:
//                   selectedDestination ===
//                   destination.id
//                     ? 'rgba(0,217,255,0.2)'
//                     : 'rgba(20,20,24,0.85)',

//                 color: '#fff',

//                 fontSize: 14,

//                 cursor:
//                   localized
//                     ? 'pointer'
//                     : 'not-allowed',

//                 opacity:
//                   localized
//                     ? 1
//                     : 0.5,

//                 backdropFilter:
//                   'blur(12px)',

//                 WebkitBackdropFilter:
//                   'blur(12px)',
//               }}
//             >
//               {destination.name}
//             </button>
//           )
//         )}
//       </div>
//     </main>
//   )
// }
'use client'

import {
  useEffect,
  useRef,
  useState,
} from 'react'

import * as THREE from 'three'

import {
  MultisetClient,
  XRSessionManager,
} from '@multisetai/vps/core'

import {
  ThreeAdapter,
  MapSpace,
} from '@multisetai/vps/three'

import {
  findPath,
} from '@/lib/navigation/pathFinder'

type Destination = {
  id: string
  name: string
  position: THREE.Vector3
}

/**
 * ============================================================
 * DESTINATIONS
 * ============================================================
 */

const destinations: Destination[] = [
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
    name: 'Meeting Room',
    position: new THREE.Vector3(
      11.588,
      -0.468,
      1.757
    ),
  },
]

export default function NavigatePage() {
  /**
   * ==========================================================
   * REFS
   * ==========================================================
   */

  const containerRef =
    useRef<HTMLDivElement>(null)

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const mapSpaceRef =
    useRef<MapSpace | null>(null)

  const markerRef =
    useRef<THREE.Group | null>(null)

  const routeRef =
    useRef<THREE.Group | null>(null)

  /**
   * Current device position
   * in MultiSet map coordinates.
   */
  const currentMapPositionRef =
    useRef<THREE.Vector3 | null>(
      null
    )

  /**
   * ==========================================================
   * STATE
   * ==========================================================
   */

  const [
    status,
    setStatus,
  ] = useState(
    'Initializing...'
  )

  const [
    error,
    setError,
  ] = useState('')

  const [
    localized,
    setLocalized,
  ] = useState(false)

  /**
   * IMPORTANT:
   *
   * "lift" was removed because it doesn't
   * exist in the updated destination list.
   */
  const [
    selectedDestination,
    setSelectedDestination,
  ] = useState(
    'entrance'
  )

  /**
   * ==========================================================
   * INITIALIZE MULTISET
   * ==========================================================
   */

  useEffect(() => {
    let disposed = false

    async function init() {
      try {
        setStatus(
          'Checking WebXR...'
        )

        /**
         * ----------------------------------------------------
         * Check WebXR
         * ----------------------------------------------------
         */

        const supported =
          await XRSessionManager.isSupported()

        if (!supported) {
          throw new Error(
            'WebXR is not supported on this device/browser.'
          )
        }

        /**
         * ----------------------------------------------------
         * Environment variables
         * ----------------------------------------------------
         */

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

        /**
         * ----------------------------------------------------
         * MultiSet client
         * ----------------------------------------------------
         */

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

        if (disposed) {
          return
        }

        /**
         * ----------------------------------------------------
         * Three.js renderer
         * ----------------------------------------------------
         */

        setStatus(
          'Creating AR renderer...'
        )

        const renderer =
          new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
          })

        renderer.setPixelRatio(
          window.devicePixelRatio
        )

        renderer.setSize(
          window.innerWidth,
          window.innerHeight
        )

        /**
         * Transparent renderer.
         *
         * Camera feed is provided by WebXR.
         */
        renderer.setClearColor(
          0x000000,
          0
        )

        renderer.domElement.style.position =
          'fixed'

        renderer.domElement.style.top =
          '0'

        renderer.domElement.style.left =
          '0'

        renderer.domElement.style.width =
          '100%'

        renderer.domElement.style.height =
          '100%'

        renderer.domElement.style.zIndex =
          '0'

        containerRef.current?.appendChild(
          renderer.domElement
        )

        /**
         * ----------------------------------------------------
         * Scene
         * ----------------------------------------------------
         */

        const scene =
          new THREE.Scene()

        /**
         * ----------------------------------------------------
         * Camera
         * ----------------------------------------------------
         */

        const camera =
          new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
              window.innerHeight,
            0.01,
            1000
          )

        /**
         * ----------------------------------------------------
         * XR session
         * ----------------------------------------------------
         */

        setStatus(
          'Creating MultiSet XR session...'
        )

        const session =
          new XRSessionManager(
            renderer.getContext() as WebGL2RenderingContext,
            {
              client,

              autoLocalize: true,

              referenceSpaceType:
                'local',

              confidenceCheck: true,

              confidenceThreshold:
                0.5,

              /**
               * XR session started.
               */
              onSessionStart: () => {
                console.log(
                  'XR SESSION STARTED'
                )

                setStatus(
                  'Scanning...'
                )
              },

              /**
               * XR session ended.
               */
              onSessionEnd: () => {
                console.log(
                  'XR SESSION ENDED'
                )

                setStatus(
                  'AR session ended'
                )

                setLocalized(
                  false
                )
              },

              /**
               * Localization started.
               */
              onLocalizationInit: () => {
                console.log(
                  'Localization started'
                )

                setStatus(
                  'Scanning... Move the phone slowly and point at the mapped area.'
                )
              },

              /**
               * Localization result.
               */
              onLocalizationResult: (
                result: any
              ) => {
                console.log(
                  'Localization result:',
                  result
                )
              },

              /**
               * Localization failed.
               */
              onLocalizationFailure: (
                localizationError: any
              ) => {
                console.error(
                  'Localization failed:',
                  localizationError
                )

                setStatus(
                  'Localization failed'
                )
              },

              /**
               * XR error.
               */
              onError: (
                xrError: any
              ) => {
                console.error(
                  'XR ERROR:',
                  xrError
                )

                setError(
                  xrError?.message ||
                    String(
                      xrError
                    )
                )
              },
            }
          )

        /**
         * ----------------------------------------------------
         * MapSpace
         * ----------------------------------------------------
         */

        const mapSpace =
          new MapSpace(
            new THREE.Object3D(),
            {
              hideUntilLocalized:
                false,
            }
          )

        scene.add(
          mapSpace.object
        )

        mapSpaceRef.current =
          mapSpace

        /**
         * ----------------------------------------------------
         * ThreeAdapter
         * ----------------------------------------------------
         */

        const adapter =
          new ThreeAdapter({
            session,
            renderer,
            scene,
            camera,

            showMesh: false,

            showGizmo: false,

            useDefaultButton: true,

            /**
             * ------------------------------------------------
             * Localization success
             * ------------------------------------------------
             */

            onLocalizationSuccess: (
              result: any,
              worldFromMap:
                THREE.Matrix4
            ) => {
              console.log(
                'LOCALIZATION SUCCESS'
              )

              console.log(
                'Result:',
                result
              )

              console.log(
                'worldFromMap:',
                worldFromMap
              )

              /**
               * Connect MapSpace to
               * MultiSet localization.
               */
              mapSpace.connect(
                adapter
              )

              setLocalized(
                true
              )

              setStatus(
                'Localized successfully!'
              )
            },

            /**
             * ------------------------------------------------
             * XR frame
             * ------------------------------------------------
             */
            onXRFrame: () => {
              /**
               * We can only calculate
               * map coordinates after
               * MapSpace is available.
               */
              if (
                !mapSpaceRef.current
              ) {
                return
              }

              /**
               * Camera position is in
               * Three.js world coordinates.
               *
               * Convert it back into
               * MultiSet map coordinates.
               */
              const mapPosition =
                mapSpaceRef.current.object.worldToLocal(
                  camera.position.clone()
                )

              currentMapPositionRef.current =
                mapPosition
            },
          })

        adapterRef.current =
          adapter

        /**
         * ----------------------------------------------------
         * Initialize adapter
         * ----------------------------------------------------
         */

        await adapter.initialize()

        if (disposed) {
          return
        }

        setStatus(
          'Ready — tap the AR button.'
        )

        console.log(
          'MultiSet ThreeAdapter initialized'
        )
      } catch (
        initializationError: any
      ) {
        console.error(
          initializationError
        )

        setError(
          initializationError?.message ||
            String(
              initializationError
            )
        )

        setStatus(
          'Initialization failed'
        )
      }
    }

    init()

    /**
     * ========================================================
     * CLEANUP
     * ========================================================
     */

    return () => {
      disposed = true

      try {
        markerRef.current?.removeFromParent()
      } catch {}

      try {
        routeRef.current?.removeFromParent()
      } catch {}

      try {
        mapSpaceRef.current?.dispose()
      } catch {}

      try {
        adapterRef.current?.dispose()
      } catch {}
    }
  }, [])

  /**
   * ==========================================================
   * DRAW DESTINATION MARKER
   * ==========================================================
   */

  const drawDestinationMarker = (
    destination: Destination
  ) => {
    const mapSpace =
      mapSpaceRef.current

    if (!mapSpace) {
      setError(
        'MapSpace is not ready.'
      )

      return
    }

    /**
     * Remove old marker.
     */
    if (
      markerRef.current
    ) {
      markerRef.current.removeFromParent()

      markerRef.current =
        null
    }

    /**
     * Create marker group.
     */
    const marker =
      new THREE.Group()

    /**
     * --------------------------------------------------------
     * Floor ring
     * --------------------------------------------------------
     */

    const ring =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.25,
          0.32,
          32
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        })
      )

    ring.rotation.x =
      -Math.PI / 2

    /**
     * --------------------------------------------------------
     * Vertical pole
     * --------------------------------------------------------
     */

    const pole =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.025,
          0.025,
          0.8,
          16
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
        })
      )

    pole.position.y =
      0.4

    /**
     * --------------------------------------------------------
     * Floating sphere
     * --------------------------------------------------------
     */

    const sphere =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.16,
          24,
          24
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
        })
      )

    sphere.position.y =
      0.85

    /**
     * Add marker parts.
     */
    marker.add(
      ring
    )

    marker.add(
      pole
    )

    marker.add(
      sphere
    )

    /**
     * Add marker to MultiSet map.
     */
    mapSpace.add(
      marker,
      destination.position.clone()
    )

    markerRef.current =
      marker
  }

  /**
   * ==========================================================
   * DRAW NAVIGATION ROUTE
   * ==========================================================
   */

  const drawNavigationRoute = (
    points: THREE.Vector3[]
  ) => {
    const mapSpace =
      mapSpaceRef.current

    if (!mapSpace) {
      return
    }

    /**
     * Remove old route.
     */
    if (
      routeRef.current
    ) {
      routeRef.current.removeFromParent()

      routeRef.current =
        null
    }

    if (
      points.length < 2
    ) {
      return
    }

    /**
     * --------------------------------------------------------
     * Route group
     * --------------------------------------------------------
     */

    const routeGroup =
      new THREE.Group()

    /**
     * --------------------------------------------------------
     * Route line
     * --------------------------------------------------------
     */

    const lineGeometry =
      new THREE.BufferGeometry()

    lineGeometry.setFromPoints(
      points
    )

    const lineMaterial =
      new THREE.LineBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.9,
      })

    const line =
      new THREE.Line(
        lineGeometry,
        lineMaterial
      )

    routeGroup.add(
      line
    )

    /**
     * --------------------------------------------------------
     * Route waypoint markers
     * --------------------------------------------------------
     */

    for (
      let i = 1;
      i < points.length;
      i++
    ) {
      const point =
        points[i]

      const waypoint =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            0.08,
            12,
            12
          ),
          new THREE.MeshBasicMaterial({
            color: 0x00ff88,
          })
        )

      waypoint.position.copy(
        point
      )

      routeGroup.add(
        waypoint
      )
    }

    /**
     * Add route to MultiSet MapSpace.
     *
     * Route points are already in
     * map coordinates.
     */
    mapSpace.add(
      routeGroup,
      new THREE.Vector3(
        0,
        0,
        0
      )
    )

    routeRef.current =
      routeGroup

    console.log(
      'Navigation route points:',
      points
    )
  }

  /**
   * ==========================================================
   * SHOW DESTINATION + FIND PATH
   * ==========================================================
   */

  const showDestination = () => {
    /**
     * --------------------------------------------------------
     * Must be localized first.
     * --------------------------------------------------------
     */

    if (!localized) {
      setStatus(
        'Please localize first.'
      )

      return
    }

    /**
     * --------------------------------------------------------
     * MapSpace
     * --------------------------------------------------------
     */

    const mapSpace =
      mapSpaceRef.current

    if (!mapSpace) {
      setError(
        'MapSpace is not ready.'
      )

      return
    }

    /**
     * --------------------------------------------------------
     * Find destination
     * --------------------------------------------------------
     */

    const destination =
      destinations.find(
        item =>
          item.id ===
          selectedDestination
      )

    if (!destination) {
      setError(
        'Destination not found.'
      )

      return
    }

    /**
     * --------------------------------------------------------
     * Current user position
     * --------------------------------------------------------
     */

    const currentPosition =
      currentMapPositionRef.current

    if (!currentPosition) {
      setStatus(
        'Waiting for current position...'
      )

      return
    }

    console.log(
      'Current map position:',
      currentPosition
    )

    /**
     * --------------------------------------------------------
     * Find A* path
     * --------------------------------------------------------
     */

    const navigationPath =
      findPath(
        currentPosition,
        destination.id
      )

    if (!navigationPath) {
      setError(
        'No navigation path found.'
      )

      return
    }

    console.log(
      'Navigation node IDs:',
      navigationPath.nodeIds
    )

    console.log(
      'Navigation points:',
      navigationPath.points
    )

    console.log(
      'Navigation distance:',
      navigationPath.distance
    )

    /**
     * --------------------------------------------------------
     * Draw route
     * --------------------------------------------------------
     */

    drawNavigationRoute(
      navigationPath.points
    )

    /**
     * --------------------------------------------------------
     * Draw destination
     * --------------------------------------------------------
     */

    drawDestinationMarker(
      destination
    )

    /**
     * --------------------------------------------------------
     * Status
     * --------------------------------------------------------
     */

    setStatus(
      `Navigate to ${destination.name} • ${navigationPath.distance.toFixed(1)} m`
    )
  }

  /**
   * ==========================================================
   * UI
   * ==========================================================
   */

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background:
          'transparent',
      }}
    >
      /**
       * ------------------------------------------------------
       * Three.js container
       * ------------------------------------------------------
       */

      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
        }}
      />

      /**
       * ------------------------------------------------------
       * UI
       * ------------------------------------------------------
       */

      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          right: 20,

          zIndex: 10,

          color: 'white',

          background:
            'rgba(0,0,0,0.70)',

          padding: 16,

          borderRadius: 14,

          fontFamily:
            'Arial, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          Indoor Navigation
        </div>

        <div
          style={{
            fontSize: 16,
            marginBottom: 14,
          }}
        >
          {status}
        </div>

        {localized && (
          <>
            <div
              style={{
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              Destination
            </div>

            <select
              value={
                selectedDestination
              }
              onChange={event => {
                setSelectedDestination(
                  event.target.value
                )
              }}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: 'none',
                fontSize: 16,
                marginBottom: 10,
              }}
            >
              {destinations.map(
                destination => (
                  <option
                    key={
                      destination.id
                    }
                    value={
                      destination.id
                    }
                  >
                    {
                      destination.name
                    }
                  </option>
                )
              )}
            </select>

            <button
              onClick={
                showDestination
              }
              style={{
                width: '100%',
                padding: 13,
                borderRadius: 8,
                border: 'none',
                background:
                  '#ffffff',
                color: '#000000',
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              Start Navigation
            </button>
          </>
        )}

        {error && (
          <div
            style={{
              marginTop: 10,
              color: '#ff7777',
              fontSize: 14,
              wordBreak:
                'break-word',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </main>
  )
}