import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PairingState, RegistrationState
// logger, // Commented out - source unclear
// StatusBar, // Imported directly below
// DeviceID // Imported directly below
 } from '@vizora/common';
import { useConnectionState } from '@vizora/common/hooks/useConnectionState'; // Correct hook path
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, AlertTriangle, Play } from 'lucide-react';
import StatusBar from '@vizora/common/components/ui/StatusBar'; // Correct component path
import DeviceID from '@vizora/common/components/ui/DeviceID'; // Correct component path
import QRCode from "react-qr-code";
import { useDisplay } from '@/context/DisplayContext';
export const PairingScreen = () => {
    const { deviceId, pairingCode, pairingUrl, pairingState, registrationState, error, startPairing, resetPairing, lastError } = useDisplay();
    const connectionState = useConnectionState();
    const displayError = error || lastError;
    const isLoading = connectionState === 'connecting' ||
        connectionState === 'reconnecting' ||
        registrationState === RegistrationState.REGISTERING ||
        pairingState === PairingState.REQUESTING;
    // Determine if we should show the QR code/pairing info
    const showPairingInfo = !isLoading && !displayError && pairingState === PairingState.ACTIVE && !!pairingCode && !!pairingUrl;
    const handleGetNewCode = () => {
        // logger.info('🔄 Requesting new pairing code...');
        resetPairing();
    };
    const handleStartPairing = () => {
        // logger.info('🚀 Starting pairing process...');
        startPairing();
    };
    return (_jsx(TooltipProvider, { children: _jsxs("div", { className: "relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background bg-gradient-to-br from-gray-900 to-black px-6 py-12 text-white", children: [_jsx(StatusBar, { className: "absolute top-6 right-6" // Adjusted positioning
                    , connectionState: connectionState, registrationState: registrationState, pairingState: pairingState }), _jsx("main", { className: "flex flex-grow flex-col items-center justify-center gap-8 text-center w-full max-w-md md:max-w-lg lg:max-w-xl", children: _jsxs(AnimatePresence, { mode: "wait", children: [" ", isLoading && (_jsxs(motion.div, { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.9 }, transition: { duration: 0.2 }, className: "flex flex-col items-center space-y-4", children: [_jsx(LoadingSpinner, { size: 48 }), _jsx("p", { className: "text-lg text-muted-foreground", children: "Initializing..." })] }, "loading")), displayError && (_jsxs(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.2 }, className: "flex w-full max-w-sm flex-col items-center space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-6", children: [_jsx(AlertTriangle, { className: "h-8 w-8 text-destructive" }), _jsx("p", { className: "text-xl font-semibold", children: "Pairing Error" }), _jsx("p", { className: "text-base text-destructive/80", children: displayError.message || 'An unknown error occurred.' }), _jsxs(Button, { variant: "destructive", size: "sm", className: "mt-2", onClick: resetPairing, children: [_jsx(RefreshCw, { className: "mr-1.5 h-4 w-4" }), "Reset Pairing"] })] }, "error")), showPairingInfo && pairingUrl && pairingCode && (_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.3 }, className: "flex w-full flex-col items-center", children: _jsxs(Card, { className: "w-full max-w-sm p-6 flex flex-col items-center gap-4 shadow-lg bg-card border-border", children: [_jsx("div", { className: "bg-white p-3 rounded-md", children: _jsx(QRCode, { value: pairingUrl, size: 192, bgColor: "#FFFFFF", fgColor: "#000000", level: "Q" }) }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Enter this code:" }), _jsx("p", { className: "text-2xl font-mono font-semibold tracking-wide text-primary", children: pairingCode })] }), _jsx(DeviceID, { deviceId: deviceId, className: "mt-2 opacity-75" })] }) }, "pairing-info")), !isLoading && !displayError && !showPairingInfo && (_jsx(motion.div, { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.9 }, transition: { duration: 0.2 }, children: _jsxs(Button, { onClick: handleStartPairing, size: "lg", className: "rounded-full px-8 py-3 text-lg font-semibold shadow-lg transition-shadow hover:shadow-xl", children: [pairingState === PairingState.EXPIRED ? _jsx(RefreshCw, { className: "mr-2 h-5 w-5" }) : _jsx(Play, { className: "mr-2 h-5 w-5" }), pairingState === PairingState.EXPIRED ? 'Get New Code' : 'Start Pairing'] }) }, "start-button"))] }) }), _jsx("footer", { className: "absolute bottom-12 left-1/2 -translate-x-1/2 transform", children: _jsx(AnimatePresence, { children: showPairingInfo && (_jsx(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 10 }, transition: { duration: 0.2, delay: 0.1 }, children: _jsxs(Button, { variant: "ghost" // Use ghost for less emphasis
                                , onClick: handleGetNewCode, disabled: isLoading, className: "text-sm text-muted-foreground hover:bg-white/10 hover:text-white", children: [_jsx(RefreshCw, { className: "mr-1.5 h-4 w-4" }), "Get New Code"] }) }, "get-new-code")) }) })] }) }));
};
export default PairingScreen;
