document.addEventListener('DOMContentLoaded', function () {
    const tablePagination = {};

    function applyFilters(tableId, filterClass, pageNumberId, rowsPerPage = 10) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const rows = Array.from(table.getElementsByTagName('tbody')[0].getElementsByTagName('tr'));
        const filters = document.querySelectorAll(`.${filterClass}`);
        const headerCheckbox = table.querySelector('.header-checkbox');

        if (headerCheckbox) {
            headerCheckbox.checked = false;
            headerCheckbox.style.backgroundColor = '';
        }

        let visibleRows = [...rows];

        // Apply filters
        filters.forEach((input, columnIndex) => {
            const searchTerm = input.value.trim().toLowerCase();
            if (searchTerm) {
                visibleRows = visibleRows.filter((row) => {
                    const cells = row.getElementsByTagName('td');

                    // Configurable column index adjustment
                    const offsetTables = ['assetTable', 'soldierTable', 'bagsTable', 'helmetTable', 'largeWorkhouse', 'smallWorkhouse'];
                    const effectiveColumnIndex = offsetTables.includes(tableId) ? columnIndex + 1 : columnIndex;

                    const cellToCheck = cells[effectiveColumnIndex];
                    return cellToCheck && cellToCheck.textContent.toLowerCase().includes(searchTerm);
                });
            }
        });

        // Hide all rows first
        rows.forEach(row => row.style.display = 'none');

        // Apply pagination to filtered rows
        updateTable(visibleRows, 0, rowsPerPage, pageNumberId);

        // Attach pagination controls once
        attachPaginationControls('prevBtn', 'nextBtn', 'pageNumber');
        attachPaginationControls('prevBtnDate', 'nextBtnDate', 'pageNumberDate');
        attachPaginationControls('prevBtnSecond', 'nextBtnSecond', 'pageNumberSecond');
        attachPaginationControls('prevBtnTherd', 'nextBtnTherd', 'pageNumberTherd');
        attachPaginationControls('prevBtnFourth', 'nextBtnFourth', 'pageNumberFourth');
        attachPaginationControls('prevBtnFifth', 'nextBtnFifth', 'pageNumberFifth');
        attachPaginationControls('prevBtnSixth', 'nextBtnSixth', 'pageNumberSixth');
    }

    function updateTable(rows, currentIndex, rowsPerPage, pageNumberId) {
        rows.forEach((row, index) => {
            row.style.display = index >= currentIndex && index < currentIndex + rowsPerPage ? "table-row" : "none";
        });

        const totalPages = Math.ceil(rows.length / rowsPerPage) || 1;
        const currentPage = Math.floor(currentIndex / rowsPerPage) + 1;

        // Update page number display if element exists
        const pageNumberElement = document.getElementById(pageNumberId);
        if (pageNumberElement) {
            pageNumberElement.textContent = `${currentPage}/${totalPages}`;
        }

        // Store pagination data
        tablePagination[pageNumberId] = { rows, currentIndex, rowsPerPage };
    }

    function attachPaginationControls(prevBtnId, nextBtnId, pageNumberId) {
        const prevBtn = document.getElementById(prevBtnId);
        const nextBtn = document.getElementById(nextBtnId);

        if (!prevBtn || !nextBtn || !tablePagination[pageNumberId]) return;

        // Remove previous event listeners to prevent duplication
        prevBtn.replaceWith(prevBtn.cloneNode(true));
        nextBtn.replaceWith(nextBtn.cloneNode(true));

        const newPrevBtn = document.getElementById(prevBtnId);
        const newNextBtn = document.getElementById(nextBtnId);

        newPrevBtn.onclick = () => {
            if (tablePagination[pageNumberId].currentIndex > 0) {
                tablePagination[pageNumberId].currentIndex -= tablePagination[pageNumberId].rowsPerPage;
                updateTable(
                    tablePagination[pageNumberId].rows,
                    tablePagination[pageNumberId].currentIndex,
                    tablePagination[pageNumberId].rowsPerPage,
                    pageNumberId
                );
            }
        };

        newNextBtn.onclick = () => {
            if (tablePagination[pageNumberId].currentIndex + tablePagination[pageNumberId].rowsPerPage < tablePagination[pageNumberId].rows.length) {
                tablePagination[pageNumberId].currentIndex += tablePagination[pageNumberId].rowsPerPage;
                updateTable(
                    tablePagination[pageNumberId].rows,
                    tablePagination[pageNumberId].currentIndex,
                    tablePagination[pageNumberId].rowsPerPage,
                    pageNumberId
                );
            }
        };
    }

    function attachFilterEvents(tableId, filterClass, pageNumberId = '', rowsPerPage = 10) {
        document.querySelectorAll(`.${filterClass}`).forEach((input) => {
            input.addEventListener('input', () => {
                applyFilters(tableId, filterClass, pageNumberId, rowsPerPage);
            });
        });
    }

    // Attach filters with their respective page number IDs
    attachFilterEvents('soldierUsageTable', 'search-input-view', 'pageNumber');
    attachFilterEvents('soldierMoveTable', 'search-input-view-second','pageNumberDate');
    attachFilterEvents('bagsWashedTable', 'search-input-view-laundry', 'pageNumber');
    attachFilterEvents('bagsWashedNationalityTable', 'search-input-view-laundry-second', 'pageNumberDate');
    attachFilterEvents('data-table', 'search-input');
    attachFilterEvents('bikeUsageTable', 'search-input-view-bike', 'pageNumber');
    attachFilterEvents('bikeTotalsTable', 'search-input-view-total-bike', 'pageNumberDate');
    attachFilterEvents('assetTable', 'asset-search-input', 'pageNumberSecond');
    attachFilterEvents('soldierTable', 'search-input-soldier', 'pageNumberSecond');
    attachFilterEvents('upcomingActionTable', 'search-input-upcoming-action', 'pageNumberFourth');
    attachFilterEvents('bagsTable', 'laundry-search-input', 'pageNumberSecond');
    attachFilterEvents('assetsTable', 'search-input-view-assets', 'pageNumber');
    attachFilterEvents('assetDateTable', 'search-input-view-assets-second', 'pageNumberDate');
    attachFilterEvents('lostItemsTable', 'lost-item-search-input', 'pageNumberTherd');
    attachFilterEvents('additonalItemTable', 'additional-item-search-input', 'pageNumberTherd');
    attachFilterEvents('helmetTable', 'search-input-helmet', 'pageNumberSecond');
    attachFilterEvents('largeWorkhouse', 'search-input-clean-item', 'pageNumberFourth', 7);
    attachFilterEvents('smallWorkhouse', 'second-search-input-clean-item', 'pageNumberFifth', 7);
    attachFilterEvents('itemTraceabilityTable', 'search-input-traceability', 'pageNumberSixth');
});
