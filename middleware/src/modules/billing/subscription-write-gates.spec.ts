import {
  DynamicModule,
  ExecutionContext,
  ForbiddenException,
  Type,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { SubscriptionActiveGuard } from './guards/subscription-active.guard';
import { DatabaseService } from '../database/database.service';
import { MailModule } from '../mail/mail.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../common/common.module';
import { DisplayGroupsModule } from '../display-groups/display-groups.module';
import { DisplayGroupsController } from '../display-groups/display-groups.controller';
import { FoldersModule } from '../folders/folders.module';
import { FoldersController } from '../folders/folders.controller';
import { BulkOperationsController } from '../content/controllers/bulk-operations.controller';
import { LayoutsController } from '../content/controllers/layouts.controller';
import { TemplatesController } from '../content/controllers/templates.controller';
import { WidgetsController } from '../content/controllers/widgets.controller';

type ControllerClass = {
  name: string;
  prototype: object;
};
type NestModuleImport = Type<unknown> | DynamicModule;

function methodGuards(controller: ControllerClass, methodName: string) {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    (controller.prototype as Record<string, unknown>)[methodName],
  ) ?? [];
}

function guardContext(handler: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        user: {
          id: 'user-expired',
          organizationId: 'org-expired',
        },
      }),
    }),
    getHandler: () => handler,
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describe('dashboard subscription write gates', () => {
  const guardedWriteHandlers: Array<[ControllerClass, string]> = [
    [DisplayGroupsController, 'create'],
    [DisplayGroupsController, 'update'],
    [DisplayGroupsController, 'remove'],
    [DisplayGroupsController, 'addDisplays'],
    [DisplayGroupsController, 'removeDisplays'],
    [FoldersController, 'create'],
    [FoldersController, 'update'],
    [FoldersController, 'remove'],
    [FoldersController, 'moveContent'],
    [BulkOperationsController, 'bulkUpdate'],
    [BulkOperationsController, 'bulkArchive'],
    [BulkOperationsController, 'bulkRestore'],
    [BulkOperationsController, 'bulkDelete'],
    [BulkOperationsController, 'bulkAddTags'],
    [BulkOperationsController, 'bulkSetDuration'],
    [LayoutsController, 'createLayout'],
    [LayoutsController, 'updateLayout'],
    [LayoutsController, 'deleteLayout'],
    [TemplatesController, 'createTemplate'],
    [TemplatesController, 'updateTemplate'],
    [TemplatesController, 'refreshTemplate'],
    [WidgetsController, 'createWidget'],
    [WidgetsController, 'updateWidget'],
    [WidgetsController, 'refreshWidget'],
  ];

  it.each(guardedWriteHandlers)(
    '%s.%s requires an active subscription for writes',
    (controller, methodName) => {
      expect(methodGuards(controller, methodName)).toEqual(
        expect.arrayContaining([SubscriptionActiveGuard]),
      );
    },
  );

  it.each([
    [TemplatesController, 'previewTemplate'],
    [TemplatesController, 'validateTemplate'],
  ] as Array<[ControllerClass, string]>)(
    '%s.%s stays ungated because it is stateless',
    (controller, methodName) => {
      expect(methodGuards(controller, methodName)).not.toContain(
        SubscriptionActiveGuard,
      );
    },
  );

  it.each([
    [DisplayGroupsModule, DisplayGroupsController, 'create'],
    [FoldersModule, FoldersController, 'create'],
  ] as Array<[NestModuleImport, ControllerClass, string]>)(
    '%s resolves and executes SubscriptionActiveGuard for %s.%s',
    async (moduleType, controller, methodName) => {
      const databaseService = {
        organization: {
          findUnique: jest.fn().mockResolvedValue({
            subscriptionStatus: 'canceled',
            subscriptionTier: 'pro',
            trialEndsAt: null,
          }),
        },
      };

      const moduleRef = await Test.createTestingModule({
        imports: [CommonModule, MailModule, RedisModule, moduleType],
      })
        .overrideProvider(DatabaseService)
        .useValue(databaseService)
        .compile();

      try {
        const guard = moduleRef.get(SubscriptionActiveGuard, { strict: false });

        await expect(
          guard.canActivate(
            guardContext((controller.prototype as Record<string, unknown>)[methodName]),
          ),
        ).rejects.toThrow(ForbiddenException);

        expect(databaseService.organization.findUnique).toHaveBeenCalledWith({
          where: { id: 'org-expired' },
          select: {
            subscriptionStatus: true,
            subscriptionTier: true,
            trialEndsAt: true,
          },
        });
      } finally {
        await moduleRef.close();
      }
    },
  );
});
