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
  Navigation as MultiSetNavigation,
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

import {
  MapPin,
  Navigation,
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
    id: 'cabin-2',
    name: 'Cabin 2',
    position: new THREE.Vector3(
      -7.993,
      -0.587,
      -2.108
    ),
  },

  {
    id: 'cabin-1',
    name: 'Cabin 1',
    position: new THREE.Vector3(
      -7.883,
      -0.689,
      1.642
    ),
  },

  {
    id: 'meeting-room',
    name: 'Meeting room',
    position: new THREE.Vector3(
      -6.902,
      -0.809,
      5.77
    ),
  },

  {
    id: 'men-washroom',
    name: 'Men washroom',
    position: new THREE.Vector3(
      -1.308,
      -0.733,
      5.901
    ),
  },

  {
    id: 'women-washroom',
    name: 'Women washroom',
    position: new THREE.Vector3(
      -0.654,
      -0.626,
      7.272
    ),
  },

  {
    id: 'lobby',
    name: 'Lobby',
    position: new THREE.Vector3(
      3.612,
      -0.867,
      4.142
    ),
  },

  {
    id: 'entrance-door',
    name: 'Entrance door',
    position: new THREE.Vector3(
      5.603,
      -0.839,
      3.897
    ),
  },

  {
    id: 'cabin-3',
    name: 'Cabin 3',
    position: new THREE.Vector3(
      6.659,
      -1.062,
      -5.447
    ),
  },

  {
    id: 'cabin-4',
    name: 'Cabin 4',
    position: new THREE.Vector3(
      10.033,
      -1.043,
      -6.443
    ),
  },

  {
    id: 'cabin-5',
    name: 'Cabin 5',
    position: new THREE.Vector3(
      7.735,
      -1.18,
      -5.194
    ),
  },

  {
    id: 'office-space',
    name: 'Office space',
    position: new THREE.Vector3(
      0.344,
      -1.861,
      0.899
    ),
  }

];

// =============================================================
// CONSTANTS
// =============================================================

const ROUTE_HEIGHT = 0.045

const ARROW_HEIGHT = 0.065

const DESTINATION_PIN_HEIGHT = 0.82

const DESTINATION_LABEL_HEIGHT = 1.30

const ARROW_SPACING = 0.62

const ARROW_SIZE = 0.22

const DIRECTION_UPDATE_DISTANCE = 0.15
const VOICE_COOLDOWN = 3000
const VOICE_DISTANCE_MILESTONES = [20, 10, 5]

// =============================================================
// PAGE
// =============================================================

export default function KokaryaFullMapPage() {
  // ===========================================================
  // THREE
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
    useRef<MultiSetNavigation | null>(null)

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(null)

  // ===========================================================
  // NAVIGATION VISUALS
  // ===========================================================

  const navigationGroupRef =
    useRef<THREE.Group | null>(null)

  const arrowMeshesRef =
    useRef<THREE.Group[]>([])

  const routePointsRef =
    useRef<THREE.Vector3[]>([])

  const routeDistancesRef =
    useRef<number[]>([])

  const totalRouteLengthRef =
    useRef(0)

  const destinationMarkerRef =
    useRef<THREE.Group | null>(null)

  const destinationRingRef =
    useRef<THREE.Mesh | null>(null)

  const destinationBeamRef =
    useRef<THREE.Mesh | null>(null)

  const destinationLabelRef =
    useRef<THREE.Sprite | null>(null)

  // ===========================================================
  // NAVIGATION STATE REFS
  // ===========================================================

  const navigationActiveRef =
    useRef(false)

  const selectedDestinationRef =
    useRef('')

  const animationTimeRef =
    useRef(0)

  const arrowOffsetRef =
    useRef(0)

  const currentMapPositionRef =
    useRef(new THREE.Vector3())

  const lastMapPositionRef =
    useRef(new THREE.Vector3())

  const currentDirectionRef =
    useRef<DirectionState>('none')

  // ===========================================================
  // VOICE NAVIGATION
  // ===========================================================

  const voiceEnabledRef =
    useRef(true)

  const lastSpokenDirectionRef =
    useRef<DirectionState>('none')

  const lastVoiceTimeRef =
    useRef(0)

  const spokenDistanceMilestonesRef =
    useRef<number[]>([])

  // ===========================================================
  // REACT STATE
  // ===========================================================

  const [status, setStatus] =
    useState('Initializing...')

  const [localized, setLocalized] =
    useState(false)

  const [distance, setDistance] =
    useState<number | null>(null)

  const [selectedDestination, setSelectedDestination] =
    useState('')

  const [pathVisible, setPathVisible] =
    useState(false)

  const [isNavigating, setIsNavigating] =
    useState(false)

  const [error, setError] =
    useState('')

  const [arrivedMessage, setArrivedMessage] =
    useState('')

  const [direction, setDirection] =
    useState<DirectionState>('none')

  const [voiceEnabled, setVoiceEnabled] =
    useState(true)

  // ===========================================================
  // DESTINATION OBJECT
  // ===========================================================

  const selectedDestinationObject =
    DESTINATIONS.find(
      (destination) =>
        destination.id ===
        selectedDestination
    )

  // ===========================================================
  // VOICE ENGINE
  // ===========================================================

  const speak = (
    message: string,
    force = false
  ) => {
    if (!voiceEnabledRef.current) return
    if (typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return

    const now = Date.now()

    if (
      !force &&
      now - lastVoiceTimeRef.current < VOICE_COOLDOWN
    ) {
      return
    }

    lastVoiceTimeRef.current = now

    const speech = window.speechSynthesis
    speech.cancel()

    const utterance =
      new SpeechSynthesisUtterance(message)

    utterance.lang = 'en-IN'
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 1

    const voices = speech.getVoices()

    const preferredVoice =
      voices.find((voice) =>
        voice.lang.toLowerCase().startsWith('en-in')
      ) ??
      voices.find((voice) =>
        voice.lang.toLowerCase().startsWith('en')
      )

    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    speech.speak(utterance)
  }

  const speakDirection = (
    nextDirection: DirectionState
  ) => {
    if (nextDirection === 'none') return
    if (lastSpokenDirectionRef.current === nextDirection) return

    lastSpokenDirectionRef.current = nextDirection

    switch (nextDirection) {
      case 'straight':
        speak('Go straight.')
        break
      case 'left':
        speak('Turn left.')
        break
      case 'right':
        speak('Turn right.')
        break
      case 'uturn':
        speak('Turn around.')
        break
    }
  }

  const speakDistance = (
    remainingDistance: number
  ) => {
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
  // CREATE ARROW
  // ===========================================================

  const createArrowGeometry = () => {
    const width = ARROW_SIZE
    const height = ARROW_SIZE * 1.25

    // Hollow chevron pointing along local +Z.
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
  // CREATE DESTINATION LABEL
  // ===========================================================

  const createDestinationLabel = (
    text: string
  ) => {
    const canvas =
      document.createElement(
        'canvas'
      )

    canvas.width = 640
    canvas.height = 180

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
    // SHADOW
    // ---------------------------------------------------------

    context.shadowColor =
      'rgba(0,0,0,0.45)'

    context.shadowBlur = 24

    // ---------------------------------------------------------
    // BACKGROUND
    // ---------------------------------------------------------

    context.beginPath()

    context.roundRect(
      14,
      14,
      612,
      152,
      42
    )

    context.fillStyle =
      'rgba(10,10,14,0.90)'

    context.fill()

    context.shadowBlur = 0

    // ---------------------------------------------------------
    // PIN DOT
    // ---------------------------------------------------------

    context.beginPath()

    context.arc(
      74,
      90,
      17,
      0,
      Math.PI * 2
    )

    context.fillStyle =
      '#ff3158'

    context.fill()

    // ---------------------------------------------------------
    // TEXT
    // ---------------------------------------------------------

    context.font =
      '600 46px Arial'

    context.fillStyle =
      '#ffffff'

    context.textAlign =
      'left'

    context.textBaseline =
      'middle'

    context.fillText(
      text,
      112,
      90
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
      2.05,
      0.58,
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

    group.name =
      'destination-marker'

    // =========================================================
    // FLOOR RING
    // =========================================================

    const ring =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.28,
          0.38,
          48
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff3158,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: false,
        })
      )

    ring.rotation.x =
      -Math.PI / 2

    ring.position.y =
      0.025

    ring.name =
      'destination-ring'

    destinationRingRef.current =
      ring

    group.add(
      ring
    )

    // =========================================================
    // SECOND PULSE RING
    // =========================================================

    const pulseRing =
      new THREE.Mesh(
        new THREE.RingGeometry(
          0.42,
          0.46,
          48
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff3158,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: false,
        })
      )

    pulseRing.rotation.x =
      -Math.PI / 2

    pulseRing.position.y =
      0.027

    pulseRing.name =
      'destination-pulse-ring'

    group.add(
      pulseRing
    )

    // =========================================================
    // PIN STEM
    // =========================================================

    const stem =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.045,
          0.065,
          0.78,
          16
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff3158,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          depthTest: false,
        })
      )

    stem.position.y =
      0.58

    group.add(
      stem
    )

    // =========================================================
    // PIN HEAD
    // =========================================================

    const head =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.20,
          32,
          32
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff3158,
          transparent: true,
          opacity: 0.98,
          depthWrite: false,
          depthTest: false,
        })
      )

    head.position.y =
      DESTINATION_PIN_HEIGHT

    group.add(
      head
    )

    // =========================================================
    // INNER HEAD
    // =========================================================

    const inner =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.075,
          20,
          20
        ),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          depthTest: false,
        })
      )

    inner.position.y =
      DESTINATION_PIN_HEIGHT

    group.add(
      inner
    )

    // =========================================================
    // VERTICAL BEAM
    // =========================================================

    const beam =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.025,
          0.025,
          1.5,
          12
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff3158,
          transparent: true,
          opacity: 0.14,
          depthWrite: false,
          depthTest: false,
        })
      )

    beam.position.y =
      0.78

    destinationBeamRef.current =
      beam

    group.add(
      beam
    )

    // =========================================================
    // LABEL
    // =========================================================

    const label =
      createDestinationLabel(
        destination.name
      )

    if (label) {
      label.position.y =
        DESTINATION_LABEL_HEIGHT

      destinationLabelRef.current =
        label

      group.add(
        label
      )
    }

    // =========================================================
    // POSITION
    // =========================================================

    group.position.copy(
      destination.position
    )

    return group
  }

  // ===========================================================
  // DISTANCE BETWEEN PATH POINTS
  // ===========================================================

  const calculateRouteDistances = (
    points: readonly THREE.Vector3[]
  ) => {
    const distances: number[] = [
      0,
    ]

    let total = 0

    for (
      let i = 1;
      i < points.length;
      i++
    ) {
      total +=
        points[i - 1].distanceTo(
          points[i]
        )

      distances.push(
        total
      )
    }

    return {
      distances,
      total,
    }
  }

  // ===========================================================
  // POINT ALONG EXACT POLYLINE
  // ===========================================================

  const getPointOnRoute = (
    distanceAlongRoute: number
  ) => {
    const points =
      routePointsRef.current

    const distances =
      routeDistancesRef.current

    if (
      points.length === 0
    ) {
      return null
    }

    if (
      points.length === 1
    ) {
      return {
        point:
          points[0].clone(),

        tangent:
          new THREE.Vector3(
            0,
            0,
            -1
          ),
      }
    }

    const clampedDistance =
      THREE.MathUtils.clamp(
        distanceAlongRoute,
        0,
        totalRouteLengthRef.current
      )

    let segmentIndex = 0

    for (
      let i = 1;
      i < distances.length;
      i++
    ) {
      if (
        clampedDistance <=
        distances[i]
      ) {
        segmentIndex =
          i - 1

        break
      }

      segmentIndex =
        i - 1
    }

    const start =
      points[segmentIndex]

    const end =
      points[
      Math.min(
        segmentIndex + 1,
        points.length - 1
      )
      ]

    const startDistance =
      distances[segmentIndex]

    const endDistance =
      distances[
      Math.min(
        segmentIndex + 1,
        distances.length - 1
      )
      ]

    const segmentLength =
      Math.max(
        endDistance -
        startDistance,
        0.0001
      )

    const t =
      THREE.MathUtils.clamp(
        (
          clampedDistance -
          startDistance
        ) /
        segmentLength,
        0,
        1
      )

    const point =
      new THREE.Vector3().lerpVectors(
        start,
        end,
        t
      )

    const tangent =
      new THREE.Vector3()
        .subVectors(
          end,
          start
        )
        .normalize()

    return {
      point,
      tangent,
    }
  }

  // ===========================================================
  // CLEAR ROUTE
  // ===========================================================

  const clearNavigationVisual = () => {
    const mapSpace =
      mapSpaceRef.current

    const group =
      navigationGroupRef.current

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

          if (
            mesh.material instanceof
            THREE.Material
          ) {
            mesh.material.dispose()
          }
        }
      )
    }

    navigationGroupRef.current =
      null

    arrowMeshesRef.current =
      []

    routePointsRef.current =
      []

    routeDistancesRef.current =
      []

    totalRouteLengthRef.current =
      0

    destinationMarkerRef.current =
      null

    destinationRingRef.current =
      null

    destinationBeamRef.current =
      null

    destinationLabelRef.current =
      null
  }

  // ===========================================================
  // CREATE EXACT ROUTE VISUAL
  // ===========================================================

  const createRouteVisual = (
    corners: readonly THREE.Vector3[]
  ) => {
    const mapSpace =
      mapSpaceRef.current

    if (!mapSpace) {
      return
    }

    if (
      corners.length < 2
    ) {
      return
    }

    // ---------------------------------------------------------
    // CLEAR OLD
    // ---------------------------------------------------------

    clearNavigationVisual()

    // ---------------------------------------------------------
    // CLONE EXACT CORNERS
    //
    // IMPORTANT:
    // We intentionally DO NOT smooth these.
    // ---------------------------------------------------------

    const points =
      corners.map(
        (point) =>
          point.clone()
      )

    routePointsRef.current =
      points

    const {
      distances,
      total,
    } =
      calculateRouteDistances(
        points
      )

    routeDistancesRef.current =
      distances

    totalRouteLengthRef.current =
      total

    // ---------------------------------------------------------
    // GROUP
    // ---------------------------------------------------------

    const group =
      new THREE.Group()

    group.name =
      'ar-navigation'

    navigationGroupRef.current =
      group

    mapSpace.object.add(
      group
    )

    // =========================================================
    // EXACT ROUTE LINE
    // =========================================================

    const lineGeometry =
      new THREE.BufferGeometry().setFromPoints(
        points.map(
          (point) =>
            new THREE.Vector3(
              point.x,
              point.y +
              ROUTE_HEIGHT,
              point.z
            )
        )
      )

    const lineMaterial =
      new THREE.LineBasicMaterial({
        color: 0x00d9ff,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        depthTest: false,
        linewidth: 3,
      })

    const line =
      new THREE.Line(
        lineGeometry,
        lineMaterial
      )

    line.frustumCulled =
      false

    group.add(
      line
    )

    // =========================================================
    // ROUTE SEGMENT GLOW
    // =========================================================

    for (
      let i = 0;
      i < points.length - 1;
      i++
    ) {
      const start =
        points[i].clone()

      const end =
        points[i + 1].clone()

      start.y +=
        ROUTE_HEIGHT

      end.y +=
        ROUTE_HEIGHT

      const geometry =
        new THREE.CylinderGeometry(
          0.012,
          0.012,
          start.distanceTo(
            end
          ),
          8
        )

      const material =
        new THREE.MeshBasicMaterial({
          color: 0x00d9ff,
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
          depthTest: false,
        })

      const segment =
        new THREE.Mesh(
          geometry,
          material
        )

      const midpoint =
        new THREE.Vector3()
          .addVectors(
            start,
            end
          )
          .multiplyScalar(
            0.5
          )

      segment.position.copy(
        midpoint
      )

      segment.quaternion.setFromUnitVectors(
        new THREE.Vector3(
          0,
          1,
          0
        ),
        new THREE.Vector3()
          .subVectors(
            end,
            start
          )
          .normalize()
      )

      segment.frustumCulled =
        false

      group.add(
        segment
      )
    }

    // =========================================================
    // FLOWING CHEVRON ARROWS
    // =========================================================

    const arrowCount =
      Math.max(
        5,
        Math.floor(
          total / ARROW_SPACING
        )
      )

    for (
      let i = 0;
      i < arrowCount;
      i++
    ) {
      const arrowGroup =
        new THREE.Group()

      arrowGroup.name =
        `navigation-chevron-${i}`

      // Main hollow chevron.
      const geometry =
        createArrowGeometry()

      const material =
        new THREE.LineBasicMaterial({
          color: 0x16b9ff,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          depthTest: false,
          linewidth: 2,
        })

      const chevron =
        new THREE.Line(
          geometry,
          material
        )

      chevron.frustumCulled =
        false

      // Larger, softer glow.
      const glowGeometry =
        createArrowGeometry()

      const glowMaterial =
        new THREE.LineBasicMaterial({
          color: 0x00aaff,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          depthTest: false,
        })

      const glow =
        new THREE.Line(
          glowGeometry,
          glowMaterial
        )

      glow.scale.set(
        1.55,
        1.55,
        1.55
      )

      glow.frustumCulled =
        false

      arrowGroup.add(
        glow
      )

      arrowGroup.add(
        chevron
      )

      arrowGroup.userData.index =
        i

      arrowGroup.userData.chevron =
        chevron

      arrowGroup.userData.glow =
        glow

      arrowGroup.frustumCulled =
        false

      group.add(
        arrowGroup
      )

      arrowMeshesRef.current.push(
        arrowGroup
      )
    }

    // =========================================================
    // DESTINATION MARKER
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

      destinationMarkerRef.current =
        marker

      group.add(
        marker
      )
    }
  }

  // ===========================================================
  // CALCULATE DIRECTION FROM CAMERA
  // ===========================================================

  const calculateCameraDirection = () => {
    const camera =
      cameraRef.current

    const mapSpace =
      mapSpaceRef.current

    const points =
      routePointsRef.current

    if (
      !camera ||
      !mapSpace ||
      points.length < 2
    ) {
      return 'none' as DirectionState
    }

    // =========================================================
    // CAMERA WORLD POSITION
    // =========================================================

    const cameraWorldPosition =
      new THREE.Vector3()

    camera.getWorldPosition(
      cameraWorldPosition
    )

    // =========================================================
    // CAMERA MAP POSITION
    // =========================================================

    const cameraMapPosition =
      cameraWorldPosition.clone()

    mapSpace.object.worldToLocal(
      cameraMapPosition
    )

    currentMapPositionRef.current =
      cameraMapPosition

    // =========================================================
    // CAMERA FORWARD WORLD
    // =========================================================

    const cameraForwardWorld =
      new THREE.Vector3()

    camera.getWorldDirection(
      cameraForwardWorld
    )

    // =========================================================
    // CONVERT FORWARD TO MAP SPACE
    // =========================================================

    const cameraForwardEndWorld =
      cameraWorldPosition
        .clone()
        .add(
          cameraForwardWorld
        )

    const cameraForwardEndMap =
      cameraForwardEndWorld.clone()

    mapSpace.object.worldToLocal(
      cameraForwardEndMap
    )

    const cameraForwardMap =
      cameraForwardEndMap
        .sub(
          cameraMapPosition
        )
        .normalize()

    cameraForwardMap.y = 0

    if (
      cameraForwardMap.lengthSq() <
      0.0001
    ) {
      return 'none' as DirectionState
    }

    cameraForwardMap.normalize()

    // =========================================================
    // FIND CLOSEST ROUTE SEGMENT
    // =========================================================

    let closestDistance =
      Infinity

    let closestSegment = 0

    for (
      let i = 0;
      i < points.length - 1;
      i++
    ) {
      const segmentStart =
        points[i]

      const segmentEnd =
        points[i + 1]

      const segment =
        new THREE.Vector3()
          .subVectors(
            segmentEnd,
            segmentStart
          )

      segment.y = 0

      const lengthSq =
        segment.lengthSq()

      if (
        lengthSq <
        0.000001
      ) {
        continue
      }

      const toUser =
        cameraMapPosition
          .clone()
          .sub(
            segmentStart
          )

      toUser.y = 0

      const t =
        THREE.MathUtils.clamp(
          toUser.dot(
            segment
          ) /
          lengthSq,
          0,
          1
        )

      const closest =
        segmentStart
          .clone()
          .add(
            segment.multiplyScalar(
              t
            )
          )

      closest.y = 0

      const distance =
        cameraMapPosition
          .clone()
          .setY(0)
          .distanceTo(
            closest
          )

      if (
        distance <
        closestDistance
      ) {
        closestDistance =
          distance

        closestSegment =
          i
      }
    }

    // =========================================================
    // NEXT ROUTE DIRECTION
    // =========================================================

    const start =
      points[
      closestSegment
      ]

    const end =
      points[
      Math.min(
        closestSegment + 1,
        points.length - 1
      )
      ]

    const routeDirection =
      new THREE.Vector3()
        .subVectors(
          end,
          start
        )

    routeDirection.y = 0

    if (
      routeDirection.lengthSq() <
      0.0001
    ) {
      return 'none' as DirectionState
    }

    routeDirection.normalize()

    // =========================================================
    // RELATIVE ANGLE
    //
    // dot:
    //
    // +1 = same direction
    //  0 = 90 degrees
    // -1 = opposite
    //
    // cross determines left/right.
    // =========================================================

    const dot =
      THREE.MathUtils.clamp(
        cameraForwardMap.dot(
          routeDirection
        ),
        -1,
        1
      )

    const crossY =
      cameraForwardMap.x *
      routeDirection.z -
      cameraForwardMap.z *
      routeDirection.x

    const angle =
      Math.atan2(
        crossY,
        dot
      )

    const absoluteAngle =
      Math.abs(angle)

    // =========================================================
    // U-TURN
    // =========================================================

    if (
      absoluteAngle >
      THREE.MathUtils.degToRad(
        135
      )
    ) {
      return 'uturn'
    }

    // =========================================================
    // STRAIGHT
    // =========================================================

    if (
      absoluteAngle <
      THREE.MathUtils.degToRad(
        22
      )
    ) {
      return 'straight'
    }

    // =========================================================
    // LEFT
    // =========================================================

    if (
      angle > 0
    ) {
      return 'left'
    }

    // =========================================================
    // RIGHT
    // =========================================================

    return 'right'
  }

  // ===========================================================
  // UPDATE NAVIGATION ANIMATION
  // ===========================================================

  const updateNavigationAnimation = (
    deltaSeconds: number
  ) => {
    if (
      !navigationActiveRef.current
    ) {
      return
    }

    animationTimeRef.current +=
      deltaSeconds

    // =========================================================
    // FLOWING CHEVRON ANIMATION
    // =========================================================

    const arrows =
      arrowMeshesRef.current

    const total =
      totalRouteLengthRef.current

    if (
      arrows.length > 0 &&
      total > 0
    ) {
      // Continuous forward flow.
      arrowOffsetRef.current +=
        deltaSeconds * 0.85

      if (
        arrowOffsetRef.current >=
        ARROW_SPACING
      ) {
        arrowOffsetRef.current -=
          ARROW_SPACING
      }

      arrows.forEach(
        (
          arrowGroup,
          index
        ) => {
          const baseDistance =
            index * ARROW_SPACING

          const distance =
            (
              baseDistance +
              arrowOffsetRef.current
            ) % total

          const result =
            getPointOnRoute(
              distance
            )

          if (!result) {
            return
          }

          arrowGroup.position.copy(
            result.point
          )

          const float =
            Math.sin(
              animationTimeRef.current * 4 +
              index * 0.35
            ) * 0.012

          arrowGroup.position.y =
            result.point.y +
            ARROW_HEIGHT +
            float

          const tangent =
            result.tangent.clone()

          tangent.y = 0

          if (
            tangent.lengthSq() >
            0.0001
          ) {
            tangent.normalize()

            const angle =
              Math.atan2(
                tangent.x,
                tangent.z
              )

            arrowGroup.rotation.set(
              0,
              angle,
              0
            )
          }

          // Subtle breathing animation.
          const pulse =
            1 +
            Math.sin(
              animationTimeRef.current * 5 +
              index * 0.45
            ) *
            0.10

          const chevron =
            arrowGroup.userData
              .chevron as THREE.Line | undefined

          if (chevron) {
            chevron.scale.set(
              pulse,
              pulse,
              pulse
            )

            const material =
              chevron.material as THREE.LineBasicMaterial

            material.opacity =
              0.72 +
              Math.sin(
                animationTimeRef.current * 3 +
                index * 0.3
              ) *
              0.18
          }

          const glow =
            arrowGroup.userData
              .glow as THREE.Line | undefined

          if (glow) {
            const glowPulse =
              1.15 +
              Math.sin(
                animationTimeRef.current * 4 +
                index * 0.4
              ) *
              0.15

            glow.scale.set(
              glowPulse,
              glowPulse,
              glowPulse
            )

            const glowMaterial =
              glow.material as THREE.LineBasicMaterial

            glowMaterial.opacity =
              0.10 +
              (
                Math.sin(
                  animationTimeRef.current * 4 +
                  index * 0.4
                ) +
                1
              ) *
              0.05
          }
        }
      )
    }

    // =========================================================
    // DESTINATION ANIMATION
    // =========================================================

    const marker =
      destinationMarkerRef.current

    if (marker) {
      const time =
        animationTimeRef.current

      const pulse =
        1 +
        Math.sin(
          time * 2.8
        ) *
        0.045

      marker.scale.setScalar(
        pulse
      )

      // -------------------------------------------------------
      // RING
      // -------------------------------------------------------

      const ring =
        destinationRingRef.current

      if (ring) {
        const ringProgress =
          (
            time * 0.45
          ) % 1

        const ringScale =
          1 +
          ringProgress *
          1.8

        ring.scale.set(
          ringScale,
          ringScale,
          ringScale
        )

        const material =
          ring.material

        if (
          material instanceof
          THREE.MeshBasicMaterial
        ) {
          material.opacity =
            0.7 *
            (1 -
              ringProgress)
        }
      }

      // -------------------------------------------------------
      // SECOND RING
      // -------------------------------------------------------

      const pulseRing =
        marker.getObjectByName(
          'destination-pulse-ring'
        )

      if (pulseRing) {
        const pulseProgress =
          (
            time * 0.32 +
            0.5
          ) % 1

        const scale =
          1 +
          pulseProgress *
          2.2

        pulseRing.scale.set(
          scale,
          scale,
          scale
        )

        const material =
          (
            pulseRing as THREE.Mesh
          ).material

        if (
          material instanceof
          THREE.MeshBasicMaterial
        ) {
          material.opacity =
            0.35 *
            (1 -
              pulseProgress)
        }
      }

      // -------------------------------------------------------
      // BEAM
      // -------------------------------------------------------

      const beam =
        destinationBeamRef.current

      if (beam) {
        const beamPulse =
          0.10 +
          (
            Math.sin(
              time * 3
            ) +
            1
          ) *
          0.035

        const material =
          beam.material

        if (
          material instanceof
          THREE.MeshBasicMaterial
        ) {
          material.opacity =
            beamPulse
        }
      }

      // -------------------------------------------------------
      // LABEL FLOAT
      // -------------------------------------------------------

      const label =
        destinationLabelRef.current

      if (label) {
        label.position.y =
          DESTINATION_LABEL_HEIGHT +
          Math.sin(
            time * 2
          ) *
          0.045
      }
    }

    // =========================================================
    // DIRECTION HUD
    // =========================================================

    const newDirection =
      calculateCameraDirection()

    if (
      newDirection !==
      currentDirectionRef.current
    ) {
      currentDirectionRef.current =
        newDirection

      setDirection(
        newDirection
      )

      speakDirection(newDirection)
    }
  }

  // ===========================================================
  // INITIALIZATION
  // ===========================================================

  useEffect(() => {
    let disposed = false

    let renderer:
      THREE.WebGLRenderer | null =
      null

    let scene:
      THREE.Scene | null =
      null

    let camera:
      THREE.PerspectiveCamera | null =
      null

    let adapter:
      ThreeAdapter | null =
      null

    let mapSpace:
      MapSpace | null =
      null

    let pathfinder:
      NavMeshPathfinder | null =
      null

    let navigation:
      MultiSetNavigation | null =
      null

    let resizeHandler:
      (() => void) | null =
      null

    // =========================================================
    // INIT
    // =========================================================

    const init = async () => {
      try {
        // =====================================================
        // CONTAINER
        // =====================================================

        if (
          !containerRef.current
        ) {
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
        // ENVIRONMENT
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

        scene.background =
          null

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

        cameraRef.current =
          camera

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
        // LOAD NAVMESH
        // =====================================================

        setStatus(
          'Loading NavMesh...'
        )

        const loader =
          new GLTFLoader()

        const gltf =
          await loader.loadAsync(
            '/navigation/uttarahalli-final-glb.glb'
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
        // ADAPTER
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
                updateNavigationAnimation(
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
                  'Ready'
                )
              },
          })

        adapterRef.current =
          adapter

        // =====================================================
        // MAP SPACE CONNECT
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
          await MultiSetNavigation.create({
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
              '[Kokarya] PATH UPDATED'
            )

            console.log(
              '[Kokarya] Corners:',
              corners
            )

            console.log(
              '[Kokarya] Distance:',
              remainingDistance
            )

            setDistance(
              remainingDistance
            )

            if (navigationActiveRef.current) {
              speakDistance(remainingDistance)
            }

            if (
              !navigationActiveRef.current
            ) {
              return
            }

            if (
              corners.length < 2
            ) {
              clearNavigationVisual()

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
              '[Kokarya] Exact AR route rendered'
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

            setDirection(
              'none'
            )

            currentDirectionRef.current =
              'none'

            setStatus(
              `Arrived at ${poi.name}`
            )

            setArrivedMessage(
              `You have arrived at ${poi.name}`
            )

            speak(
              `You have arrived at ${poi.name}.`,
              true
            )

            /*
             * Keep destination marker
             * briefly after arrival.
             */
            setTimeout(() => {
              if (disposed) {
                return
              }

              clearNavigationVisual()

              setPathVisible(
                false
              )

              setArrivedMessage(
                ''
              )

              setSelectedDestination(
                ''
              )

              selectedDestinationRef.current =
                ''
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

            setDirection(
              'none'
            )

            setStatus(
              `No route to ${poi.name}`
            )

            speak(
              `There is no route to ${poi.name}.`,
              true
            )

            setPathVisible(
              false
            )

            clearNavigationVisual()
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

      if (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window
      ) {
        window.speechSynthesis.cancel()
      }

      navigationActiveRef.current =
        false

      if (resizeHandler) {
        window.removeEventListener(
          'resize',
          resizeHandler
        )
      }

      clearNavigationVisual()

      try {
        adapter?.dispose()
      } catch { }

      try {
        pathfinder?.dispose()
      } catch { }

      try {
        mapSpace?.dispose()
      } catch { }

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

      cameraRef.current =
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
      '[Kokarya] Starting navigation:',
      destination.name
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

    setDirection(
      'none'
    )

    currentDirectionRef.current =
      'none'

    lastSpokenDirectionRef.current =
      'none'
    lastVoiceTimeRef.current = 0
    spokenDistanceMilestonesRef.current = []

    navigationActiveRef.current =
      true

    animationTimeRef.current =
      0

    arrowOffsetRef.current =
      0

    setStatus(
      `Navigating to ${destination.name}`
    )

    speak(
      `Navigation started. Head towards ${destination.name}.`,
      true
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

    setDirection(
      'none'
    )

    currentDirectionRef.current =
      'none'

    setPathVisible(
      false
    )

    setArrivedMessage(
      ''
    )

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

    setStatus(
      localized
        ? 'Ready'
        : 'Localizing...'
    )
  }

  // ===========================================================
  // DIRECTION UI
  // ===========================================================

  const renderDirectionHud = () => {
    if (
      !isNavigating ||
      direction === 'none'
    ) {
      return null
    }

    if (
      direction === 'straight'
    ) {
      return (
        <div
          className="
            pointer-events-none
            fixed
            left-1/2
            top-20
            z-40
            -translate-x-1/2
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              rounded-full
              border
              border-cyan-300/20
              bg-black/65
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-xl
              backdrop-blur-xl
            "
          >
            <ChevronUp
              className="
                h-5
                w-5
                text-cyan-300
              "
            />

            Go straight
          </div>
        </div>
      )
    }

    if (
      direction === 'left'
    ) {
      return (
        <div
          className="
            pointer-events-none
            fixed
            left-1/2
            top-20
            z-40
            -translate-x-1/2
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              rounded-full
              border
              border-cyan-300/20
              bg-black/65
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-xl
              backdrop-blur-xl
            "
          >
            <ArrowLeft
              className="
                h-5
                w-5
                text-cyan-300
              "
            />

            Turn left
          </div>
        </div>
      )
    }

    if (
      direction === 'right'
    ) {
      return (
        <div
          className="
            pointer-events-none
            fixed
            left-1/2
            top-20
            z-40
            -translate-x-1/2
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              rounded-full
              border
              border-cyan-300/20
              bg-black/65
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-xl
              backdrop-blur-xl
            "
          >
            <ArrowRight
              className="
                h-5
                w-5
                text-cyan-300
              "
            />

            Turn right
          </div>
        </div>
      )
    }

    return (
      <div
        className="
          pointer-events-none
          fixed
          left-1/2
          top-20
          z-40
          -translate-x-1/2
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
            rounded-full
            border
            border-amber-300/25
            bg-black/70
            px-4
            py-2.5
            text-sm
            font-semibold
            text-white
            shadow-xl
            backdrop-blur-xl
          "
        >
          <RotateCcw
            className="
              h-5
              w-5
              text-amber-300
            "
          />

          Turn around
        </div>
      </div>
    )
  }

  // ===========================================================
  // DESTINATION DRAWER
  // ===========================================================

  const DestinationDrawer =
    () => {
      return (
        <Drawer>
          <DrawerTrigger

          >
            <Button
              disabled={!localized}
              className="
                h-12
                rounded-full
                bg-black/80
                px-7
                text-sm
                font-semibold
                text-white
                shadow-2xl
                backdrop-blur-xl
                hover:bg-black/90
              "
            >
              <MapPin
                className="
                  mr-2
                  h-4
                  w-4
                "
              />

              Choose destination
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
                  Select a destination to
                  start AR navigation.
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
                  (
                    destination
                  ) => (
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
                        <div
                          className="
                            mr-3
                            flex
                            h-10
                            w-10
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            bg-red-50
                            dark:bg-red-950/40
                          "
                        >
                          <MapPin
                            className="
                              h-5
                              w-5
                              text-red-500
                            "
                          />
                        </div>

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
                <DrawerClose

                >
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
          AR CANVAS
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
          TOP STATUS
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
            flex
            items-center
            gap-2
            rounded-full
            border
            border-white/15
            bg-black/65
            px-4
            py-2
            text-sm
            text-white
            shadow-xl
            backdrop-blur-xl
          "
        >
          <span
            className={`
              h-2
              w-2
              rounded-full
              ${localized
                ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                : 'bg-yellow-400'
              }
            `}
          />

          {isNavigating &&
            selectedDestinationObject
            ? selectedDestinationObject.name
            : localized
              ? 'Ready'
              : 'Localizing...'}
        </div>
      </div>

      {/* =====================================================
          DIRECTION HUD
      ===================================================== */}

      {renderDirectionHud()}

      {/* =====================================================
          VOICE CONTROL
      ===================================================== */}

      {isNavigating && (
        <div
          className="
            fixed
            right-4
            top-20
            z-50
          "
        >
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
            className="
              h-11
              w-11
              rounded-full
              border
              border-white/15
              bg-black/70
              text-white
              shadow-xl
              backdrop-blur-xl
              hover:bg-black/80
            "
          >
            {voiceEnabled ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
          </Button>
        </div>
      )}

      {/* =====================================================
          DESTINATION DISTANCE
      ===================================================== */}

      {isNavigating &&
        distance !== null &&
        selectedDestinationObject && (
          <div
            className="
              pointer-events-none
              fixed
              bottom-24
              left-1/2
              z-30
              -translate-x-1/2
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                rounded-full
                border
                border-white/10
                bg-black/70
                px-4
                py-2
                text-xs
                text-white
                shadow-xl
                backdrop-blur-xl
              "
            >
              <LocateFixed
                className="
                  h-4
                  w-4
                  text-cyan-300
                "
              />

              {distance.toFixed(
                1
              )}{' '}
              m to{' '}
              {
                selectedDestinationObject.name
              }
            </div>
          </div>
        )}

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
            Stop navigation
          </Button>
        </div>
      )}

      {/* =====================================================
          ARRIVAL
      ===================================================== */}

      {arrivedMessage && (
        <div
          className="
            fixed
            left-1/2
            top-1/2
            z-[60]
            -translate-x-1/2
            -translate-y-1/2
            rounded-3xl
            border
            border-white/10
            bg-black/85
            px-7
            py-6
            text-center
            text-white
            shadow-2xl
            backdrop-blur-xl
          "
        >
          <div
            className="
              mb-2
              text-4xl
              text-emerald-400
            "
          >
            ✓
          </div>

          <div
            className="
              text-base
              font-semibold
            "
          >
            Arrived
          </div>

          <div
            className="
              mt-1
              text-sm
              text-white/60
            "
          >
            {
              selectedDestinationObject?.name
            }
          </div>
        </div>
      )}
    </main>
  )
}