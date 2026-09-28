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

export default function KokaryaFullMapPage() {
  const containerRef =
    useRef<HTMLDivElement | null>(null)

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null)

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const mapSpaceRef =
    useRef<MapSpace | null>(null)

  const navMeshRef =
    useRef<THREE.Object3D | null>(null)

  const pathfinderRef =
    useRef<NavMeshPathfinder | null>(null)

  const navigationRef =
    useRef<Navigation | null>(null)

  const pathMeshRef =
    useRef<THREE.Mesh | null>(null)

  const animationTimeRef =
    useRef(0)

  const [status, setStatus] =
    useState('Initializing...')

  const [localized, setLocalized] =
    useState(false)

  const [groupCount, setGroupCount] =
    useState<number | null>(null)

  const [remainingDistance, setRemainingDistance] =
    useState<number | null>(null)

  const [navigationState, setNavigationState] =
    useState('unlocalized')

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

    let navigation:
      Navigation | null = null

    let resizeHandler:
      (() => void) | null = null

    try {
      // =====================================================
      // MAIN INITIALIZATION
      // =====================================================

      const init = async () => {
        try {
          // ===================================================
          // 1. CHECK WEBXR
          // ===================================================

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

          // ===================================================
          // 2. MULTISET CREDENTIALS
          // ===================================================

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

          // ===================================================
          // 3. MULTISET CLIENT
          // ===================================================

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

          // ===================================================
          // 4. THREE RENDERER
          // ===================================================

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
           * IMPORTANT
           *
           * Transparent canvas allows
           * Android camera feed to appear.
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

          rendererRef.current =
            renderer

          containerRef.current?.appendChild(
            renderer.domElement
          )

          // ===================================================
          // 5. SCENE
          // ===================================================

          scene =
            new THREE.Scene()

          scene.background = null

          // ===================================================
          // 6. CAMERA
          // ===================================================

          camera =
            new THREE.PerspectiveCamera(
              70,
              window.innerWidth /
                window.innerHeight,
              0.01,
              1000
            )

          scene.add(camera)

          // ===================================================
          // 7. LIGHT
          // ===================================================

          scene.add(
            new THREE.AmbientLight(
              0xffffff,
              1
            )
          )

          // ===================================================
          // 8. MAP SPACE
          // ===================================================

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

          // ===================================================
          // 9. LOAD NAVMESH GLB
          // ===================================================

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

          /*
           * IMPORTANT
           *
           * NavMesh belongs to MapSpace.
           */

          mapSpace.object.add(
            navMesh
          )

          /*
           * We DO NOT want to display
           * the raw NavMesh.
           *
           * Your black polygons were
           * exactly this geometry.
           */

          navMesh.visible = false

          // ===================================================
          // 10. NAVMESH BOUNDS
          // ===================================================

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

          // ===================================================
          // 11. CREATE PATHFINDER
          // ===================================================

          setStatus(
            'Creating NavMesh Pathfinder...'
          )

          const pathfinder =
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
            '[Kokarya] Pathfinder created'
          )

          console.log(
            '[Kokarya] NavMesh groups:',
            pathfinder.groupCount
          )

          // ===================================================
          // 12. XR SESSION
          // ===================================================

          setStatus(
            'Creating AR session...'
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

                onSessionStart: () => {
                  console.log(
                    '[Kokarya] AR session started'
                  )

                  setStatus(
                    'Scanning...'
                  )

                  /*
                   * Hide desktop canvas while
                   * immersive AR is active.
                   *
                   * MultiSet renders directly
                   * into the XR framebuffer.
                   */

                  if (
                    renderer
                  ) {
                    renderer.domElement.style.display =
                      'none'
                  }
                },

                onSessionEnd: () => {
                  console.log(
                    '[Kokarya] AR session ended'
                  )

                  setLocalized(
                    false
                  )

                  setNavigationState(
                    'unlocalized'
                  )

                  /*
                   * Show preview canvas again.
                   */

                  if (
                    renderer
                  ) {
                    renderer.domElement.style.display =
                      'block'
                  }
                },

                onLocalizationInit: () => {
                  console.log(
                    '[Kokarya] Localization started'
                  )

                  setStatus(
                    'Scanning...'
                  )
                },

                onLocalizationResult:
                  (
                    result: any
                  ) => {
                    console.log(
                      '[Kokarya] Localization result:',
                      result
                    )
                  },

                onLocalizationFailure:
                  (
                    reason: any
                  ) => {
                    console.warn(
                      '[Kokarya] Localization failed:',
                      reason
                    )

                    setStatus(
                      'Localization failed'
                    )
                  },

                onError: (
                  sessionError: any
                ) => {
                  console.error(
                    '[Kokarya] XR error:',
                    sessionError
                  )

                  setError(
                    sessionError?.message ||
                    String(sessionError)
                  )
                },
              }
            )

          // ===================================================
          // 13. PATH MATERIAL
          // ===================================================

          /*
           * This is the visible navigation
           * ribbon.
           *
           * We start with a simple material.
           * Later we can replace this with
           * an arrow texture/shader.
           */

          const pathMaterial =
            new THREE.MeshBasicMaterial({
              color: 0x00d9ff,

              transparent: true,

              opacity: 0.9,

              side:
                THREE.DoubleSide,

              depthWrite: false,
            })

          // ===================================================
          // 14. PATH MESH
          // ===================================================

          const pathMesh =
            new THREE.Mesh(
              new THREE.BufferGeometry(),
              pathMaterial
            )

          pathMesh.frustumCulled =
            false

          pathMesh.visible =
            false

          pathMeshRef.current =
            pathMesh

          /*
           * Path belongs to MapSpace.
           */

          mapSpace.object.add(
            pathMesh
          )

          // ===================================================
          // 15. THREE ADAPTER
          // ===================================================

          adapter =
            new ThreeAdapter({
              session,

              renderer,

              scene,

              camera,

              /*
               * Don't render MultiSet's
               * map mesh.
               */

              showMesh: false,

              showGizmo: false,

              useDefaultButton: true,

              onLocalizationSuccess:
                (
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
                    '[Kokarya] Confidence:',
                    result
                      ?.localizeData
                      ?.confidence
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
                },

              onXRFrame: ({
                deltaSeconds,
              }) => {
                /*
                 * Navigation.tick is internally
                 * handled by Navigation.
                 *
                 * We keep this callback available
                 * for our future animation system.
                 */

                animationTimeRef.current +=
                  deltaSeconds
              },
            })

          adapterRef.current =
            adapter

          // ===================================================
          // 16. CONNECT MAP SPACE
          // ===================================================

          mapSpace.connect(
            adapter
          )

          console.log(
            '[Kokarya] MapSpace connected'
          )

          // ===================================================
          // 17. CREATE NAVIGATION
          // ===================================================

          setStatus(
            'Creating navigation...'
          )

          /*
           * IMPORTANT:
           *
           * Replace this coordinate later
           * with an actual Kokarya POI.
           *
           * This is only a test destination.
           */

          const testDestination =
            MapSpace.toLocal(
              new THREE.Vector3(
                4.0,
                0,
                1.2
              )
            )

          navigation =
            await Navigation.create({
              adapter,

              mapSpace,

              pathfinder,

              pois: [
                {
                  id:
                    'test-destination',

                  name:
                    'Test Destination',

                  position:
                    testDestination,
                },
              ],
            })

          if (disposed) return

          navigationRef.current =
            navigation

          console.log(
            '[Kokarya] Navigation created'
          )

          // ===================================================
          // 18. NAVIGATION STATE
          // ===================================================

          navigation.on(
            'stateChanged',
            ({
              state,
              previous,
            }) => {
              console.log(
                '[Kokarya] Navigation state:',
                previous,
                '→',
                state
              )

              setNavigationState(
                state
              )
            }
          )

          // ===================================================
          // 19. PATH UPDATED
          // ===================================================

          navigation.on(
            'pathUpdated',
            ({
              corners,
              remainingDistance,
            }) => {
              console.log(
                '[Kokarya] PATH UPDATED'
              )

              console.log(
                '[Kokarya] Corners:',
                corners
              )

              console.log(
                '[Kokarya] Remaining:',
                remainingDistance
              )

              setRemainingDistance(
                remainingDistance
              )

              if (
                corners.length <
                2
              ) {
                pathMesh.visible =
                  false

                return
              }

              /*
               * Remove old geometry.
               */

              pathMesh.geometry.dispose()

              /*
               * Build a new route ribbon.
               */

              pathMesh.geometry =
                buildPathRibbon(
                  corners,
                  {
                    width:
                      0.35,

                    heightAboveFloor:
                      0.1,

                    cornerRadius:
                      0.4,

                    cornerSegments:
                      4,
                  }
                )

              pathMesh.visible =
                true

              console.log(
                '[Kokarya] Route rendered'
              )
            }
          )

          // ===================================================
          // 20. ARRIVED
          // ===================================================

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

              setRemainingDistance(
                0
              )

              setNavigationState(
                'arrived'
              )

              pathMesh.visible =
                false
            }
          )

          // ===================================================
          // 21. UNREACHABLE
          // ===================================================

          navigation.on(
            'unreachable',
            (poi) => {
              console.warn(
                '[Kokarya] No route to:',
                poi.name
              )

              setStatus(
                `No route to ${poi.name}`
              )

              pathMesh.visible =
                false
            }
          )

          // ===================================================
          // 22. TICK
          // ===================================================

          navigation.on(
            'tick',
            ({
              deltaSeconds,
            }) => {
              /*
               * This is where the animated
               * arrow system will run.
               *
               * For now we just keep the
               * timer available.
               */

              animationTimeRef.current +=
                deltaSeconds
            }
          )

          // ===================================================
          // 23. INITIALIZE MULTISET
          // ===================================================

          setStatus(
            'Ready — tap START AR'
          )

          await adapter.initialize()

          if (disposed) return

          console.log(
            '[Kokarya] Adapter initialized'
          )

          setStatus(
            'Ready — tap START AR'
          )

          // ===================================================
          // 24. RESIZE
          // ===================================================

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

      init()
    } catch (error: any) {
      console.error(
        '[Kokarya] Fatal error:',
        error
      )
    }

    // =======================================================
    // CLEANUP
    // =======================================================

    return () => {
      disposed = true

      if (
        resizeHandler
      ) {
        window.removeEventListener(
          'resize',
          resizeHandler
        )
      }

      // -----------------------------------------------
      // Navigation
      // -----------------------------------------------

      try {
        navigation?.stop()
      } catch {}

      navigationRef.current =
        null

      // -----------------------------------------------
      // Path
      // -----------------------------------------------

      if (
        pathMeshRef.current
      ) {
        pathMeshRef.current.geometry.dispose()

        const material =
          pathMeshRef.current
            .material

        if (
          material instanceof
          THREE.Material
        ) {
          material.dispose()
        }

        pathMeshRef.current =
          null
      }

      // -----------------------------------------------
      // Pathfinder
      // -----------------------------------------------

      try {
        pathfinderRef.current?.dispose()
      } catch {}

      pathfinderRef.current =
        null

      // -----------------------------------------------
      // MapSpace
      // -----------------------------------------------

      try {
        mapSpaceRef.current?.dispose()
      } catch {}

      mapSpaceRef.current =
        null

      // -----------------------------------------------
      // Adapter
      // -----------------------------------------------

      try {
        adapterRef.current?.dispose()
      } catch {}

      adapterRef.current =
        null

      // -----------------------------------------------
      // Renderer
      // -----------------------------------------------

      if (
        renderer &&
        renderer.domElement.parentElement
      ) {
        renderer.domElement.parentElement.removeChild(
          renderer.domElement
        )
      }

      renderer?.dispose()

      rendererRef.current =
        null

      navMeshRef.current =
        null
    }
  }, [])

  // =======================================================
  // UI
  // =======================================================

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

      {/* ================================================
          STATUS PANEL
      ================================================= */}

      <div
        style={{
          position: 'fixed',

          top: 16,
          left: 16,
          right: 16,

          zIndex: 50,

          padding:
            '16px 18px',

          borderRadius: 20,

          color: '#ffffff',

          background:
            'rgba(20, 20, 24, 0.84)',

          backdropFilter:
            'blur(16px)',

          WebkitBackdropFilter:
            'blur(16px)',

          border:
            '1px solid rgba(255,255,255,0.12)',

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
            opacity: 0.9,
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
                ? '#7CFFA8'
                : '#FFD866',
          }}
        >
          ●{' '}
          {localized
            ? 'Localized'
            : 'Not localized'}
        </div>

        <div
          style={{
            marginTop: 5,
            fontSize: 13,
            opacity: 0.75,
          }}
        >
          Navigation:{' '}
          {navigationState}
        </div>

        {remainingDistance !==
          null && (
          <div
            style={{
              marginTop: 5,
              fontSize: 13,
              opacity: 0.75,
            }}
          >
            Distance:{' '}
            {remainingDistance.toFixed(
              1
            )}{' '}
            m
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
              color: '#ff8b8b',
              fontSize: 12,
              wordBreak:
                'break-word',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* ================================================
          THREE / WEBXR CONTAINER
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

    </main>
  )
}