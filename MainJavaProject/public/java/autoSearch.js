document.addEventListener('DOMContentLoaded', function () {
    // General function to apply filters on a table
    function applyFilters(tableId, filterClass) {
        const table = document.getElementById(tableId);
        const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
        const filters = document.querySelectorAll(`.${filterClass}`);


        // Reset the header checkbox (if present)
        const headerCheckbox = table.querySelector('.header-checkbox');
        if (headerCheckbox) {
            headerCheckbox.checked = false;
            headerCheckbox.style.backgroundColor = '';
        }

        // Show all rows initially
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display = '';
        }

        // Apply filters column by column
        filters.forEach((input, columnIndex) => {
            const searchTerm = input.value.trim().toLowerCase();
            if (searchTerm) {
                for (let i = 0; i < rows.length; i++) {
                    const cells = rows[i].getElementsByTagName('td');

                    // Skip the first column if tableId is 'assetTable'
                    let effectiveColumnIndex;
                    switch (tableId) {
                        case 'assetTable':
                        case 'soldierTable':
                        case 'bagsTable':
                            effectiveColumnIndex = columnIndex + 1;
                            break;
                        default:
                            effectiveColumnIndex = columnIndex;
                            break;
                    }

                    const cellToCheck = cells[effectiveColumnIndex];
                    if (cellToCheck) {
                        const cellText = cellToCheck.textContent.toLowerCase();
                        if (!cellText.includes(searchTerm)) {
                            rows[i].style.display = 'none'; // Hide unmatched row
                        }
                    }
                }
            }
        });
    }

    // Attach event listeners to inputs
    function attachFilterEvents(tableId, filterClass) {
        document.querySelectorAll(`.${filterClass}`).forEach((input) => {
            input.addEventListener('input', () => {
                applyFilters(tableId, filterClass);
            });
        });
    }

    // Apply for each table
    attachFilterEvents('soldierUsageTable', 'search-input-view');
    attachFilterEvents('soldierMoveTable', 'search-input-view-second');
    attachFilterEvents('bagsWashedTable', 'search-input-view-laundry');
    attachFilterEvents('bagsWashedNationalityTable', 'search-input-view-laundry-second');
    attachFilterEvents('data-table', 'search-input');
    attachFilterEvents('bikeUsageTable', 'search-input-view-bike');
    attachFilterEvents('bikeTotalsTable', 'search-input-view-total-bike');
    attachFilterEvents('assetTable', 'asset-search-input');
    attachFilterEvents('soldierTable', 'search-input-soldier');
    attachFilterEvents('bagsTable', 'laundry-search-input');
});
