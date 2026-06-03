// @ts-nocheck
const {
  presentBikeAppFile,
  presentBikeAppRaw,
  presentBikeAppResult,
} = require('./bike-app.presenter');

function bodyOf(result = {}) {
  return result?.body || {};
}

function actorUserId(req) {
  return req.user?.id || req.auth?.id || null;
}

function parseInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : value;
}

function parseFilters(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function statusLabel(value) {
  const status = String(value || '').toLowerCase();
  if (status === 'long_term') return 'Long term';
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Available';
}

function createBikeAppController({ useCases }) {
  return {
    camps: async (req) =>
      presentBikeAppResult(
        await useCases.listCamps({
          actorUserId: actorUserId(req),
          page: req.query?.page,
          limit: req.query?.limit,
        }),
      ),

    permissions: async (req) =>
      presentBikeAppResult(
        await useCases.currentPermissions({
          actorUserId: actorUserId(req),
        }),
      ),

    inventory: async (req) =>
      presentBikeAppResult(
        await useCases.inventory({
          actorUserId: actorUserId(req),
          campId: req.query?.campId,
        }),
      ),

    bicycles: async (req) =>
      presentBikeAppResult(
        await useCases.listBicycles({
          actorUserId: actorUserId(req),
          campId: req.query?.campId,
          search: req.query?.search,
          page: parseInteger(req.query?.page),
          limit: parseInteger(req.query?.limit),
          filters: parseFilters(req.query?.filters),
          sortColumn: req.query?.sortColumn,
          sortDirection: req.query?.sortDirection,
        }),
      ),

    helmets: async (req) =>
      presentBikeAppResult(
        await useCases.listHelmets({
          actorUserId: actorUserId(req),
          campId: req.query?.campId,
          search: req.query?.search,
          page: parseInteger(req.query?.page),
          limit: parseInteger(req.query?.limit),
          filters: parseFilters(req.query?.filters),
          sortColumn: req.query?.sortColumn,
          sortDirection: req.query?.sortDirection,
        }),
      ),

    legacyBicycles: async (req) => {
      const body = bodyOf(
        await useCases.listBicycles({
          actorUserId: actorUserId(req),
          campId: req.query?.campId,
          search: req.query?.search,
          limit: req.query?.limit,
        }),
      );
      return presentBikeAppRaw(
        (body.bicycles || []).map((item) => ({
          id: item.nfcCode,
          identifier: item.id,
          name: item.name,
          status: statusLabel(item.status),
        })),
      );
    },

    legacyHelmets: async (req) => {
      const body = bodyOf(
        await useCases.listHelmets({
          actorUserId: actorUserId(req),
          campId: req.query?.campId,
          search: req.query?.search,
          limit: req.query?.limit,
        }),
      );
      return presentBikeAppRaw(
        (body.helmets || []).map((item) => ({
          id: item.nfcCode,
          identifier: item.id,
          name: item.code,
          code: statusLabel(item.status),
          status: statusLabel(item.status),
        })),
      );
    },

    legacySoldiers: async (req) => {
      const body = bodyOf(
        await useCases.listSoldiers({
          actorUserId: actorUserId(req),
          campId: req.query?.campId,
          search: req.query?.search,
          limit: req.query?.limit,
        }),
      );
      return presentBikeAppRaw(
        (body.soldiers || []).map((item) => ({
          id: item.id,
          keyid: item.mealCard,
          namesoldier: item.name,
          namekey: item.mealCard || 'null',
          name: item.name,
          country: item.country,
          meal_card: item.mealCard,
          count_get_bike: item.activeAssignmentCount,
        })),
      );
    },

    legacyCamps: async (req) => {
      const body = bodyOf(
        await useCases.listCamps({
          actorUserId: actorUserId(req),
          page: req.query?.page,
          limit: req.query?.limit,
        }),
      );
      return presentBikeAppRaw(
        (body.camps || []).map((camp) => ({
          id: camp.id,
          campname: camp.name,
          name: camp.name,
        })),
      );
    },

    legacyEmptyHistory: async () => presentBikeAppRaw([]),

    soldiers: async (req) =>
      presentBikeAppResult(
        await useCases.listSoldiers({
          actorUserId: actorUserId(req),
          campId: req.query?.campId,
          search: req.query?.search,
          limit: req.query?.limit,
        }),
      ),

    nfcLookup: async (req) =>
      presentBikeAppResult(
        await useCases.lookupNfc({
          actorUserId: actorUserId(req),
          campId: req.query?.campId,
          nfcData: req.query?.nfcData,
        }),
      ),

    legacyNfcLookup: async (req) =>
      presentBikeAppResult(
        await useCases.legacyLookupNfc({
          actorUserId: actorUserId(req),
          campId: req.query?.campId || null,
          nfcData: req.query?.nfcData,
        }),
      ),

    legacyCheckBike: async (req) =>
      presentBikeAppResult(
        await useCases.legacyCheckBike({
          actorUserId: actorUserId(req),
          nfcData: req.query?.bikeId,
        }),
      ),

    recentRentals: async (req) =>
      presentBikeAppResult(
        await useCases.recentRentals({
          actorUserId: actorUserId(req),
          campId: req.query?.campId,
          assetType: req.query?.assetType,
          assetId: req.query?.assetId,
          limit: req.query?.limit,
        }),
      ),

    activeAssignments: async (req) =>
      presentBikeAppResult(
        await useCases.activeAssignments({
          actorUserId: actorUserId(req),
          campId: req.query?.campId,
          soldierId: req.query?.soldierId,
        }),
      ),

    addBicycle: async (req) =>
      presentBikeAppResult(
        await useCases.addBicycle({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          name: req.body?.name,
          nfcCode: req.body?.nfcCode,
          req,
        }),
      ),

    legacyAddBicycle: async (req) =>
      presentBikeAppResult(
        await useCases.legacyAddBicycle({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          bikeName: req.body?.bikeName,
          bikeAddId: req.body?.bikeAddId,
          req,
        }),
      ),

    editBicycle: async (req) =>
      presentBikeAppResult(
        await useCases.editBicycle({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          identifier: req.body?.identifier,
          name: req.body?.name,
          nfcCode: req.body?.nfcCode,
          status: req.body?.status,
          soldierId: req.body?.soldierId,
          helmetId: req.body?.helmetId,
          rentedAt: req.body?.rentedAt,
          req,
        }),
      ),

    legacyEditBicycle: async (req) =>
      presentBikeAppResult(
        await useCases.legacyEditBicycle({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          oldNfcContent: req.body?.oldNfcContent || req.body?.oldBikeId,
          newNfcContent: req.body?.newNfcContent || req.body?.newBikeId,
          bikeName: req.body?.bikeName,
          req,
        }),
      ),

    deleteBicycle: async (req) =>
      presentBikeAppResult(
        await useCases.deleteBicycle({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          identifier: req.body?.identifier,
          req,
        }),
      ),

    legacyDeleteBicycle: async (req) =>
      presentBikeAppResult(
        await useCases.legacyDeleteBicycle({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          bikeRemoveId: req.body?.bikeRemoveId,
          req,
        }),
      ),

    addHelmet: async (req) =>
      presentBikeAppResult(
        await useCases.addHelmet({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          code: req.body?.code,
          nfcCode: req.body?.nfcCode,
          req,
        }),
      ),

    legacyAddHelmet: async (req) =>
      presentBikeAppResult(
        await useCases.legacyAddHelmet({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          helmetName: req.body?.helmetName,
          helmetAddId: req.body?.helmetAddId,
          req,
        }),
      ),

    editHelmet: async (req) =>
      presentBikeAppResult(
        await useCases.editHelmet({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          helmetId: req.body?.helmetId,
          code: req.body?.code,
          nfcCode: req.body?.nfcCode,
          req,
        }),
      ),

    legacyEditHelmet: async (req) =>
      presentBikeAppResult(
        await useCases.legacyEditHelmet({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          oldNfcContent: req.body?.oldNfcContent || req.body?.oldHelmetId,
          newNfcContent: req.body?.newNfcContent || req.body?.newHelmetId,
          helmetName: req.body?.helmetName,
          req,
        }),
      ),

    deleteHelmet: async (req) =>
      presentBikeAppResult(
        await useCases.deleteHelmet({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          helmetId: req.body?.helmetId,
          req,
        }),
      ),

    legacyDeleteHelmet: async (req) =>
      presentBikeAppResult(
        await useCases.legacyDeleteHelmet({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          bikeRemoveId: req.body?.bikeRemoveId,
          code: req.body?.code,
          helmetRemoveId: req.body?.helmetRemoveId,
          req,
        }),
      ),

    rentBicycle: async (req) =>
      presentBikeAppResult(
        await useCases.rentBicycle({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          identifier: req.body?.identifier,
          soldierId: req.body?.soldierId,
          helmetId: req.body?.helmetId || null,
          rentedAt: req.body?.rentedAt,
          repair: req.body?.repair,
          longTerm: req.body?.longTerm,
          req,
        }),
      ),

    legacyRentBicycle: async (req) =>
      presentBikeAppResult(
        await useCases.legacyRentBicycle({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          nfcData: req.body?.nfcData,
          date: req.body?.date,
          time: req.body?.time,
          selectClient: req.body?.selectClient,
          helmetId: req.body?.helmetId,
          req,
        }),
      ),

    returnBicycle: async (req) =>
      presentBikeAppResult(
        await useCases.returnBicycle({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          identifier: req.body?.identifier,
          returnedAt: req.body?.returnedAt,
          req,
        }),
      ),

    legacyReturnBicycle: async (req) =>
      presentBikeAppResult(
        await useCases.legacyReturnBicycle({
          actorUserId: actorUserId(req),
          campId: req.body?.campId,
          nfcData: req.body?.nfcData,
          date: req.body?.date,
          time: req.body?.time,
          req,
        }),
      ),

    appVersion: async (req) =>
      presentBikeAppResult(await useCases.appVersion({ actorUserId: actorUserId(req) })),

    downloadMobileApp: async (req) =>
      presentBikeAppFile(
        await useCases.downloadMobileApp({
          actorUserId: actorUserId(req),
          req,
        }),
      ),
  };
}

module.exports = { createBikeAppController };
