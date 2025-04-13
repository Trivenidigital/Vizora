import React, { useState } from 'react';

interface RegistrationScreenProps {
  onRegister: (pairingCode: string) => Promise<void>;
}

export const RegistrationScreen: React.FC<RegistrationScreenProps> = ({ onRegister }) => {
  const [pairingCode, setPairingCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onRegister(pairingCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="registration-screen">
      <h1>Display Registration</h1>
      <p>Enter the pairing code from your Vizora dashboard to register this display.</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="pairingCode">Pairing Code</label>
          <input
            id="pairingCode"
            type="text"
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value)}
            placeholder="Enter pairing code"
            required
            disabled={isSubmitting}
          />
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Registering...' : 'Register Display'}
        </button>
      </form>

      <div className="help-text">
        <p>Need help?</p>
        <ol>
          <li>Log in to your Vizora dashboard</li>
          <li>Go to Display Management</li>
          <li>Click "Add New Display"</li>
          <li>Copy the pairing code shown</li>
          <li>Enter the code above and click Register</li>
        </ol>
      </div>
    </div>
  );
}; 