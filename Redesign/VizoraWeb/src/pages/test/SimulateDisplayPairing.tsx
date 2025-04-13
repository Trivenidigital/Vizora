import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/**
 * SimulateDisplayPairing - A test component that simulates a Vizora display showing a pairing code
 * This helps test the pairing flow without needing an actual display device
 */
const SimulateDisplayPairing: React.FC = () => {
  const [pairingCode, setPairingCode] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>(`test-device-${Date.now()}`);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [error, setError] = useState<string>('');
  
  const navigate = useNavigate();
  
  // Generate a new pairing code
  const generatePairingCode = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/devices/pair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceId: deviceId,
          deviceInfo: {
            name: 'Simulated Vizora Display',
            model: 'Vizora Simulator',
            type: 'VizoraTV'
          }
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setPairingCode(data.pairingCode);
        setExpiresAt(new Date(data.expiresAt));
        setTimeLeft(data.expiresIn);
      } else {
        setError(data.message || 'Failed to generate pairing code');
      }
    } catch (err) {
      console.error('Error generating pairing code:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update the time left every second
  useEffect(() => {
    if (!expiresAt) return;
    
    const timer = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
      
      if (diff <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        setPairingCode('');
      } else {
        setTimeLeft(diff);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [expiresAt]);
  
  // Format time left as MM:SS
  const formatTimeLeft = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  useEffect(() => {
    // Generate a pairing code when component mounts
    generatePairingCode();
  }, []);
  
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-gray-900 text-white rounded-lg overflow-hidden shadow-xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Vizora Display</h1>
            <div className="text-xs bg-blue-500 px-2 py-1 rounded">Simulator</div>
          </div>
          
          <div className="bg-black rounded-lg p-6 mb-6">
            <h2 className="text-lg text-center mb-2">Pairing Code</h2>
            
            {pairingCode ? (
              <>
                <div className="text-center">
                  <div className="font-mono text-4xl tracking-widest font-bold mb-2 py-3 px-4 bg-gray-800 rounded-lg">
                    {pairingCode}
                  </div>
                  <div className="text-gray-400 text-sm mt-3">
                    Code expires in <span className="text-yellow-400">{formatTimeLeft()}</span>
                  </div>
                </div>
              </>
            ) : error ? (
              <div className="text-red-500 text-center py-4">
                {error}
              </div>
            ) : (
              <div className="flex justify-center items-center h-24">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
              </div>
            )}
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold mb-2">Device Information</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-400">Device ID:</div>
              <div className="font-mono truncate">{deviceId}</div>
              
              <div className="text-gray-400">Model:</div>
              <div>Vizora Simulator</div>
              
              <div className="text-gray-400">Status:</div>
              <div>
                <span className="inline-flex items-center">
                  <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                  Ready to pair
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="primary"
              className="w-full"
              onClick={generatePairingCode}
              disabled={isLoading}
            >
              New Code
            </Button>
            
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate('/test-polling')}
            >
              Test Connection
            </Button>
          </div>
          
          <div className="mt-4 text-xs text-center text-gray-500">
            Enter this code in the Vizora Web app to connect this display
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SimulateDisplayPairing; 