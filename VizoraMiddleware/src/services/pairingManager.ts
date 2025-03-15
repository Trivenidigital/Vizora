import { Socket } from 'socket.io';
import { Display, Controller } from '../types';
import { DisplayManager } from './displayManager';
import { RedisStateManager } from './redisStateManager';

export class PairingManager {
  private readonly displayManager: DisplayManager;
  private readonly stateManager: RedisStateManager;

  constructor(displayManager: DisplayManager) {
    this.displayManager = displayManager;
    this.stateManager = new RedisStateManager();
  }

  async registerController(socket: Socket): Promise<Controller> {
    const controller: Controller = {
      id: socket.id,
      socket,
      connectedDisplays: new Set()
    };

    await this.stateManager.saveController(controller);
    return controller;
  }

  async handlePairingRequest(controllerId: string, pairingCode: string): Promise<Display | null> {
    const controller = await this.stateManager.getController(controllerId);
    if (!controller) return null;

    const display = await this.displayManager.getDisplayByPairingCode(pairingCode);
    if (!display) return null;

    controller.connectedDisplays.add(display.id);
    await this.stateManager.saveController(controller as Controller);
    await this.stateManager.linkDisplayToController(display.id, controllerId);

    return display;
  }

  async removeController(controllerId: string): Promise<void> {
    const controller = await this.stateManager.getController(controllerId);
    if (controller && controller.connectedDisplays) {
      for (const displayId of controller.connectedDisplays) {
        await this.stateManager.unlinkDisplayFromController(displayId, controllerId);
      }
    }
    await this.stateManager.removeController(controllerId);
  }

  async getController(controllerId: string): Promise<Controller | null> {
    const controllerData = await this.stateManager.getController(controllerId);
    return controllerData as Controller | null;
  }

  async isDisplayConnectedToController(displayId: string, controllerId: string): Promise<boolean> {
    const controllers = await this.stateManager.getDisplayControllers(displayId);
    return controllers.includes(controllerId);
  }
} 