export enum PairingStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export interface Pairing {
  id: string;
  displayId: string;
  pairingCode: string;
  status: PairingStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePairingDto {
  displayId: string;
}

export interface ValidatePairingDto {
  pairingCode: string;
}
