import * as THREE from 'three'


// ============================================================
// OPTIONS
// ============================================================

export interface ArrowPathOptions {

  color?: number

  arrowCount?: number

  spacing?: number

  groundY?: number

  arrowHeight?: number

  arrowScale?: number

}


// ============================================================
// ANIMATED ARROW PATH
// ============================================================

export class AnimatedArrowPath {

  public group: THREE.Group


  private arrows: THREE.Group[] = []

  private clock =
    new THREE.Clock()


  private color: number

  private arrowCount: number

  private spacing: number

  private groundY: number

  private arrowHeight: number

  private arrowScale: number


  // ==========================================================
  // CONSTRUCTOR
  // ==========================================================

  constructor(
    options: ArrowPathOptions = {}
  ) {

    this.group =
      new THREE.Group()


    this.color =
      options.color ??
      0x7c3aed


    this.arrowCount =
      options.arrowCount ??
      18


    this.spacing =
      options.spacing ??
      0.65


    this.groundY =
      options.groundY ??
      0


    this.arrowHeight =
      options.arrowHeight ??
      0.025


    this.arrowScale =
      options.arrowScale ??
      0.55


    this.createArrows()
  }


  // ==========================================================
  // CREATE ALL ARROWS
  // ==========================================================

  private createArrows() {

    for (
      let index = 0;
      index < this.arrowCount;
      index++
    ) {

      const arrow =
        this.createArrow()


      /*
       * Arrow path runs in LOCAL +Z.
       *
       * The first arrow is close to
       * the user.
       */

      arrow.position.set(
        0,
        0,
        index * this.spacing
      )


      arrow.scale.setScalar(
        this.arrowScale
      )


      this.group.add(
        arrow
      )


      this.arrows.push(
        arrow
      )
    }
  }


  // ==========================================================
  // CREATE ONE ARROW
  // ==========================================================

  private createArrow():
    THREE.Group {

    const group =
      new THREE.Group()


    // ========================================================
    // MAIN ARROW SHAPE
    // ========================================================

    const shape =
      new THREE.Shape()


    /*
     * IMPORTANT
     *
     * Shape initially exists in XY.
     *
     * The point is toward +Y.
     *
     * After rotation onto the floor,
     * the point becomes +Z.
     */

    shape.moveTo(
      -0.16,
      0
    )

    shape.lineTo(
      0.16,
      0
    )


    // Arrow body

    shape.lineTo(
      0.16,
      0.50
    )


    // Arrow head left/right

    shape.lineTo(
      0.38,
      0.50
    )


    // SHARP POINT

    shape.lineTo(
      0,
      0.98
    )


    shape.lineTo(
      -0.38,
      0.50
    )


    shape.lineTo(
      -0.16,
      0.50
    )


    shape.closePath()


    // ========================================================
    // MAIN ARROW
    // ========================================================

    const geometry =
      new THREE.ShapeGeometry(
        shape
      )


    const material =
      new THREE.MeshBasicMaterial({
        color:
          this.color,

        transparent:
          true,

        opacity:
          0.95,

        side:
          THREE.DoubleSide,

        depthWrite:
          false,

        depthTest:
          true,
      })


    const mesh =
      new THREE.Mesh(
        geometry,
        material
      )


    /*
     * Shape is XY.
     *
     * Rotate it onto XZ floor.
     *
     * IMPORTANT:
     *
     * +Y from the shape becomes +Z.
     *
     * Therefore the sharp point
     * faces +Z.
     */

    mesh.rotation.x =
      Math.PI / 2


    /*
     * VERY small Y offset.
     *
     * This prevents z-fighting.
     *
     * It does NOT make the arrow
     * visibly float.
     */

    mesh.position.y =
      this.arrowHeight


    group.add(
      mesh
    )


    // ========================================================
    // DOUBLE BORDER
    // ========================================================

    const borderMaterial =
      new THREE.LineBasicMaterial({

        color:
          0xffffff,

        transparent:
          true,

        opacity:
          0.65,

        depthWrite:
          false,
      })


    // --------------------------------------------------------
    // OUTER BORDER
    // --------------------------------------------------------

    const outerPoints =
      this.createArrowOutline(
        1.12
      )


    const outerGeometry =
      new THREE.BufferGeometry().setFromPoints(
        outerPoints
      )


    const outerBorder =
      new THREE.LineLoop(
        outerGeometry,
        borderMaterial.clone()
      )


    outerBorder.rotation.x =
      Math.PI / 2


    outerBorder.position.y =
      this.arrowHeight +
      0.004


    group.add(
      outerBorder
    )


    // --------------------------------------------------------
    // INNER BORDER
    // --------------------------------------------------------

    const innerPoints =
      this.createArrowOutline(
        0.96
      )


    const innerGeometry =
      new THREE.BufferGeometry().setFromPoints(
        innerPoints
      )


    const innerBorder =
      new THREE.LineLoop(
        innerGeometry,
        borderMaterial.clone()
      )


    innerBorder.rotation.x =
      Math.PI / 2


    innerBorder.position.y =
      this.arrowHeight +
      0.006


    group.add(
      innerBorder
    )


    return group
  }


  // ==========================================================
  // CREATE ARROW OUTLINE
  // ==========================================================

  private createArrowOutline(
    scale: number
  ): THREE.Vector3[] {

    /*
     * Outline is created in XY.
     *
     * It is then rotated onto floor.
     */

    return [

      new THREE.Vector3(
        -0.16 * scale,
        0,
        0
      ),

      new THREE.Vector3(
        0.16 * scale,
        0,
        0
      ),

      new THREE.Vector3(
        0.16 * scale,
        0,
        0.50 * scale
      ),

      new THREE.Vector3(
        0.38 * scale,
        0,
        0.50 * scale
      ),

      // SHARP POINT

      new THREE.Vector3(
        0,
        0,
        0.98 * scale
      ),

      new THREE.Vector3(
        -0.38 * scale,
        0,
        0.50 * scale
      ),

      new THREE.Vector3(
        -0.16 * scale,
        0,
        0.50 * scale
      ),
    ]
  }


  // ==========================================================
  // SET PATH
  // ==========================================================

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


    /*
     * Ignore vertical difference.
     *
     * Indoor navigation happens
     * on the floor.
     */

    direction.y = 0


    if (
      direction.lengthSq() <
      0.000001
    ) {

      return
    }


    direction.normalize()


    /*
     * Our arrow points toward
     * LOCAL +Z.
     *
     * Rotate +Z toward destination.
     */

    const angle =
      Math.atan2(
        direction.x,
        direction.z
      )


    /*
     * Position arrow path
     * at current user location.
     */

    this.group.position.set(
      start.x,
      this.groundY,
      start.z
    )


    /*
     * Rotate path toward destination.
     */

    this.group.rotation.set(
      0,
      angle,
      0
    )
  }


  // ==========================================================
  // SET GROUND LEVEL
  // ==========================================================

  public setGroundY(
    groundY: number
  ) {

    this.groundY =
      groundY


    this.group.position.y =
      groundY
  }


  // ==========================================================
  // SHOW
  // ==========================================================

  public show() {

    this.group.visible =
      true
  }


  // ==========================================================
  // HIDE
  // ==========================================================

  public hide() {

    this.group.visible =
      false
  }


  // ==========================================================
  // UPDATE ANIMATION
  // ==========================================================

  public update() {

    const elapsed =
      this.clock.getElapsedTime()


    this.arrows.forEach(
      (
        arrow,
        index
      ) => {

        /*
         * Flow animation.
         */

        const progress =
          (
            elapsed * 0.9 +
            index * 0.12
          ) % 1


        /*
         * Fade.
         */

        const mesh =
          arrow.children[0] as THREE.Mesh


        if (mesh) {

          const material =
            mesh.material as
              THREE.MeshBasicMaterial


          material.opacity =
            0.25 +
            0.70 *
              (
                1 -
                progress
              )
        }


        /*
         * Move arrows forward.
         *
         * +Z = destination direction.
         */

        arrow.position.z =
          index *
            this.spacing -
          progress *
            0.28


        /*
         * IMPORTANT:
         *
         * Never animate Y.
         *
         * This keeps arrows
         * on the ground.
         */

        arrow.position.y =
          0
      }
    )
  }


  // ==========================================================
  // DISPOSE
  // ==========================================================

  public dispose() {

    this.arrows.forEach(
      arrow => {

        arrow.traverse(
          object => {

            if (
              !(
                object instanceof
                THREE.Mesh
              ) &&
              !(
                object instanceof
                THREE.Line
              )
            ) {
              return
            }


            object.geometry.dispose()


            const material =
              object.material


            if (
              Array.isArray(
                material
              )
            ) {

              material.forEach(
                item =>
                  item.dispose()
              )

            } else {

              material.dispose()
            }
          }
        )
      }
    )


    this.arrows = []


    if (
      this.group.parent
    ) {

      this.group.parent.remove(
        this.group
      )
    }
  }
}