const { buildRequestMeta } = require('../../../../shared/security/audit-log');
const {
  presentBicyclesFileResult,
  presentBicyclesResult,
  presentBicyclesView,
} = require('./bicycles.presenter');

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

function createBicyclesController({ useCases }) {
  return {
    bicyclesPage: async (req, res) => {
      const model = await useCases.getBicyclesView({
        userId: req.session?.userId,
        campId: req.session?.camp || null,
        csrfToken: res.locals?.csrfToken || req.session?.csrfToken || '',
      });
      return presentBicyclesView(model);
    },

    bicyclesData: async (req) => {
      return presentBicyclesResult(
        await useCases.getBicyclesOverview({
          campId: req.session?.camp || null,
          tableState: parseTableState(req.query?.state),
        }),
      );
    },

    bicycleRentalReport: async (req) => {
      return presentBicyclesResult(
        await useCases.getBicycleRentalReport({
          campId: req.session?.camp || null,
          fromDate: req.query?.fromDate,
          toDate: req.query?.toDate,
          tableState: parseTableState(req.query?.state),
        }),
      );
    },

    recentRentalsByAsset: async (req) => {
      return presentBicyclesResult(
        await useCases.getRecentRentalsByAsset({
          campId: req.session?.camp || null,
          assetType: req.query?.assetType,
          assetId: req.query?.assetId,
          limit: req.query?.limit,
        }),
      );
    },

    activeAssignmentsBySoldier: async (req) => {
      return presentBicyclesResult(
        await useCases.getActiveAssignmentsBySoldier({
          campId: req.session?.camp || null,
          soldierId: req.query?.soldierId,
        }),
      );
    },

    reportAssets: async (req) => {
      return presentBicyclesResult(
        await useCases.listReportAssets({
          campId: req.session?.camp || null,
          assetType: req.query?.assetType,
          search: req.query?.search || '',
          limit: req.query?.limit,
        }),
      );
    },

    reportSoldiers: async (req) => {
      return presentBicyclesResult(
        await useCases.listReportSoldiers({
          campId: req.session?.camp || null,
          search: req.query?.search || '',
          limit: req.query?.limit,
        }),
      );
    },

    soldiersData: async (req) => {
      return presentBicyclesResult(
        await useCases.listSoldiers({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          search: req.query?.search || '',
          limit: req.query?.limit,
        }),
      );
    },

    helmetsData: async (req) => {
      return presentBicyclesResult(
        await useCases.listAvailableHelmets({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          search: req.query?.search || '',
          limit: req.query?.limit,
          identifier: req.query?.identifier || null,
        }),
      );
    },

    addBicycle: async (req) => {
      return presentBicyclesResult(
        await useCases.addBicycle({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          name: req.body?.name,
          nfcCode: req.body?.nfcCode,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    addHelmet: async (req) => {
      return presentBicyclesResult(
        await useCases.addHelmet({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          code: req.body?.code,
          nfcCode: req.body?.nfcCode,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    editBicycle: async (req) => {
      return presentBicyclesResult(
        await useCases.editBicycle({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          identifier: req.body?.identifier,
          name: req.body?.name,
          nfcCode: req.body?.nfcCode,
          status: req.body?.status,
          soldierId: req.body?.soldierId,
          helmetId: req.body?.helmetId,
          rentedAt: req.body?.rentedAt,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    editHelmet: async (req) => {
      return presentBicyclesResult(
        await useCases.editHelmet({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          helmetId: req.body?.helmetId,
          code: req.body?.code,
          nfcCode: req.body?.nfcCode,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    deleteBicycle: async (req) => {
      return presentBicyclesResult(
        await useCases.deleteBicycle({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          identifier: req.body?.identifier,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    deleteHelmet: async (req) => {
      return presentBicyclesResult(
        await useCases.deleteHelmet({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          helmetId: req.body?.helmetId,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    rentBicycle: async (req) => {
      return presentBicyclesResult(
        await useCases.rentBicycle({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          identifier: req.body?.identifier,
          soldierId: req.body?.soldierId,
          helmetId: req.body?.helmetId || null,
          rentedAt: req.body?.rentedAt,
          repair: req.body?.repair,
          longTerm: req.body?.longTerm,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    returnBicycle: async (req) => {
      return presentBicyclesResult(
        await useCases.returnBicycle({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          identifier: req.body?.identifier,
          returnedAt: req.body?.returnedAt,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    downloadBicycleTemplate: async () => {
      return presentBicyclesFileResult(await useCases.downloadBicycleTemplate());
    },

    downloadHelmetTemplate: async () => {
      return presentBicyclesFileResult(await useCases.downloadHelmetTemplate());
    },


    downloadBikeMobileApp: async (req) => {
      return presentBicyclesFileResult(
        await useCases.downloadBikeMobileApp({
          actorUserId: req.session?.userId,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    downloadBicycleRentalReport: async (req) => {
      return presentBicyclesFileResult(
        await useCases.downloadBicycleRentalReport({
          campId: req.session?.camp || null,
          fromDate: req.query?.fromDate,
          toDate: req.query?.toDate,
          tableState: parseTableState(req.query?.state),
        }),
      );
    },

    importBicycles: async (req) => {
      return presentBicyclesResult(
        await useCases.importBicycles({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },

    importHelmets: async (req) => {
      return presentBicyclesResult(
        await useCases.importHelmets({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
          requestMeta: buildRequestMeta(req),
        }),
      );
    },
  };
}

module.exports = { createBicyclesController };
