'use client'

import { useState } from 'react'

export default function TestClientPage() {
  const [clicked, setClicked] = useState(false)

  return (
    <main className="p-10">
      <h1>Client Test</h1>

      <button
        type="button"
        onClick={() => setClicked(true)}
        className="mt-5 rounded bg-black px-5 py-3 text-white"
      >
        TEST CLIENT BUTTON
      </button>

      <p className="mt-5">
        {clicked ? 'CLIENT JAVASCRIPT WORKS' : 'Waiting...'}
      </p>
    </main>
  )
}
