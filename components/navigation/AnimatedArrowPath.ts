import * as THREE from 'three'

export interface ArrowPathOptions {
  color?: number
  arrowCount?: number
  spacing?: number
  groundY?: number
  arrowHeight?: number
  arrowScale?: number
}

export class AnimatedArrowPath {
  public group: THREE.Group

  private arrows: THREE.Group[] = []

  private clock = new THREE.Clock()

  private color: number
  private arrowCount: number
  private spacing: number
  private groundY: number
  private arrowHeight: number
  private arrowScale: number

  constructor(
    options: ArrowPathOptions = {}
  ) {
    this.group = new THREE.Group()

    this.color =
      options.color ?? 0x7c3aed

    this.arrowCount =
      options.arrowCount ?? 14

    this.spacing =
      options.spacing ?? 0.75

    // MultiSet floor Y.
    this.groundY =
      options.groundY ?? 0

    // Small offset above the floor
    // to prevent z-fighting.
    this.arrowHeight =
      options.arrowHeight ?? 0.025

    this.arrowScale =
      options.arrowScale ?? 0.65

    this.createArrows()
  }

  /**
   * Create all arrows.
   */
  private createArrows() {
    for (
      let i = 0;
      i < this.arrowCount;
      i++
    ) {
      const arrow =
        this.createArrow()

      arrow.position.set(
        0,
        0,
        -i * this.spacing
      )

      arrow.scale.setScalar(
        this.arrowScale
      )

      this.group.add(arrow)

      this.arrows.push(arrow)
    }
  }

  /**
   * Create one flat arrow.
   */
  private createArrow(): THREE.Group {
    const group =
      new THREE.Group()

    const shape =
      new THREE.Shape()

    // Arrow body
    shape.moveTo(-0.16, 0)
    shape.lineTo(0.16, 0)

    shape.lineTo(0.16, 0.55)

    // Arrow head
    shape.lineTo(0.38, 0.55)
    shape.lineTo(0, 0.98)
    shape.lineTo(-0.38, 0.55)

    shape.lineTo(-0.16, 0.55)

    shape.closePath()

    const geometry =
      new THREE.ShapeGeometry(
        shape
      )

    const material =
      new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      })

    const mesh =
      new THREE.Mesh(
        geometry,
        material
      )

    /**
     * ShapeGeometry is created in XY.
     *
     * Rotate onto XZ ground plane.
     */
    mesh.rotation.x =
      -Math.PI / 2

    /**
     * Keep arrow just above
     * the actual floor.
     */
    mesh.position.y =
      this.arrowHeight

    group.add(mesh)

    return group
  }

  /**
   * Set the arrow path from
   * current position to destination.
   */
  public setPath(
    start: THREE.Vector3,
    end: THREE.Vector3
  ) {
    const direction =
      new THREE.Vector3().subVectors(
        end,
        start
      )

    // Ignore height differences.
    direction.y = 0

    if (
      direction.lengthSq() === 0
    ) {
      return
    }

    direction.normalize()

    /**
     * Direction on X/Z plane.
     */
    const angle =
      Math.atan2(
        direction.x,
        direction.z
      )

    /**
     * Start path at user position.
     */
    this.group.position.set(
      start.x,
      this.groundY,
      start.z
    )

    /**
     * Point arrows toward destination.
     */
    this.group.rotation.y =
      angle

    /**
     * Force ground level.
     */
    this.group.position.y =
      this.groundY
  }

  /**
   * Update floor height.
   */
  public setGroundY(
    groundY: number
  ) {
    this.groundY = groundY

    this.group.position.y =
      groundY
  }

  /**
   * Animate arrows.
   */
  public update() {
    const elapsed =
      this.clock.getElapsedTime()

    this.arrows.forEach(
      (arrow, index) => {
        const progress =
          (
            elapsed * 0.8 +
            index * 0.18
          ) % 1

        const mesh =
          arrow.children[0] as THREE.Mesh

        const material =
          mesh.material as THREE.MeshBasicMaterial

        /**
         * Fade animation.
         */
        material.opacity =
          0.25 +
          0.7 *
            (1 - progress)

        /**
         * Move slightly forward.
         */
        arrow.position.z =
          -index * this.spacing +
          progress * 0.25

        /**
         * NEVER change Y here.
         *
         * This keeps the arrows
         * at ground level.
         */
        arrow.position.y = 0
      }
    )
  }

  /**
   * Remove Three.js resources.
   */
  public dispose() {
    this.arrows.forEach(
      arrow => {
        const mesh =
          arrow.children[0] as THREE.Mesh

        mesh.geometry.dispose()

        const material =
          mesh.material as THREE.Material

        material.dispose()
      }
    )

    this.arrows = []

    if (this.group.parent) {
      this.group.parent.remove(
        this.group
      )
    }
  }
}