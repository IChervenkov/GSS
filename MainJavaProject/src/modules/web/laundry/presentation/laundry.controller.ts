const {
  presentLaundryFileResult,
  presentLaundryResult,
  presentLaundryView,
} = require('./laundry.presenter');
const { buildRequestMeta } = require('../../../../shared/security/audit-log');

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

function createLaundryController({ useCases }) {
  return {
    laundryPage: async (req, res) => {
      const model = await useCases.getLaundryView({
        userId: req.session?.userId,
        campId: req.session?.camp || null,
        csrfToken: res.locals?.csrfToken || req.session?.csrfToken || '',
      });

      return presentLaundryView(model);
    },

    laundryData: async (req) => {
      return presentLaundryResult(
        await useCases.getLaundryOverview({
          campId: req.session?.camp || null,
          tableState: parseTableState(req.query?.state),
        }),
      );
    },

    laundryReport: async (req) => {
      return presentLaundryResult(
        await useCases.getLaundryReport({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          fromDate: req.query?.fromDate,
          toDate: req.query?.toDate,
          tableState: parseTableState(req.query?.state),
        }),
      );
    },

    availableBags: async (req) => {
      return presentLaundryResult(
        await useCases.listAvailableBags({
          campId: req.session?.camp || null,
          search: req.query?.search || '',
          limit: req.query?.limit,
        }),
      );
    },

    downloadBagTemplate: async (req) => {
      return presentLaundryFileResult(
        await useCases.downloadBagTemplate({
          actorUserId: req.session?.userId,
        }),
      );
    },

    downloadLaundryReport: async (req) => {
      return presentLaundryFileResult(
        await useCases.downloadLaundryReport({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          fromDate: req.query?.fromDate,
          toDate: req.query?.toDate,
          tableState: parseTableState(req.query?.state),
        }),
      );
    },

    downloadLaundryMobileApp: async (req) => {
      return presentLaundryFileResult(
        await useCases.downloadLaundryMobileApp({
          actorUserId: req.session?.userId,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    addBag: async (req) => {
      return presentLaundryResult(
        await useCases.addBag({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          code: req.body?.code,
          rfidCode: req.body?.rfidCode,
          type: req.body?.type,
          maxCountLaundry: req.body?.maxCountLaundry,
        }),
      );
    },

    editBag: async (req) => {
      return presentLaundryResult(
        await useCases.editBag({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          bagId: req.body?.bagId,
          code: req.body?.code,
          rfidCode: req.body?.rfidCode,
          type: req.body?.type,
          maxCountLaundry: req.body?.maxCountLaundry,
        }),
      );
    },

    deleteBag: async (req) => {
      return presentLaundryResult(
        await useCases.deleteBag({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          bagId: req.body?.bagId,
        }),
      );
    },

    addBagToStatus: async (req) => {
      return presentLaundryResult(
        await useCases.addBagToStatus({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          bagId: req.body?.bagId,
          status: req.body?.status,
        }),
      );
    },

    moveBag: async (req) => {
      return presentLaundryResult(
        await useCases.moveBag({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          bagId: req.body?.bagId,
          status: req.body?.status,
        }),
      );
    },

    recordLinenExchange: async (req) => {
      return presentLaundryResult(
        await useCases.recordLinenExchange({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          bagId: req.body?.bagId,
        }),
      );
    },

    removeBagFromStatus: async (req) => {
      return presentLaundryResult(
        await useCases.removeBagFromStatus({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          bagId: req.body?.bagId,
        }),
      );
    },

    bulkUpdateBags: async (req) => {
      return presentLaundryResult(
        await useCases.bulkUpdateBags({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          payload: req.body?.payload,
        }),
      );
    },

    importBags: async (req) => {
      return presentLaundryResult(
        await useCases.importBags({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
        }),
      );
    },
  };
}

module.exports = { createLaundryController };
