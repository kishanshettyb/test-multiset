'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  Navigation as MultiSetNavigation,
  NavMeshPathfinder,
  buildPathRibbon,
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

import {
  MapPin,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  LocateFixed,
  Volume2,
  VolumeX,
} from 'lucide-react'

// =============================================================
// TYPES
// =============================================================

type Destination = {
  id: string
  name: string
  position: THREE.Vector3
}

type DirectionState =
  | 'straight'
  | 'left'
  | 'right'
  | 'uturn'
  | 'none'

// =============================================================
// DESTINATIONS
// =============================================================

const DESTINATIONS: Destination[] = [
  {
    id: 'entrance',
    name: 'Entrance',
    position: new THREE.Vector3(-0.149, -0.543, 1.201),
  },
  {
    id: 'pantry',
    name: 'Pantry',
    position: new THREE.Vector3(0.607, -0.493, 6.68),
  },
  {
    id: 'cabin-1',
    name: 'Cabin 1',
    position: new THREE.Vector3(4.758, -0.47, 1.897),
  },
  {
    id: 'cabin-2',
    name: 'Cabin 2',
    position: new THREE.Vector3(8.962, -0.488, 1.736),
  },
  {
    id: 'meeting-room',
    name: 'Meeting room',
    position: new THREE.Vector3(11.588, -0.468, 1.757),
  },
]

// =============================================================
// CONSTANTS
// =============================================================

const ROUTE_HEIGHT = 0.045
const DESTINATION_PIN_HEIGHT = 0.82
const DESTINATION_LABEL_HEIGHT = 1.30

// Ribbon visual
const RIBBON_WIDTH = 0.42
const ARROW_SPACING = 0.68          // meters between chevrons
const ARROW_LENGTH = 0.34           // meters of drawn chevron
const ARROW_SCROLL_SPEED = 1.1      // meters per second

// Voice — ASCENDING order so nearest milestone fires first
const VOICE_COOLDOWN = 3000
const VOICE_DISTANCE_MILESTONES = [5, 10, 20]

// =============================================================
// ARROW TEXTURE (chevron pointing along +U = forward)
// =============================================================

const createArrowTexture = (): THREE.CanvasTexture | null => {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, 128, 128)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 18
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = 'rgba(255,255,255,0.7)'
  ctx.shadowBlur = 6

  // Chevron pointing towards +U
  ctx.beginPath()
  ctx.moveTo(26, 22)
  ctx.lineTo(100, 64)
  ctx.lineTo(26, 106)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

// =============================================================
// PAGE
// =============================================================

export default function KokaryaFullMapPage() {
  // ===========================================================
  // DOM OVERLAY
  //
  // Required by XRSessionManager/ThreeAdapter. All pointer-driven
  // UI must be mounted inside this element so it works during an
  // immersive WebXR session.
  // ===========================================================

  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const el = document.createElement('div')
    el.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 40;
    `
    document.body.appendChild(el)
    setOverlayRoot(el)
    return () => {
      el.remove()
    }
  }, [])

  // ===========================================================
  // REFS — THREE
  // ===========================================================

  const containerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const adapterRef = useRef<ThreeAdapter | null>(null)
  const mapSpaceRef = useRef<MapSpace | null>(null)
  const pathfinderRef = useRef<NavMeshPathfinder | null>(null)
  const navigationRef = useRef<MultiSetNavigation | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)

  // ===========================================================
  // REFS — NAVIGATION VISUALS
  // ===========================================================

  // Destination marker lives in this group.
  const navigationGroupRef = useRef<THREE.Group | null>(null)

  // Ribbon is a single persistent mesh; we swap its geometry on
  // each path update instead of rebuilding geometry per arrow.
  const ribbonMeshRef = useRef<THREE.Mesh | null>(null)
  const ribbonMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
  const arrowTextureRef = useRef<THREE.CanvasTexture | null>(null)

  // Raw corners — used by the direction calculator.
  const routePointsRef = useRef<THREE.Vector3[]>([])

  const destinationMarkerRef = useRef<THREE.Group | null>(null)
  const destinationRingRef = useRef<THREE.Mesh | null>(null)
  const destinationBeamRef = useRef<THREE.Mesh | null>(null)
  const destinationLabelRef = useRef<THREE.Sprite | null>(null)

  // ===========================================================
  // REFS — NAVIGATION STATE
  // ===========================================================

  const navigationActiveRef = useRef(false)
  const selectedDestinationRef = useRef('')
  const animationTimeRef = useRef(0)
  const currentDirectionRef = useRef<DirectionState>('none')

  // ===========================================================
  // REFS — VOICE
  // ===========================================================

  const voiceEnabledRef = useRef(true)
  const lastSpokenDirectionRef = useRef<DirectionState>('none')
  const lastVoiceTimeRef = useRef(0)
  const spokenDistanceMilestonesRef = useRef<number[]>([])

  // ===========================================================
  // REACT STATE
  // ===========================================================

  const [localized, setLocalized] = useState(false)
  const [distance, setDistance] = useState<number | null>(null)
  const [selectedDestination, setSelectedDestination] = useState('')
  const [isNavigating, setIsNavigating] = useState(false)
  const [error, setError] = useState('')
  const [arrivedMessage, setArrivedMessage] = useState('')
  const [direction, setDirection] = useState<DirectionState>('none')
  const [voiceEnabled, setVoiceEnabled] = useState(true)

  const selectedDestinationObject = DESTINATIONS.find(
    (d) => d.id === selectedDestination
  )

  // ===========================================================
  // VOICE ENGINE
  // ===========================================================

  const speak = (message: string, force = false) => {
    if (!voiceEnabledRef.current) return
    if (typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return

    const now = Date.now()
    if (!force && now - lastVoiceTimeRef.current < VOICE_COOLDOWN) {
      return
    }
    lastVoiceTimeRef.current = now

    const speech = window.speechSynthesis
    speech.cancel()

    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = 'en-IN'
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 1

    const voices = speech.getVoices()
    const preferredVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('en-in')) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('en'))

    if (preferredVoice) utterance.voice = preferredVoice

    speech.speak(utterance)
  }

  const speakDirection = (nextDirection: DirectionState) => {
    if (nextDirection === 'none') return
    if (lastSpokenDirectionRef.current === nextDirection) return
    lastSpokenDirectionRef.current = nextDirection

    // Force = true so direction changes are never suppressed by
    // the distance-announcement cooldown.
    switch (nextDirection) {
      case 'straight':
        speak('Go straight.', true)
        break
      case 'left':
        speak('Turn left.', true)
        break
      case 'right':
        speak('Turn right.', true)
        break
      case 'uturn':
        speak('Turn around.', true)
        break
    }
  }

  const speakDistance = (remainingDistance: number) => {
    // Milestones are ascending so the closest one fires first.
    for (const milestone of VOICE_DISTANCE_MILESTONES) {
      if (
        remainingDistance <= milestone &&
        !spokenDistanceMilestonesRef.current.includes(milestone)
      ) {
        spokenDistanceMilestonesRef.current.push(milestone)
        speak(`${milestone} meters remaining.`)
        return
      }
    }
  }

  const toggleVoice = () => {
    const next = !voiceEnabledRef.current
    voiceEnabledRef.current = next
    setVoiceEnabled(next)

    if (!next) {
      if (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window
      ) {
        window.speechSynthesis.cancel()
      }
      return
    }
    speak('Voice guidance enabled.', true)
  }

  // ===========================================================
  // DESTINATION LABEL
  // ===========================================================

  const createDestinationLabel = (text: string) => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 180

    const context = canvas.getContext('2d')
    if (!context) return null

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.shadowColor = 'rgba(0,0,0,0.45)'
    context.shadowBlur = 24

    context.beginPath()
    // roundRect is not universally supported — guard it.
    if (typeof (context as any).roundRect === 'function') {
      ;(context as any).roundRect(14, 14, 612, 152, 42)
    } else {
      context.rect(14, 14, 612, 152)
    }
    context.fillStyle = 'rgba(10,10,14,0.90)'
    context.fill()
    context.shadowBlur = 0

    context.beginPath()
    context.arc(74, 90, 17, 0, Math.PI * 2)
    context.fillStyle = '#ff3158'
    context.fill()

    context.font = '600 46px Arial'
    context.fillStyle = '#ffffff'
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.fillText(text, 112, 90)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })

    const sprite = new THREE.Sprite(material)
    sprite.scale.set(2.05, 0.58, 1)
    return sprite
  }

  // ===========================================================
  // DESTINATION MARKER
  // ===========================================================

  const createDestinationMarker = (destination: Destination) => {
    const group = new THREE.Group()
    group.name = 'destination-marker'

    // Floor ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.38, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff3158,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.025
    ring.name = 'destination-ring'
    destinationRingRef.current = ring
    group.add(ring)

    // Outer pulse ring
    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.46, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff3158,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      })
    )
    pulseRing.rotation.x = -Math.PI / 2
    pulseRing.position.y = 0.027
    pulseRing.name = 'destination-pulse-ring'
    group.add(pulseRing)

    // Pin stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.065, 0.78, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff3158,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: false,
      })
    )
    stem.position.y = 0.58
    group.add(stem)

    // Pin head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff3158,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        depthTest: false,
      })
    )
    head.position.y = DESTINATION_PIN_HEIGHT
    group.add(head)

    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: false,
      })
    )
    inner.position.y = DESTINATION_PIN_HEIGHT
    group.add(inner)

    // Vertical beam
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.5, 12),
      new THREE.MeshBasicMaterial({
        color: 0xff3158,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        depthTest: false,
      })
    )
    beam.position.y = 0.78
    destinationBeamRef.current = beam
    group.add(beam)

    // Floating label
    const label = createDestinationLabel(destination.name)
    if (label) {
      label.position.y = DESTINATION_LABEL_HEIGHT
      destinationLabelRef.current = label
      group.add(label)
    }

    group.position.copy(destination.position)
    return group
  }

  // ===========================================================
  // DISPOSE HELPERS
  // ===========================================================

  const disposeMaterial = (material: THREE.Material) => {
    const mat = material as unknown as {
      map?: THREE.Texture
      alphaMap?: THREE.Texture
      normalMap?: THREE.Texture
    }
    mat.map?.dispose()
    mat.alphaMap?.dispose()
    mat.normalMap?.dispose()
    material.dispose()
  }

  const disposeObject3D = (root: THREE.Object3D) => {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) {
        disposeMaterial(mesh.material)
      } else if (Array.isArray(mesh.material)) {
        mesh.material.forEach(disposeMaterial)
      }
    })
  }

  // ===========================================================
  // CLEAR NAVIGATION VISUALS
  // ===========================================================

  const clearNavigationVisual = () => {
    const mapSpace = mapSpaceRef.current
    const group = navigationGroupRef.current

    // Remove destination-marker group
    if (mapSpace && group) {
      mapSpace.object.remove(group)
      disposeObject3D(group)
    }

    // Hide + clear ribbon geometry (keep the mesh + material for reuse)
    if (ribbonMeshRef.current) {
      ribbonMeshRef.current.visible = false
      ribbonMeshRef.current.geometry.dispose()
      ribbonMeshRef.current.geometry = new THREE.BufferGeometry()
    }

    navigationGroupRef.current = null
    routePointsRef.current = []
    destinationMarkerRef.current = null
    destinationRingRef.current = null
    destinationBeamRef.current = null
    destinationLabelRef.current = null
  }

  // ===========================================================
  // RIBBON — SINGLE-DRAW-CALL PATH VISUAL
  // ===========================================================

  const ensureRibbonMesh = (): THREE.Mesh | null => {
    if (ribbonMeshRef.current) return ribbonMeshRef.current

    const mapSpace = mapSpaceRef.current
    if (!mapSpace) return null

    const arrowTexture =
      arrowTextureRef.current ?? createArrowTexture()

    if (!arrowTexture) return null
    arrowTextureRef.current = arrowTexture

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: arrowTexture },
        uColor: { value: new THREE.Color(0x00d9ff) },
        uArrowSpacing: { value: ARROW_SPACING },
        uArrowLength: { value: ARROW_LENGTH },
        uScrollOffset: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        uniform float uArrowSpacing;
        uniform float uArrowLength;
        uniform float uScrollOffset;
        varying vec2 vUv;

        void main() {
          // vUv.x is distance along the path in meters.
          float along = vUv.x - uScrollOffset;
          float cell = fract(along / max(uArrowSpacing, 0.0001));
          float u = cell * uArrowSpacing / max(uArrowLength, 0.0001);
          if (u > 1.0) discard;
          vec4 texel = texture2D(uMap, vec2(u, vUv.y));
          if (texel.a < 0.01) discard;
          gl_FragColor = vec4(uColor, texel.a);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material)
    mesh.frustumCulled = false
    mesh.renderOrder = 20
    mesh.visible = false
    mapSpace.object.add(mesh)

    ribbonMeshRef.current = mesh
    ribbonMaterialRef.current = material
    return mesh
  }

  const updateRibbonGeometry = (corners: readonly THREE.Vector3[]) => {
    const mesh = ensureRibbonMesh()
    if (!mesh || !ribbonMaterialRef.current) return

    try {
      const geometry = buildPathRibbon(corners as THREE.Vector3[], {
        width: RIBBON_WIDTH,
        heightAboveFloor: ROUTE_HEIGHT,
      })
      mesh.geometry.dispose()
      mesh.geometry = geometry
      mesh.visible = true
      ribbonMaterialRef.current.uniforms.uScrollOffset.value = 0
    } catch (err) {
      console.warn('[Kokarya] buildPathRibbon failed:', err)
    }
  }

  // ===========================================================
  // CREATE ROUTE VISUAL
  // ===========================================================

  const createRouteVisual = (corners: readonly THREE.Vector3[]) => {
    const mapSpace = mapSpaceRef.current
    if (!mapSpace) return
    if (corners.length < 2) return

    // Remove the previous destination marker group (ribbon is reused).
    const oldGroup = navigationGroupRef.current
    if (oldGroup) {
      mapSpace.object.remove(oldGroup)
      disposeObject3D(oldGroup)
    }

    routePointsRef.current = corners.map((p) => p.clone())
    destinationMarkerRef.current = null
    destinationRingRef.current = null
    destinationBeamRef.current = null
    destinationLabelRef.current = null

    const newGroup = new THREE.Group()
    newGroup.name = 'ar-navigation'
    navigationGroupRef.current = newGroup
    mapSpace.object.add(newGroup)

    // Path ribbon
    updateRibbonGeometry(corners)

    // Destination marker
    const destination = DESTINATIONS.find(
      (item) => item.id === selectedDestinationRef.current
    )
    if (destination) {
      const marker = createDestinationMarker(destination)
      destinationMarkerRef.current = marker
      newGroup.add(marker)
    }
  }

  // ===========================================================
  // CAMERA DIRECTION CALCULATION
  // ===========================================================

  const calculateCameraDirection = (): DirectionState => {
    const camera = cameraRef.current
    const mapSpace = mapSpaceRef.current
    const points = routePointsRef.current

    if (!camera || !mapSpace || points.length < 2) {
      return 'none'
    }

    const cameraWorldPosition = new THREE.Vector3()
    camera.getWorldPosition(cameraWorldPosition)

    const cameraMapPosition = cameraWorldPosition.clone()
    mapSpace.object.worldToLocal(cameraMapPosition)

    const cameraForwardWorld = new THREE.Vector3()
    camera.getWorldDirection(cameraForwardWorld)

    const cameraForwardEndWorld = cameraWorldPosition
      .clone()
      .add(cameraForwardWorld)

    const cameraForwardEndMap = cameraForwardEndWorld.clone()
    mapSpace.object.worldToLocal(cameraForwardEndMap)

    const cameraForwardMap = cameraForwardEndMap
      .sub(cameraMapPosition)
      .normalize()

    cameraForwardMap.y = 0
    if (cameraForwardMap.lengthSq() < 0.0001) return 'none'
    cameraForwardMap.normalize()

    // Nearest segment
    let closestDistance = Infinity
    let closestSegment = 0

    for (let i = 0; i < points.length - 1; i++) {
      const segmentStart = points[i]
      const segmentEnd = points[i + 1]
      const segment = new THREE.Vector3().subVectors(
        segmentEnd,
        segmentStart
      )
      segment.y = 0

      const lengthSq = segment.lengthSq()
      if (lengthSq < 0.000001) continue

      const toUser = cameraMapPosition.clone().sub(segmentStart)
      toUser.y = 0

      const t = THREE.MathUtils.clamp(
        toUser.dot(segment) / lengthSq,
        0,
        1
      )

      const closest = segmentStart
        .clone()
        .add(segment.clone().multiplyScalar(t))
      closest.y = 0

      const distance = cameraMapPosition
        .clone()
        .setY(0)
        .distanceTo(closest)

      if (distance < closestDistance) {
        closestDistance = distance
        closestSegment = i
      }
    }

    const start = points[closestSegment]
    const end =
      points[Math.min(closestSegment + 1, points.length - 1)]

    const routeDirection = new THREE.Vector3()
      .subVectors(end, start)
    routeDirection.y = 0
    if (routeDirection.lengthSq() < 0.0001) return 'none'
    routeDirection.normalize()

    const dot = THREE.MathUtils.clamp(
      cameraForwardMap.dot(routeDirection),
      -1,
      1
    )

    const crossY =
      cameraForwardMap.x * routeDirection.z -
      cameraForwardMap.z * routeDirection.x

    const angle = Math.atan2(crossY, dot)
    const absoluteAngle = Math.abs(angle)

    if (absoluteAngle > THREE.MathUtils.degToRad(135)) return 'uturn'
    if (absoluteAngle < THREE.MathUtils.degToRad(22)) return 'straight'
    if (angle > 0) return 'left'
    return 'right'
  }

  // ===========================================================
  // DESTINATION MARKER ANIMATION (called each frame)
  // ===========================================================

  const animateDestinationMarker = () => {
    const marker = destinationMarkerRef.current
    if (!marker) return

    const time = animationTimeRef.current

    const pulse = 1 + Math.sin(time * 2.8) * 0.045
    marker.scale.setScalar(pulse)

    // Inner ring
    const ring = destinationRingRef.current
    if (ring) {
      const ringProgress = (time * 0.45) % 1
      const ringScale = 1 + ringProgress * 1.8
      ring.scale.set(ringScale, ringScale, ringScale)

      const mat = ring.material
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.opacity = 0.7 * (1 - ringProgress)
      }
    }

    // Outer pulse ring
    const pulseRing = marker.getObjectByName('destination-pulse-ring')
    if (pulseRing) {
      const pulseProgress = (time * 0.32 + 0.5) % 1
      const scale = 1 + pulseProgress * 2.2
      pulseRing.scale.set(scale, scale, scale)

      const mat = (pulseRing as THREE.Mesh).material
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.opacity = 0.35 * (1 - pulseProgress)
      }
    }

    // Beam
    const beam = destinationBeamRef.current
    if (beam) {
      const beamPulse =
        0.10 + (Math.sin(time * 3) + 1) * 0.035
      const mat = beam.material
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.opacity = beamPulse
      }
    }

    // Label float
    const label = destinationLabelRef.current
    if (label) {
      label.position.y =
        DESTINATION_LABEL_HEIGHT +
        Math.sin(time * 2) * 0.045
    }
  }

  // ===========================================================
  // PER-FRAME TICK (driven by navigation 'tick' event)
  // ===========================================================

  const onNavigationTick = (deltaSeconds: number) => {
    animationTimeRef.current += deltaSeconds

    if (!navigationActiveRef.current) return

    // Scroll the ribbon arrows forward.
    const material = ribbonMaterialRef.current
    if (material) {
      const spacing = material.uniforms.uArrowSpacing.value as number
      const next =
        ((material.uniforms.uScrollOffset.value as number) +
          deltaSeconds * ARROW_SCROLL_SPEED) %
        spacing
      material.uniforms.uScrollOffset.value = next
    }

    // Destination marker animations.
    animateDestinationMarker()

    // Direction HUD.
    const newDirection = calculateCameraDirection()
    if (newDirection !== currentDirectionRef.current) {
      currentDirectionRef.current = newDirection
      setDirection(newDirection)
      speakDirection(newDirection)
    }
  }

  // ===========================================================
  // INITIALIZATION
  // ===========================================================

  useEffect(() => {
    // Wait for overlayRoot before creating the XR session.
    if (!overlayRoot) return

    let disposed = false

    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let adapter: ThreeAdapter | null = null
    let mapSpace: MapSpace | null = null
    let pathfinder: NavMeshPathfinder | null = null
    let navigation: MultiSetNavigation | null = null
    let resizeHandler: (() => void) | null = null

    const init = async () => {
      try {
        if (!containerRef.current) {
          throw new Error('AR container not available.')
        }

        // -----------------------------------------------------
        // WebXR support
        // -----------------------------------------------------
        const supported = await ThreeAdapter.isSupported()
        if (!supported) {
          throw new Error(
            'WebXR immersive AR is not supported on this device.'
          )
        }
        if (disposed) return

        // -----------------------------------------------------
        // Env
        // -----------------------------------------------------
        const clientId =
          process.env.NEXT_PUBLIC_MULTISET_CLIENT_ID
        const clientSecret =
          process.env.NEXT_PUBLIC_MULTISET_CLIENT_SECRET
        const mapCode =
          process.env.NEXT_PUBLIC_MULTISET_MAP_CODE

        if (!clientId || !clientSecret || !mapCode) {
          throw new Error('Missing MultiSet environment variables.')
        }

        // -----------------------------------------------------
        // MultiSet client
        // -----------------------------------------------------
        const client = new MultisetClient({
          clientId,
          clientSecret,
          mapType: 'map',
          code: mapCode,
        })
        await client.authorize()
        if (disposed) return

        console.log('[Kokarya] MultiSet authorized')

        // -----------------------------------------------------
        // Renderer
        // -----------------------------------------------------
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.xr.enabled = true
        renderer.setClearColor(0x000000, 0)

        renderer.domElement.style.position = 'fixed'
        renderer.domElement.style.left = '0'
        renderer.domElement.style.top = '0'
        renderer.domElement.style.width = '100%'
        renderer.domElement.style.height = '100%'
        renderer.domElement.style.zIndex = '0'

        containerRef.current.appendChild(renderer.domElement)
        rendererRef.current = renderer

        // -----------------------------------------------------
        // Scene / camera / light
        // -----------------------------------------------------
        scene = new THREE.Scene()
        scene.background = null

        camera = new THREE.PerspectiveCamera(
          70,
          window.innerWidth / window.innerHeight,
          0.01,
          1000
        )
        cameraRef.current = camera
        scene.add(camera)

        scene.add(new THREE.AmbientLight(0xffffff, 1))

        // -----------------------------------------------------
        // Map space
        // -----------------------------------------------------
        mapSpace = new MapSpace(new THREE.Object3D())
        mapSpaceRef.current = mapSpace
        scene.add(mapSpace.object)

        // -----------------------------------------------------
        // NavMesh
        // -----------------------------------------------------
        const loader = new GLTFLoader()
        const gltf = await loader.loadAsync(
          '/navigation/kokarya-nav-mesh.glb'
        )
        if (disposed) return

        const navMesh = gltf.scene
        mapSpace.object.add(navMesh)
        navMesh.visible = false

        const bounds = new THREE.Box3().setFromObject(navMesh)
        console.log(
          '[Kokarya] NavMesh center:',
          bounds.getCenter(new THREE.Vector3())
        )
        console.log(
          '[Kokarya] NavMesh size:',
          bounds.getSize(new THREE.Vector3())
        )

        // -----------------------------------------------------
        // Pathfinder
        // -----------------------------------------------------
        pathfinder = await NavMeshPathfinder.fromObject3D(navMesh, {
          space: mapSpace.object,
        })
        if (disposed) return
        pathfinderRef.current = pathfinder

        console.log('[Kokarya] NavMesh groups:', pathfinder.groupCount)

        // -----------------------------------------------------
        // XR session — pass overlayRoot so AR DOM UI works
        // -----------------------------------------------------
        const session = new XRSessionManager(
          renderer.getContext() as WebGL2RenderingContext,
          {
            client,
            autoLocalize: true,
            overlayRoot, // 👈 required for ThreeAdapter + DOM Overlay

            onLocalizationFailure: (reason) => {
              console.warn('[Kokarya] Localization failed:', reason)
              setLocalized(false)
            },

            onError: (sessionError) => {
              console.error('[Kokarya] XR error:', sessionError)
              setError(
                sessionError instanceof Error
                  ? sessionError.message
                  : String(sessionError)
              )
            },
          }
        )

        // -----------------------------------------------------
        // Adapter
        // -----------------------------------------------------
        adapter = new ThreeAdapter({
          session,
          renderer,
          scene,
          camera,
          showMesh: false,
          showGizmo: false,

          onLocalizationSuccess: (result, worldFromMap) => {
            console.log('================================')
            console.log('[Kokarya] LOCALIZED')
            console.log(
              '[Kokarya] Confidence:',
              result.localizeData.confidence
            )
            console.log('[Kokarya] worldFromMap:', worldFromMap)
            console.log('================================')

            setLocalized(true)
          },
        })
        adapterRef.current = adapter

        // -----------------------------------------------------
        // Connect map space
        // -----------------------------------------------------
        mapSpace.connect(adapter)

        // -----------------------------------------------------
        // Navigation
        // -----------------------------------------------------
        navigation = await MultiSetNavigation.create({
          adapter,
          mapSpace,
          pathfinder,
          pois: DESTINATIONS,
        })
        if (disposed) return
        navigationRef.current = navigation

        console.log('[Kokarya] Navigation created')

        // -----------------------------------------------------
        // Path updates
        // -----------------------------------------------------
        navigation.on('pathUpdated', ({ corners, remainingDistance }) => {
          setDistance(remainingDistance)

          if (navigationActiveRef.current) {
            speakDistance(remainingDistance)
          }

          if (!navigationActiveRef.current) return

          if (corners.length < 2) {
            clearNavigationVisual()
            return
          }

          createRouteVisual(corners)
        })

        // -----------------------------------------------------
        // Tick — animation loop
        // -----------------------------------------------------
        navigation.on('tick', ({ deltaSeconds }) => {
          onNavigationTick(deltaSeconds)
        })

        // -----------------------------------------------------
        // Arrived
        // -----------------------------------------------------
        navigation.on('arrived', (poi) => {
          console.log('[Kokarya] ARRIVED:', poi.name)

          navigationActiveRef.current = false
          setIsNavigating(false)
          setDistance(0)
          setDirection('none')
          currentDirectionRef.current = 'none'

          // Stop the SDK's internal navigation loop.
          try {
            navigationRef.current?.stop()
          } catch {}

          setArrivedMessage(`You have arrived at ${poi.name}`)
          speak(`You have arrived at ${poi.name}.`, true)

          setTimeout(() => {
            if (disposed) return
            clearNavigationVisual()
            setArrivedMessage('')
            setSelectedDestination('')
            selectedDestinationRef.current = ''
          }, 3500)
        })

        // -----------------------------------------------------
        // Unreachable
        // -----------------------------------------------------
        navigation.on('unreachable', (poi) => {
          console.warn('[Kokarya] UNREACHABLE:', poi.name)

          navigationActiveRef.current = false
          setIsNavigating(false)
          setDirection('none')

          try {
            navigationRef.current?.stop()
          } catch {}

          speak(`There is no route to ${poi.name}.`, true)
          clearNavigationVisual()
        })

        // -----------------------------------------------------
        // Initialize adapter (starts XR + localization)
        // -----------------------------------------------------
        await adapter.initialize()
        if (disposed) return

        console.log('[Kokarya] Ready')

        // -----------------------------------------------------
        // Resize
        // -----------------------------------------------------
        resizeHandler = () => {
          if (!renderer || !camera) return
          camera.aspect = window.innerWidth / window.innerHeight
          camera.updateProjectionMatrix()
          renderer.setSize(window.innerWidth, window.innerHeight)
        }
        window.addEventListener('resize', resizeHandler)
      } catch (err) {
        console.error('[Kokarya] Initialization error:', err)
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    init()

    return () => {
      disposed = true

      if (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window
      ) {
        window.speechSynthesis.cancel()
      }

      navigationActiveRef.current = false

      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler)
      }

      try {
        navigation?.stop()
      } catch {}

      clearNavigationVisual()

      // Dispose ribbon resources
      if (ribbonMeshRef.current) {
        ribbonMeshRef.current.geometry.dispose()
        ribbonMeshRef.current.parent?.remove(ribbonMeshRef.current)
        ribbonMeshRef.current = null
      }
      ribbonMaterialRef.current?.dispose()
      ribbonMaterialRef.current = null
      arrowTextureRef.current?.dispose()
      arrowTextureRef.current = null

      try {
        adapter?.dispose()
      } catch {}
      try {
        pathfinder?.dispose()
      } catch {}
      try {
        mapSpace?.dispose()
      } catch {}

      if (renderer && renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(
          renderer.domElement
        )
      }
      renderer?.dispose()

      navigationRef.current = null
      pathfinderRef.current = null
      mapSpaceRef.current = null
      adapterRef.current = null
      rendererRef.current = null
      cameraRef.current = null
    }
  }, [overlayRoot])

  // ===========================================================
  // START / STOP NAVIGATION
  // ===========================================================

  const startNavigation = (destination: Destination) => {
    const navigation = navigationRef.current
    if (!navigation) {
      console.warn('[Kokarya] Navigation not ready')
      return
    }
    if (!localized) {
      setError('Please wait for localization')
      return
    }

    // Clean up any previous session first.
    try {
      navigation.stop()
    } catch {}

    console.log('[Kokarya] Starting navigation:', destination.name)

    selectedDestinationRef.current = destination.id
    setSelectedDestination(destination.id)
    setIsNavigating(true)
    setArrivedMessage('')
    setDirection('none')

    currentDirectionRef.current = 'none'
    lastSpokenDirectionRef.current = 'none'
    lastVoiceTimeRef.current = 0
    spokenDistanceMilestonesRef.current = []

    navigationActiveRef.current = true
    animationTimeRef.current = 0

    speak(
      `Navigation started. Head towards ${destination.name}.`,
      true
    )

    navigation.setDestination(destination.id)
  }

  const stopNavigation = () => {
    console.log('[Kokarya] Navigation stopped')

    // Stop the SDK's internal navigation loop.
    try {
      navigationRef.current?.stop()
    } catch {}

    navigationActiveRef.current = false
    setIsNavigating(false)
    setSelectedDestination('')
    selectedDestinationRef.current = ''
    setDistance(null)
    setDirection('none')
    currentDirectionRef.current = 'none'
    setArrivedMessage('')

    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      window.speechSynthesis.cancel()
    }

    lastSpokenDirectionRef.current = 'none'
    lastVoiceTimeRef.current = 0
    spokenDistanceMilestonesRef.current = []

    clearNavigationVisual()
  }

  // ===========================================================
  // DIRECTION HUD
  // ===========================================================

  const renderDirectionHud = () => {
    if (!isNavigating || direction === 'none') return null

    const baseClass =
      'flex items-center gap-2 rounded-full border border-cyan-300/20 ' +
      'bg-black/65 px-4 py-2.5 text-sm font-semibold text-white ' +
      'shadow-xl backdrop-blur-xl'

    const wrapperClass =
      'pointer-events-none fixed left-1/2 top-20 z-40 -translate-x-1/2'

    if (direction === 'straight') {
      return (
        <div className={wrapperClass}>
          <div className={baseClass}>
            <ChevronUp className="h-5 w-5 text-cyan-300" />
            Go straight
          </div>
        </div>
      )
    }

    if (direction === 'left') {
      return (
        <div className={wrapperClass}>
          <div className={baseClass}>
            <ArrowLeft className="h-5 w-5 text-cyan-300" />
            Turn left
          </div>
        </div>
      )
    }

    if (direction === 'right') {
      return (
        <div className={wrapperClass}>
          <div className={baseClass}>
            <ArrowRight className="h-5 w-5 text-cyan-300" />
            Turn right
          </div>
        </div>
      )
    }

    // uturn
    return (
      <div className={wrapperClass}>
        <div
          className={
            'flex items-center gap-2 rounded-full border ' +
            'border-amber-300/25 bg-black/70 px-4 py-2.5 text-sm ' +
            'font-semibold text-white shadow-xl backdrop-blur-xl'
          }
        >
          <RotateCcw className="h-5 w-5 text-amber-300" />
          Turn around
        </div>
      </div>
    )
  }

  // ===========================================================
  // UI
  // ===========================================================

  const ui = (
    <>
      {/* AR CANVAS (outside portal — sits under everything) */}

      {/* TOP STATUS */}
      <div className="pointer-events-none fixed left-1/2 top-4 z-30 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/65 px-4 py-2 text-sm text-white shadow-xl backdrop-blur-xl">
          <span
            className={`h-2 w-2 rounded-full ${
              localized
                ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                : 'bg-yellow-400'
            }`}
          />
          {isNavigating && selectedDestinationObject
            ? selectedDestinationObject.name
            : localized
              ? 'Ready'
              : 'Localizing...'}
        </div>
      </div>

      {/* DIRECTION HUD */}
      {renderDirectionHud()}

      {/* VOICE CONTROL */}
      {isNavigating && (
        <div className="pointer-events-auto fixed right-4 top-20 z-50">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={toggleVoice}
            aria-label={
              voiceEnabled
                ? 'Mute voice guidance'
                : 'Enable voice guidance'
            }
            className="h-11 w-11 rounded-full border border-white/15 bg-black/70 text-white shadow-xl backdrop-blur-xl hover:bg-black/80"
          >
            {voiceEnabled ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
          </Button>
        </div>
      )}

      {/* DESTINATION DISTANCE */}
      {isNavigating && distance !== null && selectedDestinationObject && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs text-white shadow-xl backdrop-blur-xl">
            <LocateFixed className="h-4 w-4 text-cyan-300" />
            {distance.toFixed(1)} m to{' '}
            {selectedDestinationObject.name}
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="pointer-events-auto fixed left-4 right-4 top-16 z-50 rounded-2xl border border-red-400/20 bg-red-950/80 p-3 text-xs text-red-200 shadow-xl backdrop-blur-xl">
          {error}
        </div>
      )}

      {/* DESTINATION DRAWER */}
      {!isNavigating && (
        <div className="pointer-events-auto fixed bottom-20 left-0 right-0 z-40 flex justify-center px-4">
          <Drawer>
            <DrawerTrigger>
              <Button
                disabled={!localized}
                className="h-12 rounded-full bg-black/80 px-7 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl hover:bg-black/90"
              >
                <MapPin className="mr-2 h-4 w-4" />
                Choose destination
              </Button>
            </DrawerTrigger>

            <DrawerContent>
              <div className="mx-auto w-full max-w-lg">
                <DrawerHeader>
                  <DrawerTitle>Where do you want to go?</DrawerTitle>
                  <DrawerDescription>
                    Select a destination to start AR navigation.
                  </DrawerDescription>
                </DrawerHeader>

                <div className="grid grid-cols-2 gap-3 px-4">
                  {DESTINATIONS.map((destination) => (
                    <DrawerClose key={destination.id}>
                      <Button
                        variant="outline"
                        className="h-20 justify-start rounded-2xl px-4 text-left"
                        onClick={() => startNavigation(destination)}
                      >
                        <div className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
                          <MapPin className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                          <div className="font-semibold">
                            {destination.name}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Start navigation
                          </div>
                        </div>
                      </Button>
                    </DrawerClose>
                  ))}
                </div>

                <DrawerFooter>
                  <DrawerClose>
                    <Button variant="ghost" className="rounded-full">
                      Cancel
                    </Button>
                  </DrawerClose>
                </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      )}

      {/* STOP NAVIGATION */}
      {isNavigating && (
        <div className="pointer-events-auto fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
          <Button
            variant="destructive"
            onClick={stopNavigation}
            className="h-12 rounded-full px-7 font-semibold shadow-2xl"
          >
            Stop navigation
          </Button>
        </div>
      )}

      {/* ARRIVAL */}
      {arrivedMessage && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-black/85 px-7 py-6 text-center text-white shadow-2xl backdrop-blur-xl">
          <div className="mb-2 text-4xl text-emerald-400">✓</div>
          <div className="text-base font-semibold">Arrived</div>
          <div className="mt-1 text-sm text-white/60">
            {selectedDestinationObject?.name}
          </div>
        </div>
      )}
    </>
  )

  return (
    <main className="fixed inset-0 overflow-hidden bg-transparent">
      {/* WebGL canvas host */}
      <div
        ref={containerRef}
        className="pointer-events-none fixed inset-0 z-0"
      />

      {/* UI: portalled into the XR DOM-overlay root so it works
          both inside and outside an immersive session. */}
      {overlayRoot ? createPortal(ui, overlayRoot) : null}
    </main>
  )
}