'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { MultisetClient, XRSessionManager } from '@multisetai/vps/core'
import { ThreeAdapter } from '@multisetai/vps/three'

export default function NavigatePage() {
  const containerRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState('Initializing...')
  const [error, setError] = useState('')

  useEffect(() => {
    let adapter: ThreeAdapter | null = null
    let disposed = false

    async function init() {
      try {
        setStatus('Checking WebXR...')

        const supported = await XRSessionManager.isSupported()

        if (!supported) {
          throw new Error('WebXR is not supported on this device/browser.')
        }

        const clientId =
          process.env.NEXT_PUBLIC_MULTISET_CLIENT_ID

        const clientSecret =
          process.env.NEXT_PUBLIC_MULTISET_CLIENT_SECRET

        const mapCode =
          process.env.NEXT_PUBLIC_MULTISET_MAP_CODE

        if (!clientId || !clientSecret || !mapCode) {
          throw new Error(
            'Missing MultiSet environment variables.'
          )
        }

        setStatus('Connecting to MultiSet...')

        const client = new MultisetClient({
          clientId,
          clientSecret,
          mapType: 'map',
          code: mapCode,
        })

        await client.authorize()

        if (disposed) return

        setStatus('Creating AR renderer...')

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        })

        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(
          window.innerWidth,
          window.innerHeight
        )

        renderer.setClearColor(0x000000, 0)

        // Important:
        // Do NOT use renderer.setAnimationLoop().
        // ThreeAdapter manages the XR rendering loop.
        //
        // Do NOT manually call renderer.xr.enabled here.
        // ThreeAdapter handles XR setup.

        renderer.domElement.style.position = 'fixed'
        renderer.domElement.style.top = '0'
        renderer.domElement.style.left = '0'
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'
        renderer.domElement.style.zIndex = '0'

        containerRef.current?.appendChild(renderer.domElement)

        const scene = new THREE.Scene()

        const camera = new THREE.PerspectiveCamera(
          70,
          window.innerWidth / window.innerHeight,
          0.01,
          1000
        )

        setStatus('Creating MultiSet XR session...')

        const session = new XRSessionManager(
          renderer.getContext() as WebGL2RenderingContext,
          {
            client,

            autoLocalize: true,

            referenceSpaceType: 'local',

            confidenceCheck: true,

            confidenceThreshold: 0.5,

            onSessionStart: () => {
              console.log('XR SESSION STARTED')
              setStatus('Scanning...')
            },

            onSessionEnd: () => {
              console.log('XR SESSION ENDED')
              setStatus('AR session ended')
            },

            onLocalizationInit: () => {
              console.log('Localization started')
              setStatus(
                'Scanning... Move the phone slowly and point at the mapped area.'
              )
            },

            onLocalizationResult: (result: any) => {
              console.log(
                'Localization result:',
                result
              )
            },

            onLocalizationFailure: (error: any) => {
              console.error(
                'Localization failed:',
                error
              )

              setStatus('Localization failed')
            },

            onError: (error: any) => {
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

        adapter = new ThreeAdapter({
          session,
          renderer,
          scene,
          camera,

          // Keep everything invisible for now.
          // We are testing camera passthrough first.
          showMesh: false,
          showGizmo: false,

          // IMPORTANT:
          // Let MultiSet create and manage the AR button.
          useDefaultButton: true,

          onLocalizationSuccess: (
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

            setStatus(
              'Localized successfully!'
            )
          },

          onXRFrame: () => {
            // ThreeAdapter handles camera synchronization
            // and XR rendering.
          },
        })

        await adapter.initialize()

        if (disposed) return

        setStatus(
          'Ready — tap the AR button.'
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

        setStatus('Initialization failed')
      }
    }

    init()

    return () => {
      disposed = true

      try {
        adapter?.dispose()
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
        }}
      />

      {/* Debug information */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          right: 20,
          zIndex: 10,
          color: 'white',
          background: 'rgba(0,0,0,0.65)',
          padding: 16,
          borderRadius: 12,
          fontFamily: 'Arial, sans-serif',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Indoor Navigation
        </div>

        <div style={{ fontSize: 17 }}>
          {status}
        </div>

        {error && (
          <div
            style={{
              marginTop: 10,
              color: '#ff7777',
              fontSize: 14,
              wordBreak: 'break-word',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </main>
  )
}