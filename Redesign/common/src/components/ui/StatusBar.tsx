import React from 'react';
import { Badge } from './badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { ConnectionState } from '../../services/ConnectionManager';
import { RegistrationState, PairingState } from '../../services/PairingStateManager';
import { cn } from '../../lib/utils';
import { Wifi, WifiOff, CheckCircle, XCircle, CircleDotDashed, Server, HelpCircle, QrCode, Link as LinkIcon, Hourglass, AlertTriangle, Loader } from 'lucide-react';

interface StatusBarProps {
  connectionState: ConnectionState;
  registrationState: RegistrationState;
  pairingState: PairingState;
}

// Helper to determine badge variant, text, and icon based on state
const getStateBadgeProps = (
  stateType: string, 
  state: ConnectionState | RegistrationState | PairingState
): { 
  variant: React.ComponentProps<typeof Badge>['variant'], 
  text: string, 
  Icon: React.ElementType 
} => {
  switch (stateType) {
    case 'connection':
      switch (state as ConnectionState) {
        case 'connected': return { variant: 'success', text: 'Connected to Server', Icon: Wifi };
        case 'disconnected': return { variant: 'destructive', text: 'Disconnected', Icon: WifiOff };
        case 'connecting':
        case 'reconnecting': return { variant: 'outline', text: 'Connecting...', Icon: Loader };
        case 'error': return { variant: 'destructive', text: 'Connection Error', Icon: AlertTriangle };
        default: return { variant: 'secondary', text: 'Unknown Connection', Icon: HelpCircle };
      }
    case 'registration':
      switch (state as RegistrationState) {
        case RegistrationState.REGISTERED: return { variant: 'success', text: 'Device Registered', Icon: CheckCircle };
        case RegistrationState.UNREGISTERED: return { variant: 'secondary', text: 'Device Not Registered', Icon: Server };
        case RegistrationState.REGISTERING:
        case RegistrationState.VERIFYING: return { variant: 'outline', text: 'Registering Device...', Icon: Loader };
        case RegistrationState.REGISTRATION_ERROR: return { variant: 'destructive', text: 'Registration Failed', Icon: AlertTriangle };
        default: return { variant: 'secondary', text: 'Unknown Registration', Icon: HelpCircle };
      }
    case 'pairing':
      switch (state as PairingState) {
        case PairingState.PAIRED: return { variant: 'success', text: 'Device Paired', Icon: LinkIcon };
        case PairingState.ACTIVE: return { variant: 'default', text: 'Pairing Code Active', Icon: QrCode };
        case PairingState.REQUESTING: return { variant: 'outline', text: 'Requesting Code...', Icon: Loader };
        case PairingState.ERROR: return { variant: 'destructive', text: 'Pairing Failed', Icon: AlertTriangle };
        case PairingState.EXPIRED: return { variant: 'destructive', text: 'Pairing Code Expired', Icon: Hourglass };
        case PairingState.IDLE: return { variant: 'secondary', text: 'Pairing Idle', Icon: CircleDotDashed };
        default: return { variant: 'secondary', text: 'Unknown Pairing State', Icon: HelpCircle };
      }
    default:
      return { variant: 'secondary', text: 'Unknown State', Icon: HelpCircle };
  }
};

export const StatusBar: React.FC<StatusBarProps> = ({ 
  connectionState, 
  registrationState, 
  pairingState 
}) => {

  const connectionProps = getStateBadgeProps('connection', connectionState);
  const registrationProps = getStateBadgeProps('registration', registrationState);
  const pairingProps = getStateBadgeProps('pairing', pairingState);

  const successVariantClass = "bg-green-600 border-green-700 text-white hover:bg-green-700";
  const iconSize = "h-3.5 w-3.5";

  return (
    <TooltipProvider delayDuration={100}>
      <div className="absolute top-4 right-4 flex items-center space-x-2 z-20">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={connectionProps.variant} 
              className={cn(
                "flex items-center space-x-1.5",
                connectionProps.variant === 'success' && successVariantClass
              )}
            >
              <connectionProps.Icon className={cn(iconSize, connectionProps.variant === 'outline' && "animate-spin")} />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{connectionProps.text}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={registrationProps.variant}
              className={cn(
                "flex items-center space-x-1.5",
                registrationProps.variant === 'success' && successVariantClass
              )}
            >
              <registrationProps.Icon className={cn(iconSize, registrationProps.variant === 'outline' && "animate-spin")} />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{registrationProps.text}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={pairingProps.variant}
              className={cn(
                "flex items-center space-x-1.5",
                pairingProps.variant === 'success' && successVariantClass
              )}
            >
              <pairingProps.Icon className={cn(iconSize, pairingProps.variant === 'outline' && "animate-spin")} />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{pairingProps.text}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default StatusBar; 