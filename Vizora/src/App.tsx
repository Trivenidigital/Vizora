import React, { useState } from 'react'
import { getPairingService } from './services/pairingService'
import './App.css'
import AddDisplayModal from './components/AddDisplayModal'

function App() {
  const [pairingCode, setPairingCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPairing, setIsPairing] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [displays, setDisplays] = useState<string[]>([])

  const handlePairDevice = async () => {
    if (!pairingCode) {
      setError('Please enter a pairing code')
      return
    }

    setError(null)
    setIsPairing(true)

    try {
      const pairingService = getPairingService()
      const displayId = await pairingService.pairWithDisplay(pairingCode)
      console.log('Successfully paired with display:', displayId)
      setDisplays(prev => [...prev, displayId])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pair with display')
    } finally {
      setIsPairing(false)
    }
  }

  const handleDisplayAdded = (displayId: string) => {
    setDisplays(prev => [...prev, displayId])
  }

  return (
    <div className="app-container">
      <h1>Vizora</h1>
      <div className="content">
        <div className="button-group">
          <button className="addButton">
            Dashboard
          </button>
          <button onClick={() => setIsModalOpen(true)} className="addButton">
            Pair
          </button>
        </div>
        {displays.length > 0 && (
          <div className="displays">
            <h2>Connected Displays</h2>
            <ul>
              {displays.map(displayId => (
                <li key={displayId}>{displayId}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <AddDisplayModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDisplayAdded={handleDisplayAdded}
      />
    </div>
  )
}

export default App 