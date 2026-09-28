'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import {
  MultisetClient,
  XRSessionManager,
} from '@multisetai/vps/core'

import {
  ThreeAdapter,
  MapSpace,
} from '@multisetai/vps/three'

import {
  Navigation,
  NavMeshPathfinder,
} from '@multisetai/vps/navigation'

type Destination = {
  id: string
  name: string
  position: THREE.Vector3
}

const DESTINATIONS: Destination[] = [
  {
    id: 'entrance',
    name: 'Entrance',
    position: new THREE.Vector3(
      -0.149,
      -0.543,
      1.201
    ),
  },

  {
    id: 'pantry',
    name: 'Pantry',
    position: new THREE.Vector3(
      0.607,
      -0.493,
      6.68
    ),
  },

  {
    id: 'cabin-1',
    name: 'Cabin 1',
    position: new THREE.Vector3(
      4.758,
      -0.47,
      1.897
    ),
  },

  {
    id: 'cabin-2',
    name: 'Cabin 2',
    position: new THREE.Vector3(
      8.962,
      -0.488,
      1.736
    ),
  },

  {
    id: 'meeting-room',
    name: 'Meeting room',
    position: new THREE.Vector3(
      11.588,
      -0.468,
      1.757
    ),
  },
]

// =============================================================
// COMPONENT
// =============================================================

export default function KokaryaFullMapPage() {
  // ===========================================================
  // THREE REFS
  // ===========================================================

  const containerRef =
    useRef<HTMLDivElement | null>(null)

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(null)

  const adapterRef =
    useRef<ThreeAdapter | null>(null)

  const mapSpaceRef =
    useRef<MapSpace | null>(null)

  const pathfinderRef =
    useRef<NavMeshPathfinder | null>(null)

  const navigationRef =
    useRef<Navigation | null>(null)

  // ===========================================================
  // NAVIGATION VISUAL REFS
  // ===========================================================

  const navigationVisualRef =
    useRef<THREE.Group | null>(null)

  const routeCurveRef =
    useRef<THREE.CatmullRomCurve3 | null>(null)

  const chevronsRef =
    useRef<THREE.Mesh[]>([])

  const destinationMarkerRef =
    useRef<THREE.Group | null>(null)

  const destinationLabelRef =
    useRef<THREE.Sprite | null>(null)

  const navigationActiveRef =
    useRef(false)

  const animationTimeRef =
    useRef(0)

  // ===========================================================
  // STATE
  // ===========================================================

  const [status, setStatus] =
    useState('Initializing...')

  const [localized, setLocalized] =
    useState(false)

  const [groupCount, setGroupCount] =
    useState<number | null>(null)

  const [distance, setDistance] =
    useState<number | null>(null)

  const [selectedDestination, setSelectedDestination] =
    useState('')

  const [pathVisible, setPathVisible] =
    useState(false)

  const [error, setError] =
    useState('')

  const [showTargets, setShowTargets] =
    useState(true)

  const [isNavigating, setIsNavigating] =
    useState(false)

  const [arrivedMessage, setArrivedMessage] =
    useState('')

  // ===========================================================
  // CREATE CHEVRON GEOMETRY
  // ===========================================================

  const createChevronGeometry = () => {
    const shape =
      new THREE.Shape()

    const width = 0.28
    const height = 0.42
    const thickness = 0.10

    shape.moveTo(
      -width,
      0
    )

    shape.lineTo(
      0,
      height
    )

    shape.lineTo(
      width,
      0
    )

    shape.lineTo(
      width * 0.42,
      0
    )

    shape.lineTo(
      0,
      height * 0.52
    )

    shape.lineTo(
      -width * 0.42,
      0
    )

    shape.closePath()

    const geometry =
      new THREE.ShapeGeometry(
        shape
      )

    /*
     * ShapeGeometry is created in XY.
     *
     * Rotate it so it lies horizontally
     * on the AR floor.
     */
    geometry.rotateX(
      -Math.PI / 2
    )

    /*
     * Slightly lift the chevron
     * above the floor.
     */
    geometry.translate(
      0,
      thickness,
      0
    )

    return geometry
  }

  // ===========================================================
  // CREATE DESTINATION LABEL
  // ===========================================================

  const createDestinationLabel = (
    text: string
  ) => {
    const canvas =
      document.createElement('canvas')

    canvas.width = 512
    canvas.height = 160

    const context =
      canvas.getContext('2d')

    if (!context) {
      return null
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    )

    /*
     * Rounded black background.
     */
    const radius = 36

    context.beginPath()

    context.roundRect(
      10,
      10,
      492,
      140,
      radius
    )

    context.fillStyle =
      'rgba(15,15,18,0.92)'

    context.fill()

    /*
     * White text.
     */
    context.font =
      'bold 42px Arial'

    context.textAlign =
      'center'

    context.textBaseline =
      'middle'

    context.fillStyle =
      '#ffffff'

    context.fillText(
      text,
      canvas.width / 2,
      canvas.height / 2
    )

    const texture =
      new THREE.CanvasTexture(
        canvas
      )

    texture.needsUpdate = true

    const material =
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      })

    const sprite =
      new THREE.Sprite(
        material
      )

    sprite.scale.set(
      1.8,
      0.56,
      1
    )

    return sprite
  }

  // ===========================================================
  // CREATE DESTINATION MARKER
  // ===========================================================

  const createDestinationMarker = (
    destination: Destination
  ) => {
    const group =
      new THREE.Group()

    /*
     * Main red sphere.
     */
    const sphere =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.22,
          24,
          24
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff304f,
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
        })
      )

    sphere.position.y =
      1.15

    group.add(
      sphere
    )

    /*
     * Pin body.
     */
    const cone =
      new THREE.Mesh(
        new THREE.ConeGeometry(
          0.16,
          0.52,
          24
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff304f,
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
        })
      )

    cone.position.y =
      0.76

    cone.rotation.x =
      Math.PI

    group.add(
      cone
    )

    /*
     * Small glowing ring on floor.
     */
    const ring =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.28,
          0.38,
          32
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff304f,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )

    ring.rotation.x =
      -Math.PI / 2

    ring.position.y =
      0.04

    group.add(
      ring
    )

    /*
     * Destination label.
     */
    const label =
      createDestinationLabel(
        destination.name
      )

    if (label) {
      label.position.y =
        1.72

      group.add(
        label
      )

      destinationLabelRef.current =
        label
    }

    group.position.copy(
      destination.position
    )

    destinationMarkerRef.current =
      group

    return group
  }

  // ===========================================================
  // CREATE ROUTE VISUAL
  // ===========================================================

  const createRouteVisual = (
    corners: readonly THREE.Vector3[]
  ) => {
    const mapSpace =
      mapSpaceRef.current

    if (!mapSpace) {
      return
    }

    /*
     * Remove old route visual.
     */
    if (
      navigationVisualRef.current
    ) {
      mapSpace.object.remove(
        navigationVisualRef.current
      )

      navigationVisualRef.current
        .traverse(
          (object) => {
            const mesh =
              object as THREE.Mesh

            if (mesh.geometry) {
              mesh.geometry.dispose()
            }

            const material =
              mesh.material

            if (
              material instanceof
              THREE.Material
            ) {
              material.dispose()
            }
          }
        )
    }

    chevronsRef.current = []

    const visualGroup =
      new THREE.Group()

    navigationVisualRef.current =
      visualGroup

    mapSpace.object.add(
      visualGroup
    )

    // =========================================================
    // CURVE
    // =========================================================

    const points =
      corners.map(
        (point) =>
          point.clone()
      )

    const curve =
      new THREE.CatmullRomCurve3(
        points,
        false,
        'centripetal',
        0.15
      )

    routeCurveRef.current =
      curve

    // =========================================================
    // ROUTE RAILS
    // =========================================================

    const railMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x00c8ff,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      })

    const leftRailCurve =
      createOffsetCurve(
        curve,
        0.18
      )

    const rightRailCurve =
      createOffsetCurve(
        curve,
        -0.18
      )

    const railGeometryLeft =
      new THREE.TubeGeometry(
        leftRailCurve,
        Math.max(
          32,
          points.length * 16
        ),
        0.018,
        6,
        false
      )

    const railGeometryRight =
      new THREE.TubeGeometry(
        rightRailCurve,
        Math.max(
          32,
          points.length * 16
        ),
        0.018,
        6,
        false
      )

    const leftRail =
      new THREE.Mesh(
        railGeometryLeft,
        railMaterial.clone()
      )

    const rightRail =
      new THREE.Mesh(
        railGeometryRight,
        railMaterial.clone()
      )

    leftRail.position.y +=
      0.08

    rightRail.position.y +=
      0.08

    leftRail.frustumCulled =
      false

    rightRail.frustumCulled =
      false

    visualGroup.add(
      leftRail,
      rightRail
    )

    // =========================================================
    // CHEVRONS
    // =========================================================

    const chevronMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x00d9ff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      })

    const count = 10

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const mesh =
        new THREE.Mesh(
          createChevronGeometry(),
          chevronMaterial.clone()
        )

      mesh.frustumCulled =
        false

      /*
       * Store initial progress
       * in userData.
       */
      mesh.userData.progress =
        i / count

      visualGroup.add(
        mesh
      )

      chevronsRef.current.push(
        mesh
      )
    }

    // =========================================================
    // DESTINATION MARKER
    // =========================================================

    const destination =
      DESTINATIONS.find(
        (item) =>
          item.id ===
          selectedDestination
      )

    if (destination) {
      const marker =
        createDestinationMarker(
          destination
        )

      visualGroup.add(
        marker
      )
    }
  }

  // ===========================================================
  // OFFSET CURVE
  // ===========================================================

  const createOffsetCurve = (
    source:
      THREE.CatmullRomCurve3,
    offset: number
  ) => {
    const samples =
      Math.max(
        40,
        source.points.length * 20
      )

    const points:
      THREE.Vector3[] = []

    for (
      let i = 0;
      i <= samples;
      i++
    ) {
      const t =
        i / samples

      const point =
        source.getPointAt(
          t
        )

      const tangent =
        source.getTangentAt(
          t
        )

      /*
       * Horizontal perpendicular.
       */
      const side =
        new THREE.Vector3(
          -tangent.z,
          0,
          tangent.x
        ).normalize()

      point.add(
        side.multiplyScalar(
          offset
        )
      )

      point.y +=
        0.03

      points.push(
        point
      )
    }

    return new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
      0.1
    )
  }

  // ===========================================================
  // CLEAR ROUTE VISUAL
  // ===========================================================

  const clearRouteVisual = () => {
    const mapSpace =
      mapSpaceRef.current

    const group =
      navigationVisualRef.current

    if (
      mapSpace &&
      group
    ) {
      mapSpace.object.remove(
        group
      )

      group.traverse(
        (object) => {
          const mesh =
            object as THREE.Mesh

          if (
            mesh.geometry
          ) {
            mesh.geometry.dispose()
          }

          const material =
            mesh.material

          if (
            material instanceof
            THREE.Material
          ) {
            material.dispose()
          }
        }
      )
    }

    navigationVisualRef.current =
      null

    routeCurveRef.current =
      null

    chevronsRef.current =
      []

    destinationMarkerRef.current =
      null

    destinationLabelRef.current =
      null
  }

  // ===========================================================
  // ANIMATE NAVIGATION
  // ===========================================================

  const animateNavigation = (
    deltaSeconds: number
  ) => {
    if (
      !navigationActiveRef.current
    ) {
      return
    }

    const curve =
      routeCurveRef.current

    if (!curve) {
      return
    }

    animationTimeRef.current +=
      deltaSeconds

    /*
     * Controls how quickly the
     * chevrons travel.
     */
    const speed = 0.08

    const travel =
      animationTimeRef.current *
      speed

    // =========================================================
    // CHEVRONS
    // =========================================================

    chevronsRef.current.forEach(
      (chevron) => {
        let progress =
          chevron.userData.progress

        progress =
          (
            progress +
            travel
          ) % 1

        /*
         * Keep chevron away from
         * exact endpoints.
         */
        const t =
          0.04 +
          progress * 0.90

        const position =
          curve.getPointAt(
            t
          )

        const tangent =
          curve.getTangentAt(
            t
          )

        chevron.position.copy(
          position
        )

        chevron.position.y +=
          0.12

        /*
         * Shape points toward +Z
         * after X rotation.
         */
        const angle =
          Math.atan2(
            tangent.x,
            tangent.z
          )

        chevron.rotation.set(
          0,
          angle,
          0
        )

        /*
         * Pulse opacity.
         */
        const pulse =
          0.72 +
          Math.sin(
            animationTimeRef.current *
              4 +
              progress * 10
          ) *
            0.18

        const material =
          chevron.material

        if (
          material instanceof
          THREE.MeshBasicMaterial
        ) {
          material.opacity =
            pulse
        }
      }
    )

    // =========================================================
    // DESTINATION PIN ANIMATION
    // =========================================================

    const marker =
      destinationMarkerRef.current

    if (marker) {
      const pulse =
        Math.sin(
          animationTimeRef.current *
            3
        )

      marker.scale.setScalar(
        1 +
          pulse * 0.035
      )

      const ring =
        marker.children.find(
          (child) =>
            child instanceof
            THREE.Mesh &&
            child.geometry instanceof
              THREE.RingGeometry
        )

      if (ring) {
        const ringScale =
          1 +
          (
            Math.sin(
              animationTimeRef.current *
                2
            ) *
            0.15
          )

        ring.scale.setScalar(
          ringScale
        )
      }
    }
  }

  // ===========================================================
  // MAIN INITIALIZATION
  // ===========================================================

  useEffect(() => {
    let disposed = false

    let renderer:
      THREE.WebGLRenderer | null = null

    let scene:
      THREE.Scene | null = null

    let camera:
      THREE.PerspectiveCamera | null = null

    let adapter:
      ThreeAdapter | null = null

    let mapSpace:
      MapSpace | null = null

    let pathfinder:
      NavMeshPathfinder | null = null

    let navigation:
      Navigation | null = null

    let resizeHandler:
      (() => void) | null = null

    const init = async () => {
      try {
        // =====================================================
        // CONTAINER
        // =====================================================

        if (!containerRef.current) {
          throw new Error(
            'AR container not available.'
          )
        }

        // =====================================================
        // WEBXR
        // =====================================================

        setStatus(
          'Checking WebXR support...'
        )

        const supported =
          await ThreeAdapter.isSupported()

        if (!supported) {
          throw new Error(
            'WebXR immersive AR is not supported on this device.'
          )
        }

        if (disposed) {
          return
        }

        // =====================================================
        // ENV
        // =====================================================

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

        // =====================================================
        // MULTISET
        // =====================================================

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

        console.log(
          '[Kokarya] MultiSet authorized'
        )

        // =====================================================
        // RENDERER
        // =====================================================

        renderer =
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

        renderer.xr.enabled =
          true

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

        // =====================================================
        // SCENE
        // =====================================================

        scene =
          new THREE.Scene()

        scene.background = null

        // =====================================================
        // CAMERA
        // =====================================================

        camera =
          new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
              window.innerHeight,
            0.01,
            1000
          )

        scene.add(
          camera
        )

        // =====================================================
        // LIGHT
        // =====================================================

        scene.add(
          new THREE.AmbientLight(
            0xffffff,
            1
          )
        )

        // =====================================================
        // MAP SPACE
        // =====================================================

        mapSpace =
          new MapSpace(
            new THREE.Object3D()
          )

        mapSpaceRef.current =
          mapSpace

        scene.add(
          mapSpace.object
        )

        // =====================================================
        // NAVMESH
        // =====================================================

        setStatus(
          'Loading NavMesh...'
        )

        const loader =
          new GLTFLoader()

        const gltf =
          await loader.loadAsync(
            '/navigation/kokarya-nav-mesh.glb'
          )

        if (disposed) {
          return
        }

        const navMesh =
          gltf.scene

        mapSpace.object.add(
          navMesh
        )

        navMesh.visible =
          false

        // =====================================================
        // NAVMESH BOUNDS
        // =====================================================

        const bounds =
          new THREE.Box3().setFromObject(
            navMesh
          )

        console.log(
          '[Kokarya] NavMesh center:',
          bounds.getCenter(
            new THREE.Vector3()
          )
        )

        console.log(
          '[Kokarya] NavMesh size:',
          bounds.getSize(
            new THREE.Vector3()
          )
        )

        // =====================================================
        // PATHFINDER
        // =====================================================

        setStatus(
          'Creating NavMesh Pathfinder...'
        )

        pathfinder =
          await NavMeshPathfinder.fromObject3D(
            navMesh,
            {
              space:
                mapSpace.object,
            }
          )

        if (disposed) {
          return
        }

        pathfinderRef.current =
          pathfinder

        setGroupCount(
          pathfinder.groupCount
        )

        console.log(
          '[Kokarya] NavMesh groups:',
          pathfinder.groupCount
        )

        // =====================================================
        // XR SESSION
        // =====================================================

        setStatus(
          'Creating AR session...'
        )

        const session =
          new XRSessionManager(
            renderer.getContext() as WebGL2RenderingContext,
            {
              client,

              autoLocalize: true,

              onLocalizationFailure:
                (reason) => {
                  console.warn(
                    '[Kokarya] Localization failed:',
                    reason
                  )

                  setLocalized(
                    false
                  )

                  setStatus(
                    'Localization failed'
                  )
                },

              onError:
                (sessionError) => {
                  console.error(
                    '[Kokarya] XR error:',
                    sessionError
                  )

                  setError(
                    sessionError instanceof
                      Error
                      ? sessionError.message
                      : String(
                          sessionError
                        )
                  )
                },
            }
          )

        // =====================================================
        // ADAPTER
        // =====================================================

        adapter =
          new ThreeAdapter({
            session,

            renderer,

            scene,

            camera,

            showMesh: false,

            showGizmo: false,

            onXRFrame:
              ({
                deltaSeconds,
              }) => {
                animateNavigation(
                  deltaSeconds
                )
              },

            onLocalizationSuccess:
              (
                result,
                worldFromMap
              ) => {
                console.log(
                  '[Kokarya] LOCALIZED'
                )

                console.log(
                  '[Kokarya] Confidence:',
                  result.localizeData.confidence
                )

                console.log(
                  '[Kokarya] worldFromMap:',
                  worldFromMap
                )

                setLocalized(
                  true
                )

                setStatus(
                  'Localized successfully!'
                )
              },
          })

        adapterRef.current =
          adapter

        // =====================================================
        // MAP CONNECT
        // =====================================================

        mapSpace.connect(
          adapter
        )

        console.log(
          '[Kokarya] MapSpace connected'
        )

        // =====================================================
        // NAVIGATION
        // =====================================================

        setStatus(
          'Creating navigation...'
        )

        navigation =
          await Navigation.create({
            adapter,

            mapSpace,

            pathfinder,

            pois:
              DESTINATIONS,
          })

        if (disposed) {
          return
        }

        navigationRef.current =
          navigation

        console.log(
          '[Kokarya] Navigation created'
        )

        // =====================================================
        // PATH UPDATED
        // =====================================================

        navigation.on(
          'pathUpdated',
          ({
            corners,
            remainingDistance,
          }) => {
            console.log(
              '[Kokarya] PATH UPDATED',
              corners
            )

            setDistance(
              remainingDistance
            )

            if (
              !navigationActiveRef.current
            ) {
              return
            }

            if (
              corners.length < 2
            ) {
              clearRouteVisual()

              setPathVisible(
                false
              )

              return
            }

            createRouteVisual(
              corners
            )

            setPathVisible(
              true
            )
          }
        )

        // =====================================================
        // ARRIVED
        // =====================================================

        navigation.on(
          'arrived',
          (poi) => {
            console.log(
              '[Kokarya] ARRIVED:',
              poi.name
            )

            navigationActiveRef.current =
              false

            setIsNavigating(
              false
            )

            setDistance(
              0
            )

            setStatus(
              `Arrived at ${poi.name}`
            )

            setPathVisible(
              false
            )

            setArrivedMessage(
              `You have arrived at ${poi.name}!`
            )

            /*
             * Keep destination marker
             * visible briefly.
             */
            setTimeout(() => {
              if (!disposed) {
                clearRouteVisual()

                setArrivedMessage(
                  ''
                )
              }
            }, 3500)
          }
        )

        // =====================================================
        // UNREACHABLE
        // =====================================================

        navigation.on(
          'unreachable',
          (poi) => {
            console.warn(
              '[Kokarya] UNREACHABLE:',
              poi.name
            )

            navigationActiveRef.current =
              false

            setIsNavigating(
              false
            )

            setStatus(
              `No route to ${poi.name}`
            )

            setPathVisible(
              false
            )

            clearRouteVisual()
          }
        )

        // =====================================================
        // INITIALIZE
        // =====================================================

        await adapter.initialize()

        if (disposed) {
          return
        }

        setStatus(
          'Ready — localizing...'
        )

        console.log(
          '[Kokarya] Ready'
        )

        // =====================================================
        // RESIZE
        // =====================================================

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
      } catch (err) {
        console.error(
          '[Kokarya] Initialization error:',
          err
        )

        setError(
          err instanceof Error
            ? err.message
            : String(err)
        )

        setStatus(
          'Initialization failed'
        )
      }
    }

    init()

    // =========================================================
    // CLEANUP
    // =========================================================

    return () => {
      disposed = true

      navigationActiveRef.current =
        false

      if (resizeHandler) {
        window.removeEventListener(
          'resize',
          resizeHandler
        )
      }

      clearRouteVisual()

      try {
        adapter?.dispose()
      } catch {}

      try {
        pathfinder?.dispose()
      } catch {}

      try {
        mapSpace?.dispose()
      } catch {}

      if (
        renderer &&
        renderer.domElement.parentElement
      ) {
        renderer.domElement.parentElement.removeChild(
          renderer.domElement
        )
      }

      renderer?.dispose()

      navigationRef.current =
        null

      pathfinderRef.current =
        null

      mapSpaceRef.current =
        null

      adapterRef.current =
        null

      rendererRef.current =
        null
    }
  }, [])

  // ===========================================================
  // START NAVIGATION
  // ===========================================================

  const startNavigation = (
    destination: Destination
  ) => {
    const navigation =
      navigationRef.current

    if (!navigation) {
      console.warn(
        '[Kokarya] Navigation not ready'
      )

      return
    }

    if (!localized) {
      setStatus(
        'Please localize first'
      )

      return
    }

    console.log(
      '[Kokarya] Starting navigation:',
      destination.name
    )

    setSelectedDestination(
      destination.id
    )

    setIsNavigating(
      true
    )

    setShowTargets(
      false
    )

    setArrivedMessage(
      ''
    )

    navigationActiveRef.current =
      true

    setStatus(
      `Navigating to ${destination.name}...`
    )

    /*
     * Actual MultiSet navigation.
     */
    navigation.setDestination(
      destination.id
    )
  }

  // ===========================================================
  // STOP NAVIGATION
  // ===========================================================

  const stopNavigation = () => {
    console.log(
      '[Kokarya] Navigation stopped'
    )

    /*
     * We intentionally don't call an
     * undocumented navigation.stop()
     * method.
     *
     * Instead we stop rendering the
     * navigation visual and ignore
     * further path updates.
     */
    navigationActiveRef.current =
      false

    setIsNavigating(
      false
    )

    setSelectedDestination(
      ''
    )

    setDistance(
      null
    )

    setPathVisible(
      false
    )

    setStatus(
      localized
        ? 'Localized — choose a destination'
        : 'Localizing...'
    )

    clearRouteVisual()

    setShowTargets(
      true
    )
  }

  // ===========================================================
  // SELECTED DESTINATION
  // ===========================================================

  const selectedDestinationObject =
    DESTINATIONS.find(
      (item) =>
        item.id ===
        selectedDestination
    )

  // ===========================================================
  // UI
  // ===========================================================

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background:
          'transparent',
        fontFamily:
          'Arial, sans-serif',
      }}
    >
      {/* =====================================================
          AR CANVAS
      ===================================================== */}

      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents:
            'none',
        }}
      />

      {/* =====================================================
          TOP NAVIGATION BAR
      ===================================================== */}

      <div
        style={{
          position: 'fixed',
          top: 18,
          left: '50%',
          transform:
            'translateX(-50%)',
          zIndex: 30,
          pointerEvents:
            'none',
        }}
      >
        <div
          style={{
            minWidth: 210,
            padding:
              '12px 18px',
            borderRadius: 28,
            background:
              'rgba(15,15,18,0.86)',
            backdropFilter:
              'blur(16px)',
            WebkitBackdropFilter:
              'blur(16px)',
            border:
              '1px solid rgba(255,255,255,0.14)',
            color:
              '#ffffff',
            textAlign:
              'center',
            boxShadow:
              '0 8px 30px rgba(0,0,0,0.25)',
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {isNavigating &&
            selectedDestinationObject
              ? selectedDestinationObject.name
              : 'Kokarya Full Map'}
          </div>

          {isNavigating &&
            distance !== null && (
              <div
                style={{
                  marginTop: 3,
                  fontSize: 12,
                  opacity: 0.7,
                }}
              >
                {distance.toFixed(1)} m
              </div>
            )}
        </div>
      </div>

      {/* =====================================================
          LOCALIZATION STATUS
      ===================================================== */}

      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 18,
          zIndex: 30,
          pointerEvents:
            'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding:
              '8px 12px',
            borderRadius: 18,
            background:
              'rgba(15,15,18,0.72)',
            backdropFilter:
              'blur(12px)',
            WebkitBackdropFilter:
              'blur(12px)',
            color:
              localized
                ? '#75ffae'
                : '#ffd866',
            fontSize: 12,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius:
                '50%',
              background:
                'currentColor',
              boxShadow:
                localized
                  ? '0 0 10px rgba(117,255,174,0.9)'
                  : 'none',
            }}
          />

          {localized
            ? 'Localized'
            : 'Localizing'}
        </div>
      </div>

      {/* =====================================================
          SHOW TARGETS
      ===================================================== */}

      {isNavigating && (
        <button
          type="button"
          onClick={() =>
            setShowTargets(
              (value) =>
                !value
            )
          }
          style={{
            position: 'fixed',
            top: 70,
            left: '50%',
            transform:
              'translateX(-50%)',
            zIndex: 40,
            border:
              '1px solid rgba(255,255,255,0.18)',
            borderRadius: 22,
            padding:
              '9px 15px',
            background:
              'rgba(15,15,18,0.82)',
            backdropFilter:
              'blur(12px)',
            WebkitBackdropFilter:
              'blur(12px)',
            color:
              '#ffffff',
            fontSize: 12,
            cursor:
              'pointer',
          }}
        >
          ☰{' '}
          {showTargets
            ? 'Hide Navigation Targets'
            : 'Show Navigation Targets'}
        </button>
      )}

      {/* =====================================================
          DEBUG INFO
      ===================================================== */}

      {!isNavigating && (
        <div
          style={{
            position: 'fixed',
            top: 70,
            left: 18,
            right: 18,
            zIndex: 25,
            padding:
              '14px 16px',
            borderRadius: 18,
            background:
              'rgba(15,15,18,0.78)',
            backdropFilter:
              'blur(14px)',
            WebkitBackdropFilter:
              'blur(14px)',
            color:
              '#ffffff',
            pointerEvents:
              'none',
          }}
        >
          <div
            style={{
              fontSize: 21,
              fontWeight: 700,
            }}
          >
            Kokarya Full Map
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 13,
              opacity: 0.75,
            }}
          >
            {status}
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 12,
              opacity: 0.55,
            }}
          >
            NavMesh groups:{' '}
            {groupCount ??
              'loading...'}
          </div>
        </div>
      )}

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div
          style={{
            position: 'fixed',
            top: 125,
            left: 18,
            right: 18,
            zIndex: 50,
            padding: 12,
            borderRadius: 14,
            background:
              'rgba(80,0,0,0.86)',
            color:
              '#ffb5b5',
            fontSize: 12,
            wordBreak:
              'break-word',
          }}
        >
          {error}
        </div>
      )}

      {/* =====================================================
          DESTINATION TARGETS
      ===================================================== */}

      {showTargets &&
        !isNavigating && (
          <div
            style={{
              position: 'fixed',
              left: 14,
              right: 14,
              bottom: 24,
              zIndex: 40,
              display: 'flex',
              gap: 9,
              overflowX: 'auto',
              padding:
                '8px 2px',
              pointerEvents:
                'auto',
              scrollbarWidth:
                'none',
            }}
          >
            {DESTINATIONS.map(
              (
                destination
              ) => (
                <button
                  key={
                    destination.id
                  }
                  type="button"
                  disabled={
                    !localized
                  }
                  onClick={() =>
                    startNavigation(
                      destination
                    )
                  }
                  style={{
                    flexShrink: 0,
                    padding:
                      '13px 18px',
                    borderRadius:
                      22,
                    border:
                      '1px solid rgba(255,255,255,0.2)',
                    background:
                      'rgba(15,15,18,0.86)',
                    backdropFilter:
                      'blur(14px)',
                    WebkitBackdropFilter:
                      'blur(14px)',
                    color:
                      '#ffffff',
                    fontSize: 14,
                    fontWeight: 500,
                    opacity:
                      localized
                        ? 1
                        : 0.45,
                    cursor:
                      localized
                        ? 'pointer'
                        : 'not-allowed',
                  }}
                >
                  {destination.name}
                </button>
              )
            )}
          </div>
        )}

      {/* =====================================================
          STOP NAVIGATION
      ===================================================== */}

      {isNavigating && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 24,
            zIndex: 50,
            display: 'flex',
            justifyContent:
              'center',
            pointerEvents:
              'auto',
          }}
        >
          <button
            type="button"
            onClick={
              stopNavigation
            }
            style={{
              padding:
                '14px 25px',
              borderRadius: 26,
              border:
                '1px solid rgba(255,255,255,0.2)',
              background:
                'rgba(15,15,18,0.88)',
              backdropFilter:
                'blur(16px)',
              WebkitBackdropFilter:
                'blur(16px)',
              color:
                '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor:
                'pointer',
              boxShadow:
                '0 8px 30px rgba(0,0,0,0.28)',
            }}
          >
            ✕&nbsp; Stop Navigation
          </button>
        </div>
      )}

      {/* =====================================================
          ARRIVED TOAST
      ===================================================== */}

      {arrivedMessage && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 95,
            transform:
              'translateX(-50%)',
            zIndex: 60,
            minWidth: 250,
            padding:
              '13px 18px',
            borderRadius: 18,
            background:
              'rgba(15,15,18,0.9)',
            backdropFilter:
              'blur(16px)',
            WebkitBackdropFilter:
              'blur(16px)',
            border:
              '1px solid rgba(255,255,255,0.14)',
            color:
              '#ffffff',
            textAlign:
              'center',
            fontSize: 14,
            boxShadow:
              '0 10px 35px rgba(0,0,0,0.3)',
          }}
        >
          <div
            style={{
              fontSize: 18,
              marginBottom: 4,
            }}
          >
            ✓
          </div>

          {arrivedMessage}
        </div>
      )}
    </main>
  )
}