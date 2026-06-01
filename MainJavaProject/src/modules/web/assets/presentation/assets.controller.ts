const { presentAssetsFileResult, presentAssetsResult, presentAssetsView } = require('./assets.presenter');

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

function createAssetsController({ useCases }) {
  return {
    assetsPage: async (req, res) => {
      const model = await useCases.getAssetsView({
        userId: req.session?.userId,
        campId: req.session?.camp || null,
        csrfToken: res.locals?.csrfToken || req.session?.csrfToken || '',
      });

      return presentAssetsView(model);
    },

    assetsData: async (req) => {
      return presentAssetsResult(
        await useCases.getAssetsData({
          campId: req.session?.camp || null,
          tableState: parseTableState(req.query?.state),
        }),
      );
    },

    downloadAssetTemplate: async (req) => {
      return presentAssetsFileResult(
        await useCases.downloadAssetTemplate({
          actorUserId: req.session?.userId,
        }),
      );
    },

    downloadAssetTypeTemplate: async (req) => {
      return presentAssetsFileResult(
        await useCases.downloadAssetTypeTemplate({
          actorUserId: req.session?.userId,
        }),
      );
    },

    downloadCleanItemTemplate: async (req) => {
      return presentAssetsFileResult(
        await useCases.downloadCleanItemTemplate({
          actorUserId: req.session?.userId,
        }),
      );
    },

    downloadAssetsMobileApp: async (req) => {
      return presentAssetsFileResult(
        await useCases.downloadAssetsMobileApp({
          actorUserId: req.session?.userId,
          requestMeta: {
            reqId: req.id || req.reqId,
            ip: req.ip,
            userAgent: req.get?.('user-agent'),
          },
        }),
      );
    },

    addAsset: async (req) => {
      return presentAssetsResult(
        await useCases.addAsset({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          payload: req.body,
        }),
      );
    },

    addAssetType: async (req) => {
      return presentAssetsResult(
        await useCases.addAssetType({
          actorUserId: req.session?.userId,
          name: req.body?.name,
        }),
      );
    },

    editAssetType: async (req) => {
      return presentAssetsResult(
        await useCases.editAssetType({
          actorUserId: req.session?.userId,
          typeId: req.body?.typeId,
          name: req.body?.name,
        }),
      );
    },

    deleteAssetType: async (req) => {
      return presentAssetsResult(
        await useCases.deleteAssetType({
          actorUserId: req.session?.userId,
          typeId: req.body?.typeId,
        }),
      );
    },

    bulkUpdateAssetTypes: async (req) => {
      return presentAssetsResult(
        await useCases.bulkUpdateAssetTypes({
          actorUserId: req.session?.userId,
          payload: req.body?.payload,
        }),
      );
    },

    editAsset: async (req) => {
      return presentAssetsResult(
        await useCases.editAsset({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          assetId: req.body?.assetId,
          payload: req.body,
        }),
      );
    },

    deleteAsset: async (req) => {
      return presentAssetsResult(
        await useCases.deleteAsset({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          assetId: req.body?.assetId,
        }),
      );
    },

    restartInventory: async (req) => {
      return presentAssetsResult(
        await useCases.restartInventory({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
        }),
      );
    },

    bulkUpdateAssets: async (req) => {
      return presentAssetsResult(
        await useCases.bulkUpdateAssets({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          payload: req.body?.payload,
        }),
      );
    },

    addCleanItem: async (req) => {
      return presentAssetsResult(
        await useCases.addCleanItem({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          payload: req.body,
        }),
      );
    },

    editCleanItem: async (req) => {
      return presentAssetsResult(
        await useCases.editCleanItem({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          itemId: req.body?.itemId,
          payload: req.body,
        }),
      );
    },

    moveCleanItem: async (req) => {
      return presentAssetsResult(
        await useCases.moveCleanItem({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          itemId: req.body?.itemId,
          warehouse: req.body?.warehouse,
          quantity: req.body?.quantity,
        }),
      );
    },

    deleteCleanItem: async (req) => {
      return presentAssetsResult(
        await useCases.deleteCleanItem({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          itemId: req.body?.itemId,
        }),
      );
    },

    bulkUpdateCleanItems: async (req) => {
      return presentAssetsResult(
        await useCases.bulkUpdateCleanItems({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          payload: req.body?.payload,
        }),
      );
    },

    importAssets: async (req) => {
      return presentAssetsResult(
        await useCases.importAssets({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
        }),
      );
    },

    importAssetTypes: async (req) => {
      return presentAssetsResult(
        await useCases.importAssetTypes({
          actorUserId: req.session?.userId,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
        }),
      );
    },

    importCleanItems: async (req) => {
      return presentAssetsResult(
        await useCases.importCleanItems({
          actorUserId: req.session?.userId,
          campId: req.session?.camp || null,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
        }),
      );
    },
  };
}

module.exports = { createAssetsController };
