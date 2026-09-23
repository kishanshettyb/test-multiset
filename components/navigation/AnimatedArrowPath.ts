import * as THREE from 'three'

export interface ArrowPathOptions {
  color?: number
  arrowCount?: number
  spacing?: number
  groundOffset?: number
  pathWidth?: number
  arrowWidth?: number
  arrowLength?: number
  animationSpeed?: number
  railOpacity?: number
  arrowOpacity?: number
}

export class AnimatedArrowPath {
  public group: THREE.Group

  private arrows: THREE.Group[] = []
  private arrowMaterials: THREE.MeshBasicMaterial[] = []

  private leftRail: THREE.Line | null = null
  private rightRail: THREE.Line | null = null

  private clock = new THREE.Clock()

  private color: number
  private arrowCount: number
  private spacing: number
  private groundOffset: number
  private pathWidth: number
  private arrowWidth: number
  private arrowLength: number
  private animationSpeed: number
  private railOpacity: number
  private arrowOpacity: number

  constructor(options: ArrowPathOptions = {}) {
    this.group = new THREE.Group()

    this.color = options.color ?? 0x8b7cff

    this.arrowCount = options.arrowCount ?? 16

    this.spacing = options.spacing ?? 0.65

    // Very small offset above floor.
    // Prevents z-fighting without making arrows look elevated.
    this.groundOffset =
      options.groundOffset ?? 0.012

    this.pathWidth =
      options.pathWidth ?? 0.95

    this.arrowWidth =
      options.arrowWidth ?? 0.42

    this.arrowLength =
      options.arrowLength ?? 0.55

    this.animationSpeed =
      options.animationSpeed ?? 0.9

    this.railOpacity =
      options.railOpacity ?? 0.55

    this.arrowOpacity =
      options.arrowOpacity ?? 0.95

    this.createArrows()
  }

  /**
   * Creates all animated arrows.
   *
   * IMPORTANT:
   *
   * Local +Z is ALWAYS the destination direction.
   *
   * The complete group is rotated in setPath()
   * so +Z points toward the destination.
   */
  private createArrows() {
    for (let i = 0; i < this.arrowCount; i++) {
      const arrow = this.createArrow()

      /*
       * First arrow starts at the user.
       *
       * Every following arrow is placed
       * toward +Z.
       */
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
   * Creates one flat arrow on the X/Z floor plane.
   *
   * Arrow direction:
   *
   *             TIP
   *              ↑
   *             / \
   *            /   \
   *           /     \
   *
   *              +Z
   */
  private createArrow(): THREE.Group {
    const group = new THREE.Group()

    const width = this.arrowWidth
    const length = this.arrowLength

    /*
     * We create the arrow directly on the X/Z plane.
     *
     * Y is always 0.
     *
     * Therefore this geometry does NOT need
     * an X rotation.
     */

    const shape = new THREE.Shape()

    /*
     * Arrow starts at the back.
     */
    shape.moveTo(
      -width * 0.30,
      0
    )

    /*
     * Left side of arrow body.
     */
    shape.lineTo(
      -width * 0.30,
      length * 0.42
    )

    /*
     * Left side of arrow head.
     */
    shape.lineTo(
      -width,
      length * 0.42
    )

    /*
     * SHARP TIP.
     *
     * This is +Z.
     */
    shape.lineTo(
      0,
      length
    )

    /*
     * Right side of arrow head.
     */
    shape.lineTo(
      width,
      length * 0.42
    )

    /*
     * Right side of arrow body.
     */
    shape.lineTo(
      width * 0.30,
      length * 0.42
    )

    /*
     * Back to starting point.
     */
    shape.lineTo(
      width * 0.30,
      0
    )

    shape.closePath()

    /*
     * ShapeGeometry is created in XY.
     *
     * We rotate it onto the floor:
     *
     * Three.js:
     *
     * X = horizontal
     * Y = vertical
     * Z = depth
     *
     * After rotation:
     *
     * X/Z = floor
     * Y   = height
     */
    const geometry =
      new THREE.ShapeGeometry(shape)

    geometry.rotateX(
      -Math.PI / 2
    )

    const material =
      new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: this.arrowOpacity,

        side: THREE.DoubleSide,

        /*
         * Prevents the arrow from writing
         * into the depth buffer.
         */
        depthWrite: false,

        /*
         * Still allows the real floor
         * to occlude the arrow.
         */
        depthTest: true,
      })

    const mesh =
      new THREE.Mesh(
        geometry,
        material
      )

    /*
     * VERY IMPORTANT:
     *
     * The arrow itself is only slightly
     * above the floor.
     */
    mesh.position.y =
      this.groundOffset

    group.add(mesh)

    this.arrowMaterials.push(
      material
    )

    return group
  }

  /**
   * Sets the navigation path.
   *
   * start = user's current position
   * end   = selected destination
   */
  public setPath(
    start: THREE.Vector3,
    end: THREE.Vector3
  ) {
    /*
     * Calculate horizontal direction.
     */
    const direction =
      new THREE.Vector3()

    direction.subVectors(
      end,
      start
    )

    /*
     * Ignore vertical difference.
     *
     * Indoor walking navigation
     * should stay on the floor.
     */
    direction.y = 0

    /*
     * No valid path.
     */
    if (
      direction.lengthSq() <
      0.000001
    ) {
      return
    }

    direction.normalize()

    /*
     * Put the complete navigation
     * system exactly where the user is.
     */
    this.group.position.set(
      start.x,
      start.y,
      start.z
    )

    /*
     * +Z is our arrow direction.
     *
     * Rotate +Z toward destination.
     */
    this.group.rotation.y =
      Math.atan2(
        direction.x,
        direction.z
      )

    /*
     * Recreate the two side borders.
     */
    this.createSideRails()
  }

  /**
   * Creates the two blue/purple navigation
   * border lines.
   *
   * They run parallel to the arrows.
   */
  private createSideRails() {
    /*
     * Remove old rails.
     */
    if (this.leftRail) {
      this.disposeRail(
        this.leftRail
      )

      this.group.remove(
        this.leftRail
      )

      this.leftRail = null
    }

    if (this.rightRail) {
      this.disposeRail(
        this.rightRail
      )

      this.group.remove(
        this.rightRail
      )

      this.rightRail = null
    }

    /*
     * Make the rails slightly longer
     * than the arrow sequence.
     */
    const length =
      (this.arrowCount - 1) *
        this.spacing +
      this.arrowLength

    const halfWidth =
      this.pathWidth / 2

    /*
     * Rails are also placed almost
     * exactly on the floor.
     */
    const railY =
      this.groundOffset * 0.7

    /*
     * LEFT RAIL
     */
    const leftGeometry =
      new THREE.BufferGeometry()

    leftGeometry.setFromPoints([
      new THREE.Vector3(
        -halfWidth,
        railY,
        0
      ),

      new THREE.Vector3(
        -halfWidth,
        railY,
        length
      ),
    ])

    const leftMaterial =
      new THREE.LineBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: this.railOpacity,

        depthWrite: false,
        depthTest: true,
      })

    this.leftRail =
      new THREE.Line(
        leftGeometry,
        leftMaterial
      )

    this.leftRail.userData.navigationRail =
      true

    /*
     * RIGHT RAIL
     */
    const rightGeometry =
      new THREE.BufferGeometry()

    rightGeometry.setFromPoints([
      new THREE.Vector3(
        halfWidth,
        railY,
        0
      ),

      new THREE.Vector3(
        halfWidth,
        railY,
        length
      ),
    ])

    const rightMaterial =
      new THREE.LineBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: this.railOpacity,

        depthWrite: false,
        depthTest: true,
      })

    this.rightRail =
      new THREE.Line(
        rightGeometry,
        rightMaterial
      )

    this.rightRail.userData.navigationRail =
      true

    /*
     * Add rails to navigation group.
     */
    this.group.add(
      this.leftRail
    )

    this.group.add(
      this.rightRail
    )
  }

  /**
   * Updates the arrow animation.
   *
   * Arrows move FORWARD toward +Z.
   *
   * They NEVER move vertically.
   */
  public update() {
    const elapsed =
      this.clock.getElapsedTime()

    this.arrows.forEach(
      (arrow, index) => {
        /*
         * Create flowing animation.
         *
         * Each arrow has a small delay
         * from the previous arrow.
         */
        const progress =
          (
            elapsed *
              this.animationSpeed +
            index * 0.18
          ) % 1

        /*
         * Base position of this arrow.
         */
        const baseZ =
          index * this.spacing

        /*
         * Move arrow slightly forward.
         *
         * This creates the flowing
         * navigation effect.
         */
        arrow.position.z =
          baseZ +
          progress * 0.22

        /*
         * NEVER change Y.
         *
         * This guarantees that the
         * arrow stays on the floor.
         */
        arrow.position.y = 0

        /*
         * Fade animation.
         */
        const material =
          this.arrowMaterials[index]

        material.opacity =
          0.30 +
          (1 - progress) *
            0.65

        /*
         * Very subtle scale pulse.
         *
         * No vertical movement.
         */
        const scale =
          0.94 +
          Math.sin(
            progress * Math.PI
          ) *
            0.06

        arrow.scale.setScalar(
          scale
        )
      }
    )
  }

  /**
 * Update the floor height.
 *
 * Use this when MultiSet/map coordinates
 * require a specific Y value for the navigation path.
 */
public setGroundY(groundY: number) {
  this.group.position.y = groundY

  // Keep all arrows at the floor.
  this.arrows.forEach((arrow) => {
    arrow.position.y = 0
  })
}

  /**
   * Show / hide navigation.
   */
  public setVisible(
    visible: boolean
  ) {
    this.group.visible =
      visible
  }

  /**
   * Change arrow color.
   */
  public setColor(
    color: number
  ) {
    this.color = color

    this.arrowMaterials.forEach(
      material => {
        material.color.setHex(
          color
        )
      }
    )

    if (this.leftRail) {
      ;(
        this.leftRail.material as THREE.LineBasicMaterial
      ).color.setHex(color)
    }

    if (this.rightRail) {
      ;(
        this.rightRail.material as THREE.LineBasicMaterial
      ).color.setHex(color)
    }
  }

  /**
   * Dispose all Three.js resources.
   */
  public dispose() {
    /*
     * Dispose arrows.
     */
    this.arrows.forEach(
      arrow => {
        const mesh =
          arrow.children[0] as THREE.Mesh

        if (!mesh) {
          return
        }

        mesh.geometry.dispose()

        const material =
          mesh.material as THREE.Material

        material.dispose()
      }
    )

    this.arrows = []

    this.arrowMaterials = []

    /*
     * Dispose left rail.
     */
    if (this.leftRail) {
      this.disposeRail(
        this.leftRail
      )

      this.leftRail = null
    }

    /*
     * Dispose right rail.
     */
    if (this.rightRail) {
      this.disposeRail(
        this.rightRail
      )

      this.rightRail = null
    }

    /*
     * Remove group from scene.
     */
    if (this.group.parent) {
      this.group.parent.remove(
        this.group
      )
    }
  }

  /**
   * Dispose one rail.
   */
  private disposeRail(
    rail: THREE.Line
  ) {
    rail.geometry.dispose()

    const material =
      rail.material as THREE.Material

    material.dispose()
  }
}