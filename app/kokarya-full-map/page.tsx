'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import {
  MultisetClient,
  XRSessionManager,
} from '@multisetai/vps/core'

import { ThreeAdapter, MapSpace } from '@multisetai/vps/three'

import {
  NavMeshPathfinder,
} from '@multisetai/vps/navigation'

export default function KokaryaFullMapPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  const adapterRef = useRef<ThreeAdapter | null>(null)
  const mapSpaceRef = useRef<MapSpace | null>(null)
  const pathfinderRef = useRef<NavMeshPathfinder | null>(null)

  const navMeshRef = useRef<THREE.Object3D | null>(null)

  const [status, setStatus] = useState('Initializing...')
  const [localizationStatus, setLocalizationStatus] =
    useState('Not localized')

  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false

    const container = containerRef.current

    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let adapter: ThreeAdapter | null = null

    const init = async () => {
      try {
        // --------------------------------------------------
        // 1. THREE.JS RENDERER
        // --------------------------------------------------

        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        })

        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio, 2)
        )

        renderer.setSize(
          container.clientWidth,
          container.clientHeight
        )

        renderer.xr.enabled = true

        container.appendChild(renderer.domElement)

        // --------------------------------------------------
        // 2. SCENE
        // --------------------------------------------------

        scene = new THREE.Scene()

        // Transparent is important for AR camera view.
        scene.background = null

        // --------------------------------------------------
        // 3. CAMERA
        // --------------------------------------------------

        camera = new THREE.PerspectiveCamera(
          70,
          container.clientWidth /
            container.clientHeight,
          0.01,
          100
        )

        scene.add(camera)

        // --------------------------------------------------
        // 4. LIGHT
        // --------------------------------------------------

        const ambientLight =
          new THREE.AmbientLight(
            0xffffff,
            1
          )

        scene.add(ambientLight)

        // --------------------------------------------------
        // 5. MAP SPACE
        // --------------------------------------------------

        const mapSpace = new MapSpace(
          new THREE.Object3D()
        )

        mapSpaceRef.current = mapSpace

        scene.add(mapSpace.object)

        console.log(
          '[Kokarya] MapSpace created'
        )

        // --------------------------------------------------
        // 6. LOAD NAVMESH
        // --------------------------------------------------

        setStatus(
          'Loading Kokarya NavMesh...'
        )

        const loader = new GLTFLoader()

        const gltf =
          await loader.loadAsync(
            '/navigation/kokarya-nav-mesg-threejs.glb'
          )

        if (disposed) return

        const navMesh = gltf.scene

        navMeshRef.current = navMesh

        // NavMesh lives inside MapSpace.
        mapSpace.object.add(navMesh)

        navMesh.visible = true

        // --------------------------------------------------
        // 7. NAVMESH BOUNDS
        // --------------------------------------------------

        const box =
          new THREE.Box3().setFromObject(
            navMesh
          )

        const center =
          box.getCenter(
            new THREE.Vector3()
          )

        const size =
          box.getSize(
            new THREE.Vector3()
          )

        console.log(
          '[Kokarya] NavMesh loaded'
        )

        console.log(
          '[Kokarya] Center:',
          center
        )

        console.log(
          '[Kokarya] Size:',
          size
        )

        console.log(
          '[Kokarya] Min:',
          box.min
        )

        console.log(
          '[Kokarya] Max:',
          box.max
        )

        setStatus(
          `NavMesh loaded — ` +
          `${size.x.toFixed(2)} × ` +
          `${size.y.toFixed(2)} × ` +
          `${size.z.toFixed(2)} m`
        )

        // --------------------------------------------------
        // 8. MULTISET CLIENT
        // --------------------------------------------------

        const client =
          new MultisetClient({
            clientId:
              process.env
                .NEXT_PUBLIC_MULTISET_CLIENT_ID!,

            clientSecret:
              process.env
                .NEXT_PUBLIC_MULTISET_CLIENT_SECRET!,

            mapType: 'map',

            code:
              process.env
                .NEXT_PUBLIC_MULTISET_MAP_CODE!,
          })

        console.log(
          '[Kokarya] Authorizing MultiSet...'
        )

        await client.authorize()

        if (disposed) return

        console.log(
          '[Kokarya] MultiSet authorized'
        )

        // --------------------------------------------------
        // 9. XR SESSION
        // --------------------------------------------------

        const session =
          new XRSessionManager(
            renderer.getContext() as WebGL2RenderingContext,
            {
              client,

              autoLocalize: true,

              onLocalizationFailure: (
                reason
              ) => {
                console.warn(
                  '[Kokarya] Localization failed:',
                  reason
                )

                setLocalizationStatus(
                  'Localization failed'
                )
              },

              onError: (
                error
              ) => {
                console.error(
                  '[Kokarya] Session error:',
                  error
                )

                setStatus(
                  'MultiSet session error'
                )
              },
            }
          )

        // --------------------------------------------------
        // 10. THREE ADAPTER
        // --------------------------------------------------

        adapter =
          new ThreeAdapter({
            session,

            renderer,

            scene,

            camera,

            showMesh: false,

            showGizmo: true,

            onLocalizationSuccess: (
              result,
              worldFromMap
            ) => {
              console.log(
                '================================'
              )

              console.log(
                '[Kokarya] LOCALIZATION SUCCESS'
              )

              console.log(
                'Confidence:',
                result.localizeData
                  ?.confidence
              )

              console.log(
                'worldFromMap:',
                worldFromMap
              )

              console.log(
                '================================'
              )

              setLocalizationStatus(
                `Localized — confidence: ${
                  result.localizeData
                    ?.confidence
                    ?.toFixed?.(2) ??
                  'unknown'
                }`
              )

              /*
               * IMPORTANT
               *
               * MultiSet gives us a matrix that
               * converts MAP coordinates into
               * THREE WORLD coordinates.
               *
               * MapSpace handles this transform
               * for the navigation system.
               */
            },

            onXRFrame: ({
              deltaSeconds,
            }) => {
              // Reserved for navigation
              // animation later.

              void deltaSeconds
            },
          })

        adapterRef.current = adapter

        // --------------------------------------------------
        // 11. CONNECT MAPSPACE TO MULTISET
        // --------------------------------------------------

        mapSpace.connect(adapter)

        console.log(
          '[Kokarya] MapSpace connected to MultiSet'
        )

        // --------------------------------------------------
        // 12. CREATE NAVMESH PATHFINDER
        // --------------------------------------------------

        setStatus(
          'Creating NavMesh Pathfinder...'
        )

        const pathfinder =
          await NavMeshPathfinder
            .fromObject3D(
              navMesh,
              {
                space:
                  mapSpace.object,
              }
            )

        if (disposed) return

        pathfinderRef.current =
          pathfinder

        console.log(
          '[Kokarya] NavMesh Pathfinder created'
        )

        console.log(
          '[Kokarya] NavMesh groups:',
          pathfinder.groupCount
        )

        setStatus(
          `NavMesh ready — ` +
          `${pathfinder.groupCount} navigation group(s)`
        )

        // --------------------------------------------------
        // 13. START MULTISET
        // --------------------------------------------------

        console.log(
          '[Kokarya] Starting MultiSet...'
        )

        adapter.initialize()

        console.log(
          '[Kokarya] MultiSet initialized'
        )

        // --------------------------------------------------
        // 14. RESIZE
        // --------------------------------------------------

        const handleResize = () => {
          if (
            !containerRef.current ||
            !camera ||
            !renderer
          ) {
            return
          }

          const width =
            containerRef.current
              .clientWidth

          const height =
            containerRef.current
              .clientHeight

          camera.aspect =
            width / height

          camera.updateProjectionMatrix()

          renderer.setSize(
            width,
            height
          )
        }

        window.addEventListener(
          'resize',
          handleResize
        )

        // --------------------------------------------------
        // 15. CLEANUP
        // --------------------------------------------------

        return () => {
          window.removeEventListener(
            'resize',
            handleResize
          )
        }
      } catch (error) {
        console.error(
          '[Kokarya] Initialization error:',
          error
        )

        setStatus(
          'Initialization failed'
        )
      }
    }

    let cleanup: (() => void) | undefined

    init().then((result) => {
      cleanup = result
    })

    return () => {
      disposed = true

      cleanup?.()

      if (adapter) {
        try {
          adapter.dispose()
        } catch (error) {
          console.warn(
            '[Kokarya] Adapter cleanup error:',
            error
          )
        }
      }

      adapterRef.current = null
      mapSpaceRef.current = null
      pathfinderRef.current = null
      navMeshRef.current = null

      if (renderer) {
        renderer.dispose()

        if (
          container.contains(
            renderer.domElement
          )
        ) {
          container.removeChild(
            renderer.domElement
          )
        }
      }
    }
  }, [])

  return (
    <main className="relative min-h-screen bg-black text-white">
      {/* Header */}
      <div className="absolute left-0 top-0 z-20 w-full bg-black/70 p-4 backdrop-blur">
        <h1 className="text-xl font-semibold">
          Kokarya Full Map
        </h1>

        <p className="mt-1 text-sm text-gray-300">
          {status}
        </p>

        <p className="mt-1 text-sm text-gray-400">
          {localizationStatus}
        </p>
      </div>

      {/* Three.js / WebXR */}
      <div
        ref={containerRef}
        className="h-screen w-full"
      />
    </main>
  )
}