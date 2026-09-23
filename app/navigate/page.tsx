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
} from '@multisetai/vps/three'
 
import {
  AnimatedArrowPath,
} from '@/components/navigation/AnimatedArrowPath'
import { DestinationDrawer, DestinationItem } from '@/components/navigation/destination-drawer'


// ============================================================
// DESTINATION TYPE
// ============================================================

type Destination = DestinationItem & {
  position: THREE.Vector3
}


// ============================================================
// KOKARYA DESTINATIONS
// ============================================================

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
    id: 'entrance',
    name: 'Entrance Door',
    position: new THREE.Vector3(
      -0.058,
      -2.210,
      1.260
    ),
  },
]


// ============================================================
// NAVIGATION SETTINGS
// ============================================================

// Distance in meters at which destination is considered reached.
const ARRIVAL_DISTANCE = 0.8

// ============================================================
// PAGE
// ============================================================

export default function NavigatePage() {

  // ==========================================================
  // DOM
  // ==========================================================

  const containerRef =
    useRef<HTMLDivElement | null>(null)


  // ==========================================================
  // MULTISET
  // ==========================================================

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const sessionRef =
    useRef<XRSessionManager | null>(null)


  // ==========================================================
  // THREE.JS
  // ==========================================================

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null)

  const sceneRef =
    useRef<THREE.Scene | null>(null)

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(null)


  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const arrowPathRef =
    useRef<AnimatedArrowPath | null>(null)

  const currentPositionRef =
    useRef<THREE.Vector3 | null>(null)

  const destinationRef =
    useRef<Destination | null>(null)

  // Important:
  // Keep reached state in a ref as well.
  // This prevents stale React state inside MultiSet callbacks.
  const destinationReachedRef =
    useRef(false)


  // ==========================================================
  // STATE
  // ==========================================================

  const [
    status,
    setStatus,
  ] = useState(
    'Initializing...'
  )

  const [
    error,
    setError,
  ] = useState('')

  const [
    localized,
    setLocalized,
  ] = useState(false)

  const [
    selectedId,
    setSelectedId,
  ] = useState<string | null>(null)

  const [
    distance,
    setDistance,
  ] = useState<number | null>(null)

  const [
    destinationReached,
    setDestinationReached,
  ] = useState(false)


  // ==========================================================
  // DISTANCE CALCULATION
  // ==========================================================

  const calculateDistance = useCallback(
    (
      from: THREE.Vector3,
      to: THREE.Vector3
    ) => {

      // Indoor navigation should normally
      // calculate distance on X/Z floor plane.
      //
      // We intentionally ignore Y.

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


  // ==========================================================
  // DESTINATION SELECT
  // ==========================================================

  const handleDestinationSelect =
    useCallback(
      (id: string) => {

        const destination =
          destinations.find(
            item => item.id === id
          )

        if (!destination) {
          return
        }


        // Save destination.
        destinationRef.current =
          destination


        // Reset arrival state.
        destinationReachedRef.current =
          false

        setDestinationReached(false)


        // Save selected destination.
        setSelectedId(id)


        // Get latest localized position.
        const current =
          currentPositionRef.current


        // User has not localized yet.
        if (!current) {

          setStatus(
            `Selected ${destination.name}. Start AR to begin navigation.`
          )

          return
        }


        // ------------------------------------------------------
        // GROUND LEVEL
        // ------------------------------------------------------

        // Use current localized Y as floor level.
        //
        // This prevents the arrows from being placed
        // at an old hard-coded floor height.

        arrowPathRef.current?.setGroundY(
          current.y
        )


        // ------------------------------------------------------
        // CREATE ARROW PATH
        // ------------------------------------------------------

        arrowPathRef.current?.setPath(
          current,
          destination.position
        )


        // ------------------------------------------------------
        // DISTANCE
        // ------------------------------------------------------

        const distanceValue =
          calculateDistance(
            current,
            destination.position
          )

        setDistance(
          distanceValue
        )


        setStatus(
          `Navigating to ${destination.name}`
        )
      },
      [
        calculateDistance,
      ]
    )


  // ==========================================================
  // INITIALIZATION
  // ==========================================================

  useEffect(() => {

    let disposed = false


    async function initialize() {

      try {

        // ======================================================
        // WEBXR
        // ======================================================

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


        // ======================================================
        // ENVIRONMENT VARIABLES
        // ======================================================

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


        // ======================================================
        // MULTISET CLIENT
        // ======================================================

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


        // ======================================================
        // THREE.JS RENDERER
        // ======================================================

        setStatus(
          'Creating AR renderer...'
        )


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


        rendererRef.current =
          renderer


        containerRef.current?.appendChild(
          renderer.domElement
        )


        // ======================================================
        // SCENE
        // ======================================================

        const scene =
          new THREE.Scene()


        sceneRef.current =
          scene


        // ======================================================
        // CAMERA
        // ======================================================

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


        // ======================================================
        // ARROW PATH
        // ======================================================

        const arrowPath =
          new AnimatedArrowPath({

            color:
              0x7c3aed,

            arrowCount:
              18,

            spacing:
              0.65,

            // Temporary initial value.
            //
            // Once localization happens,
            // this gets replaced with the actual
            // localized floor Y.

            groundY:
              -2.20,

            arrowHeight:
              0.025,

            arrowScale:
              0.55,
          })


        scene.add(
          arrowPath.group
        )


        arrowPathRef.current =
          arrowPath


        // ======================================================
        // XR SESSION
        // ======================================================

        setStatus(
          'Creating MultiSet XR session...'
        )


        const session =
          new XRSessionManager(

            // IMPORTANT:
            // Do not pass WebGL2RenderingContext
            // as a separate constructor argument.
            //
            // The renderer context itself is passed here.

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


              // ================================================
              // SESSION START
              // ================================================

              onSessionStart:
                () => {

                  console.log(
                    'XR SESSION STARTED'
                  )

                  setStatus(
                    'Scanning...'
                  )
                },


              // ================================================
              // SESSION END
              // ================================================

              onSessionEnd:
                () => {

                  console.log(
                    'XR SESSION ENDED'
                  )

                  setStatus(
                    'AR session ended'
                  )
                },


              // ================================================
              // LOCALIZATION START
              // ================================================

              onLocalizationInit:
                () => {

                  console.log(
                    'Localization started'
                  )

                  setStatus(
                    'Scanning... Move the phone slowly and point at the mapped area.'
                  )
                },


              // ================================================
              // LOCALIZATION RESULT
              // ================================================

              onLocalizationResult:
                (result: any) => {

                  console.log(
                    'Localization result:',
                    result
                  )


                  const data =
                    result?.localizeData


                  if (
                    !data?.position
                  ) {
                    return
                  }


                  // ----------------------------------------------
                  // CURRENT MAP POSITION
                  // ----------------------------------------------

                  const position =
                    new THREE.Vector3(
                      data.position.x,
                      data.position.y,
                      data.position.z
                    )


                  currentPositionRef.current =
                    position


                  // ----------------------------------------------
                  // DESTINATION
                  // ----------------------------------------------

                  const destination =
                    destinationRef.current


                  if (!destination) {
                    return
                  }


                  // ----------------------------------------------
                  // GROUND LEVEL
                  // ----------------------------------------------

                  // Keep arrows at the user's current
                  // localized floor height.

                  arrowPathRef.current?.setGroundY(
                    position.y
                  )


                  // ----------------------------------------------
                  // DISTANCE
                  // ----------------------------------------------

                  const remaining =
                    calculateDistance(
                      position,
                      destination.position
                    )


                  setDistance(
                    remaining
                  )


                  // ----------------------------------------------
                  // DESTINATION REACHED
                  // ----------------------------------------------

                  if (
                    remaining <=
                    ARRIVAL_DISTANCE
                  ) {

                    // Ref prevents the callback from
                    // repeatedly firing the completion state.

                    if (
                      !destinationReachedRef.current
                    ) {

                      destinationReachedRef.current =
                        true


                      setDestinationReached(
                        true
                      )


                      setStatus(
                        `✓ You reached ${destination.name}`
                      )


                      // Remove arrows after arrival.
                      arrowPathRef.current?.hide()
                    }


                    return
                  }


                  // ----------------------------------------------
                  // USER MOVED AWAY AGAIN
                  // ----------------------------------------------

                  if (
                    destinationReachedRef.current
                  ) {

                    destinationReachedRef.current =
                      false

                    setDestinationReached(
                      false
                    )

                    arrowPathRef.current?.show()
                  }


                  // ----------------------------------------------
                  // UPDATE ARROW PATH
                  // ----------------------------------------------

                  arrowPathRef.current?.setPath(
                    position,
                    destination.position
                  )


                  setStatus(
                    `Navigating to ${destination.name}`
                  )
                },


              // ================================================
              // LOCALIZATION FAILURE
              // ================================================

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


              // ================================================
              // MULTISET ERROR
              // ================================================

              onError:
                (err: any) => {

                  console.error(
                    'MULTISET ERROR:',
                    err
                  )


                  const message =
                    err instanceof Error
                      ? `${err.name}: ${err.message}`
                      : String(err)


                  setError(
                    message
                  )


                  setStatus(
                    'MultiSet error'
                  )
                },
            }
          )


        sessionRef.current =
          session


        // ======================================================
        // THREE ADAPTER
        // ======================================================

        const adapter =
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


            // ================================================
            // LOCALIZATION SUCCESS
            // ================================================

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
                  'World From Map:',
                  worldFromMap
                )


                setLocalized(
                  true
                )


                setStatus(
                  'Localized successfully'
                )


                const data =
                  result?.localizeData


                if (
                  !data?.position
                ) {
                  return
                }


                const position =
                  new THREE.Vector3(
                    data.position.x,
                    data.position.y,
                    data.position.z
                  )


                currentPositionRef.current =
                  position


                // ----------------------------------------------
                // Update floor level immediately
                // ----------------------------------------------

                arrowPathRef.current?.setGroundY(
                  position.y
                )


                // ----------------------------------------------
                // Existing destination
                // ----------------------------------------------

                const destination =
                  destinationRef.current


                if (!destination) {
                  return
                }


                const remaining =
                  calculateDistance(
                    position,
                    destination.position
                  )


                setDistance(
                  remaining
                )


                // ----------------------------------------------
                // Already reached
                // ----------------------------------------------

                if (
                  remaining <=
                  ARRIVAL_DISTANCE
                ) {

                  destinationReachedRef.current =
                    true

                  setDestinationReached(
                    true
                  )

                  arrowPathRef.current?.hide()

                  setStatus(
                    `✓ You reached ${destination.name}`
                  )

                  return
                }


                // ----------------------------------------------
                // Draw navigation arrows
                // ----------------------------------------------

                destinationReachedRef.current =
                  false

                setDestinationReached(
                  false
                )

                arrowPathRef.current?.show()

                arrowPathRef.current?.setPath(
                  position,
                  destination.position
                )
              },


            // ================================================
            // XR FRAME
            // ================================================

            onXRFrame:
              () => {

                arrowPathRef.current?.update()
              },
          })


        adapterRef.current =
          adapter


        // ======================================================
        // INITIALIZE ADAPTER
        // ======================================================

        await adapter.initialize()


        if (disposed) {
          return
        }


        setStatus(
          'Ready — tap the AR button'
        )


        console.log(
          'MultiSet ThreeAdapter initialized'
        )


        // ======================================================
        // RESIZE
        // ======================================================

        const handleResize =
          () => {

            if (!rendererRef.current) {
              return
            }


            if (!cameraRef.current) {
              return
            }


            const camera =
              cameraRef.current


            camera.aspect =
              window.innerWidth /
              window.innerHeight


            camera.updateProjectionMatrix()


            rendererRef.current.setSize(
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
          'INITIALIZATION ERROR:',
          err
        )


        const message =
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : String(err)


        setError(
          message
        )


        setStatus(
          'Initialization failed'
        )
      }
    }


    initialize()


    // ==========================================================
    // CLEANUP
    // ==========================================================

    return () => {

      disposed = true


      // --------------------------------------------------------
      // Arrow path
      // --------------------------------------------------------

      try {

        arrowPathRef.current?.dispose()

      } catch (err) {

        console.error(
          err
        )
      }


      // --------------------------------------------------------
      // MultiSet adapter
      // --------------------------------------------------------

      try {

        adapterRef.current?.dispose()

      } catch (err) {

        console.error(
          err
        )
      }


      // --------------------------------------------------------
      // Renderer
      // --------------------------------------------------------

      if (
        rendererRef.current
      ) {

        try {

          rendererRef.current.dispose()

        } catch (err) {

          console.error(
            err
          )
        }


        const canvas =
          rendererRef.current.domElement


        if (
          canvas.parentElement
        ) {

          canvas.parentElement.removeChild(
            canvas
          )
        }


        rendererRef.current =
          null
      }


      adapterRef.current =
        null

      sessionRef.current =
        null

      arrowPathRef.current =
        null

      currentPositionRef.current =
        null

      destinationRef.current =
        null
    }

  }, [
    calculateDistance,
  ])


  // ==========================================================
  // SELECTED DESTINATION
  // ==========================================================

  const selectedDestination =
    destinations.find(
      item =>
        item.id === selectedId
    ) ?? null


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <main
      className="
        fixed
        inset-0
        overflow-hidden
        bg-transparent
        text-white
      "
    >

      {/* ======================================================
          THREE.JS / AR CANVAS
      ======================================================= */}

      <div
        ref={containerRef}
        className="
          fixed
          inset-0
          z-0
        "
      />


      {/* ======================================================
          TOP STATUS
      ======================================================= */}

      <div
        className="
          fixed
          left-4
          right-4
          top-4
          z-20
          rounded-2xl
          bg-black/70
          p-4
          backdrop-blur-md
        "
      >

        <div
          className="
            text-lg
            font-bold
          "
        >
          Indoor Navigation
        </div>


        <div
          className="
            mt-1
            text-sm
            text-white/80
          "
        >
          {status}
        </div>


        {/* VPS STATUS */}

        {localized && (

          <div
            className="
              mt-2
              text-xs
              text-green-400
            "
          >
            ● VPS Localized
          </div>

        )}


        {/* ERROR */}

        {error && (

          <div
            className="
              mt-3
              break-words
              rounded-lg
              bg-red-500/20
              p-2
              text-xs
              text-red-300
            "
          >
            {error}
          </div>

        )}

      </div>


      {/* ======================================================
          DESTINATION / DISTANCE
      ======================================================= */}

      {selectedDestination &&
        distance !== null &&
        !destinationReached && (

          <div
            className="
              fixed
              bottom-32
              left-4
              right-4
              z-20
              rounded-2xl
              bg-black/75
              px-5
              py-4
              backdrop-blur-md
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
              "
            >

              <div>

                <div
                  className="
                    text-xs
                    text-white/60
                  "
                >
                  NAVIGATING TO
                </div>


                <div
                  className="
                    mt-1
                    text-lg
                    font-bold
                  "
                >
                  {selectedDestination.name}
                </div>

              </div>


              <div
                className="
                  text-right
                "
              >

                <div
                  className="
                    text-2xl
                    font-bold
                    text-violet-400
                  "
                >
                  {distance.toFixed(1)} m
                </div>


                <div
                  className="
                    text-xs
                    text-white/60
                  "
                >
                  remaining
                </div>

              </div>

            </div>

          </div>

        )}


      {/* ======================================================
          DESTINATION REACHED
      ======================================================= */}

      {destinationReached &&
        selectedDestination && (

          <div
            className="
              fixed
              bottom-32
              left-4
              right-4
              z-30
              rounded-2xl
              bg-green-600/95
              px-5
              py-5
              text-center
              shadow-2xl
              backdrop-blur
            "
          >

            <div
              className="
                text-3xl
                font-bold
              "
            >
              ✓
            </div>


            <div
              className="
                mt-1
                text-lg
                font-bold
              "
            >
              Destination Reached
            </div>


            <div
              className="
                mt-1
                text-sm
                text-white/90
              "
            >
              You have reached{' '}
              {selectedDestination.name}
            </div>

          </div>

        )}


      {/* ======================================================
          DESTINATION DRAWER
      ======================================================= */}

      <div
        className="
          fixed
          bottom-6
          left-0
          right-0
          z-30
          flex
          justify-center
          px-4
        "
      >

        <DestinationDrawer

          destinations={
            destinations.map(
              destination => ({
                id:
                  destination.id,

                name:
                  destination.name,
              })
            )
          }

          selectedId={
            selectedId
          }

          disabled={
            !localized
          }

          onSelect={
            handleDestinationSelect
          }

        />

      </div>

    </main>
  )
}