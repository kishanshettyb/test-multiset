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
  NavMeshPathfinder,
} from '@multisetai/vps/navigation'

export default function KokaryaFullMapPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null)

  const sceneRef =
    useRef<THREE.Scene | null>(null)

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(null)

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const mapSpaceRef =
    useRef<MapSpace | null>(null)

  const pathfinderRef =
    useRef<NavMeshPathfinder | null>(null)

  const navMeshRef =
    useRef<THREE.Object3D | null>(null)

  const [status, setStatus] =
    useState('Loading...')

  const [localizationStatus, setLocalizationStatus] =
    useState('Not localized')

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    let disposed = false
    let animationFrame = 0

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

    const init = async () => {
      try {
        // =====================================================
        // 1. RENDERER
        // =====================================================

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
          container.clientWidth,
          container.clientHeight
        )

        renderer.xr.enabled = true

        rendererRef.current = renderer

        container.appendChild(
          renderer.domElement
        )

        // =====================================================
        // 2. SCENE
        // =====================================================

        scene = new THREE.Scene()

        // Transparent for AR.
        // The desktop page itself has a dark background.
        scene.background = null

        sceneRef.current = scene

        // =====================================================
        // 3. CAMERA
        // =====================================================

        camera =
          new THREE.PerspectiveCamera(
            60,
            container.clientWidth /
              container.clientHeight,
            0.01,
            1000
          )

        cameraRef.current = camera

        scene.add(camera)

        // =====================================================
        // 4. LIGHTS
        // =====================================================

        const ambientLight =
          new THREE.AmbientLight(
            0xffffff,
            2
          )

        scene.add(ambientLight)

        const directionalLight =
          new THREE.DirectionalLight(
            0xffffff,
            2
          )

        directionalLight.position.set(
          10,
          20,
          10
        )

        scene.add(
          directionalLight
        )

        // =====================================================
        // 5. MAP SPACE
        // =====================================================

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

        // =====================================================
        // 6. LOAD NAVMESH
        // =====================================================

        setStatus(
          'Loading Kokarya NavMesh...'
        )

        const loader =
          new GLTFLoader()

        const gltf =
          await loader.loadAsync(
            '/navigation/kokarya-nav-mesg-threejs.glb'
          )

        if (disposed) return

        const navMesh =
          gltf.scene

        navMeshRef.current =
          navMesh

        // NavMesh belongs to MapSpace.
        mapSpace.object.add(
          navMesh
        )

        navMesh.visible = true

        // =====================================================
        // 7. CALCULATE BOUNDS
        // =====================================================

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
          '================================'
        )

        console.log(
          '[Kokarya] NAVMESH LOADED'
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

        console.log(
          '================================'
        )

        // =====================================================
        // 8. POSITION DESKTOP CAMERA
        // =====================================================

        const maxDimension =
          Math.max(
            size.x,
            size.y,
            size.z
          )

        camera.position.set(
          center.x +
            maxDimension * 1.4,

          center.y +
            maxDimension * 1.0,

          center.z +
            maxDimension * 1.4
        )

        camera.lookAt(
          center
        )

        // =====================================================
        // 9. NAVMESH PATHFINDER
        // =====================================================

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
          '[Kokarya] Pathfinder created'
        )

        console.log(
          '[Kokarya] NavMesh groups:',
          pathfinder.groupCount
        )

        setStatus(
          `NavMesh ready — ${
            pathfinder.groupCount
          } navigation group(s)`
        )

        // =====================================================
        // 10. NORMAL DESKTOP RENDER LOOP
        // =====================================================

        const renderPreview = () => {
          if (disposed) return

          animationFrame =
            requestAnimationFrame(
              renderPreview
            )

          if (
            renderer &&
            scene &&
            camera
          ) {
            renderer.render(
              scene,
              camera
            )
          }
        }

        renderPreview()

        // =====================================================
        // 11. MULTISET CLIENT
        // =====================================================

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

        // =====================================================
        // 12. XR SESSION
        // =====================================================

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
                  '[Kokarya] XR error:',
                  error
                )

                setStatus(
                  'XR error'
                )
              },
            }
          )

        // =====================================================
        // 13. THREE ADAPTER
        // =====================================================

        adapter =
          new ThreeAdapter({
            session,

            renderer,

            scene,

            camera,

            // IMPORTANT:
            // Don't download/display MultiSet's
            // own map mesh here.
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
                '[Kokarya] Confidence:',
                result.localizeData
                  ?.confidence
              )

              console.log(
                '[Kokarya] worldFromMap:',
                worldFromMap
              )

              console.log(
                '================================'
              )

              setLocalizationStatus(
                `Localized — confidence: ${
                  result.localizeData
                    ?.confidence ??
                  'unknown'
                }`
              )
            },

            onXRFrame: ({
              deltaSeconds,
            }) => {
              // Navigation will be added here later.

              void deltaSeconds
            },
          })

        adapterRef.current =
          adapter

        // =====================================================
        // 14. CONNECT MAPSPACE
        // =====================================================

        mapSpace.connect(
          adapter
        )

        console.log(
          '[Kokarya] MapSpace connected'
        )

        // =====================================================
        // 15. INITIALIZE MULTISET
        // =====================================================

        console.log(
          '[Kokarya] Initializing MultiSet...'
        )

        adapter.initialize()

        console.log(
          '[Kokarya] MultiSet initialized'
        )

        // =====================================================
        // 16. RESIZE
        // =====================================================

        const handleResize = () => {
          if (
            !containerRef.current ||
            !renderer ||
            !camera
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

        // =====================================================
        // CLEANUP
        // =====================================================

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

    init()

    // =======================================================
    // GLOBAL CLEANUP
    // =======================================================

    return () => {
      disposed = true

      cancelAnimationFrame(
        animationFrame
      )

      if (adapter) {
        try {
          adapter.dispose()
        } catch (error) {
          console.warn(
            '[Kokarya] Adapter dispose error:',
            error
          )
        }
      }

      adapterRef.current =
        null

      mapSpaceRef.current =
        null

      pathfinderRef.current =
        null

      navMeshRef.current =
        null

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
    <main className="relative min-h-screen overflow-hidden bg-black text-white">

      {/* ---------------------------------------------- */}
      {/* STATUS PANEL                                   */}
      {/* ---------------------------------------------- */}

      <div className="absolute left-0 top-0 z-50 w-full bg-black/80 p-4 backdrop-blur">
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

      {/* ---------------------------------------------- */}
      {/* THREE.JS                                       */}
      {/* ---------------------------------------------- */}

      <div
        ref={containerRef}
        className="h-screen w-full"
      />

    </main>
  )
}