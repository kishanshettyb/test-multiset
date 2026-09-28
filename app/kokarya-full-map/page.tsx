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
  MapPin,
  Navigation,
  RotateCcw,
  Volume2,
  VolumeX,
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

type DirectionInstruction =
  | 'none'
  | 'straight'
  | 'left'
  | 'right'
  | 'uturn'

/* =========================================================
   DESTINATIONS
========================================================= */

const destinations: Destination[] = [
  {
    id: 'cabin-1',
    name: 'Cabin 1',
    position: new THREE.Vector3(
      4.433,
      -2.196,
      1.104
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
 */
const REACHED_DISTANCE = 0.75

/**
 * Require multiple consecutive samples.
 * Prevents false arrival.
 */
const REQUIRED_REACHED_SAMPLES = 3

/**
 * Don't rebuild arrows for tiny movements.
 */
const PATH_UPDATE_DISTANCE = 0.18

/**
 * Floor arrow height.
 */
const ARROW_Y_OFFSET = 0.035

/**
 * Space between navigation chevrons.
 */
const ARROW_SPACING = 0.55

/**
 * Arrow width.
 */
const ARROW_WIDTH = 0.30

/**
 * Destination marker height.
 *
 * Lower than previous version.
 */
const DESTINATION_PIN_HEIGHT = 0.68

/**
 * Destination label height.
 */
const DESTINATION_LABEL_HEIGHT = 0.92

/**
 * Voice cooldown.
 */
const VOICE_COOLDOWN = 2500

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

  /* =======================================================
     MULTISET
  ======================================================= */

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const mapSpaceRef =
    useRef<MapSpace | null>(null)

  /* =======================================================
     NAVIGATION OBJECTS
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

  /* =======================================================
     VOICE
  ======================================================= */

  const voiceEnabledRef =
    useRef(true)

  const lastVoiceTimeRef =
    useRef(0)

  const lastInstructionRef =
    useRef<DirectionInstruction>('none')

  const lastDistanceMilestoneRef =
    useRef<number | null>(null)

  /* =======================================================
     STATE
  ======================================================= */

  const [status, setStatus] =
    useState(
      'Initializing...'
    )

  const [error, setError] =
    useState('')

  const [localized, setLocalized] =
    useState(false)

  const [
    selectedDestination,
    setSelectedDestination,
  ] =
    useState<Destination | null>(
      null
    )

  const [distance, setDistance] =
    useState<number | null>(
      null
    )

  const [
    navigationState,
    setNavigationState,
  ] =
    useState<NavigationState>(
      'idle'
    )

  const [
    voiceEnabled,
    setVoiceEnabled,
  ] =
    useState(true)

  const [
    currentInstruction,
    setCurrentInstruction,
  ] =
    useState<DirectionInstruction>(
      'none'
    )

  /* =======================================================
     DISTANCE
  ======================================================= */

  const calculateDistance =
    useCallback(
      (
        from: THREE.Vector3,
        to: THREE.Vector3
      ) => {
        const dx =
          to.x - from.x

        const dz =
          to.z - from.z

        return Math.sqrt(
          dx * dx +
            dz * dz
        )
      },
      []
    )

  /* =======================================================
     SPEECH
  ======================================================= */

  const speak = useCallback(
    (
      text: string,
      force = false
    ) => {
      if (
        !voiceEnabledRef.current
      ) {
        return
      }

      if (
        typeof window ===
        'undefined'
      ) {
        return
      }

      if (
        !(
          'speechSynthesis' in
          window
        )
      ) {
        return
      }

      const now =
        Date.now()

      if (
        !force &&
        now -
          lastVoiceTimeRef.current <
          VOICE_COOLDOWN
      ) {
        return
      }

      lastVoiceTimeRef.current =
        now

      window.speechSynthesis.cancel()

      const utterance =
        new SpeechSynthesisUtterance(
          text
        )

      utterance.lang =
        'en-IN'

      utterance.rate =
        0.92

      utterance.pitch =
        1

      utterance.volume =
        1

      window.speechSynthesis.speak(
        utterance
      )
    },
    []
  )

  /* =======================================================
     RESET VOICE
  ======================================================= */

  const resetVoiceState =
    useCallback(() => {
      lastInstructionRef.current =
        'none'

      lastDistanceMilestoneRef.current =
        null

      lastVoiceTimeRef.current =
        0

      setCurrentInstruction(
        'none'
      )
    }, [])

  /* =======================================================
     VOICE TOGGLE
  ======================================================= */

  const toggleVoice =
    useCallback(() => {
      const next =
        !voiceEnabledRef.current

      voiceEnabledRef.current =
        next

      setVoiceEnabled(
        next
      )

      if (!next) {
        if (
          typeof window !==
            'undefined' &&
          'speechSynthesis' in
            window
        ) {
          window.speechSynthesis.cancel()
        }

        return
      }

      speak(
        'Voice guidance enabled.',
        true
      )
    }, [speak])

  /* =======================================================
     GET DIRECTION
     
     Uses the phone camera's horizontal
     forward direction against the destination.
  ======================================================= */

  const getDirectionInstruction =
    useCallback(
      (
        camera: THREE.PerspectiveCamera,
        current: THREE.Vector3,
        destination: THREE.Vector3
      ): DirectionInstruction => {
        const destinationDirection =
          new THREE.Vector3(
            destination.x -
              current.x,
            0,
            destination.z -
              current.z
          )

        if (
          destinationDirection.lengthSq() <
          0.001
        ) {
          return 'none'
        }

        destinationDirection.normalize()

        const cameraForward =
          new THREE.Vector3()

        camera.getWorldDirection(
          cameraForward
        )

        cameraForward.y = 0

        if (
          cameraForward.lengthSq() <
          0.001
        ) {
          return 'none'
        }

        cameraForward.normalize()

        const dot =
          cameraForward.dot(
            destinationDirection
          )

        const cross =
          cameraForward.x *
            destinationDirection.z -
          cameraForward.z *
            destinationDirection.x

        /*
         * User is facing almost directly
         * toward destination.
         */
        if (dot > 0.72) {
          return 'straight'
        }

        /*
         * Destination is almost directly
         * behind the user.
         */
        if (dot < -0.55) {
          return 'uturn'
        }

        /*
         * Cross product determines side.
         */
        if (cross > 0) {
          return 'left'
        }

        return 'right'
      },
      []
    )

  /* =======================================================
     DIRECTION LABEL
  ======================================================= */

  const getInstructionLabel =
    useCallback(
      (
        instruction: DirectionInstruction
      ) => {
        switch (
          instruction
        ) {
          case 'straight':
            return 'Go straight'

          case 'left':
            return 'Turn left'

          case 'right':
            return 'Turn right'

          case 'uturn':
            return 'Turn around'

          default:
            return 'Follow the arrows'
        }
      },
      []
    )

  /* =======================================================
     SPEAK DIRECTION
  ======================================================= */

  const announceDirection =
    useCallback(
      (
        instruction: DirectionInstruction,
        destinationName: string
      ) => {
        if (
          instruction ===
          'none'
        ) {
          return
        }

        if (
          instruction ===
          lastInstructionRef.current
        ) {
          return
        }

        lastInstructionRef.current =
          instruction

        setCurrentInstruction(
          instruction
        )

        switch (
          instruction
        ) {
          case 'straight':
            speak(
              `Go straight towards ${destinationName}.`
            )
            break

          case 'left':
            speak(
              `Turn left towards ${destinationName}.`
            )
            break

          case 'right':
            speak(
              `Turn right towards ${destinationName}.`
            )
            break

          case 'uturn':
            speak(
              `Turn around. ${destinationName} is behind you.`
            )
            break
        }
      },
      [speak]
    )

  /* =======================================================
     DISTANCE VOICE
  ======================================================= */

  const announceDistance =
    useCallback(
      (
        remainingDistance: number,
        destinationName: string
      ) => {
        if (
          !voiceEnabledRef.current
        ) {
          return
        }

        const milestones =
          [20, 10, 5]

        for (
          const milestone of
            milestones
        ) {
          if (
            remainingDistance <=
              milestone &&
            (
              lastDistanceMilestoneRef.current ===
                null ||
              lastDistanceMilestoneRef.current >
                milestone
            )
          ) {
            lastDistanceMilestoneRef.current =
              milestone

            speak(
              `${milestone} meters to ${destinationName}.`
            )

            return
          }
        }
      },
      [speak]
    )

  /* =======================================================
     CLEAR NAVIGATION
  ======================================================= */

  const clearNavigationObjects =
    useCallback(() => {
      const navigationGroup =
        navigationGroupRef.current

      if (!navigationGroup) {
        return
      }

      while (
        navigationGroup
          .children.length >
        0
      ) {
        const object =
          navigationGroup
            .children[0]

        navigationGroup.remove(
          object
        )

        object.traverse(
          child => {
            const mesh =
              child as THREE.Mesh

            if (
              mesh.geometry
            ) {
              mesh.geometry.dispose()
            }

            const material =
              mesh.material

            if (
              Array.isArray(
                material
              )
            ) {
              material.forEach(
                item =>
                  item.dispose()
              )
            } else if (
              material
            ) {
              material.dispose()
            }
          }
        )
      }

      arrowGroupRef.current =
        null

      destinationMarkerRef.current =
        null

      destinationBoardRef.current =
        null
    }, [])

  /* =======================================================
     CREATE FLOOR ARROW
  ======================================================= */

  const createChevron = (
    direction: THREE.Vector3,
    index: number
  ) => {
    const shape =
      new THREE.Shape()

    const width =
      ARROW_WIDTH

    const length =
      0.42

    /*
     * IMPORTANT:
     *
     * Tip is +Y.
     *
     * Therefore it looks:
     *
     *        /\
     *       /  \
     *      /____\
     *
     * instead of \/.
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
      new THREE.ShapeGeometry(
        shape
      )

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

    mesh.rotation.x =
      -Math.PI / 2

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
        i *
        ARROW_SPACING

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

      const scale =
        i % 2 === 0
          ? 1
          : 0.88

      arrow.scale.set(
        scale,
        scale,
        scale
      )

      group.add(
        arrow
      )
    }

    return group
  }

  /* =======================================================
     UPDATE ARROW PATH
  ======================================================= */

  const updateArrowPath =
    useCallback(
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
       FLOOR PULSE
    ----------------------------------------------------- */

    const outerRing =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.28,
          0.36,
          48
        ),
        new THREE.MeshBasicMaterial({
          color: 0x8b5cf6,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )

    outerRing.rotation.x =
      -Math.PI / 2

    outerRing.position.y =
      0.025

    group.add(
      outerRing
    )

    /* -----------------------------------------------------
       INNER RING
    ----------------------------------------------------- */

    const innerRing =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.10,
          0.16,
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

    innerRing.rotation.x =
      -Math.PI / 2

    innerRing.position.y =
      0.03

    group.add(
      innerRing
    )

    /* -----------------------------------------------------
       MAP PIN BODY
    ----------------------------------------------------- */

    const pinGroup =
      new THREE.Group()

    /*
     * Sphere head.
     */
    const pinHead =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.115,
          24,
          24
        ),
        new THREE.MeshBasicMaterial({
          color: 0x8b5cf6,
          transparent: true,
          opacity: 0.98,
        })
      )

    pinHead.position.y =
      DESTINATION_PIN_HEIGHT

    pinGroup.add(
      pinHead
    )

    /*
     * Pin stem.
     */
    const pinStem =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.055,
          0.075,
          0.32,
          20
        ),
        new THREE.MeshBasicMaterial({
          color: 0x8b5cf6,
          transparent: true,
          opacity: 0.98,
        })
      )

    pinStem.position.y =
      DESTINATION_PIN_HEIGHT -
      0.18

    pinGroup.add(
      pinStem
    )

    /*
     * Small white center.
     */
    const pinCenter =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.045,
          20,
          20
        ),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
        })
      )

    pinCenter.position.y =
      DESTINATION_PIN_HEIGHT

    pinGroup.add(
      pinCenter
    )

    group.add(
      pinGroup
    )

    group.userData.destinationName =
      name

    return group
  }

  /* =======================================================
     DESTINATION LABEL
  ======================================================= */

  const createDestinationBoard = (
    name: string
  ) => {
    const canvas =
      document.createElement(
        'canvas'
      )

    canvas.width =
      700

    canvas.height =
      180

    const ctx =
      canvas.getContext(
        '2d'
      )

    if (!ctx) {
      return null
    }

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    )

    /*
     * Background.
     */
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

    /*
     * Purple accent.
     */
    ctx.fillStyle =
      '#8b5cf6'

    ctx.fillRect(
      8,
      8,
      14,
      164
    )

    /*
     * Pin icon.
     */
    ctx.fillStyle =
      '#8b5cf6'

    ctx.beginPath()

    ctx.arc(
      75,
      78,
      25,
      0,
      Math.PI * 2
    )

    ctx.fill()

    /*
     * White pin center.
     */
    ctx.fillStyle =
      '#ffffff'

    ctx.beginPath()

    ctx.arc(
      75,
      78,
      9,
      0,
      Math.PI * 2
    )

    ctx.fill()

    /*
     * Destination name.
     */
    ctx.fillStyle =
      '#ffffff'

    ctx.font =
      'bold 44px Arial'

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

    /*
     * Smaller label.
     */
    sprite.scale.set(
      2.0,
      0.52,
      1
    )

    sprite.userData.destinationName =
      name

    return sprite
  }

  /* =======================================================
     SHOW DESTINATION
  ======================================================= */

  const showDestination =
    useCallback(
      (
        destination: Destination
      ) => {
        const navigationGroup =
          navigationGroupRef.current

        if (
          !navigationGroup
        ) {
          return
        }

        selectedDestinationRef.current =
          destination

        reachedSamplesRef.current =
          0

        lastPathPositionRef.current =
          null

        resetVoiceState()

        clearNavigationObjects()

        /* ---------------------------------------------------
           DESTINATION MARKER
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
           DESTINATION LABEL
        --------------------------------------------------- */

        const board =
          createDestinationBoard(
            destination.name
          )

        if (board) {
          board.position.copy(
            destination.position
          )

          /*
           * LOWERED.
           */
          board.position.y +=
            DESTINATION_LABEL_HEIGHT

          navigationGroup.add(
            board
          )

          destinationBoardRef.current =
            board
        }

        /* ---------------------------------------------------
           ARROW PATH
        --------------------------------------------------- */

        updateArrowPath(
          true
        )

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

        /*
         * Initial voice.
         */
        speak(
          `Navigation started. Head towards ${destination.name}.`,
          true
        )
      },
      [
        clearNavigationObjects,
        resetVoiceState,
        speak,
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

        if (
          !destination
        ) {
          return
        }

        const distanceValue =
          calculateDistance(
            position,
            destination.position
          )

        setDistance(
          distanceValue
        )

        /* -------------------------------------------------
           ARRIVAL
        ------------------------------------------------- */

        if (
          distanceValue <=
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
          if (
            navigationState !==
            'reached'
          ) {
            setNavigationState(
              'reached'
            )

            setStatus(
              `You reached ${destination.name}`
            )

            speak(
              `You have arrived at ${destination.name}.`,
              true
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
          }

          return
        }

        /* -------------------------------------------------
           UPDATE ARROWS
        ------------------------------------------------- */

        updateArrowPath()

        /* -------------------------------------------------
           VOICE DISTANCE
        ------------------------------------------------- */

        announceDistance(
          distanceValue,
          destination.name
        )

        /* -------------------------------------------------
           DIRECTION
        ------------------------------------------------- */

        const camera =
          cameraRef.current

        if (camera) {
          const instruction =
            getDirectionInstruction(
              camera,
              position,
              destination.position
            )

          announceDirection(
            instruction,
            destination.name
          )
        }

        setNavigationState(
          'navigating'
        )

        setStatus(
          `Navigating to ${destination.name}`
        )
      },
      [
        announceDirection,
        announceDistance,
        calculateDistance,
        getDirectionInstruction,
        navigationState,
        speak,
        updateArrowPath,
      ]
    )

  /* =======================================================
     INITIALIZE MULTISET
  ======================================================= */

  useEffect(() => {
    let disposed =
      false

    let adapter:
      | ThreeAdapter
      | null = null

    async function init() {
      try {
        /* -------------------------------------------------
           WEBXR
        ------------------------------------------------- */

        setStatus(
          'Checking WebXR...'
        )

        const supported =
          await XRSessionManager.isSupported()

        if (
          !supported
        ) {
          throw new Error(
            'WebXR is not supported on this device/browser.'
          )
        }

        /* -------------------------------------------------
           ENV
        ------------------------------------------------- */

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

        /* -------------------------------------------------
           MULTISET
        ------------------------------------------------- */

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

        if (
          disposed
        ) {
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

        /* -------------------------------------------------
           MAP SPACE
        ------------------------------------------------- */

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

              autoLocalize:
                true,

              referenceSpaceType:
                'local',

              confidenceCheck:
                true,

              confidenceThreshold:
                0.5,

              /* -----------------------------------------
                 SESSION START
              ----------------------------------------- */

              onSessionStart:
                () => {
                  console.log(
                    'XR SESSION STARTED'
                  )

                  setStatus(
                    'Scanning...'
                  )
                },

              /* -----------------------------------------
                 SESSION END
              ----------------------------------------- */

              onSessionEnd:
                () => {
                  console.log(
                    'XR SESSION ENDED'
                  )

                  setLocalized(
                    false
                  )

                  setNavigationState(
                    'idle'
                  )

                  resetVoiceState()

                  if (
                    typeof window !==
                      'undefined' &&
                    'speechSynthesis' in
                      window
                  ) {
                    window.speechSynthesis.cancel()
                  }

                  setStatus(
                    'AR session ended'
                  )
                },

              /* -----------------------------------------
                 LOCALIZATION START
              ----------------------------------------- */

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

              /* -----------------------------------------
                 LOCALIZATION RESULT
              ----------------------------------------- */

              onLocalizationResult:
                (
                  result: any
                ) => {
                  const position =
                    result
                      ?.localizeData
                      ?.position

                  if (
                    !position
                  ) {
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

              /* -----------------------------------------
                 LOCALIZATION FAILURE
              ----------------------------------------- */

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

              /* -----------------------------------------
                 ERROR
              ----------------------------------------- */

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

                  setStatus(
                    'MultiSet error'
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

            showMesh:
              false,

            showGizmo:
              false,

            useDefaultButton:
              true,

            /* -------------------------------------------
               LOCALIZATION SUCCESS
            ------------------------------------------- */

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

                /*
                 * Connect MapSpace.
                 */
                mapSpace.connect(
                  adapter!
                )

                const position =
                  result
                    ?.localizeData
                    ?.position

                if (
                  position
                ) {
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

            /* -------------------------------------------
               XR FRAME
            ------------------------------------------- */

            onXRFrame:
              () => {
                const now =
                  performance.now()

                /* ---------------------------------------
                   ARROW ANIMATION
                --------------------------------------- */

                const arrows =
                  arrowGroupRef.current

                if (
                  arrows
                ) {
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
                          now *
                            0.006 +
                            index *
                              0.8
                        ) *
                          0.08

                      /*
                       * Preserve original
                       * alternating scale.
                       */
                      const baseScale =
                        index %
                          2 ===
                        0
                          ? 1
                          : 0.88

                      const finalScale =
                        baseScale *
                        pulse

                      arrow.scale.set(
                        finalScale,
                        finalScale,
                        finalScale
                      )

                      const material =
                        arrow.material as THREE.MeshBasicMaterial

                      material.opacity =
                        0.68 +
                        (
                          Math.sin(
                            now *
                              0.006 +
                              index *
                                0.9
                          ) +
                          1
                        ) *
                          0.16
                    }
                  )
                }

                /* ---------------------------------------
                   DESTINATION MARKER
                --------------------------------------- */

                const marker =
                  destinationMarkerRef.current

                if (
                  marker
                ) {
                  const pulse =
                    1 +
                    Math.sin(
                      now *
                        0.004
                    ) *
                      0.08

                  marker.scale.set(
                    pulse,
                    pulse,
                    pulse
                  )

                  /*
                   * Outer ring.
                   */
                  const ring =
                    marker
                      .children[0]

                  if (
                    ring
                  ) {
                    const ringScale =
                      1 +
                      Math.sin(
                        now *
                          0.004
                      ) *
                        0.18

                    ring.scale.set(
                      ringScale,
                      ringScale,
                      ringScale
                    )
                  }

                  /*
                   * Pin floats very slightly.
                   */
                  const pinGroup =
                    marker
                      .children[2]

                  if (
                    pinGroup
                  ) {
                    pinGroup.position.y =
                      Math.sin(
                        now *
                          0.003
                      ) *
                        0.025
                  }
                }

                /* ---------------------------------------
                   DESTINATION LABEL
                --------------------------------------- */

                const board =
                  destinationBoardRef.current

                if (
                  board &&
                  cameraRef.current
                ) {
                  /*
                   * Always face camera.
                   */
                  board.quaternion.copy(
                    cameraRef.current.quaternion
                  )
                }
              },
          })

        await adapter.initialize()

        if (
          disposed
        ) {
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
            const currentRenderer =
              rendererRef.current

            const currentCamera =
              cameraRef.current

            if (
              !currentRenderer ||
              !currentCamera
            ) {
              return
            }

            currentCamera.aspect =
              window.innerWidth /
              window.innerHeight

            currentCamera.updateProjectionMatrix()

            currentRenderer.setSize(
              window.innerWidth,
              window.innerHeight
            )
          }

        window.addEventListener(
          'resize',
          handleResize
        )

        return () => {
          window.removeEventListener(
            'resize',
            handleResize
          )
        }
      } catch (
        err: any
      ) {
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

      /*
       * Stop voice.
       */
      if (
        typeof window !==
          'undefined' &&
        'speechSynthesis' in
          window
      ) {
        window.speechSynthesis.cancel()
      }

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

      if (
        rendererRef.current
      ) {
        const canvas =
          rendererRef.current
            .domElement

        if (
          canvas.parentElement
        ) {
          canvas.parentElement.removeChild(
            canvas
          )
        }
      }

      rendererRef.current =
        null

      adapterRef.current =
        null

      mapSpaceRef.current =
        null
    }
  }, [
    clearNavigationObjects,
    processLocalization,
    resetVoiceState,
  ])

  /* =======================================================
     DESTINATION SELECT
  ======================================================= */

  const handleDestinationSelect =
    useCallback(
      (
        id: string
      ) => {
        const destination =
          destinations.find(
            item =>
              item.id ===
              id
          )

        if (
          !destination
        ) {
          return
        }

        if (
          !localized
        ) {
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

      reachedSamplesRef.current =
        0

      lastPathPositionRef.current =
        null

      clearNavigationObjects()

      resetVoiceState()

      if (
        typeof window !==
          'undefined' &&
        'speechSynthesis' in
          window
      ) {
        window.speechSynthesis.cancel()
      }

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
      resetVoiceState,
    ])

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="fixed inset-0 overflow-hidden bg-transparent text-white">
      {/* =================================================
          THREE / AR
      ================================================= */}

      <div
        ref={containerRef}
        className="fixed inset-0 z-0"
      />

      {/* =================================================
          TOP STATUS
          
          No map here.
      ================================================= */}

      <div className="pointer-events-none fixed left-4 right-4 top-4 z-30">
        <div className="rounded-2xl border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600">
              <Navigation className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="text-base font-semibold">
                Indoor Navigation
              </div>

              <div className="mt-0.5 truncate text-xs text-white/70">
                {status}
              </div>
            </div>
          </div>

          {localized && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-400" />

              VPS Localized
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl bg-red-500/20 p-3 text-xs text-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* =================================================
          SOUND BUTTON
      ================================================= */}

      <div className="fixed right-4 top-[7.2rem] z-40">
        <button
          type="button"
          onClick={
            toggleVoice
          }
          aria-label={
            voiceEnabled
              ? 'Mute voice guidance'
              : 'Enable voice guidance'
          }
          className="
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-full
            border
            border-white/15
            bg-black/65
            text-white
            shadow-xl
            backdrop-blur-xl
            transition
            active:scale-95
          "
        >
          {voiceEnabled ? (
            <Volume2 className="h-5 w-5" />
          ) : (
            <VolumeX className="h-5 w-5 text-white/50" />
          )}
        </button>
      </div>

      {/* =================================================
          CURRENT DIRECTION
      ================================================= */}

      {selectedDestination &&
        navigationState ===
          'navigating' && (
          <div className="pointer-events-none fixed left-1/2 top-[7.2rem] z-30 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/65 px-4 py-2 text-sm shadow-xl backdrop-blur-xl">
              {currentInstruction ===
                'left' && (
                <span className="text-lg">
                  ←
                </span>
              )}

              {currentInstruction ===
                'right' && (
                <span className="text-lg">
                  →
                </span>
              )}

              {currentInstruction ===
                'straight' && (
                <span className="text-lg">
                  ↑
                </span>
              )}

              {currentInstruction ===
                'uturn' && (
                <span className="text-lg">
                  ↶
                </span>
              )}

              <span>
                {getInstructionLabel(
                  currentInstruction
                )}
              </span>
            </div>
          </div>
        )}

      {/* =================================================
          NAVIGATION DISTANCE
      ================================================= */}

      {selectedDestination &&
        distance !== null &&
        navigationState ===
          'navigating' && (
          <div className="pointer-events-none fixed bottom-28 left-4 right-4 z-30">
            <div className="rounded-2xl border border-white/10 bg-black/70 px-5 py-4 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <MapPin className="h-3.5 w-3.5 text-violet-400" />

                    GOING TO
                  </div>

                  <div className="mt-1 truncate text-lg font-bold">
                    {
                      selectedDestination.name
                    }
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-2xl font-bold text-violet-300">
                    {distance <
                    10
                      ? distance.toFixed(
                          1
                        )
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
          DESTINATION REACHED
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
                {
                  selectedDestination.name
                }
              </div>

              <button
                type="button"
                onClick={
                  resetNavigation
                }
                className="
                  mt-5
                  flex
                  h-12
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-white
                  font-semibold
                  text-black
                  transition
                  active:scale-[0.98]
                "
              >
                <RotateCcw className="h-4 w-4" />

                Choose Another
              </button>
            </div>
          </div>
        )}

      {/* =================================================
          DESTINATION DRAWER
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
                aria-label="Reset navigation"
                className="
                  flex
                  h-12
                  w-12
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-white/20
                  bg-black/70
                  text-white
                  shadow-xl
                  backdrop-blur-xl
                  transition
                  active:scale-95
                "
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
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-5 py-3 text-sm shadow-xl backdrop-blur-xl">
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