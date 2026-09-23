import * as THREE from 'three'
import type { Destination } from './types'

export const destinations: Destination[] = [
  {
    id: 'cabin-1',
    name: 'Cabin 1',
    position: new THREE.Vector3(
      4.355,
      -1.071,
      2.215
    ),
  },

  {
    id: 'cabin-2',
    name: 'Cabin 2',
    position: new THREE.Vector3(
      8.995,
      -1.109,
      2.241
    ),
  },

  {
    id: 'meeting-room',
    name: 'Meeting Room',
    position: new THREE.Vector3(
      12.398,
      -0.622,
      2.274
    ),
  },

  {
    id: 'lobby',
    name: 'Lobby',
    position: new THREE.Vector3(
      0.881,
      -1.947,
      -1.917
    ),
  },

  {
    id: 'pantry',
    name: 'Pantry',
    position: new THREE.Vector3(
      1.143,
      -1.238,
      7.950
    ),
  },

  {
    id: 'restroom',
    name: 'Restroom',
    position: new THREE.Vector3(
      -0.902,
      -1.385,
      7.157
    ),
  },

  {
    id: 'entrance',
    name: 'Entrance Door',
    position: new THREE.Vector3(
      -1.039,
      -1.388,
      1.468
    ),
  },
]