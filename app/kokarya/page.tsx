'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { MultisetClient, XRSessionManager } from '@multisetai/vps/core'
import { ThreeAdapter, MapSpace } from '@multisetai/vps/three'

type Destination = {
  id: string
  name: string
  position: THREE.Vector3
}

const destinations: Destination[] = [
  {
    id: 'lift',
    name: 'Lift',
    position: new THREE.Vector3(
      -0.152,
      -0.135,
      0.685
    ),
  },
  {
    id: 'reception',
    name: 'Reception',
    position: new THREE.Vector3(
      0.636,
      0.085,
      5.557
    ),
  },
  {
    id: 'entrance',
    name: 'Entrance',
    position: new THREE.Vector3(
      0.869,
      -0.032,
      3.022
    ),
  },
  {
    id: 'seating',
    name: 'Seating',
    position: new THREE.Vector3(
      1.925,
      0.204,
      4.881
    ),
  },
]

export default function NavigatePage() {
  const containerRef = useRef<HTMLDivElement>(null)

  const adapterRef = useRef<ThreeAdapter | null>(null)
  const mapSpaceRef = useRef<MapSpace | null>(null)

  const markerRef = useRef<THREE.Group | null>(null)

  const [status, setStatus] = useState('Initializing...')
  const [error, setError] = useState('')

  const [localized, setLocalized] = useState(false)

  const [selectedDestination, setSelectedDestination] =
    useState('lift')

  useEffect(() => {
    let disposed = false

    async function init() {
      try {
        setStatus('Checking WebXR...')

        const supported =
          await XRSessionManager.isSupported()

        if (!supported) {
          throw new Error(
            'WebXR is not supported on this device/browser.'
          )
        }

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

        if (disposed) return

        setStatus(
          'Creating AR renderer...'
        )

        const renderer =
          new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
          })

        renderer.setPixelRatio(
          window.devicePixelRatio
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

        renderer.domElement.style.top = '0'
        renderer.domElement.style.left = '0'
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'
        renderer.domElement.style.zIndex = '0'

        containerRef.current?.appendChild(
          renderer.domElement
        )

        const scene =
          new THREE.Scene()

        const camera =
          new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
              window.innerHeight,
            0.01,
            1000
          )

        setStatus(
          'Creating MultiSet XR session...'
        )

        const session =
          new XRSessionManager(
            renderer.getContext() as WebGL2RenderingContext,
            {
              client,

              autoLocalize: true,

              referenceSpaceType: 'local',

              confidenceCheck: true,

              confidenceThreshold: 0.5,

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

                setStatus(
                  'AR session ended'
                )

                setLocalized(false)
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
                error: any
              ) => {
                console.error(
                  'Localization failed:',
                  error
                )

                setStatus(
                  'Localization failed'
                )
              },

              onError: (
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

        /*
         * MapSpace
         *
         * All our destination coordinates
         * are stored in this persistent map frame.
         */
        const mapSpace =
          new MapSpace(
            new THREE.Object3D(),
            {
              hideUntilLocalized: false,
            }
          )

        scene.add(
          mapSpace.object
        )

        mapSpaceRef.current =
          mapSpace

        const adapter =
          new ThreeAdapter({
            session,
            renderer,
            scene,
            camera,

            showMesh: false,
            showGizmo: false,

            useDefaultButton: true,

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
               * Connect MapSpace to MultiSet.
               *
               * This makes the MapSpace follow
               * every successful localization.
               */
              mapSpace.connect(
                adapter
              )

              setLocalized(true)

              setStatus(
                'Localized successfully!'
              )
            },

            onXRFrame: () => {
              // ThreeAdapter handles
              // XR camera synchronization
              // and rendering.
            },
          })

        adapterRef.current =
          adapter

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

        setStatus(
          'Initialization failed'
        )
      }
    }

    init()

    return () => {
      disposed = true

      try {
        markerRef.current?.removeFromParent()
      } catch {}

      try {
        mapSpaceRef.current?.dispose()
      } catch {}

      try {
        adapterRef.current?.dispose()
      } catch {}
    }
  }, [])

  /*
   * Create the AR destination marker.
   */
  const showDestination = () => {
    if (!localized) {
      setStatus(
        'Please localize first.'
      )
      return
    }

    const mapSpace =
      mapSpaceRef.current

    if (!mapSpace) {
      setError(
        'MapSpace is not ready.'
      )
      return
    }

    const destination =
      destinations.find(
        item =>
          item.id ===
          selectedDestination
      )

    if (!destination) {
      return
    }

    /*
     * Remove previous marker.
     */
    if (markerRef.current) {
      markerRef.current.removeFromParent()

      markerRef.current = null
    }

    /*
     * Create marker group.
     */
    const marker =
      new THREE.Group()

    /*
     * Floor ring.
     */
    const ring =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.25,
          0.32,
          32
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        })
      )

    ring.rotation.x =
      -Math.PI / 2

    /*
     * Vertical pole.
     */
    const pole =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.025,
          0.025,
          0.8,
          16
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
        })
      )

    pole.position.y =
      0.4

    /*
     * Floating destination sphere.
     */
    const sphere =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.16,
          24,
          24
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
        })
      )

    sphere.position.y =
      0.85

    marker.add(ring)
    marker.add(pole)
    marker.add(sphere)

    /*
     * IMPORTANT:
     *
     * destination.position is already
     * a MultiSet map coordinate because
     * we obtained these values from
     * our localized map positions.
     */
    mapSpace.add(
      marker,
      destination.position.clone()
    )

    markerRef.current =
      marker

    setStatus(
      `Destination: ${destination.name}`
    )

    console.log(
      'Destination:',
      destination.name
    )

    console.log(
      'Map position:',
      destination.position
    )
  }

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

      {/* UI */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          right: 20,
          zIndex: 10,

          color: 'white',

          background:
            'rgba(0,0,0,0.70)',

          padding: 16,

          borderRadius: 14,

          fontFamily:
            'Arial, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          Indoor Navigation
        </div>

        <div
          style={{
            fontSize: 16,
            marginBottom: 14,
          }}
        >
          {status}
        </div>

        {localized && (
          <>
            <div
              style={{
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              Destination
            </div>

            <select
              value={
                selectedDestination
              }
              onChange={e =>
                setSelectedDestination(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: 'none',
                fontSize: 16,
                marginBottom: 10,
              }}
            >
              {destinations.map(
                destination => (
                  <option
                    key={
                      destination.id
                    }
                    value={
                      destination.id
                    }
                  >
                    {destination.name}
                  </option>
                )
              )}
            </select>

            <button
              onClick={
                showDestination
              }
              style={{
                width: '100%',
                padding: 13,
                borderRadius: 8,
                border: 'none',
                background:
                  '#ffffff',
                color: '#000000',
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              Show Destination
            </button>
          </>
        )}

        {error && (
          <div
            style={{
              marginTop: 10,
              color: '#ff7777',
              fontSize: 14,
              wordBreak:
                'break-word',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </main>
  )
}