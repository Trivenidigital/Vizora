// MFA (auth #2) API methods

import { ApiClient, AuthUser, LoginResponse } from './client';

/** Login responded that an enrolled user must complete a TOTP challenge. */
export interface MfaChallengeRequired {
  mfaRequired: true;
  challengeToken: string;
}

/** Login responded that the org requires MFA and the user must enroll first. */
export interface MfaEnrollmentRequired {
  mfaEnrollmentRequired: true;
  enrollmentToken: string;
}

export interface MfaStatus {
  enabled: boolean;
  backupCodesRemaining: number;
}

export interface MfaEnrollData {
  otpauthUrl: string;
  qrDataUrl: string;
}

/** enable() returns backup codes; in the forced-enrollment flow it also
 * returns a completed session (access_token/user) so the caller can proceed. */
export interface MfaEnableResult {
  backupCodes: string[];
  access_token?: string;
  user?: AuthUser;
  expiresIn?: number;
}

const ENROLLMENT_HEADER = 'x-mfa-enrollment-token';

declare module './client' {
  interface ApiClient {
    mfaEnroll(enrollmentToken?: string): Promise<MfaEnrollData>;
    mfaEnable(code: string, enrollmentToken?: string): Promise<MfaEnableResult>;
    mfaDisable(code: string): Promise<{ message: string }>;
    mfaStatus(): Promise<MfaStatus>;
    mfaRegenerateBackupCodes(code: string): Promise<{ backupCodes: string[] }>;
    mfaChallenge(challengeToken: string, code: string): Promise<LoginResponse>;
    setOrgMfaRequired(mfaRequired: boolean): Promise<{ mfaRequired: boolean }>;
  }
}

ApiClient.prototype.mfaEnroll = async function (enrollmentToken?: string): Promise<MfaEnrollData> {
  return this.request<MfaEnrollData>('/auth/mfa/enroll', {
    method: 'POST',
    ...(enrollmentToken ? { headers: { [ENROLLMENT_HEADER]: enrollmentToken } } : {}),
  });
};

ApiClient.prototype.mfaEnable = async function (
  code: string,
  enrollmentToken?: string,
): Promise<MfaEnableResult> {
  const result = await this.request<MfaEnableResult>('/auth/mfa/enable', {
    method: 'POST',
    body: JSON.stringify({ code }),
    ...(enrollmentToken ? { headers: { [ENROLLMENT_HEADER]: enrollmentToken } } : {}),
  });
  // Forced-enrollment path returns a completed session — mark authenticated.
  if (result.access_token) {
    this.isAuthenticated = true;
  }
  return result;
};

ApiClient.prototype.mfaDisable = async function (code: string): Promise<{ message: string }> {
  return this.request<{ message: string }>('/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
};

ApiClient.prototype.mfaStatus = async function (): Promise<MfaStatus> {
  return this.request<MfaStatus>('/auth/mfa/status');
};

ApiClient.prototype.mfaRegenerateBackupCodes = async function (
  code: string,
): Promise<{ backupCodes: string[] }> {
  return this.request<{ backupCodes: string[] }>('/auth/mfa/backup-codes/regenerate', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
};

ApiClient.prototype.mfaChallenge = async function (
  challengeToken: string,
  code: string,
): Promise<LoginResponse> {
  const response = await this.request<LoginResponse>('/auth/mfa/challenge', {
    method: 'POST',
    body: JSON.stringify({ challengeToken, code }),
  });
  // Session cookie is set by the server; mark authenticated exactly as login does.
  this.isAuthenticated = true;
  return response;
};

ApiClient.prototype.setOrgMfaRequired = async function (
  mfaRequired: boolean,
): Promise<{ mfaRequired: boolean }> {
  return this.request<{ mfaRequired: boolean }>('/organizations/current/mfa-required', {
    method: 'PATCH',
    body: JSON.stringify({ mfaRequired }),
  });
};
