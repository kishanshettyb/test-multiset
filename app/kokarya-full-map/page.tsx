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
  const containerRef =
    useRef<HTMLDivElement | null>(null)

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const mapSpaceRef =
    useRef<MapSpace | null>(null)

  const navMeshRef =
    useRef<THREE.Object3D | null>(null)

  const pathfinderRef =
    useRef<NavMeshPathfinder | null>(null)

  const [status, setStatus] =
    useState('Initializing...')

  const [error, setError] =
    useState('')

  const [groupCount, setGroupCount] =
    useState<number | null>(null)

  const [localized, setLocalized] =
    useState(false)

  useEffect(() => {
    let disposed = false

    let renderer:
      THREE.WebGLRenderer | null = null

    let scene:
      THREE.Scene | null = null

    let camera:
      THREE.PerspectiveCamera | null = null

    async function init() {
      try {
        /* =====================================================
           1. CHECK WEBXR
        ===================================================== */

        setStatus(
          'Checking WebXR...'
        )

        const supported =
          await ThreeAdapter.isSupported()

        if (!supported) {
          throw new Error(
            'WebXR immersive AR is not supported on this device/browser.'
          )
        }

        if (disposed) {
          return
        }

        /* =====================================================
           2. MULTISET ENVIRONMENT
        ===================================================== */

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

        /* =====================================================
           3. CONNECT MULTISET
        ===================================================== */

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

        /* =====================================================
           4. RENDERER
           
           IMPORTANT:
           This is copied from your working
           navigation page.
        ===================================================== */

        setStatus(
          'Creating AR renderer...'
        )

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

        /*
         * Transparent WebXR canvas.
         *
         * This allows the real camera
         * to appear behind the Three.js content.
         */
        renderer.setClearColor(
          0x000000,
          0
        )

        renderer.domElement.style.position =
          'fixed'

        renderer.domElement.style.inset =
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

        /* =====================================================
           5. SCENE
        ===================================================== */

        scene =
          new THREE.Scene()

        /* =====================================================
           6. CAMERA
        ===================================================== */

        camera =
          new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
              window.innerHeight,
            0.01,
            1000
          )

        /* =====================================================
           7. MAP SPACE
        ===================================================== */

        const mapSpace =
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

        /* =====================================================
           8. LOAD KOKARYA NAVMESH
        ===================================================== */

        setStatus(
          'Loading Kokarya NavMesh...'
        )

        const loader =
          new GLTFLoader()

        const gltf =
          await loader.loadAsync(
            '/navigation/kokarya-nav-mesg-threejs.glb'
          )

        if (disposed) {
          return
        }

        const navMesh =
          gltf.scene

        navMeshRef.current =
          navMesh

        /*
         * VERY IMPORTANT:
         *
         * NavMesh is placed INSIDE MapSpace.
         */
        mapSpace.object.add(
          navMesh
        )

        navMesh.visible = true

        console.log(
          '[Kokarya] NavMesh loaded'
        )

        /* =====================================================
           9. NAVMESH BOUNDS
        ===================================================== */

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
          '[Kokarya] NavMesh center:',
          center
        )

        console.log(
          '[Kokarya] NavMesh size:',
          size
        )

        console.log(
          '[Kokarya] NavMesh min:',
          box.min
        )

        console.log(
          '[Kokarya] NavMesh max:',
          box.max
        )

        /* =====================================================
           10. NAVMESH PATHFINDER
        ===================================================== */

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

        if (disposed) {
          return
        }

        pathfinderRef.current =
          pathfinder

        setGroupCount(
          pathfinder.groupCount
        )

        console.log(
          '[Kokarya] Pathfinder created'
        )

        console.log(
          '[Kokarya] NavMesh groups:',
          pathfinder.groupCount
        )

        /* =====================================================
           11. XR SESSION
           
           This section follows your working
           navigation page.
        ===================================================== */

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

              confidenceCheck:
                true,

              confidenceThreshold:
                0.5,

              onSessionStart: () => {
                console.log(
                  '[Kokarya] XR SESSION STARTED'
                )

                setStatus(
                  'Scanning...'
                )
              },

              onSessionEnd: () => {
                console.log(
                  '[Kokarya] XR SESSION ENDED'
                )

                setLocalized(false)

                setStatus(
                  'AR session ended'
                )
              },

              onLocalizationInit: () => {
                console.log(
                  '[Kokarya] Localization started'
                )

                setStatus(
                  'Scanning... Move the phone slowly and point at the mapped area.'
                )
              },

              onLocalizationResult: (
                result: any
              ) => {
                console.log(
                  '[Kokarya] Localization result:',
                  result
                )
              },

              onLocalizationFailure: (
                localizationError: any
              ) => {
                console.error(
                  '[Kokarya] Localization failed:',
                  localizationError
                )

                setStatus(
                  'Localization failed'
                )
              },

              onError: (
                sessionError: any
              ) => {
                console.error(
                  '[Kokarya] XR ERROR:',
                  sessionError
                )

                setError(
                  sessionError?.message ||
                  String(sessionError)
                )
              },
            }
          )

        /* =====================================================
           12. THREE ADAPTER
        ===================================================== */

        const adapter =
          new ThreeAdapter({
            session,

            renderer,

            scene,

            camera,

            /*
             * Don't show MultiSet's own mesh.
             *
             * We want to see OUR Kokarya NavMesh.
             */
            showMesh: false,

            showGizmo: false,

            useDefaultButton: true,

            /* ===============================================
               LOCALIZATION SUCCESS
            =============================================== */

            onLocalizationSuccess: (
              result: any,
              worldFromMap: THREE.Matrix4
            ) => {
              console.log(
                '================================'
              )

              console.log(
                '[Kokarya] LOCALIZATION SUCCESS'
              )

              console.log(
                '[Kokarya] Result:',
                result
              )

              console.log(
                '[Kokarya] worldFromMap:',
                worldFromMap
              )

              console.log(
                '================================'
              )

              setLocalized(true)

              setStatus(
                'Localized successfully!'
              )
            },

            /* ===============================================
               XR FRAME
            =============================================== */

            onXRFrame: () => {
              /*
               * Navigation frame logic will be
               * added here later.
               */
            },
          })

        adapterRef.current =
          adapter

        /* =====================================================
           13. CONNECT MAPSPACE TO ADAPTER
        ===================================================== */

        mapSpace.connect(
          adapter
        )

        console.log(
          '[Kokarya] MapSpace connected to MultiSet'
        )

        /* =====================================================
           14. INITIALIZE ADAPTER
           
           IMPORTANT:
           Same pattern as your working
           navigation page.
        ===================================================== */

        await adapter.initialize()

        if (disposed) {
          return
        }

        console.log(
          '[Kokarya] MultiSet ThreeAdapter initialized'
        )

        setStatus(
          'Ready — tap START AR.'
        )

        /* =====================================================
           15. RESIZE
        ===================================================== */

        const handleResize =
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
          handleResize
        )

        /* =====================================================
           CLEANUP RESIZE
        ===================================================== */

        return () => {
          window.removeEventListener(
            'resize',
            handleResize
          )
        }

      } catch (err: any) {
        console.error(
          '[Kokarya] Initialization error:',
          err
        )

        setError(
          err?.message ||
          String(err)
        )

        setStatus(
          'Initialization failed'
        )
      }
    }

    let resizeCleanup:
      (() => void) | undefined

    init().then(
      cleanup => {
        resizeCleanup =
          cleanup
      }
    )

    /* =======================================================
       GLOBAL CLEANUP
    ======================================================= */

    return () => {
      disposed = true

      resizeCleanup?.()

      try {
        adapterRef.current?.dispose()
      } catch (error) {
        console.error(
          '[Kokarya] Adapter cleanup error:',
          error
        )
      }

      adapterRef.current =
        null

      mapSpaceRef.current =
        null

      navMeshRef.current =
        null

      pathfinderRef.current =
        null

      if (
        renderer &&
        renderer.domElement.parentElement
      ) {
        renderer.domElement.parentElement.removeChild(
          renderer.domElement
        )
      }

      renderer?.dispose()
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

      {/* ================================================
          THREE.JS / WEBXR CANVAS
      ================================================= */}

      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* ================================================
          STATUS
      ================================================= */}

      <div
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 20,

          color: '#ffffff',

          background:
            'rgba(15, 15, 20, 0.78)',

          backdropFilter:
            'blur(14px)',

          WebkitBackdropFilter:
            'blur(14px)',

          padding:
            '14px 16px',

          borderRadius: 18,

          fontFamily:
            'Arial, sans-serif',

          border:
            '1px solid rgba(255,255,255,0.12)',

          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          Kokarya Full Map
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 14,
            opacity: 0.85,
          }}
        >
          {status}
        </div>

        {groupCount !== null && (
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              opacity: 0.7,
            }}
          >
            NavMesh groups: {groupCount}
          </div>
        )}

        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            color: localized
              ? '#86efac'
              : '#facc15',
          }}
        >
          {localized
            ? '● Localized'
            : '● Not localized'}
        </div>

        {error && (
          <div
            style={{
              marginTop: 8,
              color: '#ff7777',
              fontSize: 12,
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