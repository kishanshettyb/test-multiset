'use client'

import { useState } from 'react'

export default function NavigatePage() {
  const [status, setStatus] = useState('Ready')

  const handleClick = () => {
    console.log('CLICK WORKED')
    setStatus('BUTTON CLICK WORKED')
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col items-center justify-center gap-6">
        <button
          type="button"
          onClick={handleClick}
          className="rounded-xl cursor-pointer bg-white px-6 py-3 font-medium text-black"
        >
          TEST BUTTON
        </button>

        <div className="text-lg">
          Status: {status}
        </div>
      </div>
    </main>
  )
}
