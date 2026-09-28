import * as THREE from 'three'

export type NavigationNode = {
  id: string
  name: string
  position: THREE.Vector3
  neighbors: string[]
}

export type NavigationPath = {
  nodeIds: string[]
  points: THREE.Vector3[]
  distance: number
}

/**
 * Navigation graph
 *
 * These positions are in the same MultiSet map coordinate
 * system as the destination coordinates.
 *
 * Current graph:
 *
 * Entrance
 *    ├── Pantry
 *    └── Cabin 1
 *          │
 *        Cabin 2
 *          │
 *      Meeting Room
 */
const nodes: NavigationNode[] = [
  {
    id: 'entrance',
    name: 'Entrance',
    position: new THREE.Vector3(
      -0.149,
      -0.543,
      1.201
    ),
    neighbors: [
      'pantry',
      'cabin-1',
    ],
  },

  {
    id: 'pantry',
    name: 'Pantry',
    position: new THREE.Vector3(
      0.607,
      -0.493,
      6.68
    ),
    neighbors: [
      'entrance',
    ],
  },

  {
    id: 'cabin-1',
    name: 'Cabin 1',
    position: new THREE.Vector3(
      4.758,
      -0.47,
      1.897
    ),
    neighbors: [
      'entrance',
      'cabin-2',
    ],
  },

  {
    id: 'cabin-2',
    name: 'Cabin 2',
    position: new THREE.Vector3(
      8.962,
      -0.488,
      1.736
    ),
    neighbors: [
      'cabin-1',
      'meeting-room',
    ],
  },

  {
    id: 'meeting-room',
    name: 'Meeting Room',
    position: new THREE.Vector3(
      11.588,
      -0.468,
      1.757
    ),
    neighbors: [
      'cabin-2',
    ],
  },
]

function getNode(
  id: string
): NavigationNode | undefined {
  return nodes.find(
    node => node.id === id
  )
}

function getNearestNode(
  position: THREE.Vector3
): NavigationNode {
  let nearestNode = nodes[0]
  let nearestDistance = Infinity

  for (const node of nodes) {
    const currentDistance =
      position.distanceTo(
        node.position
      )

    if (
      currentDistance <
      nearestDistance
    ) {
      nearestDistance =
        currentDistance

      nearestNode = node
    }
  }

  return nearestNode
}

function heuristic(
  a: NavigationNode,
  b: NavigationNode
): number {
  return a.position.distanceTo(
    b.position
  )
}

/**
 * A* path finder
 */
export function findPath(
  currentPosition: THREE.Vector3,
  destinationId: string
): NavigationPath | null {
  const destination =
    getNode(destinationId)

  if (!destination) {
    console.error(
      'Destination not found:',
      destinationId
    )

    return null
  }

  const startNode =
    getNearestNode(
      currentPosition
    )

  console.log(
    'Nearest navigation node:',
    startNode.name
  )

  console.log(
    'Destination node:',
    destination.name
  )

  /**
   * Already at destination.
   */
  if (
    startNode.id ===
    destination.id
  ) {
    const points = [
      currentPosition.clone(),
      destination.position.clone(),
    ]

    return {
      nodeIds: [
        startNode.id,
      ],
      points,
      distance:
        currentPosition.distanceTo(
          destination.position
        ),
    }
  }

  const openSet =
    new Set<string>()

  const cameFrom =
    new Map<
      string,
      string
    >()

  const gScore =
    new Map<
      string,
      number
    >()

  const fScore =
    new Map<
      string,
      number
    >()

  /**
   * Initialize scores.
   */
  for (const node of nodes) {
    gScore.set(
      node.id,
      Infinity
    )

    fScore.set(
      node.id,
      Infinity
    )
  }

  gScore.set(
    startNode.id,
    0
  )

  fScore.set(
    startNode.id,
    heuristic(
      startNode,
      destination
    )
  )

  openSet.add(
    startNode.id
  )

  while (
    openSet.size > 0
  ) {
    let currentId:
      | string
      | null = null

    let lowestScore =
      Infinity

    /**
     * Find node with lowest fScore.
     */
    for (
      const nodeId of openSet
    ) {
      const score =
        fScore.get(
          nodeId
        ) ?? Infinity

      if (
        score <
        lowestScore
      ) {
        lowestScore =
          score

        currentId =
          nodeId
      }
    }

    if (!currentId) {
      break
    }

    /**
     * Destination reached.
     */
    if (
      currentId ===
      destination.id
    ) {
      const nodeIds:
        string[] = []

      let current:
        | string
        | undefined =
        currentId

      while (
        current
      ) {
        nodeIds.unshift(
          current
        )

        current =
          cameFrom.get(
            current
          )
      }

      /**
       * Build actual path points.
       *
       * First point is the
       * current device position.
       */
      const points:
        THREE.Vector3[] = [
          currentPosition.clone(),
        ]

      for (
        const nodeId of nodeIds
      ) {
        const node =
          getNode(
            nodeId
          )

        if (node) {
          points.push(
            node.position.clone()
          )
        }
      }

      /**
       * Calculate total distance.
       */
      let totalDistance =
        0

      for (
        let i = 1;
        i < points.length;
        i++
      ) {
        totalDistance +=
          points[
            i - 1
          ].distanceTo(
            points[i]
          )
      }

      return {
        nodeIds,
        points,
        distance:
          totalDistance,
      }
    }

    openSet.delete(
      currentId
    )

    const currentNode =
      getNode(
        currentId
      )

    if (!currentNode) {
      continue
    }

    /**
     * Check neighbours.
     */
    for (
      const neighborId of
        currentNode.neighbors
    ) {
      const neighbor =
        getNode(
          neighborId
        )

      if (!neighbor) {
        continue
      }

      const distanceToNeighbor =
        currentNode.position.distanceTo(
          neighbor.position
        )

      const tentativeGScore =
        (
          gScore.get(
            currentId
          ) ?? Infinity
        ) +
        distanceToNeighbor

      if (
        tentativeGScore <
        (
          gScore.get(
            neighborId
          ) ?? Infinity
        )
      ) {
        cameFrom.set(
          neighborId,
          currentId
        )

        gScore.set(
          neighborId,
          tentativeGScore
        )

        fScore.set(
          neighborId,
          tentativeGScore +
            heuristic(
              neighbor,
              destination
            )
        )

        openSet.add(
          neighborId
        )
      }
    }
  }

  /**
   * No path.
   */
  return null
}

export function getNavigationNodes() {
  return nodes
}