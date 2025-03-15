import React, { useState, useCallback } from 'react';
import { getPairingService } from '../services/pairingService';
import styles from './AddDisplayModal.module.css';

interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDisplayAdded: (displayId: string) => void;
}

const AddDisplayModal: React.FC<AddDisplayModalProps> = ({ isOpen, onClose, onDisplayAdded }) => {
  const [pairingCode, setPairingCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Only update if the value contains valid characters
    if (/^[A-Z0-9]*$/.test(value)) {
      setPairingCode(value);
      console.log('Input value:', value); // Debug log
    }
  }, []);

  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingCode) {
      setError('Please enter a pairing code');
      return;
    }

    setError(null);
    setIsPairing(true);

    try {
      const pairingService = getPairingService();
      const displayId = await pairingService.pairWithDisplay(pairingCode);
      onDisplayAdded(displayId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pair with display');
    } finally {
      setIsPairing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Add Display</h2>
        <form onSubmit={handlePairDevice}>
          <div className={styles.inputGroup}>
            <label htmlFor="pairingCode">Enter Pairing Code</label>
            <input
              id="pairingCode"
              name="pairingCode"
              type="text"
              pattern="[A-Z0-9]*"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck="false"
              value={pairingCode}
              onChange={handleInputChange}
              placeholder="Enter 6-character code"
              maxLength={6}
              disabled={isPairing}
              autoFocus
              className={styles.input}
            />
            {error && <div className={styles.error}>{error}</div>}
          </div>
          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isPairing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isPairing || !pairingCode}
            >
              {isPairing ? 'Pairing...' : 'Pair Display'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDisplayModal; 