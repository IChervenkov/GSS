document.addEventListener('DOMContentLoaded', function () {
    function applyFilters(tableId, filterClass, pageNumberId, rowsPerPage = 50) {
        const table = document.getElementById(tableId);
        const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
        const filters = document.querySelectorAll(`.${filterClass}`);

        const headerCheckbox = table.querySelector('.header-checkbox');
        if (headerCheckbox) {
            headerCheckbox.checked = false;
            headerCheckbox.style.backgroundColor = '';
        }

        let visibleRows = Array.from(rows); // Start with all rows visible

        // Apply filters
        filters.forEach((input, columnIndex) => {
            const searchTerm = input.value.trim().toLowerCase();
            if (searchTerm) {
                visibleRows = visibleRows.filter((row) => {
                    const cells = row.getElementsByTagName('td');

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
                    return cellToCheck && cellToCheck.textContent.toLowerCase().includes(searchTerm);
                });
            }
        });

        // Hide all rows first
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display = 'none';
        }

        // Apply pagination to filtered rows
        firstUpdateTable(visibleRows, 0, 10, pageNumberId);
    }

    function firstUpdateTable(rows, currentIndex, rowsPerPage, pageNumberId) {
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display = i >= currentIndex && i < currentIndex + rowsPerPage ? "table-row" : "none";
        }
    
        let totalPages = Math.ceil(rows.length / rowsPerPage) || 1;
        let currentPage = Math.floor(currentIndex / rowsPerPage) + 1;
        
        // Check if the page number element exists before modifying it
        const pageNumberElement = document.getElementById(pageNumberId);
        if (pageNumberElement) {
            pageNumberElement.textContent = `${currentPage}/${totalPages}`;
        }
    }    

    function attachFilterEvents(tableId, filterClass, pageNumberId = '') {
        document.querySelectorAll(`.${filterClass}`).forEach((input) => {
            input.addEventListener('input', () => {
                applyFilters(tableId, filterClass, pageNumberId);
            });
        });
    }

    // Attach filters with their respective page number IDs
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
    attachFilterEvents('assetsTable', 'search-input-view-assets', 'pageNumber');
    attachFilterEvents('assetDateTable', 'search-input-view-assets-second', 'pageNumberDate');
});
