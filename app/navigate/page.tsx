'use client'

import {
  useCallback,
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
  DestinationDrawer,
  type DestinationItem,
} from '@/components/navigation/destination-drawer'

import {
  Check,
  LocateFixed,
  Navigation,
  RotateCcw,
} from 'lucide-react'

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
    id: 'pantry',
    name: 'Pantry',
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

const destinationItems: DestinationItem[] =
  destinations.map(item => ({
    id: item.id,
    name: item.name,
  }))

/* =========================================================
   NAVIGATION CONFIG
========================================================= */

/**
 * Distance at which we consider the user arrived.
 *
 * This is map-coordinate distance in meters.
 */
const REACHED_DISTANCE = 0.75

/**
 * User must remain inside the reached radius
 * for several localization updates.
 *
 * This prevents false "destination reached".
 */
const REQUIRED_REACHED_SAMPLES = 3

/**
 * Don't rebuild arrows for tiny movements.
 */
const PATH_UPDATE_DISTANCE = 0.18

/**
 * Floor arrow height.
 *
 * Keep this LOW so arrows don't float.
 */
const ARROW_Y_OFFSET = 0.035

/**
 * Distance between arrows.
 */
const ARROW_SPACING = 0.55

/**
 * Arrow width.
 */
const ARROW_WIDTH = 0.30

/**
 * Destination board height.
 *
 * Much lower than the previous 1.9m.
 */
const BOARD_Y_OFFSET = 0.85

/* =========================================================
   COMPONENT
========================================================= */

export default function NavigatePage() {
  /* =======================================================
     DOM
  ======================================================= */

  const containerRef =
    useRef<HTMLDivElement>(null)

  /* =======================================================
     THREE
  ======================================================= */

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

  /* =======================================================
     NAVIGATION THREE OBJECTS
  ======================================================= */

  const navigationGroupRef =
    useRef<THREE.Group | null>(null)

  const arrowGroupRef =
    useRef<THREE.Group | null>(null)

  const destinationMarkerRef =
    useRef<THREE.Group | null>(null)

  const destinationBoardRef =
    useRef<THREE.Sprite | null>(null)

  /* =======================================================
     NAVIGATION DATA
  ======================================================= */

  const currentMapPositionRef =
    useRef<THREE.Vector3 | null>(null)

  const selectedDestinationRef =
    useRef<Destination | null>(null)

  const lastPathPositionRef =
    useRef<THREE.Vector3 | null>(null)

  const reachedSamplesRef =
    useRef(0)

  const lastLocalizationTimeRef =
    useRef(0)

  /* =======================================================
     STATE
  ======================================================= */

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
     CLEAR NAVIGATION OBJECTS
  ======================================================= */

  const clearNavigationObjects =
    useCallback(() => {
      const navigationGroup =
        navigationGroupRef.current

      if (!navigationGroup) {
        return
      }

      while (
        navigationGroup.children.length
      ) {
        const object =
          navigationGroup.children[
            0
          ]

        navigationGroup.remove(object)

        object.traverse(child => {
          const mesh =
            child as THREE.Mesh

          if (mesh.geometry) {
            mesh.geometry.dispose()
          }

          const material =
            mesh.material

          if (Array.isArray(material)) {
            material.forEach(
              item => item.dispose()
            )
          } else if (material) {
            material.dispose()
          }
        })
      }

      arrowGroupRef.current = null
      destinationMarkerRef.current = null
      destinationBoardRef.current = null
    }, [])

  /* =======================================================
     CREATE FLOOR CHEVRON
  ======================================================= */

  const createChevron = (
    direction: THREE.Vector3,
    index: number
  ) => {
    const shape =
      new THREE.Shape()

    const width =
      ARROW_WIDTH

    const length = 0.42

    /**
     * Chevron / arrow shape.
     *
     * It lies flat on the floor.
     */
    shape.moveTo(
      -width * 0.5,
      -length * 0.35
    )

    shape.lineTo(
      0,
      length * 0.5
    )

    shape.lineTo(
      width * 0.5,
      -length * 0.35
    )

    shape.lineTo(
      width * 0.22,
      -length * 0.35
    )

    shape.lineTo(
      0,
      0.12
    )

    shape.lineTo(
      -width * 0.22,
      -length * 0.35
    )

    shape.closePath()

    const geometry =
      new THREE.ShapeGeometry(shape)

    const material =
      new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      })

    const mesh =
      new THREE.Mesh(
        geometry,
        material
      )

    /**
     * ShapeGeometry lies in XY.
     *
     * Rotate it onto the floor.
     */
    mesh.rotation.x =
      -Math.PI / 2

    /**
     * Shape points +Y.
     *
     * Rotate toward walking direction.
     */
    const angle =
      Math.atan2(
        direction.x,
        direction.z
      )

    mesh.rotation.y =
      angle

    mesh.position.y =
      ARROW_Y_OFFSET

    mesh.userData.index =
      index

    mesh.userData.baseScale =
      1

    return mesh
  }

  /* =======================================================
     CREATE ARROW PATH
  ======================================================= */

  const createArrowPath = (
    current: THREE.Vector3,
    destination: THREE.Vector3
  ) => {
    const group =
      new THREE.Group()

    /**
     * Navigation happens on the floor.
     *
     * Ignore Y completely.
     */
    const start =
      new THREE.Vector3(
        current.x,
        current.y,
        current.z
      )

    const end =
      new THREE.Vector3(
        destination.x,
        current.y,
        destination.z
      )

    const direction =
      new THREE.Vector3()
        .subVectors(
          end,
          start
        )

    const totalDistance =
      direction.length()

    if (
      totalDistance <
      0.1
    ) {
      return group
    }

    direction.normalize()

    const count =
      Math.max(
        1,
        Math.floor(
          totalDistance /
            ARROW_SPACING
        )
      )

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const distanceAlong =
        i * ARROW_SPACING

      const position =
        start
          .clone()
          .add(
            direction
              .clone()
              .multiplyScalar(
                distanceAlong
              )
          )

      const arrow =
        createChevron(
          direction,
          i
        )

      arrow.position.x =
        position.x

      arrow.position.z =
        position.z

      /**
       * Every second arrow starts
       * slightly smaller.
       */
      const scale =
        i % 2 === 0
          ? 1
          : 0.85

      arrow.scale.set(
        scale,
        scale,
        scale
      )

      group.add(arrow)
    }

    return group
  }

  /* =======================================================
     UPDATE ARROW PATH
  ======================================================= */

  const updateArrowPath = useCallback(
    (
      force = false
    ) => {
      const navigationGroup =
        navigationGroupRef.current

      const current =
        currentMapPositionRef.current

      const destination =
        selectedDestinationRef.current

      if (
        !navigationGroup ||
        !current ||
        !destination
      ) {
        return
      }

      if (
        !force &&
        lastPathPositionRef.current
      ) {
        const movement =
          current.distanceTo(
            lastPathPositionRef.current
          )

        if (
          movement <
          PATH_UPDATE_DISTANCE
        ) {
          return
        }
      }

      /**
       * Remove ONLY old arrows.
       */
      if (
        arrowGroupRef.current
      ) {
        navigationGroup.remove(
          arrowGroupRef.current
        )

        arrowGroupRef.current =
          null
      }

      const arrows =
        createArrowPath(
          current,
          destination.position
        )

      navigationGroup.add(
        arrows
      )

      arrowGroupRef.current =
        arrows

      lastPathPositionRef.current =
        current.clone()
    },
    []
  )

  /* =======================================================
     CREATE DESTINATION MARKER
  ======================================================= */

  const createDestinationMarker = (
    name: string
  ) => {
    const group =
      new THREE.Group()

    /* -----------------------------------------------------
       FLOOR PULSE RING
    ----------------------------------------------------- */

    const ring =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.32,
          0.38,
          48
        ),
        new THREE.MeshBasicMaterial({
          color: 0x8b5cf6,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )

    ring.rotation.x =
      -Math.PI / 2

    ring.position.y =
      0.025

    group.add(ring)

    /* -----------------------------------------------------
       INNER TARGET
    ----------------------------------------------------- */

    const target =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          0.19,
          32
        ),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )

    target.rotation.x =
      -Math.PI / 2

    target.position.y =
      0.028

    group.add(target)

    /* -----------------------------------------------------
       PIN
    ----------------------------------------------------- */

    const pin =
      new THREE.Mesh(
        new THREE.ConeGeometry(
          0.12,
          0.32,
          24
        ),
        new THREE.MeshBasicMaterial({
          color: 0x8b5cf6,
          transparent: true,
          opacity: 0.98,
        })
      )

    pin.position.y =
      0.23

    group.add(pin)

    /* -----------------------------------------------------
       PIN TOP
    ----------------------------------------------------- */

    const pinTop =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.13,
          24,
          24
        ),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
        })
      )

    pinTop.position.y =
      0.43

    group.add(pinTop)

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

    canvas.width = 700
    canvas.height = 180

    const ctx =
      canvas.getContext('2d')

    if (!ctx) {
      return null
    }

    /* Background */

    ctx.fillStyle =
      'rgba(15,10,25,0.92)'

    ctx.beginPath()

    ctx.roundRect(
      8,
      8,
      684,
      164,
      30
    )

    ctx.fill()

    /* Purple left accent */

    ctx.fillStyle =
      '#8b5cf6'

    ctx.fillRect(
      8,
      8,
      14,
      164
    )

    /* Icon */

    ctx.fillStyle =
      '#8b5cf6'

    ctx.beginPath()

    ctx.arc(
      75,
      90,
      28,
      0,
      Math.PI * 2
    )

    ctx.fill()

    /* Text */

    ctx.fillStyle =
      '#ffffff'

    ctx.font =
      'bold 46px Arial'

    ctx.textAlign =
      'left'

    ctx.textBaseline =
      'middle'

    ctx.fillText(
      name,
      125,
      90
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
        depthWrite: false,
      })

    const sprite =
      new THREE.Sprite(
        material
      )

    /**
     * Keep board reasonably small.
     */
    sprite.scale.set(
      2.2,
      0.57,
      1
    )

    sprite.userData.destinationName =
      name

    return sprite
  }

  /* =======================================================
     SHOW DESTINATION
  ======================================================= */

  const showDestination = useCallback(
    (
      destination: Destination
    ) => {
      const navigationGroup =
        navigationGroupRef.current

      if (!navigationGroup) {
        return
      }

      selectedDestinationRef.current =
        destination

      reachedSamplesRef.current =
        0

      lastPathPositionRef.current =
        null

      clearNavigationObjects()

      /* ---------------------------------------------------
         MARKER
      --------------------------------------------------- */

      const marker =
        createDestinationMarker(
          destination.name
        )

      marker.position.copy(
        destination.position
      )

      navigationGroup.add(
        marker
      )

      destinationMarkerRef.current =
        marker

      /* ---------------------------------------------------
         BOARD
      --------------------------------------------------- */

      const board =
        createDestinationBoard(
          destination.name
        )

      if (board) {
        board.position.copy(
          destination.position
        )

        /**
         * LOW BOARD.
         *
         * Previous implementation used ~1.9m.
         * This uses 0.85m.
         */
        board.position.y +=
          BOARD_Y_OFFSET

        navigationGroup.add(
          board
        )

        destinationBoardRef.current =
          board
      }

      /* ---------------------------------------------------
         ARROWS
      --------------------------------------------------- */

      updateArrowPath(true)

      setSelectedDestination(
        destination
      )

      setDistance(null)

      setNavigationState(
        'navigating'
      )

      setStatus(
        `Navigating to ${destination.name}`
      )
    },
    [
      clearNavigationObjects,
      updateArrowPath,
    ]
  )

  /* =======================================================
     PROCESS LOCALIZATION
  ======================================================= */

  const processLocalization =
    useCallback(
      (
        position: THREE.Vector3
      ) => {
        const destination =
          selectedDestinationRef.current

        currentMapPositionRef.current =
          position.clone()

        if (!destination) {
          return
        }

        /**
         * Calculate walking distance using
         * horizontal X/Z coordinates.
         *
         * Y differences are ignored because
         * room destination coordinates may have
         * different Y values.
         */
        const dx =
          position.x -
          destination.position.x

        const dz =
          position.z -
          destination.position.z

        const horizontalDistance =
          Math.sqrt(
            dx * dx +
              dz * dz
          )

        setDistance(
          horizontalDistance
        )

        /* -------------------------------------------------
           DESTINATION REACHED
        ------------------------------------------------- */

        if (
          horizontalDistance <=
          REACHED_DISTANCE
        ) {
          reachedSamplesRef.current +=
            1
        } else {
          reachedSamplesRef.current =
            0
        }

        if (
          reachedSamplesRef.current >=
          REQUIRED_REACHED_SAMPLES
        ) {
          /**
           * Don't keep rebuilding navigation
           * after reaching.
           */
          setNavigationState(
            'reached'
          )

          setStatus(
            `You reached ${destination.name}`
          )

          if (
            arrowGroupRef.current
          ) {
            navigationGroupRef.current?.remove(
              arrowGroupRef.current
            )

            arrowGroupRef.current =
              null
          }

          return
        }

        /* -------------------------------------------------
           UPDATE PATH
        ------------------------------------------------- */

        setNavigationState(
          'navigating'
        )

        updateArrowPath()
      },
      [
        updateArrowPath,
      ]
    )

  /* =======================================================
     INITIALIZE MULTISET
  ======================================================= */

  useEffect(() => {
    let disposed = false

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

        /* -------------------------------------------------
           RENDERER
        ------------------------------------------------- */

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

        rendererRef.current =
          renderer

        /* -------------------------------------------------
           SCENE
        ------------------------------------------------- */

        const scene =
          new THREE.Scene()

        sceneRef.current =
          scene

        /* -------------------------------------------------
           CAMERA
        ------------------------------------------------- */

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

        /* -------------------------------------------------
           NAVIGATION GROUP
        ------------------------------------------------- */

        const navigationGroup =
          new THREE.Group()

        navigationGroupRef.current =
          navigationGroup

        /**
         * IMPORTANT:
         *
         * We attach all destination/
         * arrow objects to MapSpace.
         *
         * Therefore our coordinates are
         * always interpreted as MultiSet
         * map coordinates.
         */
        const mapSpace =
          new MapSpace(
            new THREE.Object3D(),
            {
              hideUntilLocalized:
                false,
            }
          )

        mapSpace.object.add(
          navigationGroup
        )

        scene.add(
          mapSpace.object
        )

        mapSpaceRef.current =
          mapSpace

        /* -------------------------------------------------
           XR SESSION
        ------------------------------------------------- */

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
                  'XR SESSION STARTED'
                )

                setStatus(
                  'Scanning...'
                )
              },

              onSessionEnd: () => {
                console.log(
                  'XR SESSION ENDED'
                )

                setLocalized(
                  false
                )

                setNavigationState(
                  'idle'
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
                (
                  result: any
                ) => {
                  const position =
                    result
                      ?.localizeData
                      ?.position

                  if (!position) {
                    return
                  }

                  const mapPosition =
                    new THREE.Vector3(
                      position.x,
                      position.y,
                      position.z
                    )

                  processLocalization(
                    mapPosition
                  )
                },

              onLocalizationFailure:
                (
                  reason: any
                ) => {
                  console.warn(
                    'Localization failed:',
                    reason
                  )

                  setStatus(
                    'Scanning... Move the phone slowly and point at the mapped area.'
                  )
                },

              onError:
                (
                  error: any
                ) => {
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

        /* -------------------------------------------------
           THREE ADAPTER
        ------------------------------------------------- */

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
                worldFromMap: THREE.Matrix4
              ) => {
                console.log(
                  'LOCALIZATION SUCCESS'
                )

                console.log(
                  'worldFromMap:',
                  worldFromMap
                )

                /**
                 * Connect MapSpace.
                 *
                 * This is critical.
                 */
                mapSpace.connect(
                  adapter!
                )

                const position =
                  result
                    ?.localizeData
                    ?.position

                if (position) {
                  const mapPosition =
                    new THREE.Vector3(
                      position.x,
                      position.y,
                      position.z
                    )

                  currentMapPositionRef.current =
                    mapPosition
                }

                setLocalized(
                  true
                )

                setNavigationState(
                  'idle'
                )

                setStatus(
                  'Localized successfully. Select a destination.'
                )
              },

            onXRFrame:
              () => {
                const now =
                  performance.now()

                /**
                 * Animate arrows.
                 */
                const arrows =
                  arrowGroupRef.current

                if (arrows) {
                  arrows.children.forEach(
                    (
                      child,
                      index
                    ) => {
                      const arrow =
                        child as THREE.Mesh

                      const pulse =
                        1 +
                        Math.sin(
                          now * 0.006 +
                            index * 0.8
                        ) *
                          0.08

                      arrow.scale.set(
                        pulse,
                        pulse,
                        pulse
                      )

                      const material =
                        arrow.material as THREE.MeshBasicMaterial

                      /**
                       * Flowing opacity.
                       */
                      material.opacity =
                        0.65 +
                        (
                          Math.sin(
                            now * 0.006 +
                              index * 0.9
                          ) +
                          1
                        ) *
                          0.17
                    }
                  )
                }

                /**
                 * Destination marker animation.
                 */
                const marker =
                  destinationMarkerRef.current

                if (marker) {
                  const pulse =
                    1 +
                    Math.sin(
                      now * 0.004
                    ) *
                      0.10

                  marker.scale.set(
                    pulse,
                    pulse,
                    pulse
                  )

                  /**
                   * Make marker face stable
                   * while maintaining floor ring.
                   */
                  const ring =
                    marker.children[0]

                  if (ring) {
                    const ringScale =
                      1 +
                      Math.sin(
                        now * 0.004
                      ) *
                        0.18

                    ring.scale.set(
                      ringScale,
                      ringScale,
                      ringScale
                    )
                  }
                }

                /**
                 * Destination board always
                 * faces the camera.
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

        setStatus(
          'Ready — tap the AR button.'
        )

        console.log(
          'MultiSet ThreeAdapter initialized'
        )

        /* -------------------------------------------------
           RESIZE
        ------------------------------------------------- */

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

      clearNavigationObjects()

      try {
        mapSpaceRef.current?.dispose()
      } catch {}

      try {
        adapter?.dispose()
      } catch {}

      try {
        rendererRef.current?.dispose()
      } catch {}

      adapterRef.current =
        null

      mapSpaceRef.current =
        null
    }
  }, [
    clearNavigationObjects,
    processLocalization,
  ])

  /* =======================================================
     DESTINATION SELECT
  ======================================================= */

  const handleDestinationSelect =
    useCallback(
      (id: string) => {
        const destination =
          destinations.find(
            item =>
              item.id === id
          )

        if (!destination) {
          return
        }

        if (!localized) {
          setStatus(
            'Please wait until localization is successful.'
          )

          return
        }

        showDestination(
          destination
        )
      },
      [
        localized,
        showDestination,
      ]
    )

  /* =======================================================
     RESET NAVIGATION
  ======================================================= */

  const resetNavigation =
    useCallback(() => {
      selectedDestinationRef.current =
        null

      currentMapPositionRef.current =
        currentMapPositionRef.current

      reachedSamplesRef.current =
        0

      lastPathPositionRef.current =
        null

      clearNavigationObjects()

      setSelectedDestination(
        null
      )

      setDistance(
        null
      )

      setNavigationState(
        'idle'
      )

      setStatus(
        localized
          ? 'Select a destination.'
          : 'Waiting for localization...'
      )
    }, [
      clearNavigationObjects,
      localized,
    ])

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="fixed inset-0 overflow-hidden bg-transparent text-white">
      {/* =================================================
          THREE.JS
      ================================================= */}

      <div
        ref={containerRef}
        className="fixed inset-0 z-0"
      />

      {/* =================================================
          TOP STATUS
      ================================================= */}

      <div className="pointer-events-none fixed left-4 right-4 top-4 z-30">
        <div className="rounded-2xl border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600">
              <Navigation className="h-5 w-5" />
            </div>

            <div>
              <div className="text-base font-semibold">
                Indoor Navigation
              </div>

              <div className="mt-0.5 text-xs text-white/70">
                {status}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-xl bg-red-500/20 p-3 text-xs text-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* =================================================
          DISTANCE OVERLAY
      ================================================= */}

      {selectedDestination &&
        distance !== null &&
        navigationState ===
          'navigating' && (
          <div className="pointer-events-none fixed bottom-28 left-4 right-4 z-30">
            <div className="rounded-2xl border border-white/10 bg-black/70 px-5 py-4 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/60">
                    GOING TO
                  </div>

                  <div className="mt-1 text-lg font-bold">
                    {selectedDestination.name}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-violet-300">
                    {distance < 10
                      ? distance.toFixed(1)
                      : Math.round(
                          distance
                        )}
                    m
                  </div>

                  <div className="text-xs text-white/50">
                    remaining
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* =================================================
          REACHED
      ================================================= */}

      {navigationState ===
        'reached' &&
        selectedDestination && (
          <div className="fixed inset-x-4 bottom-24 z-40">
            <div className="rounded-3xl border border-green-400/20 bg-black/80 p-6 text-center shadow-2xl backdrop-blur-xl">
              <div className="mx-auto flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-green-500">
                <Check className="h-10 w-10 text-white" />
              </div>

              <div className="mt-4 text-2xl font-bold">
                Destination Reached
              </div>

              <div className="mt-1 text-white/60">
                {selectedDestination.name}
              </div>

              <button
                type="button"
                onClick={
                  resetNavigation
                }
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-semibold text-black"
              >
                <RotateCcw className="h-4 w-4" />
                Choose Another
              </button>
            </div>
          </div>
        )}

      {/* =================================================
          BOTTOM CONTROLS
      ================================================= */}

      {localized &&
        navigationState !==
          'reached' && (
          <div className="fixed bottom-6 left-4 right-4 z-40 flex items-center justify-center gap-3">
            <DestinationDrawer
              destinations={
                destinationItems
              }
              selectedId={
                selectedDestination?.id ??
                null
              }
              onSelect={
                handleDestinationSelect
              }
            />

            {selectedDestination && (
              <button
                type="button"
                onClick={
                  resetNavigation
                }
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-black/70 text-white shadow-xl backdrop-blur-xl"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

      {/* =================================================
          LOCALIZATION INDICATOR
      ================================================= */}

      {!localized &&
        !error && (
          <div className="pointer-events-none fixed bottom-8 left-1/2 z-30 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full bg-black/70 px-5 py-3 text-sm backdrop-blur-xl">
              <LocateFixed className="h-4 w-4 animate-pulse text-violet-400" />

              <span>
                Looking for your location...
              </span>
            </div>
          </div>
        )}
    </main>
  )
}