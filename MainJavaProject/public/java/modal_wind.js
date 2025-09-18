document.addEventListener('DOMContentLoaded', function () {

    const bikeLabel = document.getElementById('modalBikeLabel');
    const clientLabel = document.getElementById('modalClientLabel');
    const labelClient = document.getElementById('labelClient');

    const modalCheckBoxLabel = document.getElementById('confirmationCheckboxLabel');
    const modalCheckBox = document.getElementById('confirmationCheckbox');

    const hourSelect = document.getElementById('hourSelect');
    const minuteSelect = document.getElementById('minuteSelect');
    const selectedDateMain = document.querySelector("#selectedDateMail");

    const modalAddBike = document.getElementById('addBikeModal');
    const modalAddBikeContent = modalAddBike.querySelector('.modal-content');

    const modalAddHelmet = document.getElementById('addHelmetModal');
    const modalAddHelmetContent = modalAddHelmet.querySelector('.modal-content');

    const modalRemoveBike = document.getElementById('removeBikeModal');
    const modalRemoveBikeContent = modalRemoveBike.querySelector('.modal-content');

    const modalAddMultiBike = document.getElementById('addMultiBikeModal');
    const modalAddMultiBikeContent = modalAddMultiBike.querySelector('.modal-content');

    const modalAddMultiHelmet = document.getElementById('addMultiHelmetModal');
    const modalAddMultiHelmetContent = modalAddMultiHelmet.querySelector('.modal-content');

    const modalEditBike = document.getElementById('bikeEditModal');
    const modalEditBikeContent = modalEditBike.querySelector('.modal-content');

    const modalListHelmets = document.getElementById('listHelmetsModal');
    const modalListHelmetsContent = modalListHelmets.querySelector('.modal-content');

    const selectedStatus = document.getElementById('statusSelect');
    const selectedBike = document.getElementById('editBikeSearch');
    const editDateFrom = document.getElementById('editDateFrom');

    const csrfToken = document.getElementsByName('_csrf')[0].value;

    var editBikeSearchId;

    // Get the modal
    var modal = document.getElementById("myModal");
    var modalContent = modal.querySelector('.modal-content');

    var modalMessRep = document.getElementById("myMessage");
    var modalMessRepContent = modalMessRep.querySelector('.modal-content-mess');

    var modalRep = document.getElementById("reportModal");
    var modalRepContent = modalRep.querySelector(".modal-content-multi-calendar");

    var modalViewRep = document.getElementById("reportViewModal");
    var modalViewRepContent = modalViewRep.querySelector(".modal-content-view");

    var modalTotalBike = document.getElementById("totalRentBikeModal");
    var modalTotalBikeContent = modalTotalBike.querySelector(".modal-content-total-info");

    var modalTotalAvailableBike = document.getElementById("totalAvailableBikeModal");
    var modalTotalAvailableBikeContent = modalTotalAvailableBike.querySelector(".modal-content-total-info");

    var modalTotalRepireBike = document.getElementById("totalRepireBikeModal");
    var modalTotalRepireBikeContent = modalTotalRepireBike.querySelector(".modal-content-total-info");

    var modalTotalLateBike = document.getElementById("totalLateBikeModal");
    var modalTotalLateBikeContent = modalTotalLateBike.querySelector(".modal-content-total-info");

    var modalTotalLongTermBike = document.getElementById("totalLongTermBikeModal");
    var modalTotalLongTermBikeContent = modalTotalLongTermBike.querySelector(".modal-content-total-info");

    var modalSearchBike = document.getElementById("searchBikeModal");
    var modalSearchBikeContent = modalSearchBike.querySelector(".modal-content-total-info");

    var modalSearchClient = document.getElementById("searchClientModal");
    var modalSearchClientContent = modalSearchClient.querySelector(".modal-content-total-info");

    var modalSearchHelmet = document.getElementById("searchHelmetModal");
    var modalSearchHelmetContent = modalSearchHelmet.querySelector(".modal-content-total-info");

    // Get the text inside the modal to modify dynamically
    var modalText = document.getElementById("modalText");

    // Get the buttons that open the modal
    var rentBtn = document.getElementById("rentBtn");
    var returnBtn = document.getElementById("returnBtn");

    const bikeSearchInput = document.getElementById('bikeSearch');
    const bikeSearchDropdown = document.getElementById('bikeDropdown');
    const selectedBikeId = document.getElementById('selectedBikeId');

    const editSoldierSearchInput = document.getElementById('editSoldierSearch');
    const editSoldierSearchDropdown = document.getElementById('editSoldierDropdown');
    const selectedEditSoldierId = document.getElementById('selectedEditSoldierId');

    const editHelmetCodeSearchInput = document.getElementById('editHelmetCode');
    const editHelmetCodeSearchDropdown = document.getElementById('editHelmetCodeDropdown');
    const selectedEditHelmetCodeId = document.getElementById('selectedEditHelmetCodeId');

    const removeBikeSearchInput = document.getElementById('removeBikeSearch');
    const removeBikeDropdown = document.getElementById('removeBikeDropdown');
    const selectedRemoveBikeId = document.getElementById('selectedRemoveBikeId');

    let bikes = [];
    let helmets = [];
    let allCheckedRow = [];

    let currentPage = 1;
    let secondCurrentPage = 1;
    let globalSearchFilters = [];
    let globalSearchFiltersDate = [];
    let globalSelectDate1;
    let globalSelectDate2;
    let globalAction = '';
    let isInfo = true;

    const clientSearchInput = document.getElementById('clientSearch');
    const clientSearchDropdown = document.getElementById('clientDropdown');
    const selectedClientId = document.getElementById('selectedClientId');

    const helmetSearchInput = document.getElementById('helmetSearch');
    const helmetSearchDropdown = document.getElementById('helmetDropdown');
    const selectedHelmetId = document.getElementById('selectedHelmetId');

    const loadingIndicator = document.getElementById('loadingIndicator');

    const mainRowsPerPage = 50;
    let mainCurrentPage = 1;
    let mainTotalRows = parseInt(document.getElementById("totalCount").value);
    let filters = [];

    const tableBody = document.getElementById("tableBody");
    const pagination = document.getElementById("pagination");
    const isFirstTime = document.getElementsByName("isFirstTime")[0];
    const headerCells = document.querySelectorAll(`#mainTable thead th`);

    const mainHeaderMap = {
        'Bike Name': 'namebike',
        'Status': 'b.status',
        'Hired by': 'namesoldier',
        'Helmet': 'h.code',
        'Date From': 'formatted_date'
    };

    let clients = [];

    const formateDate = isoString => {
        const date = new Date(isoString);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const hourStr = String(hours).padStart(2, '0');

        return `${year}-${month}-${day} ${hourStr}:${minutes} ${ampm}`;
    }

    let currentFetchController = null;

    function startLoading() {
        loadingIndicator.style.display = 'flex';
    }

    function stopLoading() {
        loadingIndicator.style.display = 'none';
    }

    function debounce(func, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Helper function to toggle input validity
    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

    const checkForGlobalError = (response, responseBody) => {
        if (response.headers.get('X-Global-Error') === 'true')
            window.location.href = `/error?statusCode=${responseBody.statusCode}&message=${responseBody.message}&details=${responseBody.details}`;
    };

    function buildQueryParams(page) {
        const offset = (page - 1) * mainRowsPerPage;
        const params = new URLSearchParams({
            isFirstTime: isFirstTime.value,
            limit: mainRowsPerPage,
            offset: offset
        });

        filters.forEach(filter => {
            params.append('searchColumn', filter.column);
            params.append('searchValue', filter.value);
        });

        return params.toString();
    }

    async function fetchTableData(page) {
        
        const query = buildQueryParams(page);

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();
        const { signal } = currentFetchController;

        startLoading();

        try {
            const res = await fetch(`/bicycles?${query}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                },
                signal
            });

            if (!res.ok) {
                const error = await res.json();
                checkForGlobalError(res, error);
                throw new Error('Failed to fetch data');
            }
            const { data, totalBike, rentedBike, availableBike, repairBike, lateBike, longTermBike, totalCount } = await res.json();

            document.getElementById("totalBike").textContent = `Total Bike: ${totalBike}`;
            document.getElementById("rentedBike").textContent = `Rented: ${rentedBike}`;
            document.getElementById("availableBike").textContent = `Available: ${availableBike}`;
            document.getElementById("repairBike").textContent = `Repair: ${repairBike}`;
            document.getElementById("lateBike").textContent = `Late: ${lateBike}`;
            document.getElementById("longTermBike").textContent = `Long Term: ${longTermBike}`;

            mainTotalRows = parseInt(totalCount);
            mainCurrentPage = page;

            renderTable(data);
            renderPagination();

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', error.message);
        } finally {
            stopLoading();
        }
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        data.forEach(item => {
            const row = document.createElement("tr");
            row.className = "data-bike";
            row.id = item.id;

            const bikeName = item.name;
            const status = item.status;
            const hiredBy = item.hiredby;
            const helmet = item.helmet;
            const dateFrom = item.datefrom;

            let image;

            switch (status) {
                case 'Available':
                    image = '/icon/available.png';
                    break;

                case 'Rented':
                    image = '/icon/unavailable.png';
                    break;

                case 'Repair':
                    image = '/icon/repire.png';
                    break;

                case 'Late':
                    image = '/icon/timeout.png';
                    break;

                default:
                    image = '/icon/long-term.png';
                    break;
            }

            row.innerHTML = `
                <td class="text-wrap" style="max-width: 200px;">${bikeName}</td>
                <td class="text-wrap" style="max-width: 200px; data-status="${status}"><img src=${image} alt=${status} class="table-icon"></td>
                <td class="text-wrap" style="max-width: 200px;">${hiredBy}</td>
                <td class="text-wrap" style="max-width: 200px;">${helmet}</td>
                <td class="text-wrap" style="max-width: 200px;">${dateFrom}</td>
            `;

            row.addEventListener('click', function () {

                if (status === 'Available') {
                    showMess('Error', 'Data can only be edited for bike that are not available');
                } else {
                    // Call the modal opening function with extracted data
                    openEditModal(bikeName, status, hiredBy, dateFrom, helmet);
                }
            });

            tableBody.appendChild(row);
        });
    }

    function renderPagination() {
        const pageCount = Math.ceil(mainTotalRows / mainRowsPerPage) || 1;
        pagination.innerHTML = "";

        function createPageItem(page, isActive = false) {
            const pageItem = document.createElement("li");
            pageItem.classList.add("page-item");
            if (isActive) pageItem.classList.add("active");

            const pageLink = document.createElement("a");
            pageLink.classList.add("page-link");
            pageLink.href = "#";
            pageLink.innerText = page;
            pageLink.addEventListener("click", function (e) {
                e.preventDefault();
                fetchTableData(page);
            });

            pageItem.appendChild(pageLink);
            return pageItem;
        }

        const maxVisiblePages = 5;
        const halfVisible = Math.floor(maxVisiblePages / 2);
        let startPage = Math.max(1, mainCurrentPage - halfVisible);
        let endPage = Math.min(pageCount, mainCurrentPage + halfVisible);

        if (mainCurrentPage <= halfVisible) {
            endPage = Math.min(pageCount, maxVisiblePages);
        } else if (mainCurrentPage > pageCount - halfVisible) {
            startPage = Math.max(1, pageCount - maxVisiblePages + 1);
        }

        const prevBtn = document.createElement("li");
        prevBtn.classList.add("page-item");
        prevBtn.innerHTML = `<a class="page-link" href="#" aria-label="Previous">&laquo;</a>`;
        prevBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (mainCurrentPage > 1) fetchTableData(mainCurrentPage - 1);
        });
        pagination.appendChild(prevBtn);

        if (startPage > 1) {
            pagination.appendChild(createPageItem(1));
            if (startPage > 2) {
                pagination.appendChild(createEllipsis());
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            pagination.appendChild(createPageItem(i, i === mainCurrentPage));
        }

        if (endPage < pageCount) {
            if (endPage < pageCount - 1) {
                pagination.appendChild(createEllipsis());
            }
            pagination.appendChild(createPageItem(pageCount));
        }

        const nextBtn = document.createElement("li");
        nextBtn.classList.add("page-item");
        nextBtn.innerHTML = `<a class="page-link" href="#" aria-label="Next">&raquo;</a>`;
        nextBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (mainCurrentPage < pageCount) fetchTableData(mainCurrentPage + 1);
        });
        pagination.appendChild(nextBtn);
    }

    function createEllipsis() {
        const ellipsis = document.createElement("li");
        ellipsis.classList.add("page-item", "disabled");
        ellipsis.innerHTML = `<span class="page-link">...</span>`;
        return ellipsis;
    }

    renderPagination();

    function rewriteTableSearch(className, tableName, headerMap, selectedDate1 = "", selectedDate2 = "") {

        document.querySelectorAll(`${className}`).forEach((input) => {
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
        });

        document.querySelectorAll(`${className}`).forEach((input) => {

            input.addEventListener('input', debounce(() => {

                const filters = document.querySelectorAll(`${className}`);
                const headerCells = document.querySelectorAll(`#${tableName} thead th`);

                const searchFilters = [];

                switch (tableName) {

                    case 'allRentedBikeTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchStatusBike('Rented', currentPage, 10, searchFilters);
                        break;

                    case 'allAvailableBikeTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchStatusBike('Available', currentPage, 10, searchFilters);
                        break;

                    case 'allRepireBikeTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchStatusBike('Repair', currentPage, 10, searchFilters);
                        break;

                    case 'allLateBikeTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchStatusBike('Late', currentPage, 10, searchFilters);
                        break;

                    case 'allLongTermBikeTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchStatusBike('Long term', currentPage, 10, searchFilters);
                        break;

                    case 'bikeUsageTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        globalSearchFilters = searchFilters;
                        fetchReport(selectedDate1, selectedDate2, currentPage, secondCurrentPage, 10, searchFilters, globalSearchFiltersDate);
                        break;

                    case 'bikeTotalsTable':
                        secondCurrentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        globalSearchFiltersDate = searchFilters;
                        fetchReport(selectedDate1, selectedDate2, currentPage, secondCurrentPage, 10, globalSearchFilters, searchFilters);
                        break;

                    case 'helmetTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchHelmet(currentPage, 10, searchFilters);
                        break;
                }
            }, 400));
        });
    }

    async function fetchStatusBike(status, page = 1, limit = 10, searchFilters = []) {

        let statusTableId = '';
        let statusTableBodyId = '';
        let pageNumber;
        let prevBtn;
        let nextBtn;

        switch (status) {
            case 'Rented':
                statusTableId = 'allRentedBikeTable';
                statusTableBodyId = 'allRentedBikeTableBody';
                pageNumber = 'pageNumberTherd';
                prevBtn = 'prevBtnTherd';
                nextBtn = 'nextBtnTherd';
                break;

            case 'Available':
                statusTableId = 'allAvailableBikeTable';
                statusTableBodyId = 'allAvailableBikeTableBody';
                pageNumber = 'pageNumberFourth';
                prevBtn = 'prevBtnFourth';
                nextBtn = 'nextBtnFourth';
                break;

            case 'Repair':
                statusTableId = 'allRepireBikeTable';
                statusTableBodyId = 'allRepireBikeTableBody';
                pageNumber = 'pageNumberFifth';
                prevBtn = 'prevBtnFifth';
                nextBtn = 'nextBtnFifth';
                break;

            case 'Late':
                statusTableId = 'allLateBikeTable';
                statusTableBodyId = 'allLateBikeTableBody';
                pageNumber = 'pageNumberSixth';
                prevBtn = 'prevBtnSixth';
                nextBtn = 'nextBtnSixth';
                break;

            case 'Long term':
                statusTableId = 'allLongTermBikeTable';
                statusTableBodyId = 'allLongTermBikeTableBody';
                pageNumber = 'pageNumberSeventh';
                prevBtn = 'prevBtnSeventh';
                nextBtn = 'nextBtnSeventh';
                break;
        }

        const statusTableBody = document.getElementById(`${statusTableId}`).getElementsByTagName('tbody')[0];
        const tbody = document.getElementById(`${statusTableBodyId}`);
        tbody.innerHTML = '';

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();
        const { signal } = currentFetchController;

        startLoading();

        try {

            const searchParams = new URLSearchParams({
                status,
                page,
                limit
            });

            searchFilters.forEach(filter => {
                searchParams.append('searchColumn', filter.column);
                searchParams.append('searchValue', filter.value);
            });

            const response = await fetch(`/bicycles/getStatusData?${searchParams.toString()}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                },
                signal
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showMess('Error', error.message);
                return;
            }

            const { data, totalPages } = await response.json();

            data.forEach(item => {
                const row = document.createElement("tr");

                // Room status cell
                const nameCell = document.createElement("td");
                nameCell.textContent = item.namebike
                nameCell.classList.add("text-wrap");
                nameCell.style = "max-width: 200px;";
                row.appendChild(nameCell);

                // Room status cell
                const hireByCell = document.createElement("td");
                hireByCell.textContent = item?.namesoldier || 'None';
                hireByCell.classList.add("text-wrap");
                hireByCell.style = "max-width: 200px;";
                row.appendChild(hireByCell);

                // Room status cell
                const rentedDateCell = document.createElement("td");
                rentedDateCell.textContent = item.formatted_date ? formateDate(item.formatted_date) : 'None';
                rentedDateCell.classList.add("text-wrap");
                rentedDateCell.style = "max-width: 200px;";
                row.appendChild(rentedDateCell);

                // Append row to the table body
                tbody.appendChild(row);
            });

            const rowsTable = statusTableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, pageNumber);

            setupTableNavigation(statusTableId, prevBtn, nextBtn, pageNumber, limit, totalPages, page, searchFilters);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'An error occurred while fetching status bike. Please try again later.')

        } finally {
            stopLoading();
        };
    }

    async function fetchHelmet(page = 1, limit = 10, searchFilters = []) {

        const tbody = document.getElementById('tableBodyModal');
        const helmetTableBody = document.getElementById('helmetTable').getElementsByTagName('tbody')[0];
        tbody.innerHTML = '';

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();
        const { signal } = currentFetchController;

        startLoading();

        try {

            const searchParams = new URLSearchParams({
                page,
                limit
            });

            searchFilters.forEach(filter => {
                searchParams.append('searchColumn', filter.column);
                searchParams.append('searchValue', filter.value);
            });

            const response = await fetch(`/helmets?${searchParams.toString()}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                },
                signal
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showMess('Error', error.message);
                return;
            }

            const { helmetListData, totalPages } = await response.json();

            // Dynamically create the header checkbox
            const headerCheckbox = document.createElement('input');
            headerCheckbox.type = 'checkbox';
            headerCheckbox.className = 'form-check-input header-checkbox';
            headerCheckbox.style.border = '1px solid black'; // Make the border more bold
            headerCheckbox.style.cursor = 'pointer';
            headerCheckbox.style.backgroundColor = ''; // Clear any previous color

            headerCheckbox.addEventListener('change', (event) => {
                headerCheckbox.style.backgroundColor = event.target.checked ? 'green' : '';
                const isChecked = event.target.checked;

                // Get all visible rows
                const visibleRows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.style.display !== 'none');

                visibleRows.forEach(row => {
                    const checkbox = row.querySelector('.form-check-input');
                    if (checkbox) {
                        checkbox.checked = isChecked;
                        checkbox.style.backgroundColor = isChecked ? 'green' : '';
                        if (isChecked) {
                            allCheckedRow.push({ code: checkbox.dataset.id });
                        } else {
                            allCheckedRow = allCheckedRow.filter(item => item.code !== checkbox.dataset.id);
                        }
                    }
                });

                // Ensure no duplicates in allCheckedRow
                if (isChecked) {
                    allCheckedRow = Array.from(new Set(allCheckedRow.map(item => item.code)))
                        .map(code => ({ code }));
                }
            });

            // Append the header checkbox to the table header
            const thead = tbody.parentElement.querySelector('thead');
            const headerRow = thead.querySelector('tr');

            headerRow.querySelectorAll('th').forEach(th => {
                if (!th.textContent.trim()) {
                    th.remove();
                }
            });

            const headerCell = document.createElement('th');
            headerCell.appendChild(headerCheckbox);
            headerRow.insertBefore(headerCell, headerRow.firstChild);

            helmetListData.forEach(item => {
                const row = document.createElement("tr");
                row.classList.add('data-helmet');

                // Add the checkbox cell
                const checkboxCell = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input';
                checkbox.dataset.id = item.id;
                checkbox.style.cursor = 'pointer';
                checkbox.style.border = '1px solid black'; // Make the border more bold

                if (allCheckedRow.some(i => i.code === item.id)) {
                    checkbox.style.backgroundColor = 'green';
                    checkbox.checked = true;
                }

                // Add change event to the checkbox
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        checkbox.style.backgroundColor = 'green';
                        allCheckedRow.push({ code: item.id });
                    } else {
                        checkbox.style.backgroundColor = '';
                        allCheckedRow = allCheckedRow.filter(row => row.code !== item.id);
                    }
                });

                checkboxCell.appendChild(checkbox);
                row.appendChild(checkboxCell);

                // Room number cell
                const codeCell = document.createElement("td");
                codeCell.textContent = item.id;
                codeCell.classList.add("text-wrap");
                codeCell.style = "max-width: 200px;";
                row.appendChild(codeCell);

                // Room status cell
                const nameCell = document.createElement("td");
                nameCell.textContent = item.name;
                nameCell.classList.add("text-wrap");
                nameCell.style = "max-width: 200px;";
                row.appendChild(nameCell);

                // Append row to the table body
                tbody.appendChild(row);
            });

            const rowsTable = helmetTableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumberSecond');

            setupTableNavigation("helmetTable", "prevBtnSecond", "nextBtnSecond", "pageNumberSecond", limit, totalPages, page, searchFilters);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'An error occurred while fetching helmet data. Please try again later.')
        } finally {
            stopLoading();
        };
    }

    // Attach filter input events
    document.querySelectorAll('.search-input').forEach((input, index) => {
        const headerLabel = headerCells[index]?.innerText.trim();
        const columnName = mainHeaderMap[headerLabel];

        input.addEventListener('input', debounce(() => {
            const searchTerm = input.value.trim().toLowerCase();

            filters = filters.filter(f => f.column !== columnName);

            if (columnName && searchTerm) {
                filters.push({ column: columnName, value: searchTerm });
            }

            fetchTableData(1);
        }, 400));
    });

    document.getElementById('form1').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form2').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form3').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form4').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form5').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form6').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.querySelectorAll('tr.data-bike').forEach(row => {
        row.addEventListener('click', function () {
            const bikeName = this.querySelector('td:nth-child(1)').textContent.trim();
            const status = this.querySelector('td:nth-child(2)').getAttribute('data-status');
            const hiredBy = this.querySelector('td:nth-child(3)').textContent.trim();
            const helmet = this.querySelector('td:nth-child(4)').textContent.trim();
            const dateFrom = this.querySelector('td:nth-child(5)').textContent.trim();

            if (status === 'Available') {
                showMess('Error', 'Data can only be edited for bike that are not available')
            } else {
                openEditModal(bikeName, status, hiredBy, dateFrom, helmet);
            }
        });
    });

    document.getElementById('confirmReportBtn').onclick = function () {

        const selectDate1 = document.getElementById('selectedDate1').value;
        const selectDate2 = document.getElementById('selectedDate2').value;

        if (selectDate1 === 'None' || selectDate2 === 'None') {
            showMess('Error', 'Both dates must be selected!');
            return;
        }

        if (new Date(selectDate1) > new Date(selectDate2)) {
            showMess('Error', 'Invalid time period');
            return;
        }

        closeReportModal();

        currentPage = 1;
        secondCurrentPage = 1;

        const headerMap = {
            'Bike Name': 'namebike',
            'Soldier Name': 'namesoldier',
            'Country': 'country',
            'Helmet Code': 'helmet_code',
            'Date From': 'date_from',
            'Date To': 'date_to',
            'Duration': 'duration'
        };

        const headerDateMap = {
            'Date': 'date',
            'Total Bikes Used': 'total_bikes'
        };

        rewriteTableSearch('.search-input-view-bike', 'bikeUsageTable', headerMap, selectDate1, selectDate2);
        rewriteTableSearch('.search-input-view-total-bike', 'bikeTotalsTable', headerDateMap, selectDate1, selectDate2);

        globalSelectDate1 = selectDate1;
        globalSelectDate2 = selectDate2;

        fetchReport(selectDate1, selectDate2);

        openViewReportModal();
    }

    function setupTableNavigation(tableId, prevBtnId, nextBtnId, pageNumberId, rowsPerPage = 10, totalPages, page, searchFilters = [], searchFiltersDate = [], selectDate1, selectDate2) {

        document.getElementById(`${pageNumberId}`).textContent = `${page}/${totalPages}`;

        switch (tableId) {
            case 'allRentedBikeTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchStatusBike('Rented', currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchStatusBike('Rented', currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'allAvailableBikeTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchStatusBike('Available', currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchStatusBike('Available', currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'allRepireBikeTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchStatusBike('Repair', currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchStatusBike('Repair', currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'allLateBikeTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchStatusBike('Late', currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchStatusBike('Late', currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'allLongTermBikeTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchStatusBike('Long term', currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchStatusBike('Long term', currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'bikeUsageTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersDate);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersDate);
                    }
                };
                break;

            case 'bikeTotalsTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (secondCurrentPage > 1) {
                        secondCurrentPage--;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersDate);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (secondCurrentPage < totalPages) {
                        secondCurrentPage++;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersDate);
                    }
                };
                break;

            case 'helmetTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchHelmet(currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchHelmet(currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;
        }
    }

    function openViewReportModal() {
        modalViewRep.classList.add('show');
        modalViewRepContent.classList.add('show');
        modalViewRepContent.classList.add('slide-in');

        modalViewRepContent.classList.remove('slide-out');
    }

    function closeViewReportModal() {
        // Add the slide-out effect
        modalViewRepContent.classList.add('slide-out');
        modalViewRepContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.search-input-view-bike, .search-input-view-total-bike').forEach((input) => {
                input.value = '';
            });

            document.getElementById('selectedDate1').value = 'None';
            document.getElementById('selectedDate2').value = 'None';

            modalViewRep.classList.remove('show');
            modalViewRepContent.classList.remove('show');

        }, 500); // Match the duration of the animation (0.4s)
    }

    function openReportModal() {
        modalRep.classList.add('show');
        modalRepContent.classList.add('show');
        modalRepContent.classList.add('slide-in');

        modalRepContent.classList.remove('slide-out');
    }

    function closeReportModal() {
        // Add the slide-out effect
        modalRepContent.classList.add('slide-out');
        modalRepContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            const listItems = document.querySelectorAll('.dates li');
            listItems.forEach(li => li.classList.remove('selected'));

            modalRep.classList.remove('show');
            modalRepContent.classList.remove('show');

        }, 500); // Match the duration of the animation (0.4s)
    }

    function openTotalBikeModal() {
        modalTotalBike.classList.add('show');
        modalTotalBikeContent.classList.add('show');
        modalTotalBikeContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalTotalBikeContent.classList.remove('slide-out');
    }

    function closeTotalBikeModal() {
        modalTotalBikeContent.classList.add('slide-out');
        modalTotalBikeContent.classList.remove('slide-in');

        setTimeout(function () {

            document.querySelectorAll('.all-rented-bike-search-input').forEach((input) => {
                input.value = '';
            });

            modalTotalBike.classList.remove('show');
            modalTotalBikeContent.classList.remove('show');

        }, 400);
    }

    function openTotalAvailableBikeModal() {
        modalTotalAvailableBike.classList.add('show');
        modalTotalAvailableBikeContent.classList.add('show');
        modalTotalAvailableBikeContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalTotalAvailableBikeContent.classList.remove('slide-out');
    }

    function closeTotalAvailableBikeModal() {
        modalTotalAvailableBikeContent.classList.add('slide-out');
        modalTotalAvailableBikeContent.classList.remove('slide-in');

        setTimeout(function () {

            document.querySelectorAll('.all-available-bike-search-input').forEach((input) => {
                input.value = '';
            });

            modalTotalAvailableBike.classList.remove('show');
            modalTotalAvailableBikeContent.classList.remove('show');

        }, 400);
    }

    function openTotalRepireBikeModal() {
        modalTotalRepireBike.classList.add('show');
        modalTotalRepireBikeContent.classList.add('show');
        modalTotalRepireBikeContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalTotalRepireBikeContent.classList.remove('slide-out');
    }

    function closeTotalRepireBikeModal() {
        modalTotalRepireBikeContent.classList.add('slide-out');
        modalTotalRepireBikeContent.classList.remove('slide-in');

        setTimeout(function () {

            document.querySelectorAll('.all-repire-bike-search-input').forEach((input) => {
                input.value = '';
            });

            modalTotalRepireBike.classList.remove('show');
            modalTotalRepireBikeContent.classList.remove('show');

        }, 400);
    }

    function openTotalLateBikeModal() {
        modalTotalLateBike.classList.add('show');
        modalTotalLateBikeContent.classList.add('show');
        modalTotalLateBikeContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalTotalLateBikeContent.classList.remove('slide-out');
    }

    function closeTotalLateBikeModal() {
        modalTotalLateBikeContent.classList.add('slide-out');
        modalTotalLateBikeContent.classList.remove('slide-in');

        setTimeout(function () {

            document.querySelectorAll('.all-late-bike-search-input').forEach((input) => {
                input.value = '';
            });

            modalTotalLateBike.classList.remove('show');
            modalTotalLateBikeContent.classList.remove('show');

        }, 400);
    }

    function openTotalLongTermBikeModal() {
        modalTotalLongTermBike.classList.add('show');
        modalTotalLongTermBikeContent.classList.add('show');
        modalTotalLongTermBikeContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalTotalLongTermBikeContent.classList.remove('slide-out');
    }

    function closeTotalLongTermBikeModal() {
        modalTotalLongTermBikeContent.classList.add('slide-out');
        modalTotalLongTermBikeContent.classList.remove('slide-in');

        setTimeout(function () {

            document.querySelectorAll('.all-long-term-bike-search-input').forEach((input) => {
                input.value = '';
            });

            modalTotalLongTermBike.classList.remove('show');
            modalTotalLongTermBikeContent.classList.remove('show');

        }, 400);
    }

    function openAddBikeModal() {
        modalAddBike.classList.add('show');
        modalAddBikeContent.classList.add('show');
        modalAddBikeContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalAddBikeContent.classList.remove('slide-out');
    }

    function closeAddBikeModal() {
        modalAddBikeContent.classList.add('slide-out');
        modalAddBikeContent.classList.remove('slide-in');

        setTimeout(function () {

            document.querySelectorAll('#bike-number, #bike-name').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';
            });

            modalAddBike.classList.remove('show');
            modalAddBikeContent.classList.remove('show');

        }, 400);
    }

    function openAddHelmetModal() {
        modalAddHelmet.classList.add('show');
        modalAddHelmetContent.classList.add('show');
        modalAddHelmetContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalAddHelmetContent.classList.remove('slide-out');
    }

    function closeAddHelmetModal() {
        modalAddHelmetContent.classList.add('slide-out');
        modalAddHelmetContent.classList.remove('slide-in');

        setTimeout(function () {

            document.querySelectorAll('#helmet-number, #helmet-name').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';
            });

            modalAddHelmet.classList.remove('show');
            modalAddHelmetContent.classList.remove('show');

        }, 400);
    }

    function openRemoveBikeModal() {
        modalRemoveBike.classList.add('show');
        modalRemoveBikeContent.classList.add('show');
        modalRemoveBikeContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalRemoveBikeContent.classList.remove('slide-out');
    }

    function closeRemoveBikeModal() {
        modalRemoveBikeContent.classList.add('slide-out');
        modalRemoveBikeContent.classList.remove('slide-in');

        setTimeout(function () {

            document.querySelectorAll('#removeBikeSearch, #selectedRemoveBikeId').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';
            });

            modalRemoveBike.classList.remove('show');
            modalRemoveBikeContent.classList.remove('show');

        }, 400);
    }

    function openAddMultiBikeModal() {
        modalAddMultiBike.classList.add('show');
        modalAddMultiBikeContent.classList.add('show');
        modalAddMultiBikeContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalAddMultiBikeContent.classList.remove('slide-out');
    }

    function closeAddMultiBikeModal() {
        modalAddMultiBikeContent.classList.add('slide-out');
        modalAddMultiBikeContent.classList.remove('slide-in');

        setTimeout(function () {

            document.getElementById("progress-multi-bike").style.width = 0 + "%";
            document.getElementById('fileInputBike').value = '';

            modalAddMultiBike.classList.remove('show');
            modalAddMultiBikeContent.classList.remove('show');

        }, 400);
    }

    function openAddMultiHelmetModal() {
        modalAddMultiHelmet.classList.add('show');
        modalAddMultiHelmetContent.classList.add('show');
        modalAddMultiHelmetContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalAddMultiHelmetContent.classList.remove('slide-out');
    }

    function closeAddMultiHelmetModal() {
        modalAddMultiHelmetContent.classList.add('slide-out');
        modalAddMultiHelmetContent.classList.remove('slide-in');

        setTimeout(function () {

            document.getElementById("progress-multi-helmet").style.width = 0 + "%";
            document.getElementById('fileInputHelmet').value = '';

            modalAddMultiHelmet.classList.remove('show');
            modalAddMultiHelmetContent.classList.remove('show');

        }, 400);
    }

    function openSearchBikeModal() {
        modalSearchBike.classList.add('show');
        modalSearchBikeContent.classList.add('show');
        modalSearchBikeContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalSearchBikeContent.classList.remove('slide-out');
    }

    function closeSearchBikeModal() {
        modalSearchBikeContent.classList.add('slide-out');
        modalSearchBikeContent.classList.remove('slide-in');

        setTimeout(function () {

            modalSearchBike.classList.remove('show');
            modalSearchBikeContent.classList.remove('show');

        }, 400);
    }

    function openSearchClientModal() {
        modalSearchClient.classList.add('show');
        modalSearchClientContent.classList.add('show');
        modalSearchClientContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalSearchClientContent.classList.remove('slide-out');
    }

    function closeSearchClientModal() {
        modalSearchClientContent.classList.add('slide-out');
        modalSearchClientContent.classList.remove('slide-in');

        setTimeout(function () {

            modalSearchClient.classList.remove('show');
            modalSearchClientContent.classList.remove('show');

        }, 400);
    }

    function openSearchHelmetModal() {
        modalSearchHelmet.classList.add('show');
        modalSearchHelmetContent.classList.add('show');
        modalSearchHelmetContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalSearchHelmetContent.classList.remove('slide-out');
    }

    function closeSearchHelmetModal() {
        modalSearchHelmetContent.classList.add('slide-out');
        modalSearchHelmetContent.classList.remove('slide-in');

        setTimeout(function () {

            modalSearchHelmet.classList.remove('show');
            modalSearchHelmetContent.classList.remove('show');

        }, 400);
    }

    function openModal() {
        modal.classList.add('show');
        modalContent.classList.add('show');
        modalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalContent.classList.remove('slide-out');
    }

    function closeModal() {
        modalContent.classList.add('slide-out');
        modalContent.classList.remove('slide-in');

        setTimeout(function () {

            modalCheckBox.checked = false;

            modal.classList.remove('show');
            modalContent.classList.remove('show');

        }, 400);
    }

    function showMess(type, message) {

        const icon = document.getElementById("mess-icon-rep");

        switch (type) {
            case 'Error':
                icon.src = "/icon/error.png";
                document.getElementById("mess-text-rep").textContent = message;
                isInfo = false;
                break;

            case 'Warnning':
                icon.src = "/icon/timeout.png";
                document.getElementById("mess-text-rep").textContent = message;
                isInfo = false;
                break;

            default:
                icon.src = "/icon/information.png";
                document.getElementById("mess-text-rep").textContent = message;
                isInfo = true;
                break;
        }

        // Add the slide-in effect by adding the necessary classes
        modalMessRep.classList.add('show');
        modalMessRepContent.classList.add('show');
        modalMessRepContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalMessRepContent.classList.remove('slide-out');
    }

    function closeMessModal(action = '') {
        // Add the slide-out effect
        modalMessRepContent.classList.add('slide-out');
        modalMessRepContent.classList.remove('slide-in');

        function clearInput(clearModalInput) {

            const listItems = clearModalInput.querySelectorAll('.dates li');
            listItems.forEach(li => li.classList.remove('selected'));

            const inputs = clearModalInput.querySelectorAll('input, textarea, select');
            inputs.forEach(el => {
                if (el.type === 'checkbox' || el.type === 'radio') {
                    el.checked = false;
                } else {
                    el.value = '';
                }
                el.classList.remove('is-valid');
                el.classList.remove('is-invalid');
            });
        }

        function clearMultiInput(progressBar, fileIput) {
            document.getElementById(`${progressBar}`).style.width = 0 + "%";
            document.getElementById(`${fileIput}`).value = '';
        }

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalMessRep.classList.remove('show');
            modalMessRepContent.classList.remove('show');

            if (isInfo) {

                const fullContent = document.getElementsByClassName('content')[0];
                const leftNav = document.getElementsByClassName('left-nav')[0];

                switch (action) {

                    case 'bikeAction':
                        closeModal();
                        clearInput(fullContent);
                        clearInput(leftNav);
                        fetchTableData(1);
                        break;

                    case 'removeHelmet':
                        allCheckedRow = [];
                        clearInput(modalListHelmetsContent);
                        fetchHelmet();
                        break;

                    case 'addBike':
                        clearInput(modalAddBikeContent);
                        clearInput(fullContent);
                        fetchTableData(1);
                        break;

                    case 'editBike':
                        closeEditModal();
                        clearInput(fullContent);
                        fetchTableData(1);
                        break;

                    case 'addHelmet':
                        clearInput(modalAddHelmetContent);
                        clearInput(modalListHelmetsContent);
                        fetchHelmet();
                        break;

                    case 'removeBike':
                        clearInput(modalRemoveBikeContent);
                        clearInput(fullContent);
                        fetchTableData(1);
                        break;

                    case 'uploadMultiBike':
                        clearMultiInput('progress-multi-bike', 'fileInputBike');
                        clearInput(fullContent);
                        fetchTableData(1);
                        break;

                    case 'uploadMultiHelmet':
                        clearMultiInput('progress-multi-helmet', 'fileInputHelmet');
                        clearInput(modalListHelmetsContent);
                        fetchHelmet();
                        break;

                }

                fetchItem();
            }

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openEditModal(bikeName, status, hiredBy, dateFrom, helmetCode) {

        editSoldierSearchInput.value = hiredBy === 'None' ? '' : hiredBy;
        const foundClient = clients.find(client => client.name && client.name === hiredBy);
        selectedEditSoldierId.value = foundClient ? foundClient.id : '';

        editHelmetCodeSearchInput.value = helmetCode === 'None' ? '' : helmetCode;
        const foundHelemt = helmets.find(helmet => helmet.name && helmet.name.replace(/\s*\(.+\)$/, '') === helmetCode);
        selectedEditHelmetCodeId.value = foundHelemt ? foundHelemt.id : '';

        editBikeSearchId = bikes.find(bike => bike.name === bikeName).id;

        selectedStatus.value = status;
        selectedBike.textContent = `Bike Name: ${bikeName}`;

        // Format the date manually
        const dateObj = new Date(dateFrom);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
        const day = String(dateObj.getDate()).padStart(2, '0');
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const formattedDateFrom = `${year}-${month}-${day}T${hours}:${minutes}`;

        editDateFrom.value = formattedDateFrom;

        if (selectedStatus.value !== 'Repair') {
            editSoldierSearchInput.classList.remove('disabled-select');
            editHelmetCodeSearchInput.classList.remove('disabled-select');
        } else {
            editSoldierSearchInput.classList.add('disabled-select');
            editHelmetCodeSearchInput.classList.add('disabled-select');
        }

        // Add the slide-in effect by adding the necessary classes
        modalEditBike.classList.add('show');
        modalEditBikeContent.classList.add('show');
        modalEditBikeContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalEditBikeContent.classList.remove('slide-out');
    }

    function closeEditModal() {
        // Add the slide-out effect
        modalEditBikeContent.classList.add('slide-out');
        modalEditBikeContent.classList.remove('slide-in');

        document.querySelectorAll('#statusSelect, #editSoldierSearch, #editHelmetCode, #editDateFrom').forEach((input) => {

            input.classList.remove('is-valid');
            input.classList.remove('is-invalid');

        });

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalEditBike.classList.remove('show');
            modalEditBikeContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openListHelmetsModal() {
        // Add the slide-in effect by adding the necessary classes
        modalListHelmets.classList.add('show');
        modalListHelmetsContent.classList.add('show');
        modalListHelmetsContent.classList.add('slide-in');

        currentPage = 1;

        const headerDate = {
            'Helmet code': 'h.id',
            'Helmet name': 'h.code'
        };

        rewriteTableSearch('.search-input-helmet', 'helmetTable', headerDate);

        fetchHelmet();

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalListHelmetsContent.classList.remove('slide-out');
    }

    function closeListHelmetsModal() {
        modalListHelmetsContent.classList.add('slide-out');
        modalListHelmetsContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.search-input-helmet').forEach(input => {
                input.value = '';
            });

            allCheckedRow = []; // Reset the global array

            modalListHelmets.classList.remove('show');
            modalListHelmetsContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    // Function to fetch bikes from the server
    async function fetchItem() {

        startLoading();

        try {
            const responseBike = await fetch(`/bikes`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            });

            if (!responseBike.ok) {
                const error = await responseBike.json();
                checkForGlobalError(responseBike, error);
                showMess('Error', error.message);
                return;
            }
            bikes = await responseBike.json(); // Store fetched bikes in the global variable

            const responseHelmets = await fetch(`/helmets`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            });

            if (!responseHelmets.ok) {
                const error = await responseHelmets.json();
                checkForGlobalError(responseHelmets, error);
                showMess('Error', error.message);
                return;
            }
            helmets = await responseHelmets.json(); // Store fetched bikes in the global variable

            const responseClient = await fetch(`/clients`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            });

            if (!responseClient.ok) {
                const error = await responseClient.json();
                checkForGlobalError(responseClient, error);
                showMess('Error', error.message);
                return;
            }
            clients = await responseClient.json(); // Store fetched bikes in the global variable

        } catch (error) {
            showMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    async function fetchHelmetBike(bikeId) {

        startLoading();

        try {
            const responseBike = await fetch(`/getHelmetByBike?bikeId=${bikeId}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            });

            if (!responseBike.ok) {
                const error = await responseBike.json();
                checkForGlobalError(responseBike, error);
                showMess('Error', error.message);
                return;
            }

            const result = await responseBike.json();
            document.getElementById('modalHelmetLabel').textContent = result.code ? result.code : 'None';
            document.getElementById('selectedByBikeHelmetId').value = result.helmetId ? result.helmetId : '';

        } catch (error) {
            showMess('Error', 'There was a problem with the fetch helmet operation');

        } finally {
            stopLoading();
        }
    }

    // Show filtered bikes in the dropdown
    function filterBikes(query) {
        bikeSearchDropdown.innerHTML = '';
        const filteredBikes = bikes.filter(bike => bike.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredBikes.length > 0) {
            bikeSearchDropdown.style.display = 'block';
            filteredBikes.forEach(bike => {
                const li = document.createElement('li');
                li.textContent = `${bike.name} (${bike.status})`;
                li.setAttribute('data-id', bike.id);
                bikeSearchDropdown.appendChild(li);
            });
        } else {
            bikeSearchDropdown.style.display = 'none';
        }
    }

    // Show filtered bikes in the dropdown
    function filterEditSoldiers(query) {
        editSoldierSearchDropdown.innerHTML = '';
        const filteredSoldiers = clients.filter(client => (
            (client.date_accommodation === '' || (client.date_accommodation !== '' && client.date_free === '')) &&
            client.name.toLowerCase().includes(query.toLowerCase()) ||
            client.namekey.toLowerCase().includes(query.toLowerCase())
        ));

        const uniqueSoldiers = Array.from(
            new Map(filteredSoldiers.map(s => [s.name.toLowerCase(), s])).values()
        );

        if (uniqueSoldiers.length > 0) {
            editSoldierSearchDropdown.style.display = 'block';
            uniqueSoldiers.forEach(soldier => {
                const li = document.createElement('li');
                li.textContent = soldier.name;
                li.setAttribute('data-id', soldier.id);
                editSoldierSearchDropdown.appendChild(li);
            });
        } else {
            editSoldierSearchDropdown.style.display = 'none';
        }
    }

    function filterEditHelmeet(query) {
        editHelmetCodeSearchDropdown.innerHTML = '';
        const filteredHelmet = helmets.filter(helemt => helemt.code.replace(/\s*\(.+\)$/, "").toLowerCase().includes(query.toLowerCase()));

        if (filteredHelmet.length > 0) {
            editHelmetCodeSearchDropdown.style.display = 'block';
            filteredHelmet.forEach(helmet => {
                const li = document.createElement('li');
                li.textContent = helmet.name;
                li.setAttribute('data-id', helmet.id);
                editHelmetCodeSearchDropdown.appendChild(li);
            });
        } else {
            editHelmetCodeSearchDropdown.style.display = 'none';
        }
    }

    // Show filtered bikes in the dropdown
    function filterRemoveBikes(query) {
        removeBikeDropdown.innerHTML = '';
        const filteredBikes = bikes.filter(bike => bike.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredBikes.length > 0) {
            removeBikeDropdown.style.display = 'block';
            filteredBikes.forEach(bike => {
                const li = document.createElement('li');
                li.textContent = `${bike.name} (${bike.status})`;
                li.setAttribute('data-id', bike.id);
                removeBikeDropdown.appendChild(li);
            });
        } else {
            removeBikeDropdown.style.display = 'none';
        }
    }

    // Show filtered bikes in the dropdown
    function filterClient(query) {
        clientSearchDropdown.innerHTML = '';
        const filteredClients = clients.filter(client => (
            (client.date_accommodation === '' || (client.date_accommodation !== '' && client.date_free === '')) &&
            client.name.toLowerCase().includes(query.toLowerCase()) ||
            client.namekey.toLowerCase().includes(query.toLowerCase())
        ));

        const uniqueSoldiers = Array.from(
            new Map(filteredClients.map(s => [s.name.toLowerCase(), s])).values()
        );

        if (uniqueSoldiers.length > 0) {
            clientSearchDropdown.style.display = 'block';
            uniqueSoldiers.forEach(client => {
                const li = document.createElement('li');
                li.textContent = client.name;
                li.setAttribute('data-id', client.id);
                clientSearchDropdown.appendChild(li);
            });
        } else {
            clientSearchDropdown.style.display = 'none';
        }
    }

    // Show filtered bikes in the dropdown
    function filterHelmets(query) {
        helmetSearchDropdown.innerHTML = '';
        const filteredHelmets = helmets.filter(helmet => helmet.code.toLowerCase().includes(query.toLowerCase()));

        if (filteredHelmets.length > 0) {
            helmetSearchDropdown.style.display = 'block';
            filteredHelmets.forEach(helmet => {
                const li = document.createElement('li');
                li.textContent = `${helmet.code}`;
                li.setAttribute('data-id', helmet.id);
                helmetSearchDropdown.appendChild(li);
            });
        } else {
            helmetSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    clientSearchInput.addEventListener('input', function () {
        const query = clientSearchInput.value;
        if (query.length > 0) {
            filterClient(query);
        } else {
            clientSearchDropdown.style.display = 'none';
            selectedClientId.value = '';
        }
    });

    // Handle input change
    bikeSearchInput.addEventListener('input', function () {
        const query = bikeSearchInput.value;
        if (query.length > 0) {
            filterBikes(query);
        } else {
            bikeSearchDropdown.style.display = 'none';
            selectedBikeId.value = '';
        }
    });

    // Handle input change
    helmetSearchInput.addEventListener('input', function () {
        const query = helmetSearchInput.value;
        if (query.length > 0) {
            filterHelmets(query);
        } else {
            helmetSearchDropdown.style.display = 'none';
            selectedHelmetId.value = '';
        }
    });

    // Handle input change
    editHelmetCodeSearchInput.addEventListener('input', function () {
        const query = editHelmetCodeSearchInput.value;
        if (query.length > 0) {
            filterEditHelmeet(query);
        } else {
            editHelmetCodeSearchDropdown.style.display = 'none';
            selectedEditHelmetCodeId.value = '';
        }

        toggleInputValidity(editHelmetCodeSearchInput, true);
    });

    // Handle input change
    editSoldierSearchInput.addEventListener('input', function () {
        const query = editSoldierSearchInput.value;
        if (query.length > 0) {
            filterEditSoldiers(query);
        } else {
            editSoldierSearchDropdown.style.display = 'none';
            selectedEditSoldierId.value = '';
        }

        toggleInputValidity(editSoldierSearchInput, selectedEditSoldierId.value !== '');
    });

    // Handle input change
    removeBikeSearchInput.addEventListener('input', function () {
        const query = removeBikeSearchInput.value;
        if (query.length > 0) {
            filterRemoveBikes(query);
        } else {
            removeBikeDropdown.style.display = 'none';
            selectedRemoveBikeId.value = '';
        }

        toggleInputValidity(removeBikeSearchInput, selectedRemoveBikeId.value !== '');
    });

    // Handle bike selection
    editSoldierSearchDropdown.addEventListener('click', function (event) {
        const selectedSoldier = event.target;
        if (selectedSoldier && selectedSoldier.dataset.id) {
            editSoldierSearchInput.value = selectedSoldier.textContent;
            selectedEditSoldierId.value = selectedSoldier.getAttribute('data-id');
            editSoldierSearchDropdown.style.display = 'none';

            toggleInputValidity(editSoldierSearchInput, selectedEditSoldierId.value !== '');
        }
    });

    // Handle bike selection
    editHelmetCodeSearchDropdown.addEventListener('click', function (event) {
        const selectedHelmet = event.target;
        if (selectedHelmet && selectedHelmet.dataset.id) {
            editHelmetCodeSearchInput.value = selectedHelmet.textContent.replace(/\s*\(.+\)$/, "");
            selectedEditHelmetCodeId.value = selectedHelmet.getAttribute('data-id');
            editHelmetCodeSearchDropdown.style.display = 'none';

            toggleInputValidity(editHelmetCodeSearchInput, selectedEditHelmetCodeId.value !== '');
        }
    });

    // Handle bike selection
    bikeSearchDropdown.addEventListener('click', function (event) {
        const selectedBike = event.target;
        if (selectedBike && selectedBike.dataset.id) {
            bikeSearchInput.value = selectedBike.textContent;
            selectedBikeId.value = selectedBike.getAttribute('data-id');
            bikeSearchDropdown.style.display = 'none';
            updateLabel(bikeLabel, selectedBike.textContent);
        }
    });

    // Handle bike selection
    helmetSearchDropdown.addEventListener('click', function (event) {
        const selectedHelmet = event.target;
        if (selectedHelmet && selectedHelmet.dataset.id) {
            helmetSearchInput.value = selectedHelmet.textContent;
            selectedHelmetId.value = selectedHelmet.getAttribute('data-id');
            helmetSearchDropdown.style.display = 'none';
        }
    });

    // Handle bike selection
    removeBikeDropdown.addEventListener('click', function (event) {
        const selectedBike = event.target;
        if (selectedBike && selectedBike.dataset.id) {
            removeBikeSearchInput.value = selectedBike.textContent;
            selectedRemoveBikeId.value = selectedBike.getAttribute('data-id');
            removeBikeDropdown.style.display = 'none';
        }

        toggleInputValidity(removeBikeSearchInput, selectedRemoveBikeId.value !== '');
    });

    // Handle bike selection
    clientSearchDropdown.addEventListener('click', function (event) {
        const selectedClient = event.target;
        if (selectedClient && selectedClient.dataset.id) {
            clientSearchInput.value = selectedClient.textContent;
            selectedClientId.value = selectedClient.getAttribute('data-id');
            clientSearchDropdown.style.display = 'none';
            updateLabel(clientLabel, selectedClient.textContent);
        }
    });

    // Hide dropdown if clicked outside
    window.addEventListener('click', function (event) {
        if (!bikeSearchDropdown.contains(event.target) && event.target !== bikeSearchInput) {
            bikeSearchDropdown.style.display = 'none';
        }

        if (!clientSearchDropdown.contains(event.target) && event.target !== clientSearchInput) {
            clientSearchDropdown.style.display = 'none';
        }

        if (!removeBikeDropdown.contains(event.target) && event.target !== removeBikeSearchInput) {
            removeBikeDropdown.style.display = 'none';
        }

        if (!editSoldierSearchDropdown.contains(event.target) && event.target !== editSoldierSearchInput) {
            editSoldierSearchDropdown.style.display = 'none';
        }

        if (!helmetSearchDropdown.contains(event.target) && event.target !== helmetSearchInput) {
            helmetSearchDropdown.style.display = 'none';
        }

        if (!editHelmetCodeSearchDropdown.contains(event.target) && event.target !== editHelmetCodeSearchInput) {
            editHelmetCodeSearchDropdown.style.display = 'none';
        }
    });

    // Fetch the bikes when the script loads
    fetchItem();

    // Function to update the label based on the selected value
    function updateLabel(label, value) {
        if (value === 'None' || value.length === 0) {
            label.classList.add('none-selected');
            label.textContent = "None";
        } else {
            label.classList.remove('none-selected');
            label.textContent = value;
        }
    }

    // Function to enable or disable time selection fields
    function toggleTimeSelection(disable) {

        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const dateNow = new Date();

        if (disable) {
            hourSelect.value = dateNow.getHours();
            minuteSelect.value = dateNow.getMinutes();

            modalText.textContent = `${months[dateNow.getMonth()]} ${dateNow.getDate()}, ${dateNow.getFullYear()}`;

            const selectDate = `${dateNow.getFullYear()}-${(dateNow.getMonth() + 1) > 9 ? (dateNow.getMonth() + 1) : '0' + (dateNow.getMonth() + 1)}-${dateNow.getDate() > 9 ? dateNow.getDate() : '0' + dateNow.getDate()}`;
            document.getElementById("date").value = selectDate;

            modalText.classList.remove('none-selected');

            hourSelect.classList.add('disabled-select');
            minuteSelect.classList.add('disabled-select');

        } else {
            hourSelect.value = 'Select Hour';
            minuteSelect.value = 'Select Minutes';

            if (selectedDateMain.value != "None") {
                const date = new Date(selectedDateMain.value);
                const options = { month: 'long', year: 'numeric', day: 'numeric' };
                selectedDateMain.value = date.toLocaleDateString('en-US', options);

                document.getElementById("date").value = `${date.getFullYear()}-${(date.getMonth() + 1) > 9 ? (date.getMonth() + 1) : '0' + (date.getMonth() + 1)}-${date.getDate() > 9 ? date.getDate() : '0' + date.getDate()}`;
            }
            updateLabel(modalText, selectedDateMain.value);
            modalText.value = selectedDateMain.value;

            hourSelect.classList.remove('disabled-select');
            minuteSelect.classList.remove('disabled-select');
        }
    }

    if (rentBtn) {
        // When the user clicks on "Rent" button, open the modal with specific text
        rentBtn.onclick = function () {
            openModal();
            updateLabel(modalText, selectedDateMain.value);
            updateLabel(bikeLabel, bikeSearchInput.value);
            updateLabel(clientLabel, clientSearchInput.value);
            modalText.value = selectedDateMain.value;
            modalCheckBoxLabel.textContent = "Rent Now";
            toggleTimeSelection(modalCheckBox.checked); // Disable time selection if checkbox is checked
            document.getElementById("action").value = "Rent";

            document.getElementById('longTermCheckbox').style.display = 'inline-block';
            document.getElementById('longTermCheckboxLabel').style.display = 'inline-block';

            document.getElementById('modalHelmetLabel').textContent = selectedHelmetId.value ? helmetSearchInput.value.replace(/\s*\(.+\)$/, "") : 'None';

            clientLabel.style.display = "contents";
            labelClient.style.display = "contents";
        }
    }

    if (returnBtn) {
        // When the user clicks on "Return" button, open the modal with specific text
        returnBtn.onclick = function () {
            openModal();
            updateLabel(modalText, selectedDateMain.value);
            updateLabel(bikeLabel, bikeSearchInput.value);
            updateLabel(clientLabel, clientSearchInput.value);
            modalText.value = selectedDateMain.value;
            modalCheckBoxLabel.textContent = "Return Now";
            toggleTimeSelection(modalCheckBox.checked); // Disable time selection if checkbox is checked
            document.getElementById("action").value = "Return";

            document.getElementById('longTermCheckbox').style.display = 'none';
            document.getElementById('longTermCheckboxLabel').style.display = 'none';

            fetchHelmetBike(selectedBikeId.value);

            clientLabel.style.display = "none";
            labelClient.style.display = "none";

        }
    }

    document.getElementsByClassName('close-btn')[0].onclick = closeModal;
    document.getElementsByClassName('close-btn')[1].onclick = closeReportModal;
    document.getElementsByClassName('close-btn')[2].onclick = closeViewReportModal;
    document.getElementsByClassName('close-btn')[3].onclick = closeTotalBikeModal;
    document.getElementsByClassName('close-btn')[4].onclick = closeTotalAvailableBikeModal;
    document.getElementsByClassName('close-btn')[5].onclick = closeTotalRepireBikeModal;
    document.getElementsByClassName('close-btn')[6].onclick = closeTotalLateBikeModal;
    document.getElementsByClassName('close-btn')[7].onclick = closeTotalLongTermBikeModal;
    document.getElementsByClassName('close-btn')[8].onclick = closeSearchBikeModal;
    document.getElementsByClassName('close-btn')[9].onclick = closeSearchClientModal;
    document.getElementsByClassName('close-btn')[10].onclick = closeSearchHelmetModal;
    document.getElementsByClassName('close-btn')[11].onclick = closeAddBikeModal;
    document.getElementsByClassName('close-btn')[12].onclick = closeRemoveBikeModal;
    document.getElementsByClassName('close-btn')[13].onclick = closeAddMultiBikeModal;
    document.getElementsByClassName('close-btn')[14].onclick = closeEditModal;
    document.getElementsByClassName('close-btn')[15].onclick = closeListHelmetsModal;
    document.getElementsByClassName('close-btn')[16].onclick = closeAddHelmetModal;
    document.getElementsByClassName('close-btn')[17].onclick = closeAddMultiHelmetModal;
    document.getElementsByClassName('close-btn')[18].onclick = function () {
        closeMessModal(globalAction);
    };

    // When the user clicks anywhere outside of the modal, close it
    window.addEventListener("click", function (event) {

        switch (event.target) {
            case modal:
                closeModal();
                break;

            case modalRep:
                closeReportModal();
                break;

            case modalViewRep:
                closeViewReportModal();
                break;

            case modalTotalBike:
                closeTotalBikeModal();
                break;

            case modalTotalAvailableBike:
                closeTotalAvailableBikeModal();
                break;

            case modalTotalRepireBike:
                closeTotalRepireBikeModal();
                break;

            case modalTotalLateBike:
                closeTotalLateBikeModal();
                break;

            case modalTotalLongTermBike:
                closeTotalLongTermBikeModal();
                break;

            case modalSearchBike:
                closeSearchBikeModal();
                break;

            case modalSearchClient:
                closeSearchClientModal();
                break;

            case modalSearchHelmet:
                closeSearchHelmetModal();
                break;

            case modalMessRep:
                closeMessModal(globalAction);
                break;

            case modalAddBike:
                closeAddBikeModal();
                break;

            case modalAddHelmet:
                closeAddHelmetModal();
                break;

            case modalRemoveBike:
                closeRemoveBikeModal();
                break;

            case modalAddMultiBike:
                closeAddMultiBikeModal();
                break;

            case modalAddMultiHelmet:
                closeAddMultiHelmetModal();
                break;

            case modalEditBike:
                closeEditModal();
                break;

            case modalListHelmets:
                closeListHelmetsModal();
                break;
        }
    });

    // Add event listener to the checkbox
    modalCheckBox.addEventListener('change', function () {
        toggleTimeSelection(this.checked);
    });

    // Open the report modal when the Reports button is clicked
    document.getElementById("btnReport").addEventListener("click", function () {
        openReportModal();
    });

    // Open the report modal when the Reports button is clicked on phone
    document.getElementById("btnReportPhone").addEventListener("click", function () {
        openReportModal();
    });

    // Open the report modal when the Reports button is clicked
    document.getElementById("btnListHelmet").addEventListener("click", function () {
        openListHelmetsModal();
    });

    // Open the report modal when the Reports button is clicked
    document.getElementById("btnListHelmetPhone").addEventListener("click", function () {
        openListHelmetsModal();
    });

    document.getElementById("rentedBike").addEventListener("click", function () {

        currentPage = 1;

        const headerDate = {
            'Bike Name': 'namebike',
            'Hired by': 'namesoldier',
            'Rented date': 'lb.datefrom'
        };

        rewriteTableSearch('.all-rented-bike-search-input', 'allRentedBikeTable', headerDate);

        fetchStatusBike('Rented');

        openTotalBikeModal();
    });

    document.getElementById("availableBike").addEventListener("click", function () {

        currentPage = 1;

        const headerDate = {
            'Bike Name': 'namebike',
            'Hired by': 'namesoldier',
            'Rented date': 'lb.datefrom'
        };

        rewriteTableSearch('.all-available-bike-search-input', 'allAvailableBikeTable', headerDate);

        fetchStatusBike('Available');

        openTotalAvailableBikeModal();
    });

    document.getElementById("repairBike").addEventListener("click", function () {

        currentPage = 1;

        const headerDate = {
            'Bike Name': 'namebike',
            'Hired by': 'namesoldier',
            'Rented date': 'lb.datefrom'
        };

        rewriteTableSearch('.all-repire-bike-search-input', 'allRepireBikeTable', headerDate);

        fetchStatusBike('Repair');

        openTotalRepireBikeModal()
    });

    document.getElementById("lateBike").addEventListener("click", function () {

        currentPage = 1;

        const headerDate = {
            'Bike Name': 'namebike',
            'Hired by': 'namesoldier',
            'Rented date': 'lb.datefrom'
        };

        rewriteTableSearch('.all-late-bike-search-input', 'allLateBikeTable', headerDate);

        fetchStatusBike('Late');

        openTotalLateBikeModal();
    });

    document.getElementById("longTermBike").addEventListener("click", function () {

        currentPage = 1;

        const headerDate = {
            'Bike Name': 'namebike',
            'Hired by': 'namesoldier',
            'Rented date': 'lb.datefrom'
        };

        rewriteTableSearch('.all-long-term-bike-search-input', 'allLongTermBikeTable', headerDate);

        fetchStatusBike('Long term');

        openTotalLongTermBikeModal();
    });

    document.getElementById('addBike').addEventListener("click", function () {
        openAddBikeModal();
    });

    document.getElementById('addHelmet').addEventListener("click", function () {
        openAddHelmetModal();
    });

    document.getElementById('removeBike').addEventListener("click", function () {
        openRemoveBikeModal();
    });

    document.getElementById('confirmAddMultiBikeBtn').onclick = function () {
        openAddMultiBikeModal();
    }

    document.getElementById('confirmAddMultiHelmetBtn').onclick = function () {
        openAddMultiHelmetModal();
    }

    document.getElementById("searchButtonBike").addEventListener("click", function () {

        openSearchBikeModal();

        // Clear existing rows from the table
        const existingTableBody = document.querySelector("#searchBikeModal table tbody");
        if (existingTableBody) {
            existingTableBody.remove();
        }

        const bikeId = selectedBikeId.value;
        const bikeContent = bikeSearchInput.value;

        if (bikeContent.length != 0) {

            startLoading();

            // Fetch bike data from server
            fetch(`/searchBikes?id=${bikeId}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            })
                .then(async response => {

                    if (!response.ok) {
                        const errorData = await response.json();
                        checkForGlobalError(response, errorData);
                        throw new Error(errorData.message || 'Unknown error');
                    }
                    return response.json();
                })
                .then(data => {
                    const tableBody = document.querySelector("#searchBikeModal table tbody");

                    // Clear existing rows if needed
                    if (tableBody) {
                        tableBody.remove();
                    }

                    // Create new table body
                    const newTableBody = document.createElement("tbody");

                    data.forEach(bike => {
                        const row = document.createElement("tr");

                        const nameCell = document.createElement("td");
                        nameCell.textContent = bike.namesoldier;
                        nameCell.classList.add("text-wrap");
                        nameCell.style = "max-width: 200px;";
                        row.appendChild(nameCell);

                        const dateFromCell = document.createElement("td");
                        dateFromCell.textContent = bike.datefrom ? formateDate(bike.datefrom) : "None";
                        dateFromCell.classList.add("text-wrap");
                        dateFromCell.style = "max-width: 200px;";
                        row.appendChild(dateFromCell);

                        const dateToCell = document.createElement("td");
                        dateToCell.textContent = bike.dateto ? formateDate(bike.dateto) : "Still in use";
                        dateToCell.classList.add("text-wrap");
                        dateToCell.style = "max-width: 200px;";
                        row.appendChild(dateToCell);

                        newTableBody.appendChild(row);
                    });

                    // Append new table body to table
                    document.querySelector("#searchBikeModal table").appendChild(newTableBody);
                })
                .catch(error => {
                    showMess('Error', error.message);
                })
                .finally(() => {
                    stopLoading();
                });
        }
    });

    document.getElementById("searchButtonClient").addEventListener("click", function () {

        openSearchClientModal();

        // Clear existing rows from the table
        const existingTableBody = document.querySelector("#searchClientModal table tbody");
        if (existingTableBody) {
            existingTableBody.remove();
        }

        const clientId = selectedClientId.value;
        const clientContent = clientSearchInput.value;

        if (clientContent.length != 0) {

            startLoading();

            // Fetch bike data from server
            fetch(`/searchClient?id=${clientId}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            })
                .then(async response => {

                    if (!response.ok) {
                        const errorData = await response.json();
                        checkForGlobalError(response, errorData);
                        throw new Error(errorData.message || 'Unknown error');
                    }
                    return response.json();
                })
                .then(data => {
                    const tableBody = document.querySelector("#searchClientModal table tbody");

                    // Clear existing rows if needed
                    if (tableBody) {
                        tableBody.remove();
                    }

                    // Create new table body
                    const newTableBody = document.createElement("tbody");

                    data.forEach(client => {
                        const row = document.createElement("tr");

                        const nameCell = document.createElement("td");
                        nameCell.textContent = client.namebike;
                        nameCell.classList.add("text-wrap");
                        nameCell.style = "max-width: 200px;";
                        row.appendChild(nameCell);

                        const dateFromCell = document.createElement("td");
                        dateFromCell.textContent = client.datefrom ? formateDate(client.datefrom) : "None";
                        dateFromCell.classList.add("text-wrap");
                        dateFromCell.style = "max-width: 200px;";
                        row.appendChild(dateFromCell);

                        const dateToCell = document.createElement("td");
                        dateToCell.textContent = client.dateto ? formateDate(client.dateto) : "Still in use";
                        dateToCell.classList.add("text-wrap");
                        dateToCell.style = "max-width: 200px;";
                        row.appendChild(dateToCell);

                        newTableBody.appendChild(row);
                    });

                    // Append new table body to table
                    document.querySelector("#searchClientModal table").appendChild(newTableBody);
                })
                .catch(error => {
                    showMess('Error', error.message);
                })
                .finally(() => {
                    stopLoading();
                });
        }
    });

    document.getElementById("searchButtonHelmet").addEventListener("click", function () {

        openSearchHelmetModal();

        // Clear existing rows from the table
        const existingTableBody = document.querySelector("#searchHelmetModal table tbody");
        if (existingTableBody) {
            existingTableBody.remove();
        }

        const helmetId = selectedHelmetId.value;
        const helmetContent = helmetSearchInput.value;

        if (helmetContent.length != 0) {

            startLoading();

            // Fetch bike data from server
            fetch(`/searchHelmet?id=${helmetId}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            })
                .then(async response => {

                    if (!response.ok) {
                        const errorData = await response.json();
                        checkForGlobalError(response, errorData);
                        throw new Error(errorData.message || 'Unknown error');
                    }
                    return response.json();
                })
                .then(data => {
                    const tableBody = document.querySelector("#searchHelmetModal table tbody");

                    // Clear existing rows if needed
                    if (tableBody) {
                        tableBody.remove();
                    }

                    // Create new table body
                    const newTableBody = document.createElement("tbody");

                    data.forEach(bike => {
                        const row = document.createElement("tr");

                        const nameCell = document.createElement("td");
                        nameCell.textContent = bike.namesoldier;
                        nameCell.classList.add("text-wrap");
                        nameCell.style = "max-width: 200px;";
                        row.appendChild(nameCell);

                        const dateFromCell = document.createElement("td");
                        dateFromCell.textContent = bike.datefrom ? formateDate(bike.datefrom) : "None";
                        dateFromCell.classList.add("text-wrap");
                        dateFromCell.style = "max-width: 200px;";
                        row.appendChild(dateFromCell);

                        const dateToCell = document.createElement("td");
                        dateToCell.textContent = bike.dateto ? formateDate(bike.dateto) : "Still in use";
                        dateToCell.classList.add("text-wrap");
                        dateToCell.style = "max-width: 200px;";
                        row.appendChild(dateToCell);

                        newTableBody.appendChild(row);
                    });

                    // Append new table body to table
                    document.querySelector("#searchHelmetModal table").appendChild(newTableBody);
                })
                .catch(error => {
                    showMess('Error', error.message);
                })
                .finally(() => {
                    stopLoading();
                });
        }
    });

    document.getElementById("removeHelmet").addEventListener("click", function () {

        const submitButton = document.createElement('button');
        var isRemove = false;
        var isError = false;
        var result = {};

        if (allCheckedRow.length === 0) {
            showMess('Error', 'You have not selected any helmets to remove')
            return;
        }

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');
        submitButton.addEventListener('click', async () => {

            startLoading();

            for (const data of allCheckedRow) {

                isRemove = true;

                const response = await fetch('/bicycles/removeHelmet', {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data),
                });

                result = await response.json();

                if (!response.ok) {
                    checkForGlobalError(response, result);
                    isError = true;
                }
            }

            stopLoading();
            closeMessModal();
        });

        modalMessRepContent.appendChild(submitButton);

        // Close the warning modal and show the info modal
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show')) {
                closeWarningObserver.disconnect();

                // Explicitly remove submitButton if it's still in the modal content
                if (modalMessRepContent.contains(submitButton)) {
                    modalMessRepContent.removeChild(submitButton);
                }

                if (isRemove && !isError) {
                    globalAction = 'removeHelmet'
                    showMess('Info', result.message);
                } else if (isError) {
                    showMess('Error', result.message || 'An error occurred while adding the bike')
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        showMess('Warnning', 'Are you sure you want to remove the selected helmets?');
    });

    function firstUpdateTable(rows, currentIndex, rowsPerPage, pageNumberId) {
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display = i >= currentIndex && i < currentIndex + rowsPerPage ? "table-row" : "none";
        }

        let totalPages = Math.ceil(rows.length / rowsPerPage) || 1; // Recalculate total pages (avoid division by zero)
        let currentPage = Math.floor(currentIndex / rowsPerPage) + 1;
        document.getElementById(pageNumberId).textContent = `${currentPage}/${totalPages}`;
    }

    async function fetchReport(selectDate1, selectDate2, page = 1, pageDate = 1, limit = 10, searchFilters = [], searchFiltersDate = []) {

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();
        const { signal } = currentFetchController;

        startLoading();

        try {

            const searchParams = new URLSearchParams({
                selectedDate1: selectDate1,
                selectedDate2: selectDate2,
                page,
                pageDate,
                limit
            });

            searchFilters.forEach(filter => {
                searchParams.append('searchColumn', filter.column);
                searchParams.append('searchValue', filter.value);
            });

            searchFiltersDate.forEach(filter => {
                searchParams.append('searchColumnDate', filter.column);
                searchParams.append('searchValueDate', filter.value);
            });

            const response = await fetch(`/bicycles/viewReport?${searchParams.toString()}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                },
                signal
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showMess('Error', error.message);
                return;
            }

            const { data, dateTotals, totalPages, totalPagesTotal } = await response.json();

            // Clear existing rows from bike usage details table
            const bikeUsageTableBody = document.getElementById('bikeUsageTable').getElementsByTagName('tbody')[0];
            bikeUsageTableBody.innerHTML = '';

            const bikeTotalsTableBody = document.getElementById('bikeTotalsTable').getElementsByTagName('tbody')[0];
            bikeTotalsTableBody.innerHTML = '';

            data.forEach(row => {
                const newRow = bikeUsageTableBody.insertRow();
                [
                    row.namebike,
                    row.namesoldier,
                    row.country,
                    row.helmet_code || 'N/A',
                    row.date_from !== 'Still in use' ? formateDate(row.date_from) : 'Still in use',
                    row.date_to !== 'Still in use' ? formateDate(row.date_to) : 'Still in use',
                    row.duration
                ].forEach(cellValue => {
                    const cell = newRow.insertCell();
                    cell.textContent = cellValue;
                    cell.style.maxWidth = "200px";
                    cell.classList.add("text-wrap");
                });
            });

            dateTotals.forEach(row => {
                const newRow = bikeTotalsTableBody.insertRow();
                [
                    row.date,
                    row.total_bikes
                ].forEach(cellValue => {
                    const cell = newRow.insertCell();
                    cell.textContent = cellValue;
                    cell.style.maxWidth = "200px";
                    cell.classList.add("text-wrap");
                });
            });

            const rowsTable = bikeUsageTableBody.getElementsByTagName("tr");
            const rowsTableDate = bikeTotalsTableBody.getElementsByTagName("tr");

            firstUpdateTable(rowsTable, 0, 10, 'pageNumber');
            firstUpdateTable(rowsTableDate, 0, 10, 'pageNumberDate');

            setupTableNavigation("bikeUsageTable", "prevBtn", "nextBtn", "pageNumber", limit, totalPages, page, searchFilters, searchFiltersDate, selectDate1, selectDate2);
            setupTableNavigation("bikeTotalsTable", "prevBtnDate", "nextBtnDate", "pageNumberDate", limit, totalPagesTotal, pageDate, searchFilters, searchFiltersDate, selectDate1, selectDate2);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'Error fetching the report');

        } finally {
            stopLoading();
        }
    }

    document.getElementById('form1').addEventListener('submit', async function (event) {

        async function checkBike(action, setDate, selectHour, selectMinute) {

            startLoading();

            const isInvalidInput = (action === "Rent" && (
                modalText.textContent === "None" ||
                bikeLabel.textContent === "None" ||
                clientLabel.textContent === "None" ||
                selectHour === "Select Hour" ||
                selectMinute === "Select Minutes"
            )) || (action === "Return" && (
                modalText.textContent === "None" ||
                bikeLabel.textContent === "None" ||
                selectHour === "Select Hour" ||
                selectMinute === "Select Minutes"
            ));

            if (isInvalidInput) {
                showMess('Error', 'Please select all fields');
                return false;
            }

            try {

                const response = await fetch(`/checkBike?bikeId=${selectedBikeId.value}`, {
                    method: 'GET',
                    headers: {
                        'X-Is-Fetch': 'true'
                    }
                });

                if (!response.ok) {
                    const error = await response.json();
                    checkForGlobalError(response, error);
                    showMess('Error', error.message);
                    return false;
                }

                const data = await response.json();
                const dateFrom = new Date(data.datefrom);
                const dateTo = new Date(`${setDate} ${selectHour}:${selectMinute}`);
                const dateNow = new Date();

                // Validate input fields

                if (action === "Rent" && data.status !== 'Available') {
                    showMess('Error', 'The bike is already rented!');
                    return false;

                } else if (action === "Return" && data.status === 'Available') {
                    showMess('Error', 'This bike is not rented!');
                    return false;

                } else if (action === "Return" && dateFrom > dateTo) {
                    showMess('Error', 'Invalid return date!');
                    return false;

                } else if (dateTo > dateNow) {
                    showMess('Error', 'Invalid rent date!');
                    return false;
                }

                return true;
                
            } catch (error) {
                showMess('Error', 'Error check status bike');
            } finally {
                stopLoading();
            }
        }

        event.preventDefault(); // Prevent default form submission

        const action = document.getElementById("action").value;
        const setDate = document.getElementById('date').value;

        const isValid = await checkBike(action, setDate, hourSelect.value, minuteSelect.value);
        if (!isValid) return;

        if (document.getElementById("longTermCheckbox").checked)
            document.getElementById("longTermCheckbox").value = true;

        const data = {
            bikeId: selectedBikeId.value,
            clientId: selectedClientId.value,
            actionId: action,
            dateId: setDate,
            hourSelectId: hourSelect.value,
            minuteSelect: minuteSelect.value,
            ltstatus: document.getElementById("longTermCheckbox").value,
            helmetId: selectedHelmetId.value ? selectedHelmetId.value : ''
        };

        const submitButton = document.createElement('button');
        let isSubmit = false;
        let hasError = false;
        let responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    checkForGlobalError(response, responseData);
                    hasError = true;
                }

                closeMessModal();
            }
            catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }
        });

        modalMessRepContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessRepContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessRepContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show')) {
                closeWarningObserver.disconnect();

                // Explicitly remove submitButton if it's still in the modal content
                if (modalMessRepContent.contains(submitButton)) {
                    modalMessRepContent.removeChild(submitButton);
                }

                if (isSubmit && !hasError) {
                    globalAction = 'bikeAction'
                    showMess('Info', `The bike is ${action.toLowerCase()} succesful`);
                } else if (isSubmit) {
                    showMess('Error', responseData.message || `An error occurred while ${action.toLowerCase()} bike`);
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', `Are you sure you want to ${action.toLowerCase()} bike`);

    });

    document.getElementById('form2').addEventListener('submit', async function (event) {

        event.preventDefault();

        startLoading();

        try {

            const response = await fetch(document.getElementById('form2').action, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    selectedDate1: globalSelectDate1,
                    selectedDate2: globalSelectDate2,
                    filtersBike: globalSearchFilters,
                    filtersBikeDate: globalSearchFiltersDate
                })
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                throw new Error(error);
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'report_bicycles.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            showMess('Error', error.message || 'Failed to download the report.');

        } finally {
            stopLoading();
        }
    });

    document.getElementById('form3').addEventListener('submit', async function (event) {

        event.preventDefault(); // Prevent default form submission

        const bikeAddId = document.getElementById('bike-number');
        const bikeName = document.getElementById('bike-name');

        const inputsToCheck = [
            { input: bikeAddId, condition: bikeAddId.value === "" || !/^[a-zA-Z0-9]+$/.test(bikeAddId.value) },
            { input: bikeName, condition: bikeName.value === "" || !/^[0-9]+\/[A-Za-z\s]+$/.test(bikeName.value) }
        ];

        let isValid = true;

        inputsToCheck.forEach(({ input, condition }) => {
            if (condition) {
                toggleInputValidity(input, false);
                isValid = false;
            } else {
                toggleInputValidity(input, true);
            }
        });

        if (!isValid) {
            return;
        }

        const data = {
            bikeAddId: bikeAddId.value,
            bikeName: bikeName.value
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json(); // Parse JSON response

                // Display success or error messages
                if (!response.ok) {
                    checkForGlobalError(response, responseData);
                    hasError = true;
                }

                closeMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }
        });

        modalMessRepContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessRepContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessRepContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show')) {
                closeWarningObserver.disconnect();

                // Explicitly remove submitButton if it's still in the modal content
                if (modalMessRepContent.contains(submitButton)) {
                    modalMessRepContent.removeChild(submitButton);
                }

                if (isSubmit && !hasError) {
                    globalAction = 'addBike';
                    showMess('Info', responseData.message);
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while adding the bike')
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        showMess('Warnning', 'Are you sure you want to add this bike?');
    });

    document.getElementById('form5').addEventListener('submit', async function (event) {

        event.preventDefault(); // Prevent default form submission

        const value = editDateFrom.value.trim();

        // Check if the value is a valid date
        const isValidDate = !isNaN(new Date(value).getTime());

        const inputsToCheck = [
            { input: selectedStatus, condition: selectedStatus.value === 'Select Status' },
            { input: editSoldierSearchInput, condition: selectedEditSoldierId.value === "" },
            { input: editHelmetCodeSearchInput, condition: false },
            { input: editDateFrom, condition: !isValidDate }
        ];

        let isValid = true;

        inputsToCheck.forEach(({ input, condition }) => {
            if (condition) {
                toggleInputValidity(input, false);
                isValid = false;
            } else {
                toggleInputValidity(input, true);
            }
        });

        if (!isValid) {
            return;
        }

        let date = new Date(editDateFrom.value);

        // Format components
        let year = date.getFullYear();
        let month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        let day = String(date.getDate()).padStart(2, '0');
        let hours = String(date.getHours()).padStart(2, '0');
        let minutes = String(date.getMinutes()).padStart(2, '0');

        formattedDateFrom = `${year}-${month}-${day} ${hours}:${minutes}`;

        const data = {
            bikeId: editBikeSearchId,
            status: selectedStatus.value,
            soldierId: selectedEditSoldierId.value,
            helmetId: selectedEditHelmetCodeId.value,
            dateFrom: formattedDateFrom
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(this.action, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json(); // Parse JSON response

                // Display success or error messages
                if (!response.ok) {
                    checkForGlobalError(response, responseData);
                    hasError = true;
                }

                closeMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }
        });

        modalMessRepContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessRepContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessRepContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show')) {
                closeWarningObserver.disconnect();

                // Explicitly remove submitButton if it's still in the modal content
                if (modalMessRepContent.contains(submitButton)) {
                    modalMessRepContent.removeChild(submitButton);
                }

                if (isSubmit && !hasError) {
                    globalAction = 'editBike';
                    showMess('Info', responseData.message)
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while editing the bike')
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        showMess('Warnning', 'Are you sure you want to edit this bike?');
    });

    document.getElementById('form6').addEventListener('submit', async function (event) {

        event.preventDefault(); // Prevent default form submission

        const helmetAddId = document.getElementById('helmet-number');
        const helmetName = document.getElementById('helmet-name');

        const inputsToCheck = [
            { input: helmetAddId, condition: helmetAddId.value === "" || !/^[a-zA-Z0-9]+$/.test(helmetAddId.value) },
            { input: helmetName, condition: helmetName.value === "" || !/^[0-9]+\/[A-Za-z\s]+$/.test(helmetName.value) }
        ];

        let isValid = true;

        inputsToCheck.forEach(({ input, condition }) => {
            if (condition) {
                toggleInputValidity(input, false);
                isValid = false;
            } else {
                toggleInputValidity(input, true);
            }
        });

        if (!isValid) {
            return;
        }

        const data = {
            helmetAddId: helmetAddId.value,
            helmetName: helmetName.value
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json(); // Parse JSON response

                // Display success or error messages
                if (!response.ok) {
                    checkForGlobalError(response, responseData);
                    hasError = true;
                }

                closeMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }
        });

        modalMessRepContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessRepContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessRepContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show')) {
                closeWarningObserver.disconnect();

                // Explicitly remove submitButton if it's still in the modal content
                if (modalMessRepContent.contains(submitButton)) {
                    modalMessRepContent.removeChild(submitButton);
                }

                if (isSubmit && !hasError) {
                    globalAction = 'addHelmet';
                    showMess('Info', responseData.message);
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while adding the bike');
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        showMess('Warnning', 'Are you sure you want to add this helmet?');
    });

    selectedStatus.addEventListener('change', () => {
        const isDefaultStatus = selectedStatus.value === 'Select Status';
        const isRepairStatus = selectedStatus.value === 'Repair';

        // Handle 'Select Status'
        if (isDefaultStatus) {
            toggleInputValidity(selectedStatus, false);
            toggleInputValidity(editSoldierSearchInput, selectedEditSoldierId.value !== '');
            return;
        }

        // General case: mark status as valid
        toggleInputValidity(selectedStatus, true);

        // Handle 'Repair' status
        if (isRepairStatus) {
            editSoldierSearchInput.value = 'Repair';
            selectedEditSoldierId.value = 4;
            editSoldierSearchInput.classList.add('disabled-select');
            toggleInputValidity(selectedStatus, true);
            toggleInputValidity(editSoldierSearchInput, true);
            return;
        }

        // Handle other statuses
        editSoldierSearchInput.classList.remove('disabled-select');
        toggleInputValidity(editSoldierSearchInput, selectedEditSoldierId.value !== '');
    });


    document.getElementById('bike-number').addEventListener('input', function (event) {
        const input = event.target;
        if (input.value !== '' && /^[a-zA-Z0-9]+$/.test(input.value)) {
            input.classList.add('is-valid');
            input.classList.remove('is-invalid');
        } else {
            input.classList.add('is-invalid');
            input.classList.remove('is-valid');
        }
    });


    document.getElementById('bike-name').addEventListener('input', function (event) {
        const input = event.target;
        if (input.value !== '' && /^[0-9]+\/[A-Za-z\s]+$/.test(input.value)) {
            input.classList.add('is-valid');
            input.classList.remove('is-invalid');
        } else {
            input.classList.add('is-invalid');
            input.classList.remove('is-valid');
        }
    });

    document.getElementById('helmet-number').addEventListener('input', function (event) {
        const input = event.target;
        if (input.value !== '' && /^[a-zA-Z0-9]+$/.test(input.value)) {
            input.classList.add('is-valid');
            input.classList.remove('is-invalid');
        } else {
            input.classList.add('is-invalid');
            input.classList.remove('is-valid');
        }
    });


    document.getElementById('helmet-name').addEventListener('input', function (event) {
        const input = event.target;
        if (input.value !== '' && /^[0-9]+\/[A-Za-z\s]+$/.test(input.value)) {
            input.classList.add('is-valid');
            input.classList.remove('is-invalid');
        } else {
            input.classList.add('is-invalid');
            input.classList.remove('is-valid');
        }
    });

    editDateFrom.addEventListener('input', () => {
        const value = editDateFrom.value.trim();

        // Check if the value is a valid date
        const isValidDate = !isNaN(new Date(value).getTime());
        toggleInputValidity(editDateFrom, isValidDate);
    });

    document.getElementById('form4').addEventListener('submit', async function (event) {

        event.preventDefault(); // Prevent default form submission
        const bikeRemoveId = document.getElementById('selectedRemoveBikeId');

        if (bikeRemoveId.value === '') {
            removeBikeSearchInput.classList.remove('is-valid');
            removeBikeSearchInput.classList.add('is-invalid');
            return;
        }

        const data = {
            bikeRemoveId: bikeRemoveId.value
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(this.action, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json(); // Parse JSON response

                // Display success or error messages
                if (!response.ok) {
                    checkForGlobalError(response, responseData);
                    hasError = true;
                }

                closeMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }
        });

        modalMessRepContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessRepContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessRepContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMessRep.classList.contains('show')) {
                closeWarningObserver.disconnect();

                // Explicitly remove submitButton if it's still in the modal content
                if (modalMessRepContent.contains(submitButton)) {
                    modalMessRepContent.removeChild(submitButton);
                }

                if (isSubmit && !hasError) {
                    globalAction = 'removeBike';
                    showMess('Info', responseData.message)
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while removing the bike')
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        showMess('Warnning', 'Are you sure you want to remove this bike?');
    });

    document.getElementById('upload-multi-bike-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInputBike");
        const file = fileInput.files[0];

        if (!file) {
            showMess('Error', 'You have not selected a file to upload')
            return;
        }

        const url = "/bicycles/uploadMultiBike";
        const progressBar = document.getElementById("progress-multi-bike");

        const updateProgressBar = (percentage) => {
            progressBar.style.width = percentage + "%";
            if (percentage >= 100)
                startLoading();
        };

        updateProgressBar(0);

        const formData = new FormData();
        formData.append("file", file);

        // Use XMLHttpRequest to track upload progress
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('CSRF-Token', csrfToken);

        xhr.upload.onprogress = function (event) {
            if (event.lengthComputable) {
                const percentage = (event.loaded / event.total) * 100;
                updateProgressBar(percentage);
            }
        };

        xhr.onload = function () {
            if (xhr.status === 200) {
                setTimeout(() => {
                    stopLoading();
                    globalAction = 'uploadMultiBike';
                    showMess('Info', 'File uploaded successfully!');
                }, 1000);

            } else {

                stopLoading();
                const data = JSON.parse(xhr.responseText);

                if (data.errors) {

                    data.errors.forEach(error => {

                        switch (error.type) {
                            case 'Validation':
                                showMess('Error', 'Check the syntax of all rows in the table');
                                break;

                            default:
                                showMess('Error', error.message);
                                break;
                        }
                    });

                } else {
                    showMess('Error', data.error || "File upload failed.");
                }
            }
        };

        xhr.onerror = function () {
            stopLoading();
            closeAddMultiBikeModal();

            showMess('Error', 'An unexpected error occurred.');
        };

        xhr.send(formData);
    });

    document.getElementById('upload-multi-helmet-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInputHelmet");
        const file = fileInput.files[0];

        if (!file) {
            showMess('Error', 'You have not selected a file to upload');
            return;
        }

        const url = "/bicycles/uploadMultiHelmet";
        const progressBar = document.getElementById("progress-multi-helmet");

        const updateProgressBar = (percentage) => {
            progressBar.style.width = percentage + "%";
            if (percentage >= 100)
                startLoading();
        };

        updateProgressBar(0);

        const formData = new FormData();
        formData.append("file", file);

        // Use XMLHttpRequest to track upload progress
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('CSRF-Token', csrfToken);

        xhr.upload.onprogress = function (event) {
            if (event.lengthComputable) {
                const percentage = (event.loaded / event.total) * 100;
                updateProgressBar(percentage);
            }
        };

        xhr.onload = function () {
            if (xhr.status === 200) {
                setTimeout(() => {
                    stopLoading();
                    globalAction = 'uploadMultiHelmet';
                    showMess('Info', 'File uploaded successfully!');
                }, 1000);

            } else {

                stopLoading();
                const data = JSON.parse(xhr.responseText);

                if (data.errors) {

                    data.errors.forEach(error => {

                        switch (error.type) {
                            case 'Validation':
                                showMess('Error', 'Check the syntax of all rows in the table');
                                break;

                            default:
                                showMess('Error', error.message);
                                break;
                        }
                    });

                } else {
                    showMess('Error', data.error || "File upload failed.");
                }

            }
        };

        xhr.onerror = function () {
            stopLoading();

            closeAddMultiHelmetModal();
            showMess('Error', "An unexpected error occurred.");
        };

        xhr.send(formData);
    });

});
