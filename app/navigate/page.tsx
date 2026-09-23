'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import {
  MultisetClient,
  XRSessionManager,
} from '@multisetai/vps/core'

import { ThreeAdapter } from '@multisetai/vps/three'


import { AnimatedArrowPath } from '@/components/navigation/AnimatedArrowPath'
import { DestinationDrawer, DestinationItem } from '@/components/navigation/destination-drawer'

/* =========================================================
   TYPES
========================================================= */

type Destination = DestinationItem & {
  position: THREE.Vector3
}

/* =========================================================
   DESTINATIONS
   Kokarya map coordinates
========================================================= */

const DESTINATIONS: Destination[] = [
  {
    id: 'cabin-1',
    name: 'Cabin 1',
    position: new THREE.Vector3(
      3.415,
      -2.196,
      1.390
    ),
  },

  {
    id: 'cabin-2',
    name: 'Cabin 2',
    position: new THREE.Vector3(
      9.726,
      -2.138,
      1.542
    ),
  },

  {
    id: 'meeting-room',
    name: 'Meeting Room',
    position: new THREE.Vector3(
      11.947,
      -2.185,
      1.352
    ),
  },

  {
    id: 'lobby',
    name: 'Lobby',
    position: new THREE.Vector3(
      1.282,
      -1.214,
      -2.935
    ),
  },

  {
    id: 'panetry',
    name: 'Panetry',
    position: new THREE.Vector3(
      0.955,
      -1.226,
      7.942
    ),
  },

  {
    id: 'restroom',
    name: 'Restroom',
    position: new THREE.Vector3(
      -0.895,
      -1.498,
      6.978
    ),
  },

  {
    id: 'entrance-door',
    name: 'Entrance Door',
    position: new THREE.Vector3(
      -0.058,
      -2.210,
      1.260
    ),
  },
]

/* =========================================================
   CONSTANTS
========================================================= */

const ARRIVAL_DISTANCE = 0.65

/*
 * Small offset above the actual floor.
 *
 * This prevents z-fighting when the arrow is exactly
 * touching the physical/map floor.
 */
const ARROW_FLOOR_OFFSET = 0.025

/*
 * Approximate eye height.
 *
 * Used only as a fallback when we don't have a reliable
 * destination floor height.
 */
const DEFAULT_EYE_HEIGHT = 1.4

/* =========================================================
   PAGE
========================================================= */

export default function NavigatePage() {
  const containerRef =
    useRef<HTMLDivElement | null>(null)

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const arrowPathRef =
    useRef<AnimatedArrowPath | null>(null)

  const worldFromMapRef =
    useRef<THREE.Matrix4 | null>(null)

  const selectedDestinationRef =
    useRef<Destination | null>(null)

  const destinationWorldPositionRef =
    useRef<THREE.Vector3 | null>(null)

  const destinationMarkerRef =
    useRef<THREE.Group | null>(null)

  const destinationBoardRef =
    useRef<THREE.Sprite | null>(null)

  const currentUserWorldPositionRef =
    useRef(new THREE.Vector3())

  const lastDistanceRef =
    useRef<number | null>(null)

  const arrivalStableFramesRef =
    useRef(0)

  const [selectedId, setSelectedId] =
    useState<string | null>(null)

  const [status, setStatus] =
    useState('Initializing...')

  const [error, setError] =
    useState('')

  const [distance, setDistance] =
    useState<number | null>(null)

  const [reached, setReached] =
    useState(false)

  /* =======================================================
     DESTINATION SELECTION
  ======================================================= */

  function handleDestinationSelect(id: string) {
    const destination =
      DESTINATIONS.find(
        item => item.id === id
      )

    if (!destination) {
      return
    }

    selectedDestinationRef.current =
      destination

    setSelectedId(id)

    setReached(false)

    arrivalStableFramesRef.current = 0

    lastDistanceRef.current = null

    setStatus(
      `Navigating to ${destination.name}`
    )

    /*
     * If localization already happened,
     * immediately update the destination marker.
     */
    const worldFromMap =
      worldFromMapRef.current

    if (worldFromMap) {
      updateDestinationWorldPosition(
        destination,
        worldFromMap
      )
    }
  }

  /* =======================================================
     MAP -> WORLD POSITION
  ======================================================= */

  function updateDestinationWorldPosition(
    destination: Destination,
    worldFromMap: THREE.Matrix4
  ) {
    /*
     * IMPORTANT:
     *
     * destination.position is a MultiSet MAP coordinate.
     *
     * worldFromMap converts:
     *
     * MAP -> THREE WORLD
     */
    const worldPosition =
      destination.position
        .clone()
        .applyMatrix4(worldFromMap)

    destinationWorldPositionRef.current =
      worldPosition

    /*
     * Move marker.
     */
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.position.copy(
        worldPosition
      )
    }

    /*
     * Move board.
     */
    if (destinationBoardRef.current) {
      destinationBoardRef.current.position.set(
        worldPosition.x,
        worldPosition.y + 1.05,
        worldPosition.z
      )
    }
  }

  /* =======================================================
     CREATE DESTINATION MARKER
  ======================================================= */

  function createDestinationMarker(
    scene: THREE.Scene
  ) {
    const group = new THREE.Group()

    /*
     * Main glowing sphere.
     */
    const sphereGeometry =
      new THREE.SphereGeometry(
        0.12,
        24,
        24
      )

    const sphereMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
        transparent: true,
        opacity: 0.95,
      })

    const sphere =
      new THREE.Mesh(
        sphereGeometry,
        sphereMaterial
      )

    sphere.position.y = 0.22

    group.add(sphere)

    /*
     * Cone/pin underneath.
     */
    const coneGeometry =
      new THREE.ConeGeometry(
        0.10,
        0.24,
        24
      )

    const coneMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
        transparent: true,
        opacity: 0.95,
      })

    const cone =
      new THREE.Mesh(
        coneGeometry,
        coneMaterial
      )

    cone.position.y = 0.08

    group.add(cone)

    /*
     * Ground ring.
     */
    const ringGeometry =
      new THREE.RingGeometry(
        0.18,
        0.25,
        32
      )

    const ringMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      })

    const ring =
      new THREE.Mesh(
        ringGeometry,
        ringMaterial
      )

    ring.rotation.x =
      -Math.PI / 2

    ring.position.y =
      ARROW_FLOOR_OFFSET

    group.add(ring)

    /*
     * Outer glow ring.
     */
    const glowGeometry =
      new THREE.RingGeometry(
        0.28,
        0.31,
        32
      )

    const glowMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      })

    const glow =
      new THREE.Mesh(
        glowGeometry,
        glowMaterial
      )

    glow.rotation.x =
      -Math.PI / 2

    glow.position.y =
      ARROW_FLOOR_OFFSET + 0.002

    group.add(glow)

    scene.add(group)

    destinationMarkerRef.current =
      group

    return group
  }

  /* =======================================================
     CREATE DESTINATION BOARD
  ======================================================= */

  function createDestinationBoard(
    scene: THREE.Scene
  ) {
    const canvas =
      document.createElement('canvas')

    canvas.width = 512
    canvas.height = 160

    const context =
      canvas.getContext('2d')

    if (!context) {
      return null
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    )

    /*
     * Background.
     */
    context.fillStyle =
      'rgba(15, 15, 20, 0.92)'

    roundRect(
      context,
      10,
      10,
      492,
      140,
      28
    )

    context.fill()

    /*
     * Purple accent.
     */
    context.fillStyle =
      '#7c3aed'

    roundRect(
      context,
      10,
      10,
      10,
      140,
      5
    )

    context.fill()

    /*
     * Destination icon.
     */
    context.fillStyle =
      '#ffffff'

    context.beginPath()

    context.arc(
      55,
      80,
      15,
      0,
      Math.PI * 2
    )

    context.fill()

    /*
     * Text.
     */
    context.fillStyle =
      '#ffffff'

    context.font =
      'bold 40px Arial'

    context.textBaseline =
      'middle'

    context.fillText(
      'Destination',
      90,
      58
    )

    context.font =
      'bold 32px Arial'

    context.fillStyle =
      '#c4b5fd'

    context.fillText(
      'Select destination',
      90,
      105
    )

    const texture =
      new THREE.CanvasTexture(
        canvas
      )

    texture.colorSpace =
      THREE.SRGBColorSpace

    const material =
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      })

    const sprite =
      new THREE.Sprite(material)

    /*
     * Not too large.
     */
    sprite.scale.set(
      1.35,
      0.42,
      1
    )

    scene.add(sprite)

    destinationBoardRef.current =
      sprite

    return sprite
  }

  /* =======================================================
     UPDATE BOARD TEXT
  ======================================================= */

  function updateDestinationBoard(
    name: string
  ) {
    const sprite =
      destinationBoardRef.current

    if (!sprite) {
      return
    }

    const material =
      sprite.material as THREE.SpriteMaterial

    const texture =
      material.map

    if (!texture) {
      return
    }

    const canvas =
      texture.image as HTMLCanvasElement

    const context =
      canvas.getContext('2d')

    if (!context) {
      return
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    )

    /*
     * Background.
     */
    context.fillStyle =
      'rgba(15, 15, 20, 0.92)'

    roundRect(
      context,
      10,
      10,
      492,
      140,
      28
    )

    context.fill()

    /*
     * Purple bar.
     */
    context.fillStyle =
      '#7c3aed'

    roundRect(
      context,
      10,
      10,
      10,
      140,
      5
    )

    context.fill()

    /*
     * Small location icon.
     */
    context.fillStyle =
      '#a78bfa'

    context.beginPath()

    context.arc(
      55,
      80,
      15,
      0,
      Math.PI * 2
    )

    context.fill()

    /*
     * Destination name.
     */
    context.fillStyle =
      '#ffffff'

    context.font =
      'bold 38px Arial'

    context.textBaseline =
      'middle'

    context.fillText(
      name,
      90,
      80
    )

    texture.needsUpdate = true
  }

  /* =======================================================
     INIT
  ======================================================= */

  useEffect(() => {
    let disposed = false

    let scene: THREE.Scene | null =
      null

    let renderer:
      THREE.WebGLRenderer | null =
      null

    let camera:
      THREE.PerspectiveCamera | null =
      null

    async function init() {
      try {
        setStatus(
          'Checking WebXR...'
        )

        /*
         * Use ThreeAdapter support check.
         */
        const supported =
          await ThreeAdapter.isSupported()

        if (!supported) {
          throw new Error(
            'WebXR immersive AR is not supported on this device/browser.'
          )
        }

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

        setStatus(
          'Creating AR renderer...'
        )

        /* =================================================
           RENDERER
        ================================================= */

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

        /* =================================================
           SCENE
        ================================================= */

        scene =
          new THREE.Scene()

        /* =================================================
           CAMERA
        ================================================= */

        camera =
          new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
            window.innerHeight,
            0.01,
            1000
          )

        /* =================================================
           AR SESSION
        ================================================= */

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

              confidenceThreshold: 0.5,

              onSessionStart: () => {
                console.log(
                  'XR SESSION STARTED'
                )

                setStatus(
                  selectedDestinationRef.current
                    ? `Navigating to ${selectedDestinationRef.current.name}`
                    : 'Scanning...'
                )
              },

              onSessionEnd: () => {
                console.log(
                  'XR SESSION ENDED'
                )

                setStatus(
                  'AR session ended'
                )

                setDistance(null)

                setReached(false)

                arrivalStableFramesRef.current = 0
              },

              onLocalizationInit: () => {
                console.log(
                  'Localization started'
                )

                setStatus(
                  'Scanning... Move the phone slowly and point at the mapped area.'
                )
              },

              onLocalizationResult: (
                result: any
              ) => {
                console.log(
                  'Localization result:',
                  result
                )
              },

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

              onError: (
                sessionError: any
              ) => {
                console.error(
                  'XR ERROR:',
                  sessionError
                )

                setError(
                  sessionError?.message ||
                  String(sessionError)
                )
              },
            }
          )

        /* =================================================
           THREE ADAPTER
        ================================================= */

        const adapter =
          new ThreeAdapter({
            session,

            renderer,

            scene,

            camera,

            /*
             * Keep map mesh hidden.
             */
            showMesh: false,

            showGizmo: false,

            useDefaultButton: true,

            /* =============================================
               LOCALIZATION SUCCESS
            ============================================= */

            onLocalizationSuccess: (
              result: any,
              worldFromMap: THREE.Matrix4
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

              /*
               * Save latest map -> world transform.
               */
              worldFromMapRef.current =
                worldFromMap.clone()

              /*
               * If destination was already selected,
               * immediately convert it.
               */
              const destination =
                selectedDestinationRef.current

              if (destination) {
                updateDestinationWorldPosition(
                  destination,
                  worldFromMap
                )

                updateDestinationBoard(
                  destination.name
                )
              }

              setStatus(
                destination
                  ? `Navigating to ${destination.name}`
                  : 'Localized successfully!'
              )
            },

            /* =============================================
               XR FRAME
            ============================================= */

            onXRFrame: () => {
              if (!camera) {
                return
              }

              /*
               * VERY IMPORTANT:
               *
               * MultiSet updates camera.matrixWorld.
               *
               * Do NOT use camera.position.
               *
               * Use getWorldPosition().
               */
              camera.getWorldPosition(
                currentUserWorldPositionRef.current
              )

              const userPosition =
                currentUserWorldPositionRef.current

              /*
               * Animate arrows every XR frame.
               */
              if (arrowPathRef.current) {
                arrowPathRef.current.update()
              }

              const destination =
                selectedDestinationRef.current

              const destinationWorld =
                destinationWorldPositionRef.current

              if (
                !destination ||
                !destinationWorld
              ) {
                return
              }

              /*
               * Calculate horizontal distance.
               *
               * We intentionally ignore Y because
               * navigation is primarily on the floor.
               */
              const dx =
                destinationWorld.x -
                userPosition.x

              const dz =
                destinationWorld.z -
                userPosition.z

              const horizontalDistance =
                Math.sqrt(
                  dx * dx +
                  dz * dz
                )

              setDistance(
                horizontalDistance
              )

              /*
               * -----------------------------------------
               * FLOOR HEIGHT
               * -----------------------------------------
               *
               * Destination Y is normally the map
               * coordinate recorded at the destination.
               *
               * After worldFromMap conversion it becomes
               * the corresponding world floor height.
               */
              const floorY =
                destinationWorld.y +
                ARROW_FLOOR_OFFSET

              /*
               * Start arrow exactly from the user's
               * current X/Z position.
               *
               * But put the arrow on the floor rather
               * than at the camera's eye height.
               */
              const arrowStart =
                new THREE.Vector3(
                  userPosition.x,
                  floorY,
                  userPosition.z
                )

              /*
               * Destination point also sits at floor level.
               */
              const arrowEnd =
                new THREE.Vector3(
                  destinationWorld.x,
                  floorY,
                  destinationWorld.z
                )

              /*
               * Update arrow path.
               *
               * This makes the path begin from the
               * user's current physical position.
               */
              if (
                arrowPathRef.current
              ) {
                arrowPathRef.current.setGroundY(
                  floorY
                )

                arrowPathRef.current.setPath(
                  arrowStart,
                  arrowEnd
                )
              }

              /*
               * -----------------------------------------
               * ARRIVAL DETECTION
               * -----------------------------------------
               *
               * Require several consecutive frames
               * inside the arrival radius.
               *
               * This avoids flickering between:
               *
               * Reached / Navigating
               *
               * when VPS pose moves slightly.
               */
              if (
                horizontalDistance <=
                ARRIVAL_DISTANCE
              ) {
                arrivalStableFramesRef.current +=
                  1
              } else {
                arrivalStableFramesRef.current = 0
              }

              /*
               * Roughly 10 consecutive frames.
               */
              if (
                arrivalStableFramesRef.current >=
                10
              ) {
                if (!reached) {
                  setReached(true)

                  setStatus(
                    `You reached ${destination.name}`
                  )
                }
              } else {
                if (reached) {
                  setReached(false)

                  setStatus(
                    `Navigating to ${destination.name}`
                  )
                }
              }
            },
          })

        adapterRef.current =
          adapter

        /* =================================================
           CREATE ARROW PATH
        ================================================= */

        const arrowPath = new AnimatedArrowPath({
          color: 0x8b5cf6,

          // Number of arrows
          arrowCount: 18,

          // Distance between arrows
          spacing: 0.55,

          // Tiny offset above the real floor
          // Prevents z-fighting
          groundOffset: 0.012,

          // Width of the navigation corridor
          pathWidth: 0.95,

          // Arrow width
          arrowWidth: 0.42,

          // Arrow length
          arrowLength: 0.55,

          // Animation speed
          animationSpeed: 0.9,

          // Side border opacity
          railOpacity: 0.55,

          // Arrow opacity
          arrowOpacity: 0.95,
        })

        scene.add(
          arrowPath.group
        )

        /*
         * Start hidden.
         *
         * We don't want arrows before localization.
         */
        arrowPath.group.visible = false

        arrowPathRef.current =
          arrowPath

        /* =================================================
           DESTINATION MARKER
        ================================================= */

        const marker =
          createDestinationMarker(
            scene
          )

        marker.visible = false

        /* =================================================
           DESTINATION BOARD
        ================================================= */

        const board =
          createDestinationBoard(
            scene
          )

        if (board) {
          board.visible = false
        }

        /* =================================================
           INITIALIZE ADAPTER
        ================================================= */

        await adapter.initialize()

        if (disposed) {
          return
        }

        /*
         * Now we can show the navigation system
         * only after localization.
         */
        setStatus(
          'Ready — tap START AR.'
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

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      disposed = true

      try {
        arrowPathRef.current?.dispose()
      } catch (error) {
        console.error(
          'Arrow cleanup error:',
          error
        )
      }

      arrowPathRef.current = null

      destinationMarkerRef.current = null

      destinationBoardRef.current = null

      worldFromMapRef.current = null

      destinationWorldPositionRef.current =
        null

      try {
        adapterRef.current?.dispose()
      } catch (error) {
        console.error(
          'Adapter cleanup error:',
          error
        )
      }

      adapterRef.current = null

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
  }, [reached])

  /* =======================================================
     WHEN DESTINATION CHANGES
  ======================================================= */

  useEffect(() => {
    const destination =
      selectedDestinationRef.current

    const worldFromMap =
      worldFromMapRef.current

    if (
      !destination ||
      !worldFromMap
    ) {
      return
    }

    updateDestinationWorldPosition(
      destination,
      worldFromMap
    )

    updateDestinationBoard(
      destination.name
    )

    /*
     * Show navigation objects.
     */
    if (arrowPathRef.current) {
      arrowPathRef.current.group.visible =
        true
    }

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.visible =
        true
    }

    if (destinationBoardRef.current) {
      destinationBoardRef.current.visible =
        true
    }
  }, [selectedId])

  /* =======================================================
     DESTINATION UI
  ======================================================= */

  const selectedDestination =
    DESTINATIONS.find(
      item => item.id === selectedId
    )

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      {/* =================================================
          THREE.JS CANVAS
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

      {/* =================================================
          TOP STATUS
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

          padding: '14px 16px',

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
          Indoor Navigation
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

      {/* =================================================
          DISTANCE OVERLAY
      ================================================= */}

      {selectedDestination &&
        distance !== null && (
          <div
            style={{
              position: 'fixed',

              /*
               * Bottom area but above the
               * destination selector.
               */
              bottom: 92,

              left: '50%',

              transform:
                'translateX(-50%)',

              zIndex: 30,

              minWidth: 180,

              padding:
                '12px 20px',

              borderRadius: 18,

              textAlign: 'center',

              color: '#ffffff',

              background:
                'rgba(10,10,15,0.82)',

              backdropFilter:
                'blur(16px)',

              WebkitBackdropFilter:
                'blur(16px)',

              border:
                '1px solid rgba(255,255,255,0.14)',

              boxShadow:
                '0 10px 40px rgba(0,0,0,0.25)',

              pointerEvents: 'none',
            }}
          >
            {reached ? (
              <>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#c4b5fd',
                  }}
                >
                  Destination reached
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 13,
                    opacity: 0.85,
                  }}
                >
                  {selectedDestination.name}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                  }}
                >
                  Distance remaining
                </div>

                <div
                  style={{
                    marginTop: 2,
                    fontSize: 24,
                    fontWeight: 800,
                  }}
                >
                  {distance < 10
                    ? distance.toFixed(1)
                    : Math.round(distance)}{' '}
                  m
                </div>

                <div
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    opacity: 0.7,
                  }}
                >
                  →{' '}
                  {
                    selectedDestination.name
                  }
                </div>
              </>
            )}
          </div>
        )}

      {/* =================================================
          DESTINATION DRAWER
      ================================================= */}

      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: 0,
          right: 0,

          display: 'flex',
          justifyContent: 'center',

          zIndex: 40,
        }}
      >
        <DestinationDrawer
          destinations={DESTINATIONS}
          selectedId={selectedId}
          disabled={false}
          onSelect={
            handleDestinationSelect
          }
        />
      </div>
    </main>
  )
}

/* =========================================================
   CANVAS ROUND RECT HELPER
========================================================= */

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath()

  context.moveTo(
    x + radius,
    y
  )

  context.lineTo(
    x + width - radius,
    y
  )

  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + radius
  )

  context.lineTo(
    x + width,
    y + height - radius
  )

  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height
  )

  context.lineTo(
    x + radius,
    y + height
  )

  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - radius
  )

  context.lineTo(
    x,
    y + radius
  )

  context.quadraticCurveTo(
    x,
    y,
    x + radius,
    y
  )

  context.closePath()
}