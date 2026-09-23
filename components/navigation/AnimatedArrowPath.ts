import * as THREE from 'three'

export interface ArrowPathOptions {
  color?: number
  arrowCount?: number
  spacing?: number
  groundY?: number

  // Distance between the two side lines
  pathWidth?: number

  // Arrow size
  arrowWidth?: number
  arrowLength?: number

  // Animation
  animationSpeed?: number
  animationDistance?: number
}

export class AnimatedArrowPath {
  public group: THREE.Group

  private arrows: THREE.Group[] = []

  private arrowMaterials: THREE.MeshBasicMaterial[] = []

  private clock = new THREE.Clock()

  private pathLineLeft: THREE.Line | null = null
  private pathLineRight: THREE.Line | null = null

  private color: number
  private arrowCount: number
  private spacing: number
  private groundY: number

  private pathWidth: number
  private arrowWidth: number
  private arrowLength: number

  private animationSpeed: number
  private animationDistance: number

  constructor(options: ArrowPathOptions = {}) {
    this.group = new THREE.Group()

    this.color = options.color ?? 0x8b7cff

    this.arrowCount = options.arrowCount ?? 12

    this.spacing = options.spacing ?? 0.7

    this.groundY = options.groundY ?? 0

    this.pathWidth = options.pathWidth ?? 0.9

    this.arrowWidth = options.arrowWidth ?? 0.42

    this.arrowLength = options.arrowLength ?? 0.55

    this.animationSpeed = options.animationSpeed ?? 0.8

    this.animationDistance =
      options.animationDistance ?? 0.18

    this.createArrows()
  }

  /**
   * Create the animated arrow sequence.
   */
  private createArrows() {
    for (let i = 0; i < this.arrowCount; i++) {
      const arrow = this.createArrow()

      arrow.position.set(
        0,
        0,
        i * this.spacing
      )

      this.group.add(arrow)

      this.arrows.push(arrow)
    }
  }

  /**
   * Creates a flat chevron directly in X/Z.
   *
   * IMPORTANT:
   * +Z = destination direction.
   *
   * This avoids the ShapeGeometry rotation
   * problem that was reversing your arrows.
   */
  private createArrow(): THREE.Group {
    const group = new THREE.Group()

    const w = this.arrowWidth
    const l = this.arrowLength

    const geometry = new THREE.BufferGeometry()

    /**
     * Chevron shape.
     *
     *               +Z
     *                ^
     *
     *              tip
     *               /\
     *              /  \
     *             /    \
     *            /      \
     *
     *       <-- back of arrow -->
     *
     * Sharp point is +Z.
     */

    const vertices = new Float32Array([
      // left wing
      -w,
      0,
      0,

      // tip
      0,
      0,
      l,

      // right wing
      w,
      0,
      0,

      // inner left
      -w * 0.48,
      0,
      0,

      // inner tip
      0,
      0,
      l * 0.58,

      // inner right
      w * 0.48,
      0,
      0,
    ])

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(vertices, 3)
    )

    geometry.setIndex([
      0,
      1,
      3,

      3,
      1,
      4,

      3,
      4,
      5,

      5,
      4,
      2,

      2,
      4,
      1,
    ])

    geometry.computeVertexNormals()

    const material =
      new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,

        /**
         * Prevent the arrow from writing depth
         * and causing ugly floor conflicts.
         */
        depthWrite: false,

        depthTest: true,
      })

    const mesh = new THREE.Mesh(
      geometry,
      material
    )

    /**
     * IMPORTANT:
     *
     * The arrow is already created in X/Z.
     *
     * Therefore:
     *
     * X = horizontal
     * Y = height
     * Z = navigation direction
     *
     * NO rotation.x is required.
     */

    mesh.position.y = 0.025

    group.add(mesh)

    this.arrowMaterials.push(material)

    return group
  }

  /**
   * Set the complete navigation path.
   *
   * start = user's current map position
   * end   = selected destination
   */
  public setPath(
    start: THREE.Vector3,
    end: THREE.Vector3
  ) {
    const direction =
      new THREE.Vector3()

    direction.subVectors(
      end,
      start
    )

    /**
     * Indoor walking happens on X/Z.
     *
     * Ignore vertical difference.
     */
    direction.y = 0

    if (
      direction.lengthSq() <
      0.000001
    ) {
      return
    }

    direction.normalize()

    /**
     * Position path exactly at user's
     * current ground position.
     */
    this.group.position.set(
      start.x,
      this.groundY,
      start.z
    )

    /**
     * +Z of our arrow geometry must point
     * toward destination.
     *
     * atan2(X, Z) gives exactly that.
     */
    this.group.rotation.y =
      Math.atan2(
        direction.x,
        direction.z
      )

    /**
     * Build side boundary lines.
     */
    this.createSideLines()
  }

  /**
   * Creates the two thin navigation rails
   * visible in your reference video.
   */
  private createSideLines() {
    /**
     * Remove old lines.
     */
    if (this.pathLineLeft) {
      this.group.remove(
        this.pathLineLeft
      )

      this.pathLineLeft.geometry.dispose()

      ;(
        this.pathLineLeft
          .material as THREE.Material
      ).dispose()
    }

    if (this.pathLineRight) {
      this.group.remove(
        this.pathLineRight
      )

      this.pathLineRight.geometry.dispose()

      ;(
        this.pathLineRight
          .material as THREE.Material
      ).dispose()
    }

    /**
     * Path length.
     */
    const pathLength =
      Math.max(
        5,
        this.arrowCount *
          this.spacing +
          0.8
      )

    /**
     * Left and right X coordinates.
     */
    const halfWidth =
      this.pathWidth / 2

    /**
     * LEFT LINE
     */
    const leftPoints = [
      new THREE.Vector3(
        -halfWidth,
        0.018,
        0
      ),

      new THREE.Vector3(
        -halfWidth,
        0.018,
        pathLength
      ),
    ]

    /**
     * RIGHT LINE
     */
    const rightPoints = [
      new THREE.Vector3(
        halfWidth,
        0.018,
        0
      ),

      new THREE.Vector3(
        halfWidth,
        0.018,
        pathLength
      ),
    ]

    this.pathLineLeft =
      this.createLine(leftPoints)

    this.pathLineRight =
      this.createLine(rightPoints)

    this.group.add(
      this.pathLineLeft
    )

    this.group.add(
      this.pathLineRight
    )
  }

  /**
   * Create one thin path line.
   */
  private createLine(
    points: THREE.Vector3[]
  ) {
    const geometry =
      new THREE.BufferGeometry().setFromPoints(
        points
      )

    const material =
      new THREE.LineBasicMaterial({
        color: this.color,

        transparent: true,

        opacity: 0.65,
      })

    const line =
      new THREE.Line(
        geometry,
        material
      )

    return line
  }

  /**
   * Update animation every XR frame.
   */
  public update() {
    const elapsed =
      this.clock.getElapsedTime()

    this.arrows.forEach(
      (arrow, index) => {
        /**
         * Create a travelling wave.
         *
         * Each arrow gets a slightly different
         * animation phase.
         */
        const progress =
          (
            elapsed *
              this.animationSpeed +
            index * 0.18
          ) % 1

        /**
         * Animate arrows slightly toward
         * destination (+Z).
         */
        const baseZ =
          index * this.spacing

        arrow.position.z =
          baseZ +
          progress *
            this.animationDistance

        /**
         * Fade animation.
         */
        const material =
          this.arrowMaterials[index]

        material.opacity =
          0.35 +
          (1 - progress) * 0.55

        /**
         * Very subtle scale animation.
         */
        const scale =
          0.92 +
          Math.sin(
            progress * Math.PI
          ) *
            0.12

        arrow.scale.set(
          scale,
          scale,
          scale
        )

        /**
         * IMPORTANT:
         *
         * Never change Y.
         *
         * This keeps the arrow on the floor.
         */
        arrow.position.y = 0
      }
    )
  }

  /**
   * Change floor height.
   */
  public setGroundY(
    groundY: number
  ) {
    this.groundY = groundY

    this.group.position.y =
      groundY
  }

  /**
   * Hide/show path.
   */
  public setVisible(
    visible: boolean
  ) {
    this.group.visible =
      visible
  }

  /**
   * Clean everything.
   */
  public dispose() {
    this.arrows.forEach(
      arrow => {
        const mesh =
          arrow.children[0] as THREE.Mesh

        if (mesh) {
          mesh.geometry.dispose()

          ;(
            mesh.material as THREE.Material
          ).dispose()
        }
      }
    )

    this.arrows = []

    this.arrowMaterials = []

    if (this.pathLineLeft) {
      this.pathLineLeft.geometry.dispose()

      ;(
        this.pathLineLeft
          .material as THREE.Material
      ).dispose()
    }

    if (this.pathLineRight) {
      this.pathLineRight.geometry.dispose()

      ;(
        this.pathLineRight
          .material as THREE.Material
      ).dispose()
    }

    this.pathLineLeft = null

    this.pathLineRight = null

    if (this.group.parent) {
      this.group.parent.remove(
        this.group
      )
    }
  }
}