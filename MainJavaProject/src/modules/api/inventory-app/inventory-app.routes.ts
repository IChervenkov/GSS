const express = require('express');
const { asyncHandler } = require('../../../shared/http/async-handler');
const {
  isResponseContract,
  sendResponseContract,
} = require('../../../shared/http/response-contract');
const { AppError } = require('../../../shared/errors/app-error');
const {
  createAssetsPageService,
} = require('../../web/assets/application/services/assets-page.service');
const { ASSETS_PERMISSIONS } = require('../../web/assets/domain/assets.page');

function parseTableState(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function actorUserId(req) {
  return req.user?.id || req.auth?.id || null;
}

function sendResult(res, result) {
  if (isResponseContract(result)) return sendResponseContract(res, result);
  const status = Number.isInteger(result?.status) ? result.status : 200;
  return res.status(status).json(result?.body || result || {});
}

function normalizeInventoryStatus(value) {
  const status = String(value || 'completed')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!['undiscovered', 'completed', 'written_off'].includes(status)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_ASSET_INVENTORY_STATUS',
      message: 'Choose a valid inventory status.',
    });
  }
  return status;
}

async function assertInventoryAppPermission(repository, userId, permissionName, deniedMessage) {
  const [hasFullPermission, hasActionPermission] = await Promise.all([
    repository.userHasPermission(userId, ASSETS_PERMISSIONS.full),
    repository.userHasPermission(userId, permissionName),
  ]);

  if (!hasFullPermission && !hasActionPermission) {
    throw new AppError({
      status: 403,
      code: 'PERMISSION_DENIED',
      message: deniedMessage,
    });
  }
}

function createApiInventoryAppRouter(dependencies = {}) {
  const router = express.Router();
  const repository = dependencies.repositories?.assets;
  const mainRepository = dependencies.repositories?.main;

  if (!repository || !mainRepository) {
    throw new AppError({ status: 500, message: 'Inventory app API repositories not wired' });
  }

  const service = createAssetsPageService({
    repository,
    realtime: dependencies.eventBus,
    auditLog: dependencies.auditLog,
    env: dependencies.env,
  });

  router.get(
    '/inventory-app/camps',
    asyncHandler(async (req, res) => {
      const result = await mainRepository.listCampsAndPermissions({
        userId: actorUserId(req),
        page: 1,
        limit: 100,
        search: '',
        tableState: {},
      });
      return res.json({
        camps: (result.camps || []).map((camp) => ({
          id: camp.id,
          name: camp.name,
          createdAt: camp.createdAt,
        })),
      });
    }),
  );

  router.get(
    '/inventory-app/permissions',
    asyncHandler(async (req, res) => {
      const permissions = await repository.listUserPermissions({ userId: actorUserId(req) });
      return res.json({ permissions });
    }),
  );

  router.get(
    '/inventory-app/overview',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.getAssetsData({
          campId: req.query?.campId || null,
          tableState: parseTableState(req.query?.state),
        }),
      ),
    ),
  );

  router.get(
    '/inventory-app/rfid',
    asyncHandler(async (req, res) => {
      const asset = await repository.findAssetByRfid({
        campId: req.query?.campId || null,
        rfidCode: String(req.query?.rfidCode || req.query?.nfcData || '').trim(),
      });
      if (!asset) {
        throw new AppError({
          status: 404,
          code: 'ASSET_NOT_FOUND',
          message: 'No asset was found for this RFID code in the selected camp.',
        });
      }
      return res.json({ asset });
    }),
  );

  router.get(
    '/inventory-app/version',
    asyncHandler(async (_req, res) =>
      res.json({
        version: dependencies.env?.APP_ASSET_VERSION || null,
        apkUrl: '/api/inventory-app/mobile-app',
        sha256: dependencies.env?.HASH_APP_ASSET || null,
      }),
    ),
  );

  router.get(
    '/inventory-app/mobile-app',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.downloadAssetsMobileApp({
          actorUserId: actorUserId(req),
          requestMeta: {
            actorUserId: actorUserId(req),
            method: req.method,
            path: req.originalUrl || req.url,
            ip: req.ip,
          },
        }),
      ),
    ),
  );

  router.post(
    '/inventory-app/notifications/token',
    asyncHandler(async (_req, res) => res.json({ ok: true })),
  );

  router.post(
    '/inventory-app/assets',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.addAsset({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          payload: req.body,
        }),
      ),
    ),
  );

  router.patch(
    '/inventory-app/assets',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.editAsset({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          assetId: req.body?.assetId,
          payload: req.body,
        }),
      ),
    ),
  );

  router.delete(
    '/inventory-app/assets',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.deleteAsset({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          assetId: req.body?.assetId,
        }),
      ),
    ),
  );

  router.post(
    '/inventory-app/inventory/scan',
    asyncHandler(async (req, res) => {
      if (typeof repository.recordAssetInventory !== 'function') {
        throw new AppError({
          status: 500,
          code: 'INVENTORY_SCAN_NOT_WIRED',
          message: 'Inventory scan persistence is not wired.',
        });
      }
      await assertInventoryAppPermission(
        repository,
        actorUserId(req),
        ASSETS_PERMISSIONS.saveInventory,
        "You don't have permission to save inventory.",
      );
      const asset = await repository.recordAssetInventory({
        actorUserId: actorUserId(req),
        campId: req.body?.campId || null,
        assetId: req.body?.assetId,
        locationRoomId: req.body?.locationRoomId || null,
        locationKeyId: req.body?.locationKeyId || null,
        inventoryStatus: normalizeInventoryStatus(req.body?.inventoryStatus),
      });
      if (!asset) {
        throw new AppError({
          status: 404,
          code: 'ASSET_NOT_FOUND',
          message: 'The asset was not found in the selected camp.',
        });
      }
      dependencies.eventBus?.emitAssetsChanged?.(req.body?.campId || null);
      return res.json({ asset });
    }),
  );

  router.post(
    '/inventory-app/inventory/restart',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.restartInventory({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          locationRoomId: req.body?.locationRoomId || null,
        }),
      ),
    ),
  );

  return router;
}

module.exports = { createApiInventoryAppRouter };
