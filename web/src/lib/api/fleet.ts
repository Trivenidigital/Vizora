import { ApiClient } from './client';

declare module './client' {
  interface ApiClient {
    sendFleetCommand(data: {
      command: string;
      target: { type: string; id: string };
      payload?: { contentId?: string; duration?: number; priority?: string };
    }): Promise<{
      commandId: string;
      command: string;
      target: { type: string; id: string };
      devicesTargeted: number;
      devicesOnline: number;
      devicesQueued: number;
    }>;
    getActiveOverrides(): Promise<Array<{
      commandId: string;
      contentId: string;
      contentTitle: string;
      targetType: string;
      targetId: string;
      targetName: string;
      duration: number;
      startedAt: string;
      expiresAt: string;
      startedBy: string;
    }>>;
    clearOverride(commandId: string): Promise<{ commandId: string; devicesNotified: number }>;
  }
}

ApiClient.prototype.sendFleetCommand = async function (data) {
  return this.request('/fleet/commands', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

ApiClient.prototype.getActiveOverrides = async function () {
  return this.request('/fleet/overrides/active');
};

ApiClient.prototype.clearOverride = async function (commandId: string) {
  return this.request(`/fleet/overrides/${commandId}`, {
    method: 'DELETE',
  });
};
