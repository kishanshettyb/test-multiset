'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import {
  MultisetClient,
  XRSessionManager,
} from '@multisetai/vps/core'

import {
  MapSpace,
  ThreeAdapter,
} from '@multisetai/vps/three'

type Destination = {
  id: string
  name: string
  position: {
    x: number
    y: number
    z: number
  }
}

export default function DestinationCapturePage() {
  // =========================================================
  // DOM
  // =========================================================

  const containerRef =
    useRef<HTMLDivElement | null>(null)

  // =========================================================
  // THREE
  // =========================================================

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null)

  const sceneRef =
    useRef<THREE.Scene | null>(null)

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(null)

  // =========================================================
  // MULTISET
  // =========================================================

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const mapSpaceRef =
    useRef<MapSpace | null>(null)

  const worldFromMapRef =
    useRef<THREE.Matrix4 | null>(null)

  // =========================================================
  // CURRENT MAP POSITION
  // =========================================================

  const currentMapPositionRef =
    useRef<THREE.Vector3 | null>(null)

  const lastPositionUpdateRef =
    useRef(0)

  // =========================================================
  // STATE
  // =========================================================

  const [status, setStatus] =
    useState('Initializing...')

  const [error, setError] =
    useState('')

  const [localized, setLocalized] =
    useState(false)

  const [destinationName, setDestinationName] =
    useState('')

  const [currentPosition, setCurrentPosition] =
    useState<Destination['position'] | null>(null)

  const [destinations, setDestinations] =
    useState<Destination[]>([])

  // =========================================================
  // CREATE ID
  // =========================================================

  const createId = useCallback(
    (name: string) => {
      return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    },
    []
  )

  // =========================================================
  // CAPTURE DESTINATION
  // =========================================================

  const captureDestination = useCallback(() => {
    if (!localized) {
      alert(
        'Please wait until MultiSet is localized.'
      )

      return
    }

    const name =
      destinationName.trim()

    if (!name) {
      alert(
        'Enter destination name.'
      )

      return
    }

    const position =
      currentMapPositionRef.current

    if (!position) {
      alert(
        'Current map position is not available.'
      )

      return
    }

    const destination: Destination = {
      id: createId(name),

      name,

      position: {
        x: Number(
          position.x.toFixed(3)
        ),

        y: Number(
          position.y.toFixed(3)
        ),

        z: Number(
          position.z.toFixed(3)
        ),
      },
    }

    setDestinations(
      previous => {
        const existingIndex =
          previous.findIndex(
            item =>
              item.id ===
              destination.id
          )

        // Update if same ID exists
        if (
          existingIndex !== -1
        ) {
          const updated = [
            ...previous,
          ]

          updated[existingIndex] =
            destination

          return updated
        }

        // Add new destination
        return [
          ...previous,
          destination,
        ]
      }
    )

    setDestinationName('')

    console.log(
      '[Destination Capture]',
      destination
    )
  }, [
    localized,
    destinationName,
    createId,
  ])

  // =========================================================
  // DELETE
  // =========================================================

  const deleteDestination =
    useCallback(
      (id: string) => {
        setDestinations(
          previous =>
            previous.filter(
              item =>
                item.id !== id
            )
        )
      },
      []
    )

  // =========================================================
  // CLEAR ALL
  // =========================================================

  const clearAll =
    useCallback(() => {
      if (
        destinations.length === 0
      ) {
        return
      }

      if (
        !window.confirm(
          'Clear all destinations?'
        )
      ) {
        return
      }

      setDestinations([])
    }, [destinations.length])

  // =========================================================
  // GENERATED CODE
  // =========================================================

  const generateCode = useCallback(() => {
    const lines =
      destinations.map(
        destination => {
          return `  {
    id: '${destination.id}',
    name: '${destination.name.replace(
      /'/g,
      "\\'"
    )}',
    position: new THREE.Vector3(
      ${destination.position.x},
      ${destination.position.y},
      ${destination.position.z}
    ),
  }`
        }
      )

    if (
      lines.length === 0
    ) {
      return `const DESTINATIONS: Destination[] = [];`
    }

    return `const DESTINATIONS: Destination[] = [

${lines.join(',\n\n')}

];`
  }, [destinations])

  // =========================================================
  // COPY CODE
  // =========================================================

  const copyCode =
    useCallback(async () => {
      const code =
        generateCode()

      try {
        await navigator.clipboard.writeText(
          code
        )

        alert(
          'Destination code copied.'
        )
      } catch (err) {
        console.error(
          'Copy failed:',
          err
        )

        alert(
          'Copy failed. Please copy manually.'
        )
      }
    }, [generateCode])

  // =========================================================
  // MULTISET INITIALIZATION
  // =========================================================

  useEffect(() => {
    let disposed = false

    let resizeHandler:
      | (() => void)
      | null = null

    let animationFrameId:
      | number
      | null = null

    const init = async () => {
      try {
        // -----------------------------------------------------
        // 1. CHECK CONTAINER
        // -----------------------------------------------------

        if (
          !containerRef.current
        ) {
          return
        }

        // -----------------------------------------------------
        // 2. CHECK WEBXR
        // -----------------------------------------------------

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

        // -----------------------------------------------------
        // 3. ENVIRONMENT
        // -----------------------------------------------------

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

        console.log(
          '[Destination Capture] Map:',
          mapCode
        )

        // -----------------------------------------------------
        // 4. MULTISET CLIENT
        // -----------------------------------------------------

        setStatus(
          'Authorizing MultiSet...'
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

        console.log(
          '[Destination Capture] MultiSet authorized'
        )

        // -----------------------------------------------------
        // 5. THREE RENDERER
        // -----------------------------------------------------

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

        // IMPORTANT
        renderer.xr.enabled = true

        // IMPORTANT
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

        // -----------------------------------------------------
        // 6. SCENE
        // -----------------------------------------------------

        const scene =
          new THREE.Scene()

        // IMPORTANT
        scene.background = null

        sceneRef.current =
          scene

        // -----------------------------------------------------
        // 7. CAMERA
        // -----------------------------------------------------

        const camera =
          new THREE.PerspectiveCamera(
            70,

            window.innerWidth /
              window.innerHeight,

            0.01,

            1000
          )

        camera.position.set(
          0,
          0,
          0
        )

        scene.add(camera)

        cameraRef.current =
          camera

        // -----------------------------------------------------
        // 8. XR SESSION
        // -----------------------------------------------------

        setStatus(
          'Creating XR session...'
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
                  '[Destination Capture] XR SESSION STARTED'
                )

                setStatus(
                  'AR session started'
                )
              },

              onSessionEnd: () => {
                console.log(
                  '[Destination Capture] XR SESSION ENDED'
                )

                setStatus(
                  'AR session ended'
                )
              },

              onLocalizationInit:
                () => {
                  console.log(
                    '[Destination Capture] Localization started'
                  )

                  setStatus(
                    'Scanning... move phone slowly'
                  )
                },

              onLocalizationResult:
                (result: any) => {
                  console.log(
                    '[Destination Capture] Localization result:',
                    result
                  )
                },

              onLocalizationFailure:
                (reason: any) => {
                  console.error(
                    '[Destination Capture] Localization failed:',
                    reason
                  )

                  setLocalized(false)

                  setStatus(
                    'Localization failed'
                  )
                },

              onError:
                (error: any) => {
                  console.error(
                    '[Destination Capture] XR ERROR:',
                    error
                  )

                  setError(
                    error?.message ||
                      String(error)
                  )
                },
            }
          )

        // -----------------------------------------------------
        // 9. THREE ADAPTER
        // -----------------------------------------------------

        setStatus(
          'Creating ThreeAdapter...'
        )

        const adapter =
          new ThreeAdapter({
            session,

            renderer,

            scene,

            camera,

            showMesh: false,

            showGizmo: false,

            useDefaultButton: true,

            onLocalizationSuccess:
              (
                result: any,
                worldFromMap: THREE.Matrix4
              ) => {
                if (disposed) {
                  return
                }

                console.log(
                  '================================'
                )

                console.log(
                  '[Destination Capture] LOCALIZED'
                )

                console.log(
                  '[Destination Capture] Confidence:',
                  result?.localizeData
                    ?.confidence
                )

                console.log(
                  '[Destination Capture] worldFromMap:',
                  worldFromMap
                )

                console.log(
                  '================================'
                )

                // -------------------------------------------------
                // SAVE MAP -> WORLD TRANSFORM
                // -------------------------------------------------

                worldFromMapRef.current =
                  worldFromMap.clone()

                setLocalized(true)

                setStatus(
                  'Localized successfully!'
                )
              },

            onXRFrame:
              () => {
                if (
                  disposed ||
                  !camera
                ) {
                  return
                }

                // -----------------------------------------------
                // We need localization first.
                // -----------------------------------------------

                if (
                  !worldFromMapRef.current
                ) {
                  return
                }

                // -----------------------------------------------
                // Camera WORLD position
                // -----------------------------------------------

                const worldPosition =
                  new THREE.Vector3()

                camera.getWorldPosition(
                  worldPosition
                )

                // -----------------------------------------------
                // WORLD -> MAP
                // -----------------------------------------------

                const mapFromWorld =
                  worldFromMapRef.current
                    .clone()
                    .invert()

                const mapPosition =
                  worldPosition
                    .clone()
                    .applyMatrix4(
                      mapFromWorld
                    )

                // -----------------------------------------------
                // SAVE
                // -----------------------------------------------

                currentMapPositionRef.current =
                  mapPosition

                // -----------------------------------------------
                // Don't update React every
                // XR frame.
                // -----------------------------------------------

                const now =
                  performance.now()

                if (
                  now -
                    lastPositionUpdateRef.current <
                  100
                ) {
                  return
                }

                lastPositionUpdateRef.current =
                  now

                setCurrentPosition({
                  x: Number(
                    mapPosition.x.toFixed(
                      3
                    )
                  ),

                  y: Number(
                    mapPosition.y.toFixed(
                      3
                    )
                  ),

                  z: Number(
                    mapPosition.z.toFixed(
                      3
                    )
                  ),
                })
              },
          })

        adapterRef.current =
          adapter

        // -----------------------------------------------------
        // 10. MAP SPACE
        // -----------------------------------------------------

        /**
         * We DO NOT need Navigation here.
         *
         * MapSpace is enough to keep the
         * map coordinate system connected
         * to MultiSet.
         */

        const mapSpace =
          new MapSpace(
            new THREE.Object3D()
          )

        mapSpaceRef.current =
          mapSpace

        scene.add(
          mapSpace.object
        )

        mapSpace.connect(
          adapter
        )

        console.log(
          '[Destination Capture] MapSpace connected'
        )

        // -----------------------------------------------------
        // 11. INITIALIZE ADAPTER
        // -----------------------------------------------------

        setStatus(
          'Initializing AR...'
        )

        /**
         * IMPORTANT:
         *
         * Same initialization style
         * as your working Kokarya page.
         */
        await adapter.initialize()

        if (disposed) {
          return
        }

        setStatus(
          'Ready — tap START AR'
        )

        console.log(
          '[Destination Capture] Ready'
        )

        // -----------------------------------------------------
        // 12. RESIZE
        // -----------------------------------------------------

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

        // -----------------------------------------------------
        // 13. SAFETY ANIMATION LOOP
        // -----------------------------------------------------

        const tick =
          () => {
            if (disposed) {
              return
            }

            animationFrameId =
              requestAnimationFrame(
                tick
              )
          }

        tick()
      } catch (err) {
        console.error(
          '[Destination Capture] Initialization error:',
          err
        )

        const message =
          err instanceof Error
            ? err.message
            : String(err)

        setError(message)

        setStatus(
          'Initialization failed'
        )
      }
    }

    init()

    // =======================================================
    // CLEANUP
    // =======================================================

    return () => {
      disposed = true

      if (
        animationFrameId !== null
      ) {
        cancelAnimationFrame(
          animationFrameId
        )
      }

      if (resizeHandler) {
        window.removeEventListener(
          'resize',
          resizeHandler
        )
      }

      try {
        adapterRef.current?.dispose()
      } catch {}

      try {
        mapSpaceRef.current?.dispose()
      } catch {}

      if (
        rendererRef.current &&
        rendererRef.current
          .domElement
          .parentElement
      ) {
        rendererRef.current
          .domElement
          .parentElement
          .removeChild(
            rendererRef.current
              .domElement
          )
      }

      try {
        rendererRef.current?.dispose()
      } catch {}

      rendererRef.current =
        null

      sceneRef.current =
        null

      cameraRef.current =
        null

      adapterRef.current =
        null

      mapSpaceRef.current =
        null

      worldFromMapRef.current =
        null

      currentMapPositionRef.current =
        null
    }
  }, [])

  // =========================================================
  // UI
  // =========================================================

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#000',
        fontFamily:
          'Arial, sans-serif',
      }}
    >
      {/* =====================================================
          THREE / AR CAMERA
      ====================================================== */}

      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
        }}
      />

      {/* =====================================================
          TOP STATUS
      ====================================================== */}

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,

          zIndex: 20,

          padding: 16,

          borderRadius: 16,

          background:
            'rgba(0,0,0,0.72)',

          color: '#fff',

          backdropFilter:
            'blur(15px)',

          pointerEvents:
            'none',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Destination Capture
        </div>

        <div
          style={{
            fontSize: 13,
            color: '#ccc',
          }}
        >
          {status}
        </div>

        {error && (
          <div
            style={{
              marginTop: 10,
              color: '#ff7777',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* =====================================================
          BOTTOM PANEL
      ====================================================== */}

      <div
        style={{
          position: 'absolute',

          left: 16,
          right: 16,
          bottom: 16,

          zIndex: 20,

          maxHeight:
            '55vh',

          overflowY: 'auto',

          padding: 16,

          borderRadius: 18,

          background:
            'rgba(0,0,0,0.84)',

          backdropFilter:
            'blur(18px)',

          color: '#fff',
        }}
      >
        {/* ---------------------------------------------------
            LOCALIZATION
        ---------------------------------------------------- */}

        <div
          style={{
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#888',
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            MULTISET
          </div>

          <div
            style={{
              color: localized
                ? '#4ade80'
                : '#aaa',

              fontSize: 14,

              fontWeight: 600,
            }}
          >
            {localized
              ? '● Localized'
              : '○ Waiting for localization'}
          </div>
        </div>

        {/* ---------------------------------------------------
            CURRENT POSITION
        ---------------------------------------------------- */}

        <div
          style={{
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#888',
              letterSpacing: 1,
              marginBottom: 7,
            }}
          >
            CURRENT MAP COORDINATES
          </div>

          {currentPosition ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              <Coordinate
                label="X"
                value={
                  currentPosition.x
                }
              />

              <Coordinate
                label="Y"
                value={
                  currentPosition.y
                }
              />

              <Coordinate
                label="Z"
                value={
                  currentPosition.z
                }
              />
            </div>
          ) : (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: '#111',
                color: '#777',
                fontSize: 12,
              }}
            >
              Start AR and localize
              first.
            </div>
          )}
        </div>

        {/* ---------------------------------------------------
            DESTINATION INPUT
        ---------------------------------------------------- */}

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <input
            type="text"
            value={
              destinationName
            }
            onChange={event =>
              setDestinationName(
                event.target.value
              )
            }
            onKeyDown={event => {
              if (
                event.key ===
                'Enter'
              ) {
                captureDestination()
              }
            }}
            placeholder="Enter destination name"
            disabled={!localized}
            style={{
              flex: 1,

              minWidth: 0,

              padding:
                '13px 14px',

              border:
                '1px solid #444',

              borderRadius: 10,

              background: '#111',

              color: '#fff',

              outline: 'none',

              fontSize: 14,
            }}
          />

          <button
            type="button"
            onClick={
              captureDestination
            }
            disabled={!localized}
            style={{
              padding:
                '13px 16px',

              border: 0,

              borderRadius: 10,

              background:
                localized
                  ? '#00bfff'
                  : '#444',

              color: '#fff',

              fontWeight: 700,

              cursor:
                localized
                  ? 'pointer'
                  : 'not-allowed',

              whiteSpace:
                'nowrap',
            }}
          >
            Capture
          </button>
        </div>

        {/* ---------------------------------------------------
            DESTINATIONS
        ---------------------------------------------------- */}

        {destinations.length >
          0 && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Destinations (
                {
                  destinations.length
                }
                )
              </div>

              <button
                type="button"
                onClick={
                  clearAll
                }
                style={{
                  border:
                    '1px solid #444',

                  background:
                    'transparent',

                  color: '#aaa',

                  borderRadius: 8,

                  padding:
                    '6px 10px',

                  cursor:
                    'pointer',
                }}
              >
                Clear
              </button>
            </div>

            {destinations.map(
              destination => (
                <div
                  key={
                    destination.id
                  }
                  style={{
                    display: 'flex',

                    justifyContent:
                      'space-between',

                    alignItems:
                      'center',

                    gap: 10,

                    padding:
                      '10px 12px',

                    marginBottom: 6,

                    background:
                      '#111',

                    borderRadius: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {
                        destination.name
                      }
                    </div>

                    <div
                      style={{
                        marginTop: 5,

                        fontFamily:
                          'monospace',

                        fontSize: 11,

                        color: '#888',
                      }}
                    >
                      X:{' '}
                      {
                        destination
                          .position
                          .x
                      }{' '}
                      Y:{' '}
                      {
                        destination
                          .position
                          .y
                      }{' '}
                      Z:{' '}
                      {
                        destination
                          .position
                          .z
                      }
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      deleteDestination(
                        destination.id
                      )
                    }
                    style={{
                      border: 0,

                      background:
                        'transparent',

                      color:
                        '#ff6b6b',

                      cursor:
                        'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              )
            )}

            {/* -------------------------------------------------
                GENERATED CODE
            -------------------------------------------------- */}

            <div
              style={{
                marginTop: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'center',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  Generated Code
                </div>

                <button
                  type="button"
                  onClick={
                    copyCode
                  }
                  style={{
                    border: 0,

                    borderRadius: 8,

                    padding:
                      '8px 12px',

                    background:
                      '#00bfff',

                    color: '#fff',

                    fontWeight: 700,

                    cursor:
                      'pointer',
                  }}
                >
                  Copy
                </button>
              </div>

              <pre
                style={{
                  margin: 0,

                  padding: 14,

                  background:
                    '#050505',

                  borderRadius: 10,

                  color: '#9ff',

                  fontFamily:
                    'monospace',

                  fontSize: 11,

                  lineHeight: 1.55,

                  overflowX:
                    'auto',

                  whiteSpace:
                    'pre',
                }}
              >
                {
                  generateCode()
                }
              </pre>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

// =========================================================
// COORDINATE COMPONENT
// =========================================================

function Coordinate({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div
      style={{
        padding: 12,

        borderRadius: 10,

        background: '#111',

        border:
          '1px solid #222',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#777',
          marginBottom: 4,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontFamily:
            'monospace',

          fontSize: 14,

          fontWeight: 600,
        }}
      >
        {value.toFixed(3)}
      </div>
    </div>
  )
}