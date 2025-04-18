import React from 'react';
import QRCode from "react-qr-code";
import { Card, CardContent } from "./card"; // Use relative path
import { cn } from '../../lib/utils'; // Use relative path
import { motion } from 'framer-motion'; // Import motion

interface QRCodePanelProps {
  pairingUrl: string;
  pairingCode: string;
  className?: string;
}

export const QRCodePanel: React.FC<QRCodePanelProps> = ({ pairingUrl, pairingCode, className }) => {
  return (
    <Card className={cn("w-full max-w-xs bg-card border-border overflow-hidden shadow-lg", className)}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
          {/* QR Code Section */}
          <div className="bg-white p-3 rounded-md shadow-md border border-gray-200">
            <QRCode 
              value={pairingUrl} 
              size={192} // Larger size for TV readability
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="Q" // Error correction level
            />
          </div>

          {/* Pairing Code Section */}
          <div className="text-center w-full">
            <p className="text-sm text-muted-foreground mb-2">Or enter this code:</p>
            <div 
              className="text-4xl font-mono font-bold tracking-widest text-primary bg-secondary rounded-lg p-3 select-all shadow-inner border border-border"
              aria-label={`Pairing code: ${pairingCode?.split('').join(' ')}`}
            >
              {pairingCode}
            </div>
          </div>
        </CardContent>
      </motion.div>
    </Card>
  );
};

export default QRCodePanel; 