const express = require('express');
const { asyncHandler } = require('../../../shared/http/async-handler');
const {
  isResponseContract,
  sendResponseContract,
} = require('../../../shared/http/response-contract');
const { AppError } = require('../../../shared/errors/app-error');
const {
  createLaundryPageService,
} = require('../../web/laundry/application/services/laundry-page.service');

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

function createApiLaundryAppRouter(dependencies = {}) {
  const router = express.Router();
  const repository = dependencies.repositories?.laundry;
  const mainRepository = dependencies.repositories?.main;

  if (!repository || !mainRepository) {
    throw new AppError({ status: 500, message: 'Laundry app API repositories not wired' });
  }

  const service = createLaundryPageService({
    repository,
    realtime: dependencies.eventBus,
    auditLog: dependencies.auditLog,
    env: dependencies.env,
  });

  async function lookupLaundryBagByRfid(req, res) {
    const overview = await service.getLaundryOverview({
      campId: req.query?.campId || null,
      tableState: {},
    });
    const rfidCode = String(req.query?.rfidCode || req.query?.nfcData || '')
      .trim()
      .toLowerCase();
    const bag = (overview.body?.lookups?.rows || overview.body?.rows || []).find(
      (row) => String(row.rfidCode || '').trim().toLowerCase() === rfidCode,
    );
    if (!bag) {
      throw new AppError({
        status: 404,
        code: 'LAUNDRY_BAG_NOT_FOUND',
        message: 'No laundry bag was found for this RFID code in the selected camp.',
      });
    }
    return res.json({ bag, notifications: overview.body?.notifications || [] });
  }

  router.get(
    '/laundry-app/camps',
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
    '/laundry-app/permissions',
    asyncHandler(async (req, res) => {
      const permissions = await repository.listUserPermissions({ userId: actorUserId(req) });
      return res.json({ permissions });
    }),
  );

  router.get(
    '/laundry-app/overview',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.getLaundryOverview({
          campId: req.query?.campId || null,
          tableState: parseTableState(req.query?.state),
        }),
      ),
    ),
  );

  router.get(
    '/laundry-app/report',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.getLaundryReport({
          actorUserId: actorUserId(req),
          campId: req.query?.campId || null,
          fromDate: req.query?.fromDate,
          toDate: req.query?.toDate,
          tableState: parseTableState(req.query?.state),
        }),
      ),
    ),
  );

  router.get(
    '/laundry-app/available-bags',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.listAvailableBags({
          campId: req.query?.campId || null,
          search: req.query?.search || '',
          limit: req.query?.limit,
        }),
      ),
    ),
  );

  router.get(
    '/laundry-app/rfid',
    asyncHandler(lookupLaundryBagByRfid),
  );

  router.get(
    '/laundry-app/version',
    asyncHandler(async (_req, res) =>
      res.json({
        version: dependencies.env?.APP_LAUNDRY_VERSION || null,
        apkUrl: '/api/laundry-app/mobile-app',
        sha256: dependencies.env?.HASH_APP_LAUNDRY || null,
      }),
    ),
  );

  router.get(
    '/laundry-app/mobile-app',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.downloadLaundryMobileApp({
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
    '/laundry-app/notifications/token',
    asyncHandler(async (_req, res) => res.json({ ok: true })),
  );

  router.post(
    '/laundry-app/bags',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.addBag({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          code: req.body?.code,
          rfidCode: req.body?.rfidCode,
          type: req.body?.type,
          maxCountLaundry: req.body?.maxCountLaundry,
        }),
      ),
    ),
  );

  router.patch(
    '/laundry-app/bags',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.editBag({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          bagId: req.body?.bagId,
          code: req.body?.code,
          rfidCode: req.body?.rfidCode,
          type: req.body?.type,
          maxCountLaundry: req.body?.maxCountLaundry,
        }),
      ),
    ),
  );

  router.delete(
    '/laundry-app/bags',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.deleteBag({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          bagId: req.body?.bagId,
        }),
      ),
    ),
  );

  router.post(
    '/laundry-app/bags/add-to-status',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.addBagToStatus({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          bagId: req.body?.bagId,
          status: req.body?.status,
        }),
      ),
    ),
  );

  router.post(
    '/laundry-app/bags/move',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.moveBag({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          bagId: req.body?.bagId,
          status: req.body?.status,
        }),
      ),
    ),
  );

  router.post(
    '/laundry-app/bags/linen-exchange',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.recordLinenExchange({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          bagId: req.body?.bagId,
        }),
      ),
    ),
  );

  router.post(
    '/laundry-app/bags/remove-from-status',
    asyncHandler(async (req, res) =>
      sendResult(
        res,
        await service.removeBagFromStatus({
          actorUserId: actorUserId(req),
          campId: req.body?.campId || null,
          bagId: req.body?.bagId,
        }),
      ),
    ),
  );

  return router;
}

module.exports = { createApiLaundryAppRouter };
