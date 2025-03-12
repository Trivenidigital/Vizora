import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
  pairingCode: string;
  size?: number;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ pairingCode, size = 256 }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pairingCode) {
      setError('No pairing code provided');
      return;
    }

    // Generate QR code data URL
    const generateQR = async () => {
      try {
        // Create a QR code with the pairing data
        // Format: vizora://pair/{pairingCode}
        const pairingUrl = `vizora://pair/${pairingCode}`;
        const dataUrl = await QRCode.toDataURL(pairingUrl, {
          width: size,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        
        setQrDataUrl(dataUrl);
        setError(null);
      } catch (err) {
        console.error('Error generating QR code:', err);
        setError('Failed to generate QR code');
      }
    };

    generateQR();
  }, [pairingCode, size]);

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!qrDataUrl) {
    return <div className="flex justify-center items-center h-48 w-48 bg-secondary-100 rounded-lg">Loading...</div>;
  }

  return (
    <div className="qr-code-container">
      <img 
        src={qrDataUrl} 
        alt="Pairing QR Code" 
        className="rounded-lg shadow-md"
        width={size} 
        height={size} 
      />
    </div>
  );
};

export default QRCodeGenerator;
