import * as THREE from 'three'

export type Destination = {
  id: string
  name: string
  position: THREE.Vector3
}

export type NavigationUpdate = {
  distance: number
  reached: boolean
}