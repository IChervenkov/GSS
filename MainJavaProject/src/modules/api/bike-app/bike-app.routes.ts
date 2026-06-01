const express = require('express');
const { AppError } = require('../../../shared/errors/app-error');
const {
  buildDeleteRoute,
  buildGetRoute,
  buildPatchRoute,
  buildPostRoute,
} = require('../../../shared/http/route-builders');
const { createBikeAppModule } = require('./bike-app.module');
const {
  assignmentsQueryDto,
  bicycleAddDto,
  bicycleDeleteDto,
  bicycleEditDto,
  campQueryDto,
  helmetAddDto,
  helmetDeleteDto,
  helmetEditDto,
  listQueryDto,
  legacyBikeAddDto,
  legacyBikeDeleteDto,
  legacyBikeEditDto,
  legacyCheckBikeQueryDto,
  legacyHelmetAddDto,
  legacyHelmetDeleteDto,
  legacyHelmetEditDto,
  legacyNfcLookupQueryDto,
  legacyRentDto,
  legacyReturnDto,
  nfcLookupQueryDto,
  rentalCreateDto,
  rentalReturnDto,
  rentalsQueryDto,
} = require('./presentation/http/bike-app.request.dto');

function createApiBikeAppRouter(dependencies = {}) {
  const router = express.Router();
  const { controller } = createBikeAppModule(dependencies);

  if (!controller) {
    throw new AppError({ status: 500, message: 'Bike app controller not wired' });
  }

  buildGetRoute(router, '/bike-app/camps', controller.camps);
  buildGetRoute(router, '/bike-app/permissions', controller.permissions);
  buildGetRoute(router, '/bike-app/inventory', campQueryDto, controller.inventory);
  buildGetRoute(router, '/bike-app/bicycles', listQueryDto, controller.bicycles);
  buildGetRoute(router, '/bike-app/helmets', listQueryDto, controller.helmets);
  buildGetRoute(router, '/bike-app/soldiers', listQueryDto, controller.soldiers);
  buildGetRoute(router, '/bike-app/nfc', nfcLookupQueryDto, controller.nfcLookup);
  buildGetRoute(router, '/bike-app/rentals', rentalsQueryDto, controller.recentRentals);
  buildGetRoute(router, '/bike-app/assignments', assignmentsQueryDto, controller.activeAssignments);
  buildGetRoute(router, '/bike-app/version', controller.appVersion);
  buildGetRoute(router, '/bike-app/mobile-app', controller.downloadMobileApp);

  buildGetRoute(router, '/apk-bike-version', controller.appVersion);
  buildGetRoute(router, '/getAllCamp', controller.legacyCamps);
  buildGetRoute(router, '/readBikeNfc', legacyNfcLookupQueryDto, controller.legacyNfcLookup);
  buildGetRoute(router, '/checkBike', legacyCheckBikeQueryDto, controller.legacyCheckBike);
  buildGetRoute(router, '/bikes', listQueryDto, controller.legacyBicycles);
  buildGetRoute(router, '/helmets', listQueryDto, controller.legacyHelmets);
  buildGetRoute(router, '/getClient', listQueryDto, controller.legacySoldiers);
  buildGetRoute(router, '/searchBikes', controller.legacyEmptyHistory);
  buildGetRoute(router, '/searchHelmet', controller.legacyEmptyHistory);
  buildGetRoute(router, '/searchClient', controller.legacyEmptyHistory);

  buildPostRoute(router, '/bike-app/bicycles', bicycleAddDto, controller.addBicycle);
  buildPatchRoute(router, '/bike-app/bicycles', bicycleEditDto, controller.editBicycle);
  buildDeleteRoute(router, '/bike-app/bicycles', bicycleDeleteDto, controller.deleteBicycle);

  buildPostRoute(router, '/bike-app/helmets', helmetAddDto, controller.addHelmet);
  buildPatchRoute(router, '/bike-app/helmets', helmetEditDto, controller.editHelmet);
  buildDeleteRoute(router, '/bike-app/helmets', helmetDeleteDto, controller.deleteHelmet);

  buildPostRoute(router, '/bike-app/rentals', rentalCreateDto, controller.rentBicycle);
  buildPostRoute(router, '/bike-app/returns', rentalReturnDto, controller.returnBicycle);

  buildPostRoute(router, '/bicycles/addBike', legacyBikeAddDto, controller.legacyAddBicycle);
  buildPostRoute(router, '/bicycles/addHelmet', legacyHelmetAddDto, controller.legacyAddHelmet);
  buildPatchRoute(router, '/editParameturBike', legacyBikeEditDto, controller.legacyEditBicycle);
  buildPatchRoute(router, '/editParameturHelmet', legacyHelmetEditDto, controller.legacyEditHelmet);
  buildDeleteRoute(router, '/bicycles/removeBike', legacyBikeDeleteDto, controller.legacyDeleteBicycle);
  buildDeleteRoute(router, '/bicycles/removeHelmet', legacyHelmetDeleteDto, controller.legacyDeleteHelmet);
  buildPostRoute(router, '/nfcRent', legacyRentDto, controller.legacyRentBicycle);
  buildPostRoute(router, '/nfcReturn', legacyReturnDto, controller.legacyReturnBicycle);

  return router;
}

module.exports = { createApiBikeAppRouter };
