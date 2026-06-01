function toAccommodationResponseDto(result = {}) {
  return { ...(result?.body || result || {}) };
}

function toAccommodationViewResponseDto(model = {}) {
  return {
    title: model.title || 'Accommodation and keys',
    pageKey: model.pageKey || 'accommodation-page',
    currentNav: model.currentNav || 'Accommodation and keys',
    eyebrow: model.eyebrow || 'Accommodation desk',
    intro: model.intro || '',
    horizontalNavItems: Array.isArray(model.horizontalNavItems) ? model.horizontalNavItems : [],
    permissionNames: Array.isArray(model.permissionNames) ? model.permissionNames : [],
    campId: model.campId || null,
    csrfToken: model.csrfToken || '',
  };
}

function toUpcomingSummaryResponseDto(result = {}) {
  return toAccommodationResponseDto(result);
}

module.exports = {
  toAccommodationResponseDto,
  toUpcomingSummaryResponseDto,
  toAccommodationViewResponseDto,
};
