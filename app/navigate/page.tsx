'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  MultisetClient,
  XRSessionManager,
} from '@multisetai/vps/core'
import { ThreeAdapter } from '@multisetai/vps/three'

export default function NavigatePage() {
  const containerRef =
    useRef<HTMLDivElement>(null)

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null)

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const [status, setStatus] =
    useState('Initializing...')

  const [errorDetails, setErrorDetails] =
    useState<string | null>(null)

  const [confidence, setConfidence] =
    useState<number | null>(null)

  const [position, setPosition] =
    useState<{
      x: number
      y: number
      z: number
    } | null>(null)

  const showError = (error: unknown) => {
    console.error(
      'MultiSet error:',
      error
    )

    let message = 'Unknown error'

    if (error instanceof Error) {
      message =
        `${error.name}: ${error.message}`
    } else if (
      typeof error === 'string'
    ) {
      message = error
    } else {
      try {
        message =
          JSON.stringify(
            error,
            null,
            2
          )
      } catch {
        message = String(error)
      }
    }

    setErrorDetails(message)
    setStatus('MultiSet ERROR')
  }

  useEffect(() => {
    let disposed = false

    const initialize = async () => {
      try {
        if (!containerRef.current) {
          return
        }

        setStatus(
          'Checking AR support...'
        )

        /*
         * Check WebXR
         */
        const supported =
          await XRSessionManager.isSupported()

        if (!supported) {
          setStatus(
            'Immersive AR is not supported on this device/browser.'
          )

          return
        }

        /*
         * Environment variables
         */
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
          setStatus(
            'MultiSet environment variables are missing.'
          )

          return
        }

        /*
         * MultiSet client
         */
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

        /*
         * THREE renderer
         *
         * IMPORTANT:
         * Do not call renderer.setAnimationLoop().
         * ThreeAdapter manages the XR render loop.
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

        renderer.xr.enabled = true

        rendererRef.current =
          renderer

        renderer.domElement.style.position =
          'absolute'

        renderer.domElement.style.left =
          '0'

        renderer.domElement.style.top =
          '0'

        renderer.domElement.style.width =
          '100%'

        renderer.domElement.style.height =
          '100%'

        renderer.domElement.style.display =
          'block'

        containerRef.current.appendChild(
          renderer.domElement
        )

        /*
         * Scene
         */
        const scene =
          new THREE.Scene()

        /*
         * Transparent scene.
         *
         * WebXR supplies the camera passthrough.
         */
        scene.background = null

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

        /*
         * Small ambient light.
         */
        scene.add(
          new THREE.AmbientLight(
            0xffffff,
            1
          )
        )

        /*
         * XR session manager
         */
        const session =
          new XRSessionManager(
            renderer.getContext() as WebGL2RenderingContext,
            {
              client,

              /*
               * Start VPS localization
               * automatically after AR starts.
               */
              autoLocalize: true,

              /*
               * Use local because your
               * device rejected local-floor.
               */
              referenceSpaceType:
                'local',

              confidenceCheck: true,

              confidenceThreshold: 0.5,

              onSessionStart: () => {
                console.log(
                  'XR SESSION STARTED'
                )

                setErrorDetails(null)

                setStatus(
                  'AR started — looking for your map...'
                )
              },

              onSessionEnd: () => {
                console.log(
                  'XR SESSION ENDED'
                )

                setStatus(
                  'AR session ended'
                )
              },

              onLocalizationInit: () => {
                console.log(
                  'VPS localization started'
                )

                setStatus(
                  'Scanning environment...'
                )
              },

              onLocalizationResult:
                (result) => {
                  console.log(
                    'VPS localization result:',
                    result
                  )

                  const data =
                    result.localizeData

                  if (!data) {
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
                },

              onLocalizationFailure:
                (reason) => {
                  console.warn(
                    'VPS localization failed:',
                    reason
                  )

                  setStatus(
                    'Scanning... Move the phone slowly and point at the mapped area.'
                  )
                },

              onFrameCaptured:
                (frame) => {
                  console.log(
                    'VPS frame captured',
                    frame
                  )
                },

              onCameraIntrinsics:
                (intrinsics) => {
                  console.log(
                    'Camera intrinsics:',
                    intrinsics
                  )
                },

              onError: (error) => {
                showError(error)
              },

              onContextLost: () => {
                setStatus(
                  'WebGL context lost.'
                )
              },

              onContextRestored: () => {
                setStatus(
                  'WebGL context restored.'
                )
              },
            }
          )

        /*
         * ThreeAdapter
         *
         * This class owns:
         * - XR render target
         * - XR frame loop
         * - XR camera matrices
         * - Three.js rendering
         */
        const adapter =
          new ThreeAdapter({
            session,
            renderer,
            scene,
            camera,

            /*
             * We use our own button.
             */
            useDefaultButton: false,

            /*
             * Don't load mesh during
             * initial VPS test.
             */
            showMesh: false,

            /*
             * Don't show gizmo during
             * initial VPS test.
             */
            showGizmo: false,

            onXRFrame: () => {
              /*
               * ThreeAdapter handles
               * the actual XR camera.
               */
            },

            onLocalizationSuccess:
              (
                result,
                worldFromMap
              ) => {
                console.log(
                  '======================'
                )

                console.log(
                  'VPS LOCALIZATION SUCCESS'
                )

                console.log(
                  'Result:',
                  result
                )

                console.log(
                  'World From Map:',
                  worldFromMap
                )

                console.log(
                  '======================'
                )

                const data =
                  result.localizeData

                if (!data) {
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
              },
          })

        /*
         * Initialize adapter.
         *
         * MultiSet starts its preview/render
         * handling here.
         */
        adapter.initialize()

        adapterRef.current =
          adapter

        /*
         * Resize
         */
        const handleResize = () => {
          renderer.setSize(
            window.innerWidth,
            window.innerHeight
          )
        }

        window.addEventListener(
          'resize',
          handleResize
        )

        setStatus(
          'Ready — tap Start Indoor Navigation'
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
            adapter.dispose()
          } catch {}

          try {
            renderer.dispose()
          } catch {}

          if (
            renderer.domElement
              .parentElement
          ) {
            renderer.domElement.remove()
          }
        }
      } catch (error) {
        showError(error)
      }
    }

    initialize()

    return () => {
      disposed = true

      if (adapterRef.current) {
        try {
          adapterRef.current.dispose()
        } catch {}

        adapterRef.current = null
      }

      if (rendererRef.current) {
        try {
          rendererRef.current.dispose()
        } catch {}

        if (
          rendererRef.current
            .domElement
            .parentElement
        ) {
          rendererRef.current
            .domElement
            .remove()
        }

        rendererRef.current = null
      }
    }
  }, [])

  /*
   * Start AR
   *
   * MUST be called directly
   * from the user tap.
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
        'adapter.startSession() completed'
      )
    } catch (error) {
      showError(error)
    }
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white">

      {/* AR / Three.js canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0"
      />

      {/* Status */}
      <div className="absolute left-0 right-0 top-0 z-50 p-4">

        <div className="rounded-xl bg-black/70 p-4 backdrop-blur">

          <div className="text-sm font-semibold">
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

          {errorDetails && (
            <div className="mt-3 max-h-60 overflow-auto rounded-lg bg-red-950 p-3">

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

      {/* Start */}
      <div className="absolute bottom-8 left-0 right-0 z-50 flex justify-center">

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
