'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { MultisetClient, XRSessionManager } from '@multisetai/vps/core'
import { ThreeAdapter } from '@multisetai/vps/three'

export default function NavigatePage() {
  const containerRef = useRef<HTMLDivElement>(null)

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const adapterRef = useRef<ThreeAdapter | null>(null)

  const [status, setStatus] = useState('Initializing...')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [position, setPosition] = useState<{
    x: number
    y: number
    z: number
  } | null>(null)

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        if (!containerRef.current) {
          return
        }

        setStatus('Checking AR support...')

        const supported = await ThreeAdapter.isSupported()

        if (!supported) {
          setStatus(
            'Immersive AR is not supported. Use an ARCore-compatible Android device with Chrome.'
          )
          return
        }

        const clientId = process.env.NEXT_PUBLIC_MULTISET_CLIENT_ID
        const clientSecret = process.env.NEXT_PUBLIC_MULTISET_CLIENT_SECRET
        const mapCode = process.env.NEXT_PUBLIC_MULTISET_MAP_CODE

        if (!clientId || !clientSecret || !mapCode) {
          setStatus('MultiSet environment variables are missing.')
          return
        }

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

        setStatus('Creating AR session...')

        // Three.js renderer
        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        })

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(
          window.innerWidth,
          window.innerHeight
        )

        rendererRef.current = renderer

        containerRef.current.appendChild(renderer.domElement)

        // Scene
        const scene = new THREE.Scene()
        scene.background = null

        sceneRef.current = scene

        // Camera
        const camera = new THREE.PerspectiveCamera(
          70,
          window.innerWidth / window.innerHeight,
          0.01,
          100
        )

        cameraRef.current = camera

        scene.add(camera)

        // Light
        const light = new THREE.AmbientLight(0xffffff, 1)
        scene.add(light)

        // XR / VPS session
        const session = new XRSessionManager(
          renderer.getContext() as WebGL2RenderingContext,
          {
            client,
            autoLocalize: true,

            confidenceCheck: true,
            confidenceThreshold: 0.5,

            referenceSpaceType: 'local',

            onSessionStart: () => {
              console.log('MultiSet AR session started')
              setStatus('AR started — looking for your map...')
            },

            onSessionEnd: () => {
              console.log('MultiSet AR session ended')
              setStatus('AR session ended')
            },

            onLocalizationResult: (result) => {
              console.log('MultiSet localization result:', result)

              const data = result.localizeData

              setConfidence(data.confidence)

              setPosition({
                x: data.position.x,
                y: data.position.y,
                z: data.position.z,
              })

              setStatus('✓ Localized successfully')
            },

            onLocalizationFailure: (reason) => {
              console.warn(
                'MultiSet localization failed:',
                reason
              )

              setStatus(
                'Scanning... Move the phone slowly and point at the mapped area.'
              )
            },

            onError: (error) => {
              console.error('MultiSet session error:', error)

              let message = 'Unknown MultiSet error'

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

              setStatus(`MultiSet ERROR: ${message}`)
            },

          }
        )

        // ThreeAdapter connects MultiSet to Three.js
        const adapter = new ThreeAdapter({
          session,
          renderer,
          scene,
          camera,

          // We will use our own button
          useDefaultButton: false,

          // Display the map mesh after successful localization
          showMesh: true,

          // Display map origin gizmo
          showGizmo: true,

          onLocalizationSuccess: (
            result,
            worldFromMap
          ) => {
            console.log(
              'LOCALIZATION SUCCESS',
              result
            )

            console.log(
              'worldFromMap:',
              worldFromMap
            )

            const data = result.localizeData

            setConfidence(data.confidence)

            setPosition({
              x: data.position.x,
              y: data.position.y,
              z: data.position.z,
            })

            setStatus('✓ VPS LOCALIZED')
          },
        })

        adapter.initialize()

        adapterRef.current = adapter

        // Resize
        const handleResize = () => {
          if (!renderer || !camera) {
            return
          }

          camera.aspect =
            window.innerWidth / window.innerHeight

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

        setStatus('Ready — tap Start Indoor Navigation')

        return () => {
          window.removeEventListener(
            'resize',
            handleResize
          )

          adapter.dispose()

          renderer.dispose()

          if (
            renderer.domElement.parentElement
          ) {
            renderer.domElement.remove()
          }
        }
      } catch (error) {
        console.error(
          'MultiSet initialization error:',
          error
        )

        setStatus(
          'Initialization failed. Check browser console.'
        )
      }
    }

    initialize()

    return () => {
      mounted = false

      if (adapterRef.current) {
        adapterRef.current.dispose()
        adapterRef.current = null
      }

      if (rendererRef.current) {
        rendererRef.current.dispose()

        if (
          rendererRef.current.domElement.parentElement
        ) {
          rendererRef.current.domElement.remove()
        }

        rendererRef.current = null
      }
    }
  }, [])

  const startAR = async () => {
    const adapter = adapterRef.current

    if (!adapter) {
      setStatus('MultiSet is still initializing...')
      return
    }

    try {
      // IMPORTANT:
      // startSession() must be called directly from
      // the user's click/tap handler.
      await adapter.startSession()
    } catch (error) {
      console.error(
        'Failed to start AR session:',
        error
      )

      setStatus(
        'Unable to start AR. Check browser permissions and console.'
      )
    }
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-white">
      <div
        ref={containerRef}
        className="absolute inset-0"
      />

      {/* UI */}
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
              Confidence: {confidence.toFixed(3)}
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
