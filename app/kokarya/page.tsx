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

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

import { Button } from '@/components/ui/button'

// =============================================================
// TYPES
// =============================================================

type Destination = {
  id: string
  name: string
  position: THREE.Vector3
}

// =============================================================
// DESTINATIONS
// =============================================================

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
    name: 'Meeting Room',
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
    useRef<THREE.Group[]>([])

  const destinationMarkerRef =
    useRef<THREE.Group | null>(null)

  const destinationLabelRef =
    useRef<THREE.Sprite | null>(null)

  const selectedDestinationRef =
    useRef<string>('')

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

  const [isNavigating, setIsNavigating] =
    useState(false)

  const [arrivedMessage, setArrivedMessage] =
    useState('')

  // ===========================================================
  // CREATE FLOWING CHEVRON GEOMETRY
  //
  // Hollow chevron pointing along local +Z.
  // Visual direction:
  //
  //        /\\
  //       /  \\n  //
  // ===========================================================

  const createChevronGeometry = () => {
    const width = 0.22
    const height = 0.275

    const points = [
      new THREE.Vector3(
        -width,
        0,
        -height * 0.35
      ),
      new THREE.Vector3(
        0,
        0,
        height * 0.35
      ),
      new THREE.Vector3(
        width,
        0,
        -height * 0.35
      ),
    ]

    return new THREE.BufferGeometry().setFromPoints(
      points
    )
  }

  // ===========================================================
  // DESTINATION LABEL
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

    // ---------------------------------------------------------
    // BACKGROUND
    // ---------------------------------------------------------

    context.beginPath()

    context.roundRect(
      10,
      10,
      492,
      140,
      36
    )

    context.fillStyle =
      'rgba(15,15,18,0.90)'

    context.fill()

    // ---------------------------------------------------------
    // TEXT
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // TEXTURE
    // ---------------------------------------------------------

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
  // DESTINATION MARKER
  // ===========================================================

  const createDestinationMarker = (
    destination: Destination
  ) => {
    const group =
      new THREE.Group()

    // ---------------------------------------------------------
    // RED SPHERE
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // PIN
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // FLOOR RING
    // ---------------------------------------------------------

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

    ring.name =
      'destination-ring'

    group.add(
      ring
    )

    // ---------------------------------------------------------
    // LABEL
    // ---------------------------------------------------------

    const label =
      createDestinationLabel(
        destination.name
      )

    if (label) {
      label.position.y =
        1.72

      label.name =
        'destination-label'

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
  // OFFSET CURVE
  // ===========================================================

  const createOffsetCurve = (
    source: THREE.CatmullRomCurve3,
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
       * Horizontal side vector.
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

      /*
       * Slightly above floor.
       */
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

    // ---------------------------------------------------------
    // REMOVE PREVIOUS ROUTE
    // ---------------------------------------------------------

    if (
      navigationVisualRef.current
    ) {
      const oldGroup =
        navigationVisualRef.current

      mapSpace.object.remove(
        oldGroup
      )

      oldGroup.traverse(
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

    // ---------------------------------------------------------
    // GROUP
    // ---------------------------------------------------------

    const visualGroup =
      new THREE.Group()

    visualGroup.name =
      'navigation-visual'

    navigationVisualRef.current =
      visualGroup

    mapSpace.object.add(
      visualGroup
    )

    // ---------------------------------------------------------
    // POINTS
    // ---------------------------------------------------------

    const points =
      corners.map(
        (point) =>
          point.clone()
      )

    // ---------------------------------------------------------
    // CURVE
    // ---------------------------------------------------------

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

    const leftCurve =
      createOffsetCurve(
        curve,
        0.18
      )

    const rightCurve =
      createOffsetCurve(
        curve,
        -0.18
      )

    const railSegments =
      Math.max(
        32,
        points.length * 16
      )

    // ---------------------------------------------------------
    // LEFT RAIL
    // ---------------------------------------------------------

    const leftGeometry =
      new THREE.TubeGeometry(
        leftCurve,
        railSegments,
        0.018,
        6,
        false
      )

    const leftMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x00c8ff,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      })

    const leftRail =
      new THREE.Mesh(
        leftGeometry,
        leftMaterial
      )

    leftRail.position.y +=
      0.08

    leftRail.frustumCulled =
      false

    visualGroup.add(
      leftRail
    )

    // ---------------------------------------------------------
    // RIGHT RAIL
    // ---------------------------------------------------------

    const rightGeometry =
      new THREE.TubeGeometry(
        rightCurve,
        railSegments,
        0.018,
        6,
        false
      )

    const rightMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x00c8ff,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      })

    const rightRail =
      new THREE.Mesh(
        rightGeometry,
        rightMaterial
      )

    rightRail.position.y +=
      0.08

    rightRail.frustumCulled =
      false

    visualGroup.add(
      rightRail
    )

    // =========================================================
    // FLOWING CHEVRONS
    // =========================================================

    const chevronCount =
      Math.max(
        8,
        Math.min(
          16,
          Math.floor(
            Math.max(1, points.length - 1) * 3
          )
        )
      )

    for (
      let i = 0;
      i < chevronCount;
      i++
    ) {
      const chevronGroup =
        new THREE.Group()

      chevronGroup.name =
        `navigation-chevron-${i}`

      // Main hollow chevron.
      const material =
        new THREE.LineBasicMaterial({
          color: 0x00d9ff,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          depthTest: false,
        })

      const chevron =
        new THREE.Line(
          createChevronGeometry(),
          material
        )

      chevron.frustumCulled =
        false

      // Soft glow around the chevron.
      const glowMaterial =
        new THREE.LineBasicMaterial({
          color: 0x00aaff,
          transparent: true,
          opacity: 0.14,
          depthWrite: false,
          depthTest: false,
        })

      const glow =
        new THREE.Line(
          createChevronGeometry(),
          glowMaterial
        )

      glow.scale.set(
        1.55,
        1.55,
        1.55
      )

      glow.frustumCulled =
        false

      chevronGroup.add(
        glow
      )

      chevronGroup.add(
        chevron
      )

      chevronGroup.userData.progress =
        i / chevronCount

      chevronGroup.userData.chevron =
        chevron

      chevronGroup.userData.glow =
        glow

      chevronGroup.frustumCulled =
        false

      visualGroup.add(
        chevronGroup
      )

      chevronsRef.current.push(
        chevronGroup
      )
    }

    // =========================================================
    // DESTINATION
    // =========================================================

    const destination =
      DESTINATIONS.find(
        (item) =>
          item.id ===
          selectedDestinationRef.current
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
  // CLEAR ROUTE
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

    // ---------------------------------------------------------
    // CHEVRON FLOW
    // ---------------------------------------------------------
    // Same animation model as the working reference: each
    // chevron has a different starting progress and continuously
    // travels toward the destination.

    const speed =
      0.08

    const travel =
      animationTimeRef.current *
      speed

    chevronsRef.current.forEach(
      (chevronGroup) => {
        const baseProgress =
          chevronGroup.userData.progress ??
          0

        const progress =
          (
            baseProgress +
            travel
          ) % 1

        // Keep arrows slightly away from exact curve endpoints.
        const t =
          0.04 +
          progress * 0.90

        const position =
          curve.getPointAt(t)

        const tangent =
          curve.getTangentAt(t)

        // -----------------------------------------------------
        // POSITION
        // -----------------------------------------------------

        chevronGroup.position.copy(
          position
        )

        chevronGroup.position.y +=
          0.065

        // -----------------------------------------------------
        // DIRECTION
        // -----------------------------------------------------

        const flatTangent =
          tangent.clone()

        flatTangent.y = 0

        if (
          flatTangent.lengthSq() >
          0.0001
        ) {
          flatTangent.normalize()

          const angle =
            Math.atan2(
              flatTangent.x,
              flatTangent.z
            )

          // createChevronGeometry points toward +Z, so this
          // rotation makes the chevron point in route direction.
          chevronGroup.rotation.set(
            0,
            angle,
            0
          )
        }

        // -----------------------------------------------------
        // PULSE
        // -----------------------------------------------------

        const pulse =
          1 +
          Math.sin(
            animationTimeRef.current *
              4 +
              progress *
              10
          ) *
            0.08

        const chevron =
          chevronGroup.userData
            .chevron as
            | THREE.Line
            | undefined

        if (chevron) {
          chevron.scale.set(
            pulse,
            pulse,
            pulse
          )

          const material =
            chevron.material as
              THREE.LineBasicMaterial

          material.opacity =
            0.70 +
            Math.sin(
              animationTimeRef.current *
                3 +
                progress *
                10
            ) *
              0.18
        }

        // -----------------------------------------------------
        // GLOW
        // -----------------------------------------------------

        const glow =
          chevronGroup.userData
            .glow as
            | THREE.Line
            | undefined

        if (glow) {
          const glowPulse =
            1.15 +
            Math.sin(
              animationTimeRef.current *
                4 +
                progress *
                10
            ) *
              0.12

          glow.scale.set(
            glowPulse,
            glowPulse,
            glowPulse
          )

          const glowMaterial =
            glow.material as
              THREE.LineBasicMaterial

          glowMaterial.opacity =
            0.08 +
            (
              Math.sin(
                animationTimeRef.current *
                  4 +
                  progress *
                  10
              ) +
              1
            ) *
              0.035
        }
      }
    )

    // =========================================================
    // DESTINATION MARKER
    // =========================================================

    const marker =
      destinationMarkerRef.current

    if (!marker) {
      return
    }

    const pulse =
      Math.sin(
        animationTimeRef.current *
          3
      )

    marker.scale.setScalar(
      1 +
        pulse *
          0.035
    )

    const ring =
      marker.getObjectByName(
        'destination-ring'
      )

    if (ring) {
      const ringScale =
        1 +
        Math.sin(
          animationTimeRef.current *
            2
        ) *
          0.15

      ring.scale.setScalar(
        ringScale
      )
    }
  }

  // ===========================================================
  // INITIALIZATION
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
        // 1. CONTAINER
        // =====================================================

        if (!containerRef.current) {
          throw new Error(
            'AR container not available.'
          )
        }

        // =====================================================
        // 2. WEBXR
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
        // 3. ENVIRONMENT
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
        // 4. MULTISET
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
        // 5. THREE RENDERER
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

        /*
         * Transparent renderer is important
         * for the camera feed.
         */
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
        // 6. SCENE
        // =====================================================

        scene =
          new THREE.Scene()

        scene.background =
          null

        // =====================================================
        // 7. CAMERA
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
        // 8. LIGHT
        // =====================================================

        scene.add(
          new THREE.AmbientLight(
            0xffffff,
            1
          )
        )

        // =====================================================
        // 9. MAP SPACE
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

        console.log(
          '[Kokarya] MapSpace created'
        )

        // =====================================================
        // 10. LOAD NAVMESH
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

        /*
         * Keep raw NavMesh hidden.
         */
        navMesh.visible =
          false

        // =====================================================
        // 11. NAVMESH DEBUG
        // =====================================================

        const bounds =
          new THREE.Box3().setFromObject(
            navMesh
          )

        const center =
          bounds.getCenter(
            new THREE.Vector3()
          )

        const size =
          bounds.getSize(
            new THREE.Vector3()
          )

        console.log(
          '[Kokarya] NavMesh center:',
          center
        )

        console.log(
          '[Kokarya] NavMesh size:',
          size
        )

        // =====================================================
        // 12. PATHFINDER
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
        // 13. XR SESSION
        // =====================================================

        setStatus(
          'Creating AR session...'
        )

        const session =
          new XRSessionManager(
            renderer.getContext() as WebGL2RenderingContext,
            {
              client,

              autoLocalize:
                true,

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
        // 14. THREE ADAPTER
        // =====================================================

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
                  '================================'
                )

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

                console.log(
                  '================================'
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
        // 15. CONNECT MAP
        // =====================================================

        mapSpace.connect(
          adapter
        )

        console.log(
          '[Kokarya] MapSpace connected'
        )

        // =====================================================
        // 16. CREATE NAVIGATION
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
        // 17. PATH UPDATED
        // =====================================================

        navigation.on(
          'pathUpdated',
          ({
            corners,
            remainingDistance,
          }) => {
            console.log(
              '[Kokarya] PATH UPDATED'
            )

            console.log(
              '[Kokarya] Corner count:',
              corners.length
            )

            console.log(
              '[Kokarya] Corners:',
              corners
            )

            console.log(
              '[Kokarya] Remaining distance:',
              remainingDistance
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

            console.log(
              '[Kokarya] ANIMATED PATH RENDERED'
            )
          }
        )

        // =====================================================
        // 18. ARRIVED
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
             * Keep marker visible
             * for a few seconds.
             */
            setTimeout(() => {
              if (!disposed) {
                clearRouteVisual()

                setArrivedMessage(
                  ''
                )

                setSelectedDestination(
                  ''
                )

                selectedDestinationRef.current =
                  ''
              }
            }, 3500)
          }
        )

        // =====================================================
        // 19. UNREACHABLE
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
        // 20. INITIALIZE
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
        // 21. RESIZE
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
        'Please wait for localization'
      )

      return
    }

    console.log(
      '[Kokarya] Starting navigation to:',
      destination.name
    )

    console.log(
      '[Kokarya] Destination:',
      destination.position
    )

    selectedDestinationRef.current =
      destination.id

    setSelectedDestination(
      destination.id
    )

    setIsNavigating(
      true
    )

    setArrivedMessage(
      ''
    )

    navigationActiveRef.current =
      true

    setStatus(
      `Navigating to ${destination.name}...`
    )

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

    navigationActiveRef.current =
      false

    setIsNavigating(
      false
    )

    setSelectedDestination(
      ''
    )

    selectedDestinationRef.current =
      ''

    setDistance(
      null
    )

    setPathVisible(
      false
    )

    setArrivedMessage(
      ''
    )

    clearRouteVisual()

    setStatus(
      localized
        ? 'Ready'
        : 'Localizing...'
    )
  }

  // ===========================================================
  // SELECTED DESTINATION
  // ===========================================================

  const selectedDestinationObject =
    DESTINATIONS.find(
      (destination) =>
        destination.id ===
        selectedDestination
    )

  // ===========================================================
  // DESTINATION DRAWER
  // ===========================================================

  const DestinationDrawer = () => {
    return (
      <Drawer>
        <DrawerTrigger>
          <Button
            disabled={!localized}
            className="
              h-12
              rounded-full
              px-7
              text-sm
              font-semibold
              shadow-2xl
            "
          >
            Choose Destination
          </Button>
        </DrawerTrigger>

        <DrawerContent>
          <div
            className="
              mx-auto
              w-full
              max-w-lg
            "
          >
            <DrawerHeader>
              <DrawerTitle>
                Where do you want to go?
              </DrawerTitle>

              <DrawerDescription>
                Select a destination to start
                AR navigation.
              </DrawerDescription>
            </DrawerHeader>

            <div
              className="
                grid
                grid-cols-2
                gap-3
                px-4
              "
            >
              {DESTINATIONS.map(
                (destination) => (
                  <DrawerClose
                    key={
                      destination.id
                    }
                   
                  >
                    <Button
                      variant="outline"
                      className="
                        h-20
                        justify-start
                        rounded-2xl
                        px-4
                        text-left
                      "
                      onClick={() =>
                        startNavigation(
                          destination
                        )
                      }
                    >
                      <div>
                        <div
                          className="
                            font-semibold
                          "
                        >
                          {
                            destination.name
                          }
                        </div>

                        <div
                          className="
                            mt-1
                            text-xs
                            text-muted-foreground
                          "
                        >
                          Start navigation
                        </div>
                      </div>
                    </Button>
                  </DrawerClose>
                )
              )}
            </div>

            <DrawerFooter>
              <DrawerClose>
                <Button
                  variant="ghost"
                  className="
                    rounded-full
                  "
                >
                  Cancel
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // ===========================================================
  // UI
  // ===========================================================

  return (
    <main
      className="
        fixed
        inset-0
        overflow-hidden
        bg-transparent
      "
    >
      {/* =====================================================
          THREE.JS AR CANVAS
      ===================================================== */}

      <div
        ref={containerRef}
        className="
          fixed
          inset-0
          z-0
          pointer-events-none
        "
      />

      {/* =====================================================
          SMALL TOP STATUS
      ===================================================== */}

      <div
        className="
          pointer-events-none
          fixed
          left-1/2
          top-4
          z-30
          -translate-x-1/2
        "
      >
        <div
          className="
            rounded-full
            border
            border-white/15
            bg-black/70
            px-4
            py-2
            text-sm
            text-white
            shadow-xl
            backdrop-blur-xl
          "
        >
          {isNavigating &&
          selectedDestinationObject ? (
            <div
              className="
                flex
                items-center
                gap-2
                whitespace-nowrap
              "
            >
              <span
                className="
                  h-2
                  w-2
                  rounded-full
                  bg-cyan-400
                  shadow-[0_0_10px_rgba(34,211,238,0.9)]
                "
              />

              <span
                className="
                  font-medium
                "
              >
                {
                  selectedDestinationObject.name
                }
              </span>

              {distance !== null && (
                <>
                  <span
                    className="
                      text-white/40
                    "
                  >
                    •
                  </span>

                  <span
                    className="
                      text-white/70
                    "
                  >
                    {distance.toFixed(
                      1
                    )}{' '}
                    m
                  </span>
                </>
              )}
            </div>
          ) : (
            <div
              className="
                flex
                items-center
                gap-2
                whitespace-nowrap
              "
            >
              <span
                className={`
                  h-2
                  w-2
                  rounded-full
                  ${
                    localized
                      ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]'
                      : 'bg-yellow-400'
                  }
                `}
              />

              <span>
                {localized
                  ? 'Ready'
                  : 'Localizing...'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div
          className="
            fixed
            left-4
            right-4
            top-16
            z-50
            rounded-2xl
            border
            border-red-400/20
            bg-red-950/80
            p-3
            text-xs
            text-red-200
            shadow-xl
            backdrop-blur-xl
          "
        >
          {error}
        </div>
      )}

      {/* =====================================================
          DESTINATION DRAWER
      ===================================================== */}

      {!isNavigating && (
        <div
          className="
            fixed
            bottom-6
            left-0
            right-0
            z-40
            flex
            justify-center
            px-4
          "
        >
          <DestinationDrawer />
        </div>
      )}

      {/* =====================================================
          STOP NAVIGATION
      ===================================================== */}

      {isNavigating && (
        <div
          className="
            fixed
            bottom-6
            left-0
            right-0
            z-50
            flex
            justify-center
            px-4
          "
        >
          <Button
            variant="destructive"
            onClick={
              stopNavigation
            }
            className="
              h-12
              rounded-full
              px-7
              font-semibold
              shadow-2xl
            "
          >
            Stop Navigation
          </Button>
        </div>
      )}

      {/* =====================================================
          ARRIVAL TOAST
      ===================================================== */}

      {arrivedMessage && (
        <div
          className="
            fixed
            bottom-24
            left-1/2
            z-[60]
            w-max
            max-w-[calc(100%-32px)]
            -translate-x-1/2
            rounded-2xl
            border
            border-white/10
            bg-black/85
            px-5
            py-4
            text-center
            text-sm
            text-white
            shadow-2xl
            backdrop-blur-xl
          "
        >
          <div
            className="
              mb-1
              text-xl
              text-emerald-400
            "
          >
            ✓
          </div>

          {arrivedMessage}
        </div>
      )}
    </main>
  )
}