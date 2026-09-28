'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export default function KokaryaFullMapPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111111)

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.01,
      1000
    )

    camera.position.set(10, 10, 10)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
    })

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    )

    renderer.setSize(
      container.clientWidth,
      container.clientHeight
    )

    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      2
    )

    scene.add(ambientLight)

    const directionalLight =
      new THREE.DirectionalLight(
        0xffffff,
        2
      )

    directionalLight.position.set(
      10,
      20,
      10
    )

    scene.add(directionalLight)

    const loader = new GLTFLoader()

    loader.load(
      '/navigation/kokarya-nav-mesg-threejs.glb',

      (gltf) => {
        const navMesh = gltf.scene

        scene.add(navMesh)

        // Show the NavMesh temporarily.
        navMesh.visible = true

        // Calculate bounds.
        const box = new THREE.Box3().setFromObject(
          navMesh
        )

        const center = box.getCenter(
          new THREE.Vector3()
        )

        const size = box.getSize(
          new THREE.Vector3()
        )

        console.log('NavMesh loaded')
        console.log('Center:', center)
        console.log('Size:', size)
        console.log('Min:', box.min)
        console.log('Max:', box.max)

        camera.position.set(
          center.x + size.x * 1.5,
          center.y + size.y * 1.5,
          center.z + size.z * 1.5
        )

        camera.lookAt(center)

        setStatus(
          `NavMesh loaded — ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`
        )
      },

      undefined,

      (error) => {
        console.error(
          'Failed to load NavMesh:',
          error
        )

        setStatus('Failed to load NavMesh')
      }
    )

    const handleResize = () => {
      if (!containerRef.current) return

      const width =
        containerRef.current.clientWidth

      const height =
        containerRef.current.clientHeight

      camera.aspect = width / height
      camera.updateProjectionMatrix()

      renderer.setSize(width, height)
    }

    window.addEventListener(
      'resize',
      handleResize
    )

    let animationFrame = 0

    const animate = () => {
      animationFrame =
        requestAnimationFrame(animate)

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrame)

      window.removeEventListener(
        'resize',
        handleResize
      )

      renderer.dispose()

      if (
        container.contains(
          renderer.domElement
        )
      ) {
        container.removeChild(
          renderer.domElement
        )
      }
    }
  }, [])

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="p-4">
        <h1 className="text-xl font-semibold">
          Kokarya Full Map
        </h1>

        <p className="mt-2 text-sm text-gray-400">
          {status}
        </p>
      </div>

      <div
        ref={containerRef}
        className="h-[calc(100vh-100px)] w-full"
      />
    </main>
  )
}