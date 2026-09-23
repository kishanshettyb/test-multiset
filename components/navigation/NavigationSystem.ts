import * as THREE from 'three'
import type { Destination } from './types'

export class NavigationSystem {
  private scene: THREE.Scene

  private root: THREE.Group

  private arrowGroup: THREE.Group

  private destinationGroup: THREE.Group

  private boardGroup: THREE.Group

  private completionGroup: THREE.Group

  private destination: Destination | null = null

  private destinationWorldPosition =
    new THREE.Vector3()

  private arrows: THREE.Group[] = []

  private clock = new THREE.Clock()

  private completed = false

  private readonly reachDistance = 0.7

  constructor(scene: THREE.Scene) {
    this.scene = scene

    this.root = new THREE.Group()

    this.arrowGroup = new THREE.Group()

    this.destinationGroup =
      new THREE.Group()

    this.boardGroup =
      new THREE.Group()

    this.completionGroup =
      new THREE.Group()

    this.root.add(this.arrowGroup)
    this.root.add(this.destinationGroup)
    this.root.add(this.boardGroup)
    this.root.add(this.completionGroup)

    this.scene.add(this.root)
  }

  // ------------------------------------------------
  // SET DESTINATION
  // ------------------------------------------------

  setDestination(
    destination: Destination,
    worldFromMap: THREE.Matrix4
  ) {
    this.destination = destination

    this.completed = false

    this.clear()

    this.destinationWorldPosition
      .copy(destination.position)
      .applyMatrix4(worldFromMap)

    this.createDestinationMarker()

    this.createDestinationBoard(
      destination.name
    )
  }

  // ------------------------------------------------
  // CLEAR
  // ------------------------------------------------

  clear() {
    this.clearGroup(this.arrowGroup)

    this.clearGroup(
      this.destinationGroup
    )

    this.clearGroup(this.boardGroup)

    this.clearGroup(
      this.completionGroup
    )

    this.arrows = []
  }

  private clearGroup(
    group: THREE.Group
  ) {
    while (group.children.length) {
      const child = group.children[0]

      group.remove(child)

      child.traverse((object) => {
        const mesh =
          object as THREE.Mesh

        if (mesh.geometry) {
          mesh.geometry.dispose()
        }

        if (mesh.material) {
          const material =
            mesh.material as THREE.Material

          material.dispose()
        }
      })
    }
  }

  // ------------------------------------------------
  // CREATE DESTINATION MARKER
  // ------------------------------------------------

  private createDestinationMarker() {
    const group =
      new THREE.Group()

    group.position.copy(
      this.destinationWorldPosition
    )

    // -----------------------------
    // Outer ring
    // -----------------------------

    const ringGeometry =
      new THREE.RingGeometry(
        0.35,
        0.43,
        48
      )

    const ringMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      })

    const ring =
      new THREE.Mesh(
        ringGeometry,
        ringMaterial
      )

    ring.rotation.x =
      -Math.PI / 2

    group.add(ring)

    // -----------------------------
    // Inner circle
    // -----------------------------

    const circleGeometry =
      new THREE.CircleGeometry(
        0.20,
        32
      )

    const circleMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      })

    const circle =
      new THREE.Mesh(
        circleGeometry,
        circleMaterial
      )

    circle.rotation.x =
      -Math.PI / 2

    circle.position.y =
      0.02

    group.add(circle)

    // -----------------------------
    // Vertical beacon
    // -----------------------------

    const beaconGeometry =
      new THREE.CylinderGeometry(
        0.035,
        0.035,
        1.2,
        12
      )

    const beaconMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x7c3aed,
        transparent: true,
        opacity: 0.65,
      })

    const beacon =
      new THREE.Mesh(
        beaconGeometry,
        beaconMaterial
      )

    beacon.position.y =
      0.6

    group.add(beacon)

    // -----------------------------
    // Point
    // -----------------------------

    const pointGeometry =
      new THREE.SphereGeometry(
        0.10,
        20,
        20
      )

    const pointMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
      })

    const point =
      new THREE.Mesh(
        pointGeometry,
        pointMaterial
      )

    point.position.y =
      1.2

    group.add(point)

    this.destinationGroup.add(group)
  }

  // ------------------------------------------------
  // DESTINATION BOARD
  // ------------------------------------------------

  private createDestinationBoard(
    name: string
  ) {
    const canvas =
      document.createElement('canvas')

    canvas.width = 512
    canvas.height = 160

    const context =
      canvas.getContext('2d')

    if (!context) return

    // Background

    context.fillStyle =
      'rgba(20, 10, 40, 0.92)'

    context.roundRect(
      10,
      10,
      492,
      140,
      28
    )

    context.fill()

    // Accent

    context.fillStyle =
      '#8b5cf6'

    context.roundRect(
      10,
      10,
      14,
      140,
      7
    )

    context.fill()

    // Text

    context.fillStyle =
      '#ffffff'

    context.font =
      'bold 48px Arial'

    context.textAlign =
      'center'

    context.textBaseline =
      'middle'

    context.fillText(
      name,
      270,
      80
    )

    const texture =
      new THREE.CanvasTexture(canvas)

    texture.colorSpace =
      THREE.SRGBColorSpace

    const material =
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      })

    const sprite =
      new THREE.Sprite(material)

    sprite.scale.set(
      1.8,
      0.56,
      1
    )

    sprite.position.copy(
      this.destinationWorldPosition
    )

    sprite.position.y +=
      1.8

    this.boardGroup.add(sprite)
  }

  // ------------------------------------------------
  // CREATE ARROWS
  // ------------------------------------------------

  createRoute(
    currentWorldPosition: THREE.Vector3
  ) {
    if (!this.destination) return

    this.clearGroup(
      this.arrowGroup
    )

    this.arrows = []

    const start =
      currentWorldPosition.clone()

    const end =
      this.destinationWorldPosition.clone()

    // Keep arrows on approximately
    // the floor level.

    const floorY =
      start.y - 1.2

    start.y = floorY
    end.y = floorY

    const direction =
      new THREE.Vector3()
        .subVectors(end, start)

    const distance =
      direction.length()

    if (distance < 0.1) return

    direction.normalize()

    const spacing = 0.65

    const count =
      Math.floor(
        distance / spacing
      )

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const position =
        start.clone().add(
          direction.clone().multiplyScalar(
            i * spacing
          )
        )

      const arrow =
        this.createArrow()

      arrow.position.copy(
        position
      )

      // Point toward destination

      const angle =
        Math.atan2(
          direction.x,
          direction.z
        )

      arrow.rotation.y =
        angle

      // Store animation offset

      arrow.userData.index = i

      this.arrowGroup.add(arrow)

      this.arrows.push(arrow)
    }
  }

  // ------------------------------------------------
  // ARROW
  // ------------------------------------------------

  private createArrow() {
    const group =
      new THREE.Group()

    // Arrow shaft

    const shaftGeometry =
      new THREE.BoxGeometry(
        0.12,
        0.035,
        0.35
      )

    const material =
      new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.9,
      })

    const shaft =
      new THREE.Mesh(
        shaftGeometry,
        material
      )

    group.add(shaft)

    // Arrow head

    const headGeometry =
      new THREE.ConeGeometry(
        0.15,
        0.25,
        4
      )

    const head =
      new THREE.Mesh(
        headGeometry,
        material.clone()
      )

    head.rotation.x =
      Math.PI / 2

    head.position.z =
      0.28

    group.add(head)

    return group
  }

  // ------------------------------------------------
  // UPDATE
  // ------------------------------------------------

  update(
    cameraWorldPosition: THREE.Vector3
  ) {
    if (!this.destination) {
      return {
        distance: 0,
        reached: false,
      }
    }

    const distance =
      cameraWorldPosition.distanceTo(
        this.destinationWorldPosition
      )

    // Animate arrows

    const elapsed =
      this.clock.getElapsedTime()

    this.arrows.forEach(
      (arrow, index) => {
        const wave =
          Math.sin(
            elapsed * 4 -
              index * 0.45
          )

        arrow.position.y +=
          wave * 0.002

        const scale =
          1 +
          Math.max(0, wave) * 0.15

        arrow.scale.set(
          scale,
          scale,
          scale
        )
      }
    )

    // Animate destination marker

    const marker =
      this.destinationGroup
        .children[0]

    if (marker) {
      const pulse =
        1 +
        Math.sin(
          elapsed * 3
        ) *
          0.12

      marker.scale.set(
        pulse,
        pulse,
        pulse
      )
    }

    // Destination reached

    if (
      distance <=
        this.reachDistance &&
      !this.completed
    ) {
      this.completed = true

      this.playCompletionAnimation()
    }

    return {
      distance,
      reached: this.completed,
    }
  }

  // ------------------------------------------------
  // COMPLETION ANIMATION
  // ------------------------------------------------

  private playCompletionAnimation() {
    const group =
      new THREE.Group()

    group.position.copy(
      this.destinationWorldPosition
    )

    const geometry =
      new THREE.RingGeometry(
        0.15,
        0.22,
        48
      )

    const material =
      new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
      })

    const ring =
      new THREE.Mesh(
        geometry,
        material
      )

    ring.rotation.x =
      -Math.PI / 2

    group.add(ring)

    group.userData.startTime =
      this.clock.getElapsedTime()

    this.completionGroup.add(group)

    // Hide navigation arrows

    this.arrowGroup.visible =
      false

    // Animate completion

    const animate = () => {
      const elapsed =
        this.clock.getElapsedTime() -
        group.userData.startTime

      const progress =
        Math.min(
          elapsed / 1.2,
          1
        )

      const scale =
        1 + progress * 5

      ring.scale.set(
        scale,
        scale,
        scale
      )

      material.opacity =
        1 - progress

      if (progress < 1) {
        requestAnimationFrame(
          animate
        )
      } else {
        this.completionGroup.remove(
          group
        )

        geometry.dispose()
        material.dispose()
      }
    }

    animate()
  }

  // ------------------------------------------------
  // GET DESTINATION
  // ------------------------------------------------

  getDestination() {
    return this.destination
  }

  // ------------------------------------------------
  // GET WORLD POSITION
  // ------------------------------------------------

  getDestinationWorldPosition() {
    return this.destinationWorldPosition
  }

  // ------------------------------------------------
  // DISPOSE
  // ------------------------------------------------

  dispose() {
    this.clear()

    this.scene.remove(
      this.root
    )
  }
}