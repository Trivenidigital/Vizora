export enum DisplayStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  PAIRING = 'PAIRING',
}

export enum DisplayOrientation {
  LANDSCAPE = 'LANDSCAPE',
  PORTRAIT = 'PORTRAIT',
}

export interface Display {
  id: string;
  name: string;
  pairingCode: string;
  status: DisplayStatus;
  orientation: DisplayOrientation;
  resolution: string;
  location?: string;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDisplayDto {
  name: string;
  orientation?: DisplayOrientation;
  resolution?: string;
  location?: string;
}

export interface UpdateDisplayDto {
  name?: string;
  orientation?: DisplayOrientation;
  resolution?: string;
  location?: string;
  status?: DisplayStatus;
}

export interface PairingRequest {
  pairingCode: string;
  displayInfo: {
    resolution: string;
    userAgent: string;
  };
}

export interface PairingResponse {
  success: boolean;
  displayId?: string;
  error?: string;
}
