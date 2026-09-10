// 'use client'

// import { useEffect, useRef, useState } from 'react'
// import * as THREE from 'three'
// import { MultisetClient, XRSessionManager } from '@multisetai/vps/core'
// import { ThreeAdapter } from '@multisetai/vps/three'

// export default function NavigatePage() {
//   const containerRef = useRef<HTMLDivElement>(null)

//   const [status, setStatus] = useState('Initializing...')
//   const [error, setError] = useState('')

//   useEffect(() => {
//     let adapter: ThreeAdapter | null = null
//     let disposed = false

//     async function init() {
//       try {
//         setStatus('Checking WebXR...')

//         const supported = await XRSessionManager.isSupported()

//         if (!supported) {
//           throw new Error('WebXR is not supported on this device/browser.')
//         }

//         const clientId =
//           process.env.NEXT_PUBLIC_MULTISET_CLIENT_ID

//         const clientSecret =
//           process.env.NEXT_PUBLIC_MULTISET_CLIENT_SECRET

//         const mapCode =
//           process.env.NEXT_PUBLIC_MULTISET_MAP_CODE

//         if (!clientId || !clientSecret || !mapCode) {
//           throw new Error(
//             'Missing MultiSet environment variables.'
//           )
//         }

//         setStatus('Connecting to MultiSet...')

//         const client = new MultisetClient({
//           clientId,
//           clientSecret,
//           mapType: 'map',
//           code: mapCode,
//         })

//         await client.authorize()

//         if (disposed) return

//         setStatus('Creating AR renderer...')

//         const renderer = new THREE.WebGLRenderer({
//           antialias: true,
//           alpha: true,
//         })

//         renderer.setPixelRatio(window.devicePixelRatio)
//         renderer.setSize(
//           window.innerWidth,
//           window.innerHeight
//         )

//         renderer.setClearColor(0x000000, 0)

//         // Important:
//         // Do NOT use renderer.setAnimationLoop().
//         // ThreeAdapter manages the XR rendering loop.
//         //
//         // Do NOT manually call renderer.xr.enabled here.
//         // ThreeAdapter handles XR setup.

//         renderer.domElement.style.position = 'fixed'
//         renderer.domElement.style.top = '0'
//         renderer.domElement.style.left = '0'
//         renderer.domElement.style.width = '100%'
//         renderer.domElement.style.height = '100%'
//         renderer.domElement.style.zIndex = '0'

//         containerRef.current?.appendChild(renderer.domElement)

//         const scene = new THREE.Scene()

//         const camera = new THREE.PerspectiveCamera(
//           70,
//           window.innerWidth / window.innerHeight,
//           0.01,
//           1000
//         )

//         setStatus('Creating MultiSet XR session...')

//         const session = new XRSessionManager(
//           renderer.getContext() as WebGL2RenderingContext,
//           {
//             client,

//             autoLocalize: true,

//             referenceSpaceType: 'local',

//             confidenceCheck: true,

//             confidenceThreshold: 0.5,

//             onSessionStart: () => {
//               console.log('XR SESSION STARTED')
//               setStatus('Scanning...')
//             },

//             onSessionEnd: () => {
//               console.log('XR SESSION ENDED')
//               setStatus('AR session ended')
//             },

//             onLocalizationInit: () => {
//               console.log('Localization started')
//               setStatus(
//                 'Scanning... Move the phone slowly and point at the mapped area.'
//               )
//             },

//             onLocalizationResult: (result: any) => {
//               console.log(
//                 'Localization result:',
//                 result
//               )
//             },

//             onLocalizationFailure: (error: any) => {
//               console.error(
//                 'Localization failed:',
//                 error
//               )

//               setStatus('Localization failed')
//             },

//             onError: (error: any) => {
//               console.error(
//                 'XR ERROR:',
//                 error
//               )

//               setError(
//                 error?.message ||
//                   String(error)
//               )
//             },
//           }
//         )

//         adapter = new ThreeAdapter({
//           session,
//           renderer,
//           scene,
//           camera,

//           // Keep everything invisible for now.
//           // We are testing camera passthrough first.
//           showMesh: false,
//           showGizmo: false,

//           // IMPORTANT:
//           // Let MultiSet create and manage the AR button.
//           useDefaultButton: true,

//           onLocalizationSuccess: (
//             result: any,
//             worldFromMap: any
//           ) => {
//             console.log(
//               'LOCALIZATION SUCCESS'
//             )

//             console.log(
//               'Result:',
//               result
//             )

//             console.log(
//               'worldFromMap:',
//               worldFromMap
//             )

//             setStatus(
//               'Localized successfully!'
//             )
//           },

//           onXRFrame: () => {
//             // ThreeAdapter handles camera synchronization
//             // and XR rendering.
//           },
//         })

//         await adapter.initialize()

//         if (disposed) return

//         setStatus(
//           'Ready — tap the AR button.'
//         )

//         console.log(
//           'MultiSet ThreeAdapter initialized'
//         )
//       } catch (err: any) {
//         console.error(err)

//         setError(
//           err?.message ||
//             String(err)
//         )

//         setStatus('Initialization failed')
//       }
//     }

//     init()

//     return () => {
//       disposed = true

//       try {
//         adapter?.dispose()
//       } catch (e) {
//         console.error(e)
//       }
//     }
//   }, [])

//   return (
//     <main
//       style={{
//         position: 'fixed',
//         inset: 0,
//         overflow: 'hidden',
//         background: 'transparent',
//       }}
//     >
//       <div
//         ref={containerRef}
//         style={{
//           position: 'fixed',
//           inset: 0,
//           zIndex: 1,
//         }}
//       />

//       {/* Debug information */}
//       <div
//         style={{
//           position: 'fixed',
//           top: 20,
//           left: 20,
//           right: 20,
//           zIndex: 10,
//           color: 'white',
//           background: 'rgba(0,0,0,0.65)',
//           padding: 16,
//           borderRadius: 12,
//           fontFamily: 'Arial, sans-serif',
//           pointerEvents: 'none',
//         }}
//       >
//         <div
//           style={{
//             fontSize: 24,
//             fontWeight: 700,
//             marginBottom: 8,
//           }}
//         >
//           Indoor Navigation
//         </div>

//         <div style={{ fontSize: 17 }}>
//           {status}
//         </div>

//         {error && (
//           <div
//             style={{
//               marginTop: 10,
//               color: '#ff7777',
//               fontSize: 14,
//               wordBreak: 'break-word',
//             }}
//           >
//             {error}
//           </div>
//         )}
//       </div>
//     </main>
//   )
// }

'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { MultisetClient, XRSessionManager } from '@multisetai/vps/core'
import { ThreeAdapter, MapSpace } from '@multisetai/vps/three'

export default function NavigatePage() {
  const containerRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState('Initializing...')
  const [error, setError] = useState('')

  const [position, setPosition] = useState<{
    world: THREE.Vector3
    map: THREE.Vector3
  } | null>(null)

  useEffect(() => {
    let adapter: ThreeAdapter | null = null
    let mapSpace: MapSpace | null = null
    let disposed = false

    async function init() {
      try {
        setStatus('Checking WebXR...')

        const supported = await XRSessionManager.isSupported()

        if (!supported) {
          throw new Error(
            'WebXR is not supported on this device/browser.'
          )
        }

        const clientId =
          process.env.NEXT_PUBLIC_MULTISET_CLIENT_ID

        const clientSecret =
          process.env.NEXT_PUBLIC_MULTISET_CLIENT_SECRET

        const mapCode =
          process.env.NEXT_PUBLIC_MULTISET_MAP_CODE

        if (!clientId || !clientSecret || !mapCode) {
          throw new Error(
            'Missing MultiSet environment variables.'
          )
        }

        setStatus('Connecting to MultiSet...')

        const client = new MultisetClient({
          clientId,
          clientSecret,
          mapType: 'map',
          code: mapCode,
        })

        await client.authorize()

        if (disposed) return

        setStatus('Creating AR renderer...')

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        })

        renderer.setPixelRatio(window.devicePixelRatio)

        renderer.setSize(
          window.innerWidth,
          window.innerHeight
        )

        renderer.setClearColor(0x000000, 0)

        renderer.domElement.style.position = 'fixed'
        renderer.domElement.style.top = '0'
        renderer.domElement.style.left = '0'
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'
        renderer.domElement.style.zIndex = '0'

        containerRef.current?.appendChild(
          renderer.domElement
        )

        const scene = new THREE.Scene()

        const camera = new THREE.PerspectiveCamera(
          70,
          window.innerWidth / window.innerHeight,
          0.01,
          1000
        )

        setStatus('Creating MultiSet XR session...')

        const session = new XRSessionManager(
          renderer.getContext() as WebGL2RenderingContext,
          {
            client,

            autoLocalize: true,

            referenceSpaceType: 'local',

            confidenceCheck: true,

            confidenceThreshold: 0.5,

            onSessionStart: () => {
              console.log('XR SESSION STARTED')
              setStatus('Scanning...')
            },

            onSessionEnd: () => {
              console.log('XR SESSION ENDED')
              setStatus('AR session ended')
              setPosition(null)
            },

            onLocalizationInit: () => {
              console.log('Localization started')

              setStatus(
                'Scanning... Move the phone slowly and point at the mapped area.'
              )
            },

            onLocalizationResult: (result: any) => {
              console.log(
                'Localization result:',
                result
              )
            },

            onLocalizationFailure: (error: any) => {
              console.error(
                'Localization failed:',
                error
              )

              setStatus('Localization failed')
            },

            onError: (error: any) => {
              console.error(
                'XR ERROR:',
                error
              )

              setError(
                error?.message ||
                  String(error)
              )
            },
          }
        )

        adapter = new ThreeAdapter({
          session,
          renderer,
          scene,
          camera,

          showMesh: false,
          showGizmo: false,

          useDefaultButton: true,

          onLocalizationSuccess: (
            result: any,
            worldFromMap: THREE.Matrix4
          ) => {
            console.log(
              'LOCALIZATION SUCCESS'
            )

            console.log(
              'Localization result:',
              result
            )

            console.log(
              'worldFromMap:',
              worldFromMap
            )

            /*
             * Create a MapSpace.
             *
             * MapSpace represents the persistent MultiSet
             * map coordinate system.
             */
            if (!mapSpace) {
              mapSpace = new MapSpace(
                new THREE.Object3D(),
                {
                  hideUntilLocalized: false,
                }
              )

              scene.add(mapSpace.object)

              mapSpace.connect(adapter!)
            }

            /*
             * Get the phone/camera position in Three.js
             * world coordinates.
             */
            camera.updateMatrixWorld(true)

            const worldPosition =
              camera.getWorldPosition(
                new THREE.Vector3()
              )

            /*
             * Convert the world position into
             * MultiSet MAP coordinates.
             */
            const mapPosition =
              mapSpace.worldToMap(
                worldPosition,
                new THREE.Vector3()
              )

            console.log(
              'WORLD POSITION:',
              worldPosition
            )

            console.log(
              'MAP POSITION:',
              mapPosition
            )

            setPosition({
              world: worldPosition.clone(),
              map: mapPosition.clone(),
            })

            setStatus(
              'Localized successfully!'
            )
          },

          onXRFrame: () => {
            // ThreeAdapter handles XR camera
            // synchronization and rendering.
          },
        })

        await adapter.initialize()

        if (disposed) return

        setStatus(
          'Ready — tap the AR button.'
        )

        console.log(
          'MultiSet ThreeAdapter initialized'
        )
      } catch (err: any) {
        console.error(err)

        setError(
          err?.message ||
            String(err)
        )

        setStatus(
          'Initialization failed'
        )
      }
    }

    init()

    return () => {
      disposed = true

      try {
        mapSpace?.dispose()
      } catch (e) {
        console.error(e)
      }

      try {
        adapter?.dispose()
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
        }}
      />

      {/* Debug information */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          right: 20,
          zIndex: 10,
          color: 'white',
          background: 'rgba(0,0,0,0.65)',
          padding: 16,
          borderRadius: 12,
          fontFamily: 'Arial, sans-serif',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Indoor Navigation
        </div>

        <div
          style={{
            fontSize: 17,
            marginBottom: 12,
          }}
        >
          {status}
        </div>

        {position && (
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Your Map Position
            </div>

            <div>
              X: {position.map.x.toFixed(3)}
            </div>

            <div>
              Y: {position.map.y.toFixed(3)}
            </div>

            <div>
              Z: {position.map.z.toFixed(3)}
            </div>

            <div
              style={{
                marginTop: 10,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              World Position
            </div>

            <div>
              X: {position.world.x.toFixed(3)}
            </div>

            <div>
              Y: {position.world.y.toFixed(3)}
            </div>

            <div>
              Z: {position.world.z.toFixed(3)}
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 10,
              color: '#ff7777',
              fontSize: 14,
              wordBreak: 'break-word',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </main>
  )
}
