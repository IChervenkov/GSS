function normalizeBicycleStatus(value) {
  const status = String(value || '')
    .trim()
    .toLowerCase();

  if (status === 'rented') return 'rented';
  if (status === 'repair') return 'repair';
  if (status === 'late') return 'late';
  if (status === 'long_term') return 'long_term';
  return 'available';
}

function createEmptyBicyclesOverview() {
  return {
    available: 0,
    rented: 0,
    repair: 0,
    late: 0,
    longTerm: 0,
    rows: [],
  };
}

module.exports = {
  normalizeBicycleStatus,
  createEmptyBicyclesOverview,
};
