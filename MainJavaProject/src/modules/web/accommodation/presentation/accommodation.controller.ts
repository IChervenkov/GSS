const {
  presentAccommodationFileResult,
  presentAccommodationSummary,
  presentAccommodationView,
} = require('./accommodation.presenter');

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

function createAccommodationController({ useCases }) {
  return {
    accommodationPage: async (req, res) => {
      const model = await useCases.getAccommodationView({
        userId: req.session?.userId,
        campId: req.session?.campId || req.session?.camp || null,
        csrfToken: res.locals?.csrfToken || req.session?.csrfToken || '',
      });
      return presentAccommodationView(model);
    },

    accommodationData: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.getAccommodationOverview({
          campId,
          tableState: parseTableState(req.query?.state),
        }),
      );
    },

    accommodationLookup: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.listAccommodationLookupOptions({
          campId,
          type: req.query?.type,
          search: req.query?.search,
          limit: req.query?.limit,
          onlyFree: req.query?.onlyFree,
          onlyOccupied: req.query?.onlyOccupied,
          excludedSoldierId: req.query?.excludedSoldierId,
          excludedKeyIds: req.query?.excludedKeyIds,
        }),
      );
    },

    upcomingSummary: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(await useCases.getUpcomingSummary({ campId }));
    },

    downloadAccommodationReport: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationFileResult(
        await useCases.downloadAccommodationReport({
          campId,
          section: req.query?.section,
          fromDate: req.query?.fromDate,
          toDate: req.query?.toDate,
          tableState: parseTableState(req.query?.state),
        }),
      );
    },

    addBuilding: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.addBuilding({
          actorUserId: req.session?.userId,
          campId,
          name: req.body?.name,
          type: req.body?.type,
        }),
      );
    },

    editBuilding: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.editBuilding({
          actorUserId: req.session?.userId,
          campId,
          buildingId: req.body?.buildingId,
          name: req.body?.name,
          type: req.body?.type,
        }),
      );
    },

    deleteBuilding: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.deleteBuilding({
          actorUserId: req.session?.userId,
          campId,
          buildingId: req.body?.buildingId,
        }),
      );
    },

    addRoom: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.addRoom({
          actorUserId: req.session?.userId,
          campId,
          name: req.body?.name,
          buildingId: req.body?.buildingId,
        }),
      );
    },

    editRoom: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.editRoom({
          actorUserId: req.session?.userId,
          campId,
          roomId: req.body?.roomId,
          name: req.body?.name,
          buildingId: req.body?.buildingId,
        }),
      );
    },

    deleteRoom: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.deleteRoom({
          actorUserId: req.session?.userId,
          campId,
          roomId: req.body?.roomId,
        }),
      );
    },

    addKey: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.addKey({
          actorUserId: req.session?.userId,
          campId,
          name: req.body?.name,
          nfcCode: req.body?.nfcCode,
          roomId: req.body?.roomId,
        }),
      );
    },

    editKey: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.editKey({
          actorUserId: req.session?.userId,
          campId,
          keyId: req.body?.keyId,
          name: req.body?.name,
          nfcCode: req.body?.nfcCode,
          roomId: req.body?.roomId,
        }),
      );
    },

    deleteKey: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.deleteKey({
          actorUserId: req.session?.userId,
          campId,
          keyId: req.body?.keyId,
        }),
      );
    },

    issueKeyToSoldier: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.issueKeyToSoldier({
          actorUserId: req.session?.userId,
          campId,
          keyId: req.body?.keyId,
          soldierId: req.body?.soldierId,
        }),
      );
    },

    releaseKeyFromSoldier: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.releaseKeyFromSoldier({
          actorUserId: req.session?.userId,
          campId,
          keyId: req.body?.keyId,
        }),
      );
    },

    addSoldier: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.addSoldier({
          actorUserId: req.session?.userId,
          campId,
          name: req.body?.name,
          country: req.body?.country,
          mealCard: req.body?.mealCard,
          laundryBagId: req.body?.laundryBagId,
          upcomingAccommodation: req.body?.upcomingAccommodation,
          upcomingRelease: req.body?.upcomingRelease,
          upcomingAccommodationKey: req.body?.upcomingAccommodationKey,
        }),
      );
    },

    editSoldier: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.editSoldier({
          actorUserId: req.session?.userId,
          campId,
          soldierId: req.body?.soldierId,
          name: req.body?.name,
          country: req.body?.country,
          mealCard: req.body?.mealCard,
          laundryBagId: req.body?.laundryBagId,
          upcomingAccommodation: req.body?.upcomingAccommodation,
          upcomingRelease: req.body?.upcomingRelease,
          upcomingAccommodationKey: req.body?.upcomingAccommodationKey,
        }),
      );
    },

    deleteSoldier: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.deleteSoldier({
          actorUserId: req.session?.userId,
          campId,
          soldierId: req.body?.soldierId,
        }),
      );
    },

    accommodateSoldier: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.accommodateSoldier({
          actorUserId: req.session?.userId,
          campId,
          soldierId: req.body?.soldierId,
          keyId: req.body?.keyId,
          keyIds: req.body?.keyIds,
        }),
      );
    },

    accommodateSoldiers: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.accommodateSoldiers({
          actorUserId: req.session?.userId,
          campId,
          assignments: req.body?.assignments,
        }),
      );
    },

    dischargeSoldier: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.dischargeSoldier({
          actorUserId: req.session?.userId,
          campId,
          soldierId: req.body?.soldierId,
        }),
      );
    },

    releaseRooms: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.releaseRooms({
          actorUserId: req.session?.userId,
          campId,
          roomIds: req.body?.roomIds,
        }),
      );
    },

    releaseBuildings: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.releaseBuildings({
          actorUserId: req.session?.userId,
          campId,
          buildingIds: req.body?.buildingIds,
        }),
      );
    },

    moveSoldier: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.moveSoldier({
          actorUserId: req.session?.userId,
          campId,
          soldierId: req.body?.soldierId,
          keyId: req.body?.keyId,
          keyIds: req.body?.keyIds,
        }),
      );
    },

    swapSoldiers: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.swapSoldiers({
          actorUserId: req.session?.userId,
          campId,
          soldierId: req.body?.soldierId,
          targetSoldierId: req.body?.targetSoldierId,
        }),
      );
    },

    addAdditionalItem: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.addAdditionalItem({
          actorUserId: req.session?.userId,
          campId,
          soldierId: req.body?.soldierId,
          description: req.body?.description,
          quantity: req.body?.quantity,
          laundryBagId: req.body?.laundryBagId,
        }),
      );
    },

    editAdditionalItem: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.editAdditionalItem({
          actorUserId: req.session?.userId,
          campId,
          itemId: req.body?.itemId,
          soldierId: req.body?.soldierId,
          description: req.body?.description,
          quantity: req.body?.quantity,
          laundryBagId: req.body?.laundryBagId,
        }),
      );
    },

    deleteAdditionalItem: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.deleteAdditionalItem({
          actorUserId: req.session?.userId,
          campId,
          itemId: req.body?.itemId,
        }),
      );
    },

    downloadBuildingTemplate: async (req) => {
      return presentAccommodationFileResult(
        await useCases.downloadBuildingTemplate({
          actorUserId: req.session?.userId,
        }),
      );
    },

    downloadRoomTemplate: async (req) => {
      return presentAccommodationFileResult(
        await useCases.downloadRoomTemplate({
          actorUserId: req.session?.userId,
        }),
      );
    },

    downloadKeyTemplate: async (req) => {
      return presentAccommodationFileResult(
        await useCases.downloadKeyTemplate({
          actorUserId: req.session?.userId,
        }),
      );
    },

    downloadSoldierTemplate: async (req) => {
      return presentAccommodationFileResult(
        await useCases.downloadSoldierTemplate({
          actorUserId: req.session?.userId,
        }),
      );
    },

    downloadAdditionalItemTemplate: async (req) => {
      return presentAccommodationFileResult(
        await useCases.downloadAdditionalItemTemplate({
          actorUserId: req.session?.userId,
        }),
      );
    },

    importBuildings: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.importBuildings({
          actorUserId: req.session?.userId,
          campId,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
        }),
      );
    },

    importRooms: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.importRooms({
          actorUserId: req.session?.userId,
          campId,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
        }),
      );
    },

    importKeys: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.importKeys({
          actorUserId: req.session?.userId,
          campId,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
        }),
      );
    },

    importSoldiers: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.importSoldiers({
          actorUserId: req.session?.userId,
          campId,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
        }),
      );
    },

    importAdditionalItems: async (req) => {
      const campId = req.session?.campId || req.session?.camp || null;
      return presentAccommodationSummary(
        await useCases.importAdditionalItems({
          actorUserId: req.session?.userId,
          campId,
          fileBuffer: req.file?.buffer,
          fileName: req.file?.originalname,
        }),
      );
    },
  };
}

module.exports = { createAccommodationController };
