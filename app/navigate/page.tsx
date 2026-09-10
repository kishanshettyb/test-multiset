'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  MultisetClient,
  XRSessionManager,
} from '@multisetai/vps/core'
import { ThreeAdapter } from '@multisetai/vps/three'

export default function NavigatePage() {
  const containerRef = useRef<HTMLDivElement>(null)

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null)

  const sceneRef =
    useRef<THREE.Scene | null>(null)

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(null)

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const [status, setStatus] = useState('Initializing...')

  const [confidence, setConfidence] =
    useState<number | null>(null)

  const [position, setPosition] =
    useState<{
      x: number
      y: number
      z: number
    } | null>(null)

  const [errorDetails, setErrorDetails] =
    useState<string | null>(null)

  const showError = (error: unknown) => {
    console.error('MultiSet error:', error)

    let message = 'Unknown error'

    if (error instanceof Error) {
      message = `${error.name}: ${error.message}`
    } else if (typeof error === 'string') {
      message = error
    } else {
      try {
        message = JSON.stringify(error, null, 2)
      } catch {
        message = String(error)
      }
    }

    setErrorDetails(message)
    setStatus('MultiSet ERROR')
  }

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        if (!containerRef.current) {
          return
        }

        setStatus('Checking AR support...')
        setErrorDetails(null)

        /*
         * Check WebXR support
         */
        const supported =
          await ThreeAdapter.isSupported()

        if (!supported) {
          setStatus(
            'Immersive AR is not supported. Use an ARCore-compatible Android device with Chrome.'
          )

          return
        }

        /*
         * MultiSet credentials
         *
         * These must currently be NEXT_PUBLIC_ variables
         * because this page runs in the browser.
         */
        const clientId =
          process.env.NEXT_PUBLIC_MULTISET_CLIENT_ID

        const clientSecret =
          process.env.NEXT_PUBLIC_MULTISET_CLIENT_SECRET

        const mapCode =
          process.env.NEXT_PUBLIC_MULTISET_MAP_CODE

        if (
          !clientId ||
          !clientSecret ||
          !mapCode
        ) {
          setStatus(
            'MultiSet environment variables are missing.'
          )

          return
        }

        console.log(
          'MultiSet configuration:',
          {
            clientIdPresent: !!clientId,
            clientSecretPresent: !!clientSecret,
            mapCodePresent: !!mapCode,
          }
        )

        /*
         * Create MultiSet client
         */
        setStatus('Authorizing MultiSet...')

        const client = new MultisetClient({
          clientId,
          clientSecret,
          mapType: 'map',
          code: mapCode,
        })

        await client.authorize()

        if (!mounted) {
          return
        }

        console.log(
          'MultiSet authorization successful'
        )

        /*
         * Create Three.js renderer
         */
        setStatus('Creating AR session...')

        const renderer =
          new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
          })

        renderer.xr.enabled = true

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

        rendererRef.current = renderer

        containerRef.current.appendChild(
          renderer.domElement
        )

        /*
         * Scene
         */
        const scene = new THREE.Scene()

        scene.background = null

        sceneRef.current = scene

        /*
         * Camera
         */
        const camera =
          new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
              window.innerHeight,
            0.01,
            100
          )

        cameraRef.current = camera

        scene.add(camera)

        /*
         * Basic lighting
         */
        const light =
          new THREE.AmbientLight(
            0xffffff,
            1
          )

        scene.add(light)

        /*
         * Create MultiSet XR session
         */
        const session =
          new XRSessionManager(
            renderer.getContext() as WebGL2RenderingContext,
            {
              client,

              /*
               * Automatically attempt localization
               * when the AR session starts.
               */
              autoLocalize: true,

              /*
               * Only accept localization results
               * above this confidence.
               */
              confidenceCheck: true,
              confidenceThreshold: 0.5,

              /*
               * local works on the device where
               * local-floor was not supported.
               */
              referenceSpaceType: 'local',

              onSessionStart: () => {
                console.log(
                  'MultiSet AR session started'
                )

                setErrorDetails(null)

                setStatus(
                  'AR started — looking for your map...'
                )
              },

              onSessionEnd: () => {
                console.log(
                  'MultiSet AR session ended'
                )

                setStatus(
                  'AR session ended'
                )
              },

              onLocalizationResult: (
                result
              ) => {
                console.log(
                  'MultiSet localization result:',
                  result
                )

                try {
                  const data =
                    result.localizeData

                  if (!data) {
                    setStatus(
                      'Localization returned no pose.'
                    )

                    return
                  }

                  setConfidence(
                    data.confidence
                  )

                  setPosition({
                    x: data.position.x,
                    y: data.position.y,
                    z: data.position.z,
                  })

                  setStatus(
                    '✓ VPS LOCALIZED'
                  )
                } catch (error) {
                  showError(error)
                }
              },

              onLocalizationFailure: (
                reason
              ) => {
                console.warn(
                  'MultiSet localization failed:',
                  reason
                )

                setStatus(
                  'Scanning... Move the phone slowly and point at the mapped area.'
                )
              },

              onError: (error) => {
                showError(error)
              },
            }
          )

        /*
         * ThreeAdapter
         */
        const adapter =
          new ThreeAdapter({
            session,
            renderer,
            scene,
            camera,

            /*
             * We use our own Start button.
             */
            useDefaultButton: false,

            /*
             * Show MultiSet map mesh
             * when available.
             */
            showMesh: true,

            /*
             * Show map origin.
             */
            showGizmo: true,

            onLocalizationSuccess: (
              result,
              worldFromMap
            ) => {
              console.log(
                'LOCALIZATION SUCCESS:',
                result
              )

              console.log(
                'worldFromMap:',
                worldFromMap
              )

              try {
                const data =
                  result.localizeData

                if (!data) {
                  setStatus(
                    'Localization succeeded but no pose was returned.'
                  )

                  return
                }

                setConfidence(
                  data.confidence
                )

                setPosition({
                  x: data.position.x,
                  y: data.position.y,
                  z: data.position.z,
                })

                setErrorDetails(null)

                setStatus(
                  '✓ VPS LOCALIZED'
                )
              } catch (error) {
                showError(error)
              }
            },
          })

        /*
         * Initialize adapter
         */
        adapter.initialize()

        adapterRef.current = adapter

        /*
         * Window resize
         */
        const handleResize = () => {
          if (!renderer || !camera) {
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

        if (mounted) {
          setStatus(
            'Ready — tap Start Indoor Navigation'
          )
        }

        /*
         * Cleanup for initialization
         */
        return () => {
          window.removeEventListener(
            'resize',
            handleResize
          )

          try {
            adapter.dispose()
          } catch (error) {
            console.warn(
              'Adapter cleanup error:',
              error
            )
          }

          try {
            renderer.dispose()
          } catch (error) {
            console.warn(
              'Renderer cleanup error:',
              error
            )
          }

          if (
            renderer.domElement
              .parentElement
          ) {
            renderer.domElement.remove()
          }
        }
      } catch (error) {
        console.error(
          'MultiSet initialization error:',
          error
        )

        showError(error)
      }
    }

    initialize()

    return () => {
      mounted = false

      if (adapterRef.current) {
        try {
          adapterRef.current.dispose()
        } catch (error) {
          console.warn(
            'Adapter dispose error:',
            error
          )
        }

        adapterRef.current = null
      }

      if (rendererRef.current) {
        try {
          rendererRef.current.dispose()
        } catch (error) {
          console.warn(
            'Renderer dispose error:',
            error
          )
        }

        if (
          rendererRef.current
            .domElement
            .parentElement
        ) {
          rendererRef.current.domElement.remove()
        }

        rendererRef.current = null
      }
    }
  }, [])

  /*
   * Start AR
   *
   * This must be called directly from
   * the user's tap/click.
   */
  const startAR = async () => {
    const adapter =
      adapterRef.current

    if (!adapter) {
      setStatus(
        'MultiSet is still initializing...'
      )

      return
    }

    try {
      setErrorDetails(null)

      setStatus(
        'Starting AR...'
      )

      await adapter.startSession()

      console.log(
        'AR session requested successfully'
      )
    } catch (error) {
      showError(error)
    }
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white">

      {/* Three.js / AR canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0"
      />

      {/* Status panel */}
      <div className="absolute left-0 right-0 top-0 z-20 p-4">

        <div className="rounded-xl bg-black/70 p-4 backdrop-blur">

          <div className="text-sm font-medium">
            Indoor Navigation
          </div>

          <div className="mt-1 text-xs text-gray-300">
            {status}
          </div>

          {confidence !== null && (
            <div className="mt-2 text-xs text-green-400">
              Confidence:{' '}
              {confidence.toFixed(3)}
            </div>
          )}

          {position && (
            <div className="mt-2 text-xs text-gray-300">
              Position:{' '}
              {position.x.toFixed(2)},{' '}
              {position.y.toFixed(2)},{' '}
              {position.z.toFixed(2)}
            </div>
          )}

          {/* Mobile error display */}
          {errorDetails && (
            <div className="mt-3 max-h-64 overflow-auto rounded-lg bg-red-950 p-3">
              <div className="mb-1 text-xs font-semibold text-red-300">
                ERROR DETAILS
              </div>

              <pre className="whitespace-pre-wrap break-words text-xs text-red-200">
                {errorDetails}
              </pre>
            </div>
          )}

        </div>

      </div>

      {/* Start button */}
      <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center">

        <button
          type="button"
          onClick={startAR}
          className="rounded-2xl bg-white px-7 py-4 font-semibold text-black shadow-xl active:scale-95"
        >
          Start Indoor Navigation
        </button>

      </div>

    </main>
  )
}
