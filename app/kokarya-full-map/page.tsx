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
  },
]

export default function KokaryaFullMapPage() {
  // =========================================================
  // REFS
  // =========================================================

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

  // Direction arrow
  const arrowGroupRef =
    useRef<THREE.Group | null>(null)

  const arrowRef =
    useRef<THREE.Mesh | null>(null)

  // =========================================================
  // STATE
  // =========================================================

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

  const [directionInstruction, setDirectionInstruction] =
    useState('')

  const [nextTurnDistance, setNextTurnDistance] =
    useState<number | null>(null)

  // =========================================================
  // TURN INSTRUCTION HELPER
  // =========================================================

  const getTurnInstruction = (
    corners: THREE.Vector3[]
  ) => {
    if (corners.length < 3) {
      return {
        instruction: 'Walk straight',
        distance:
          corners.length >= 2
            ? corners[0].distanceTo(corners[1])
            : null,
      }
    }

    const first = corners[0]
    const second = corners[1]
    const third = corners[2]

    const incoming =
      new THREE.Vector3(
        second.x - first.x,
        0,
        second.z - first.z
      ).normalize()

    const outgoing =
      new THREE.Vector3(
        third.x - second.x,
        0,
        third.z - second.z
      ).normalize()

    const cross =
      incoming.x * outgoing.z -
      incoming.z * outgoing.x

    const dot =
      incoming.x * outgoing.x +
      incoming.z * outgoing.z

    const angle =
      Math.atan2(
        Math.abs(cross),
        dot
      ) *
      (180 / Math.PI)

    const distanceToTurn =
      first.distanceTo(second)

    // Small angle = mostly straight
    if (angle < 20) {
      return {
        instruction: 'Walk straight',
        distance: distanceToTurn,
      }
    }

    // Positive cross = left
    if (cross > 0) {
      return {
        instruction: 'Turn left',
        distance: distanceToTurn,
      }
    }

    // Negative cross = right
    return {
      instruction: 'Turn right',
      distance: distanceToTurn,
    }
  }

  // =========================================================
  // MAIN INITIALIZATION
  // =========================================================

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

    let arrowGroup:
      THREE.Group | null = null

    let resizeHandler:
      (() => void) | null = null

    // =========================================================
    // INIT
    // =========================================================

    const init = async () => {
      try {
        // =====================================================
        // 1. CONTAINER
        // =====================================================

        if (!containerRef.current) {
          throw new Error(
            'AR container not available.'
          )
        }

        // =====================================================
        // 2. WEBXR SUPPORT
        // =====================================================

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

        // =====================================================
        // 3. ENVIRONMENT VARIABLES
        // =====================================================

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

        // =====================================================
        // 4. MULTISET CLIENT
        // =====================================================

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

        // =====================================================
        // 5. THREE RENDERER
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
          window.innerWidth,
          window.innerHeight
        )

        renderer.xr.enabled = true

        // Transparent canvas
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

        // =====================================================
        // 6. SCENE
        // =====================================================

        scene =
          new THREE.Scene()

        scene.background = null

        // =====================================================
        // 7. CAMERA
        // =====================================================

        camera =
          new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
              window.innerHeight,
            0.01,
            1000
          )

        scene.add(camera)

        // =====================================================
        // 8. LIGHT
        // =====================================================

        scene.add(
          new THREE.AmbientLight(
            0xffffff,
            1
          )
        )

        // =====================================================
        // 9. MAP SPACE
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
        // 10. LOAD NAVMESH
        // =====================================================

        setStatus(
          'Loading NavMesh...'
        )

        const loader =
          new GLTFLoader()

        const gltf =
          await loader.loadAsync(
            '/navigation/kokarya-nav-mesh.glb'
          )

        if (disposed) return

        const navMesh =
          gltf.scene

        // NavMesh belongs under MapSpace
        mapSpace.object.add(
          navMesh
        )

        // Do not render raw NavMesh
        navMesh.visible = false

        // =====================================================
        // 11. DEBUG NAVMESH BOUNDS
        // =====================================================

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

        // =====================================================
        // 12. NAVMESH PATHFINDER
        // =====================================================

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

        // =====================================================
        // 13. XR SESSION
        // =====================================================

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

                  setLocalized(false)
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

        // =====================================================
        // 14. PATH MATERIAL
        // =====================================================

        const pathMaterial =
          new THREE.MeshBasicMaterial({
            color: 0x00d9ff,

            transparent: true,

            opacity: 0.9,

            side:
              THREE.DoubleSide,

            depthWrite: false,
          })

        // =====================================================
        // 15. PATH MESH
        // =====================================================

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

        // =====================================================
        // 16. DIRECTION ARROW
        // =====================================================

        arrowGroup =
          new THREE.Group()

        arrowGroup.visible =
          false

        mapSpace.object.add(
          arrowGroup
        )

        arrowGroupRef.current =
          arrowGroup

        /*
         * Cone points upward by default (+Y).
         *
         * Rotate X by 90 degrees so it points
         * forward along +Z.
         */
        const arrowGeometry =
          new THREE.ConeGeometry(
            0.22,
            0.55,
            4
          )

        const arrowMaterial =
          new THREE.MeshBasicMaterial({
            color: 0x00d9ff,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
          })

        const arrow =
          new THREE.Mesh(
            arrowGeometry,
            arrowMaterial
          )

        arrow.rotation.x =
          Math.PI / 2

        arrow.position.y =
          0.35

        arrow.frustumCulled =
          false

        arrowGroup.add(
          arrow
        )

        arrowRef.current =
          arrow

        // =====================================================
        // 17. THREE ADAPTER
        // =====================================================

        adapter =
          new ThreeAdapter({
            session,

            renderer,

            scene,

            camera,

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

                setLocalized(true)

                setStatus(
                  'Localized successfully!'
                )
              },
          })

        adapterRef.current =
          adapter

        // =====================================================
        // 18. CONNECT MAP SPACE
        // =====================================================

        mapSpace.connect(
          adapter
        )

        console.log(
          '[Kokarya] MapSpace connected'
        )

        // =====================================================
        // 19. CREATE NAVIGATION
        // =====================================================

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

        // =====================================================
        // 20. PATH UPDATED
        // =====================================================

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

            // =================================================
            // NO VALID PATH
            // =================================================

            if (
              corners.length < 2
            ) {
              pathMesh.visible =
                false

              setPathVisible(
                false
              )

              if (
                arrowGroupRef.current
              ) {
                arrowGroupRef.current.visible =
                  false
              }

              setDirectionInstruction(
                ''
              )

              setNextTurnDistance(
                null
              )

              return
            }

            // =================================================
            // BUILD CYAN PATH
            // =================================================

            pathMesh.geometry.dispose()

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

            // =================================================
            // DIRECTION GUIDANCE
            // =================================================

            const guidance =
              getTurnInstruction(
                corners
              )

            setDirectionInstruction(
              guidance.instruction
            )

            setNextTurnDistance(
              guidance.distance
            )

            // =================================================
            // POSITION ARROW
            // =================================================

            if (
              arrowGroupRef.current &&
              corners.length >= 2
            ) {
              const group =
                arrowGroupRef.current

              const first =
                corners[0]

              const second =
                corners[1]

              // Direction from first corner to second
              const direction =
                new THREE.Vector3()
                  .subVectors(
                    second,
                    first
                  )
                  .setY(0)
                  .normalize()

              // Put arrow slightly ahead
              // of current position
              const arrowPosition =
                first.clone().add(
                  direction
                    .clone()
                    .multiplyScalar(0.8)
                )

              arrowPosition.y +=
                0.35

              group.position.copy(
                arrowPosition
              )

              // Rotate +Z toward path direction
              const angle =
                Math.atan2(
                  direction.x,
                  direction.z
                )

              group.rotation.set(
                0,
                angle,
                0
              )

              group.visible =
                true
            }
          }
        )

        // =====================================================
        // 21. ARRIVED
        // =====================================================

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

            setDirectionInstruction(
              'Arrived'
            )

            setNextTurnDistance(
              0
            )

            pathMesh.visible =
              false

            setPathVisible(
              false
            )

            if (
              arrowGroupRef.current
            ) {
              arrowGroupRef.current.visible =
                false
            }
          }
        )

        // =====================================================
        // 22. UNREACHABLE
        // =====================================================

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

            setDirectionInstruction(
              'No route'
            )

            setNextTurnDistance(
              null
            )

            if (
              arrowGroupRef.current
            ) {
              arrowGroupRef.current.visible =
                false
            }
          }
        )

        // =====================================================
        // 23. INITIALIZE ADAPTER
        // =====================================================

        await adapter.initialize()

        if (disposed) return

        setStatus(
          'Ready — localizing...'
        )

        console.log(
          '[Kokarya] Ready'
        )

        // =====================================================
        // 24. RESIZE
        // =====================================================

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

      // Dispose path
      if (
        pathMeshRef.current
      ) {
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

      // Dispose arrow
      if (
        arrowRef.current
      ) {
        arrowRef.current.geometry.dispose()

        const material =
          arrowRef.current.material

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

      arrowGroupRef.current =
        null

      arrowRef.current =
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

    setDirectionInstruction(
      'Calculating route...'
    )

    setNextTurnDistance(
      null
    )

    // Actual MultiSet navigation call
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
      {/* =====================================================
          THREE.JS / AR
      ===================================================== */}

      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* =====================================================
          TOP STATUS
      ===================================================== */}

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
        {/* TITLE */}

        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          Kokarya Full Map
        </div>

        {/* STATUS */}

        <div
          style={{
            marginTop: 6,
            fontSize: 15,
          }}
        >
          {status}
        </div>

        {/* NAVMESH GROUP COUNT */}

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

        {/* LOCALIZATION */}

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

        {/* TOTAL DISTANCE */}

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

        {/* =================================================
            DIRECTION INSTRUCTION
        ================================================= */}

        {directionInstruction && (
          <div
            style={{
              marginTop: 10,

              fontSize: 17,

              fontWeight: 600,

              color:
                directionInstruction ===
                'Arrived'
                  ? '#75ffae'
                  : '#00d9ff',
            }}
          >
            {directionInstruction ===
            'Turn left'
              ? '←'
              : directionInstruction ===
                'Turn right'
              ? '→'
              : directionInstruction ===
                'Arrived'
              ? '✓'
              : '↑'}{' '}
            {directionInstruction}
          </div>
        )}

        {/* NEXT TURN DISTANCE */}

        {nextTurnDistance !== null &&
          directionInstruction !==
            'Arrived' && (
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                opacity: 0.75,
              }}
            >
              Next instruction in{' '}
              {nextTurnDistance.toFixed(
                1
              )}{' '}
              m
            </div>
          )}

        {/* PATH ACTIVE */}

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

        {/* ERROR */}

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

      {/* =====================================================
          DESTINATION LIST
      ===================================================== */}

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

          scrollbarWidth:
            'none',
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