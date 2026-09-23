'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import {
  MultisetClient,
  XRSessionManager,
} from '@multisetai/vps/core'

import { ThreeAdapter } from '@multisetai/vps/three'

/* =========================================================
   TYPES
========================================================= */

type Destination = {
  id: string
  name: string
  position: THREE.Vector3
}

type NavigationState =
  | 'idle'
  | 'localizing'
  | 'navigating'
  | 'reached'

/* =========================================================
   DESTINATIONS
========================================================= */

const destinations: Destination[] = [
  {
    id: 'cabin-1',
    name: 'Cabin 1',
    position: new THREE.Vector3(
      4.355,
      -1.071,
      2.215
    ),
  },

  {
    id: 'cabin-2',
    name: 'Cabin 2',
    position: new THREE.Vector3(
      8.995,
      -1.109,
      2.241
    ),
  },

  {
    id: 'meeting-room',
    name: 'Meeting Room',
    position: new THREE.Vector3(
      12.398,
      -0.622,
      2.274
    ),
  },

  {
    id: 'lobby',
    name: 'Lobby',
    position: new THREE.Vector3(
      0.881,
      -1.947,
      -1.917
    ),
  },

  {
    id: 'pantry',
    name: 'Pantry',
    position: new THREE.Vector3(
      1.143,
      -1.238,
      7.950
    ),
  },

  {
    id: 'restroom',
    name: 'Restroom',
    position: new THREE.Vector3(
      -0.902,
      -1.385,
      7.157
    ),
  },

  {
    id: 'entrance',
    name: 'Entrance Door',
    position: new THREE.Vector3(
      -1.039,
      -1.388,
      1.468
    ),
  },
]

/* =========================================================
   CONSTANTS
========================================================= */

const REACHED_DISTANCE = 0.8

const ARROW_SPACING = 0.65

const ARROW_HEIGHT = 0.08

/* =========================================================
   HELPERS
========================================================= */

/**
 * Convert MultiSet map coordinates to Three.js world coordinates.
 *
 * MultiSet's worldFromMap may arrive as:
 * - THREE.Matrix4
 * - object containing elements[]
 * - 16-number array
 */
function convertMapToWorld(
  mapPosition: THREE.Vector3,
  worldFromMap: any
): THREE.Vector3 {
  if (!worldFromMap) {
    return mapPosition.clone()
  }

  if (worldFromMap instanceof THREE.Matrix4) {
    return mapPosition
      .clone()
      .applyMatrix4(worldFromMap)
  }

  if (
    worldFromMap.elements &&
    Array.isArray(worldFromMap.elements)
  ) {
    const matrix = new THREE.Matrix4()

    matrix.fromArray(worldFromMap.elements)

    return mapPosition
      .clone()
      .applyMatrix4(matrix)
  }

  if (
    Array.isArray(worldFromMap) &&
    worldFromMap.length === 16
  ) {
    const matrix = new THREE.Matrix4()

    matrix.fromArray(worldFromMap)

    return mapPosition
      .clone()
      .applyMatrix4(matrix)
  }

  return mapPosition.clone()
}

/* =========================================================
   COMPONENT
========================================================= */

export default function NavigatePage() {
  /* -------------------------------------------------------
     DOM
  ------------------------------------------------------- */

  const containerRef =
    useRef<HTMLDivElement>(null)

  /* -------------------------------------------------------
     THREE
  ------------------------------------------------------- */

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null)

  const sceneRef =
    useRef<THREE.Scene | null>(null)

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(null)

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  /* -------------------------------------------------------
     NAVIGATION OBJECTS
  ------------------------------------------------------- */

  const navigationGroupRef =
    useRef<THREE.Group | null>(null)

  const destinationMarkerRef =
    useRef<THREE.Group | null>(null)

  const destinationBoardRef =
    useRef<THREE.Sprite | null>(null)

  const arrowGroupRef =
    useRef<THREE.Group | null>(null)

  const destinationWorldRef =
    useRef<THREE.Vector3 | null>(null)

  const worldFromMapRef =
    useRef<any>(null)

  const currentMapPositionRef =
    useRef<THREE.Vector3 | null>(null)

  const selectedDestinationRef =
    useRef<Destination | null>(null)

  const lastArrowUpdateRef =
    useRef(0)

  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */

  const [status, setStatus] =
    useState('Initializing...')

  const [error, setError] =
    useState('')

  const [localized, setLocalized] =
    useState(false)

  const [selectedDestination, setSelectedDestination] =
    useState<Destination | null>(null)

  const [distance, setDistance] =
    useState<number | null>(null)

  const [navigationState, setNavigationState] =
    useState<NavigationState>('idle')

  /* =======================================================
     CREATE ARROW
  ======================================================= */

  const createArrow = (
    position: THREE.Vector3,
    direction: THREE.Vector3,
    scale = 1
  ) => {
    const group = new THREE.Group()

    /*
     * Arrow shaft
     */

    const shaftGeometry =
      new THREE.CylinderGeometry(
        0.045 * scale,
        0.045 * scale,
        0.30 * scale,
        12
      )

    const material =
      new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
      })

    const shaft =
      new THREE.Mesh(
        shaftGeometry,
        material
      )

    /*
     * Cylinder default direction = Y
     */

    shaft.position.y =
      0.15 * scale

    group.add(shaft)

    /*
     * Arrow head
     */

    const headGeometry =
      new THREE.ConeGeometry(
        0.13 * scale,
        0.25 * scale,
        4
      )

    const head =
      new THREE.Mesh(
        headGeometry,
        material
      )

    head.position.y =
      0.40 * scale

    group.add(head)

    /*
     * Point arrow along +Z.
     *
     * Default arrow points +Y.
     */

    const up =
      new THREE.Vector3(0, 1, 0)

    const dir =
      direction.clone().normalize()

    const quaternion =
      new THREE.Quaternion()

    quaternion.setFromUnitVectors(
      up,
      dir
    )

    group.quaternion.copy(
      quaternion
    )

    group.position.copy(
      position
    )

    /*
     * Lift above floor.
     */

    group.position.y +=
      ARROW_HEIGHT

    return group
  }

  /* =======================================================
     CREATE ARROW PATH
  ======================================================= */

  const createArrowPath = (
    from: THREE.Vector3,
    to: THREE.Vector3
  ) => {
    const group =
      new THREE.Group()

    /*
     * Ignore vertical difference for
     * walking direction.
     */

    const start =
      from.clone()

    const end =
      to.clone()

    /*
     * Keep navigation approximately
     * at the user's floor level.
     */

    end.y =
      start.y

    const direction =
      new THREE.Vector3()
        .subVectors(end, start)

    const totalDistance =
      direction.length()

    if (totalDistance < 0.1) {
      return group
    }

    direction.normalize()

    const arrowCount =
      Math.max(
        1,
        Math.floor(
          totalDistance /
            ARROW_SPACING
        )
      )

    /*
     * Create animated chevrons.
     */

    for (
      let i = 0;
      i < arrowCount;
      i++
    ) {
      const distanceAlongPath =
        i * ARROW_SPACING

      const position =
        start.clone().add(
          direction
            .clone()
            .multiplyScalar(
              distanceAlongPath
            )
        )

      /*
       * Alternate arrow size
       * for visual depth.
       */

      const scale =
        i % 2 === 0
          ? 1
          : 0.85

      const arrow =
        createArrow(
          position,
          direction,
          scale
        )

      /*
       * Save animation offset.
       */

      arrow.userData.index = i

      group.add(arrow)
    }

    return group
  }

  /* =======================================================
     UPDATE ARROW PATH
  ======================================================= */

  const updateNavigationPath = () => {
    const scene =
      sceneRef.current

    const currentMapPosition =
      currentMapPositionRef.current

    const destination =
      selectedDestinationRef.current

    const worldFromMap =
      worldFromMapRef.current

    if (
      !scene ||
      !currentMapPosition ||
      !destination ||
      !worldFromMap
    ) {
      return
    }

    /*
     * Convert current map position
     * to world position.
     */

    const currentWorld =
      convertMapToWorld(
        currentMapPosition,
        worldFromMap
      )

    /*
     * Convert destination map
     * position to world position.
     */

    const destinationWorld =
      convertMapToWorld(
        destination.position,
        worldFromMap
      )

    destinationWorldRef.current =
      destinationWorld.clone()

    /*
     * Distance
     */

    const distanceValue =
      currentMapPosition.distanceTo(
        destination.position
      )

    setDistance(
      distanceValue
    )

    /*
     * Destination reached
     */

    if (
      distanceValue <=
      REACHED_DISTANCE
    ) {
      setNavigationState(
        'reached'
      )

      setStatus(
        `You reached ${destination.name}`
      )

      /*
       * Remove arrows.
       */

      if (
        arrowGroupRef.current
      ) {
        scene.remove(
          arrowGroupRef.current
        )

        arrowGroupRef.current =
          null
      }

      return
    }

    /*
     * Still navigating
     */

    setNavigationState(
      'navigating'
    )

    /*
     * Remove old arrows.
     */

    if (
      arrowGroupRef.current
    ) {
      scene.remove(
        arrowGroupRef.current
      )
    }

    /*
     * Create new path.
     */

    const arrows =
      createArrowPath(
        currentWorld,
        destinationWorld
      )

    scene.add(
      arrows
    )

    arrowGroupRef.current =
      arrows
  }

  /* =======================================================
     CREATE DESTINATION MARKER
  ======================================================= */

  const createDestinationMarker = (
    position: THREE.Vector3,
    name: string
  ) => {
    const group =
      new THREE.Group()

    /*
     * Outer ring
     */

    const ringGeometry =
      new THREE.RingGeometry(
        0.25,
        0.35,
        32
      )

    const ringMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })

    const ring =
      new THREE.Mesh(
        ringGeometry,
        ringMaterial
      )

    ring.rotation.x =
      -Math.PI / 2

    group.add(ring)

    /*
     * Center cylinder
     */

    const cylinderGeometry =
      new THREE.CylinderGeometry(
        0.12,
        0.12,
        0.12,
        24
      )

    const cylinderMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
      })

    const cylinder =
      new THREE.Mesh(
        cylinderGeometry,
        cylinderMaterial
      )

    cylinder.position.y =
      0.06

    group.add(cylinder)

    /*
     * Vertical marker pole
     */

    const poleGeometry =
      new THREE.CylinderGeometry(
        0.025,
        0.025,
        1.5,
        12
      )

    const poleMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
      })

    const pole =
      new THREE.Mesh(
        poleGeometry,
        poleMaterial
      )

    pole.position.y =
      0.75

    group.add(pole)

    /*
     * Top marker
     */

    const topGeometry =
      new THREE.SphereGeometry(
        0.12,
        24,
        24
      )

    const top =
      new THREE.Mesh(
        topGeometry,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
        })
      )

    top.position.y =
      1.5

    group.add(top)

    group.position.copy(
      position
    )

    group.userData.destinationName =
      name

    return group
  }

  /* =======================================================
     CREATE DESTINATION BOARD
  ======================================================= */

  const createDestinationBoard = (
    name: string
  ) => {
    const canvas =
      document.createElement(
        'canvas'
      )

    canvas.width = 512
    canvas.height = 160

    const ctx =
      canvas.getContext('2d')

    if (!ctx) {
      return null
    }

    /*
     * Background
     */

    ctx.fillStyle =
      'rgba(20, 10, 30, 0.92)'

    ctx.beginPath()

    ctx.roundRect(
      10,
      10,
      492,
      140,
      28
    )

    ctx.fill()

    /*
     * Purple accent
     */

    ctx.fillStyle =
      '#8b5cf6'

    ctx.fillRect(
      10,
      10,
      12,
      140
    )

    /*
     * Destination name
     */

    ctx.fillStyle =
      '#ffffff'

    ctx.font =
      'bold 42px Arial'

    ctx.textAlign =
      'center'

    ctx.textBaseline =
      'middle'

    ctx.fillText(
      name,
      270,
      80
    )

    const texture =
      new THREE.CanvasTexture(
        canvas
      )

    texture.needsUpdate =
      true

    const material =
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      })

    const sprite =
      new THREE.Sprite(
        material
      )

    sprite.scale.set(
      2.5,
      0.78,
      1
    )

    return sprite
  }

  /* =======================================================
     SHOW DESTINATION
  ======================================================= */

  const showDestination = (
    destination: Destination
  ) => {
    const scene =
      sceneRef.current

    const worldFromMap =
      worldFromMapRef.current

    if (
      !scene ||
      !worldFromMap
    ) {
      return
    }

    selectedDestinationRef.current =
      destination

    /*
     * Remove previous marker.
     */

    if (
      destinationMarkerRef.current
    ) {
      scene.remove(
        destinationMarkerRef.current
      )

      destinationMarkerRef.current =
        null
    }

    /*
     * Remove previous board.
     */

    if (
      destinationBoardRef.current
    ) {
      scene.remove(
        destinationBoardRef.current
      )

      destinationBoardRef.current =
        null
    }

    /*
     * Destination world position.
     */

    const worldPosition =
      convertMapToWorld(
        destination.position,
        worldFromMap
      )

    destinationWorldRef.current =
      worldPosition.clone()

    /*
     * Marker.
     */

    const marker =
      createDestinationMarker(
        worldPosition,
        destination.name
      )

    destinationMarkerRef.current =
      marker

    scene.add(
      marker
    )

    /*
     * Name board.
     */

    const board =
      createDestinationBoard(
        destination.name
      )

    if (board) {
      board.position.copy(
        worldPosition
      )

      board.position.y +=
        1.9

      destinationBoardRef.current =
        board

      scene.add(
        board
      )
    }

    /*
     * Build path.
     */

    updateNavigationPath()

    setSelectedDestination(
      destination
    )

    setNavigationState(
      'navigating'
    )

    setStatus(
      `Navigating to ${destination.name}`
    )
  }

  /* =======================================================
     INITIALIZE
  ======================================================= */

  useEffect(() => {
    let disposed =
      false

    let adapter:
      | ThreeAdapter
      | null = null

    async function init() {
      try {
        setStatus(
          'Checking WebXR...'
        )

        const supported =
          await XRSessionManager.isSupported()

        if (!supported) {
          throw new Error(
            'WebXR is not supported on this device/browser.'
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

        /*
         * Renderer
         */

        const renderer =
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

        rendererRef.current =
          renderer

        /*
         * Scene
         */

        const scene =
          new THREE.Scene()

        sceneRef.current =
          scene

        /*
         * Camera
         */

        const camera =
          new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
              window.innerHeight,
            0.01,
            1000
          )

        cameraRef.current =
          camera

        /*
         * Navigation group
         */

        const navigationGroup =
          new THREE.Group()

        navigationGroupRef.current =
          navigationGroup

        scene.add(
          navigationGroup
        )

        /*
         * MultiSet session
         */

        setStatus(
          'Creating MultiSet XR session...'
        )

        const session =
          new XRSessionManager(
            renderer.getContext() as WebGL2RenderingContext,
            {
              client,

              autoLocalize:
                true,

              referenceSpaceType:
                'local',

              confidenceCheck:
                true,

              confidenceThreshold:
                0.5,

              onSessionStart:
                () => {
                  console.log(
                    'XR SESSION STARTED'
                  )

                  setStatus(
                    'Scanning...'
                  )
                },

              onSessionEnd:
                () => {
                  console.log(
                    'XR SESSION ENDED'
                  )

                  setStatus(
                    'AR session ended'
                  )
                },

              onLocalizationInit:
                () => {
                  console.log(
                    'Localization started'
                  )

                  setNavigationState(
                    'localizing'
                  )

                  setStatus(
                    'Scanning... Move the phone slowly and point at the mapped area.'
                  )
                },

              onLocalizationResult:
                (result: any) => {
                  console.log(
                    'Localization result:',
                    result
                  )

                  /*
                   * Save current map position.
                   */

                  const position =
                    result?.localizeData
                      ?.position

                  if (
                    position
                  ) {
                    currentMapPositionRef.current =
                      new THREE.Vector3(
                        position.x,
                        position.y,
                        position.z
                      )
                  }

                  /*
                   * Rebuild navigation
                   * if destination exists.
                   */

                  if (
                    selectedDestinationRef.current
                  ) {
                    updateNavigationPath()
                  }
                },

              onLocalizationFailure:
                (reason: any) => {
                  console.warn(
                    'Localization failed:',
                    reason
                  )

                  setStatus(
                    'Scanning... Move the phone slowly and point at the mapped area.'
                  )
                },

              onError:
                (error: any) => {
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

        /*
         * ThreeAdapter
         */

        adapter =
          new ThreeAdapter({
            session,
            renderer,
            scene,
            camera,

            showMesh: false,

            showGizmo: false,

            useDefaultButton:
              true,

            onLocalizationSuccess:
              (
                result: any,
                worldFromMap: any
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
                 * Save transform.
                 */

                worldFromMapRef.current =
                  worldFromMap

                /*
                 * Save map position.
                 */

                const position =
                  result?.localizeData
                    ?.position

                if (
                  position
                ) {
                  currentMapPositionRef.current =
                    new THREE.Vector3(
                      position.x,
                      position.y,
                      position.z
                    )
                }

                setLocalized(
                  true
                )

                setNavigationState(
                  'idle'
                )

                setStatus(
                  'Localized successfully! Select a destination.'
                )
              },

            onXRFrame:
              () => {
                /*
                 * Animate navigation.
                 */

                const now =
                  performance.now()

                /*
                 * Limit expensive
                 * path rebuilds.
                 */

                if (
                  now -
                    lastArrowUpdateRef.current >
                  300
                ) {
                  lastArrowUpdateRef.current =
                    now

                  if (
                    selectedDestinationRef.current &&
                    currentMapPositionRef.current
                  ) {
                    updateNavigationPath()
                  }
                }

                /*
                 * Animate arrows.
                 */

                const arrows =
                  arrowGroupRef.current

                if (arrows) {
                  arrows.children.forEach(
                    (
                      arrow,
                      index
                    ) => {
                      /*
                       * Floating animation
                       */

                      arrow.position.y +=
                        Math.sin(
                          now * 0.004 +
                            index * 0.8
                        ) *
                        0.0008

                      /*
                       * Pulse
                       */

                      const pulse =
                        1 +
                        Math.sin(
                          now * 0.005 +
                            index
                        ) *
                          0.08

                      arrow.scale.set(
                        pulse,
                        pulse,
                        pulse
                      )
                    }
                  )
                }

                /*
                 * Animate destination
                 * marker.
                 */

                const marker =
                  destinationMarkerRef.current

                if (marker) {
                  const scale =
                    1 +
                    Math.sin(
                      now * 0.004
                    ) *
                      0.08

                  marker.scale.set(
                    scale,
                    scale,
                    scale
                  )
                }

                /*
                 * Keep destination board
                 * facing the camera.
                 */

                const board =
                  destinationBoardRef.current

                if (
                  board &&
                  cameraRef.current
                ) {
                  board.quaternion.copy(
                    cameraRef.current
                      .quaternion
                  )
                }
              },
          })

        await adapter.initialize()

        if (disposed) {
          return
        }

        adapterRef.current =
          adapter

        /*
         * Resize
         */

        const handleResize =
          () => {
            const renderer =
              rendererRef.current

            const camera =
              cameraRef.current

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

        /*
         * Cleanup
         */

        return () => {
          window.removeEventListener(
            'resize',
            handleResize
          )

          try {
            adapter?.dispose()
          } catch (e) {
            console.error(e)
          }

          try {
            renderer.dispose()
          } catch (e) {
            console.error(e)
          }

          if (
            renderer.domElement
              .parentElement
          ) {
            renderer.domElement.remove()
          }
        }
      } catch (err: any) {
        console.error(
          'MultiSet initialization error:',
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

    return () => {
      disposed = true

      try {
        adapterRef.current?.dispose()
      } catch (e) {
        console.error(e)
      }

      adapterRef.current =
        null
    }
  }, [])

  /* =======================================================
     SELECT DESTINATION
  ======================================================= */

  const handleDestinationClick = (
    destination: Destination
  ) => {
    if (!localized) {
      setStatus(
        'Please wait until MultiSet localization is successful.'
      )

      return
    }

    showDestination(
      destination
    )
  }

  /* =======================================================
     STOP NAVIGATION
  ======================================================= */

  const stopNavigation = () => {
    selectedDestinationRef.current =
      null

    setSelectedDestination(
      null
    )

    setNavigationState(
      'idle'
    )

    setDistance(
      null
    )

    const scene =
      sceneRef.current

    if (!scene) {
      return
    }

    if (
      arrowGroupRef.current
    ) {
      scene.remove(
        arrowGroupRef.current
      )

      arrowGroupRef.current =
        null
    }

    if (
      destinationMarkerRef.current
    ) {
      scene.remove(
        destinationMarkerRef.current
      )

      destinationMarkerRef.current =
        null
    }

    if (
      destinationBoardRef.current
    ) {
      scene.remove(
        destinationBoardRef.current
      )

      destinationBoardRef.current =
        null
    }

    setStatus(
      'Select a destination.'
    )
  }

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
        fontFamily:
          'Arial, sans-serif',
      }}
    >
      {/* =================================================
          THREE.JS
      ================================================= */}

      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
        }}
      />

      {/* =================================================
          TOP STATUS
      ================================================= */}

      <div
        style={{
          position: 'fixed',
          top: 18,
          left: 18,
          right: 18,
          zIndex: 20,
          color: '#ffffff',
          background:
            'rgba(15, 10, 25, 0.78)',
          padding: 18,
          borderRadius: 20,
          backdropFilter:
            'blur(15px)',
          WebkitBackdropFilter:
            'blur(15px)',
          boxShadow:
            '0 10px 40px rgba(0,0,0,0.25)',
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
            marginTop: 6,
            fontSize: 15,
            opacity: 0.85,
          }}
        >
          {status}
        </div>

        {selectedDestination &&
          distance !== null && (
            <div
              style={{
                marginTop: 10,
                fontSize: 17,
                fontWeight: 700,
                color: '#c4b5fd',
              }}
            >
              {selectedDestination.name}{' '}
              •{' '}
              {distance.toFixed(1)} m
            </div>
          )}
      </div>

      {/* =================================================
          LEFT DESTINATION PANEL
      ================================================= */}

      {localized &&
        navigationState !==
          'reached' && (
          <div
            style={{
              position: 'fixed',
              left: 16,
              top: 150,
              bottom: 120,
              width: 190,
              zIndex: 20,
              display: 'flex',
              flexDirection:
                'column',
              gap: 8,
              pointerEvents:
                'auto',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                background:
                  'rgba(15,10,25,0.78)',
                color: '#ffffff',
                padding:
                  '10px 14px',
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 700,
                backdropFilter:
                  'blur(12px)',
              }}
            >
              DESTINATIONS
            </div>

            {destinations.map(
              (
                destination
              ) => {
                const active =
                  selectedDestination
                    ?.id ===
                  destination.id

                return (
                  <button
                    key={
                      destination.id
                    }
                    type="button"
                    onClick={() =>
                      handleDestinationClick(
                        destination
                      )
                    }
                    style={{
                      width:
                        '100%',
                      textAlign:
                        'left',
                      border: 'none',
                      borderRadius:
                        14,
                      padding:
                        '12px 14px',
                      color:
                        '#ffffff',
                      background:
                        active
                          ? 'rgba(124,58,237,0.92)'
                          : 'rgba(15,10,25,0.72)',
                      backdropFilter:
                        'blur(12px)',
                      fontSize: 14,
                      fontWeight:
                        active
                          ? 700
                          : 500,
                      boxShadow:
                        active
                          ? '0 8px 25px rgba(124,58,237,0.35)'
                          : 'none',
                      cursor:
                        'pointer',
                    }}
                  >
                    {destination.name}
                  </button>
                )
              }
            )}
          </div>
        )}

      {/* =================================================
          REACHED UI
      ================================================= */}

      {navigationState ===
        'reached' && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform:
              'translate(-50%, -50%)',
            zIndex: 50,
            width: 300,
            padding: 28,
            borderRadius: 28,
            background:
              'rgba(15,10,25,0.92)',
            color: '#ffffff',
            textAlign: 'center',
            backdropFilter:
              'blur(20px)',
            boxShadow:
              '0 20px 80px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              margin:
                '0 auto 18px',
              borderRadius:
                '50%',
              background:
                '#22c55e',
              display: 'flex',
              alignItems:
                'center',
              justifyContent:
                'center',
              fontSize: 42,
              animation:
                'destinationSuccess 1s ease-in-out infinite',
            }}
          >
            ✓
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            Destination Reached
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 16,
              opacity: 0.8,
            }}
          >
            {selectedDestination?.name}
          </div>

          <button
            type="button"
            onClick={
              stopNavigation
            }
            style={{
              marginTop: 24,
              width: '100%',
              border: 'none',
              borderRadius: 14,
              padding: 14,
              background:
                '#ffffff',
              color: '#111111',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Choose Another
          </button>
        </div>
      )}

      {/* =================================================
          STOP BUTTON
      ================================================= */}

      {localized &&
        navigationState !==
          'reached' &&
        selectedDestination && (
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 28,
              zIndex: 30,
              display: 'flex',
              justifyContent:
                'center',
            }}
          >
            <button
              type="button"
              onClick={
                stopNavigation
              }
              style={{
                border:
                  '1px solid rgba(255,255,255,0.5)',
                borderRadius: 16,
                padding:
                  '13px 28px',
                background:
                  'rgba(0,0,0,0.65)',
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 700,
                backdropFilter:
                  'blur(12px)',
              }}
            >
              Stop Navigation
            </button>
          </div>
        )}

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div
          style={{
            position: 'fixed',
            left: 18,
            right: 18,
            bottom: 20,
            zIndex: 100,
            padding: 14,
            borderRadius: 14,
            background:
              'rgba(120,0,0,0.85)',
            color: '#ffffff',
            fontSize: 13,
            wordBreak:
              'break-word',
          }}
        >
          {error}
        </div>
      )}

      {/* =================================================
          SUCCESS ANIMATION
      ================================================= */}

      <style jsx>{`
        @keyframes destinationSuccess {
          0% {
            transform: scale(1);
            box-shadow:
              0 0 0 0
              rgba(34, 197, 94, 0.6);
          }

          50% {
            transform: scale(1.08);
            box-shadow:
              0 0 0 18px
              rgba(34, 197, 94, 0);
          }

          100% {
            transform: scale(1);
            box-shadow:
              0 0 0 0
              rgba(34, 197, 94, 0);
          }
        }
      `}</style>
    </main>
  )
}