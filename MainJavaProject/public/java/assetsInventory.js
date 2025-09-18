document.addEventListener('DOMContentLoaded', function () {

    const assetsModal = document.getElementById('assetsModal');
    const assetsModalContent = assetsModal.querySelector('.modal-content');

    const assetsEditModal = document.getElementById('editAssetsModal');
    const assetsEditModalContent = assetsEditModal.querySelector('.modal-content');

    const assetsAddModal = document.getElementById('addAssetsModal');
    const assetsAddModalContent = assetsAddModal.querySelector('.modal-content');

    const addAssetsTypeModal = document.getElementById("addAssetsTypeModal");
    const addAssetsTypeModalContent = addAssetsTypeModal.querySelector('.modal-content');

    const removeAssetsTypeModal = document.getElementById("removeAssetsTypeModal");
    const removeAssetsTypeModalContent = removeAssetsTypeModal.querySelector('.modal-content');

    const lostAssetsModal = document.getElementById('lostAssetsModal');
    const lostAssetsModalContent = lostAssetsModal.querySelector('.modal-content');

    const assetArchiveModal = document.getElementById('reportModal');
    const assetArchiveModalContent = assetArchiveModal.querySelector('.modal-content-multi-calendar');

    const assetReportModal = document.getElementById('reportViewModal');
    const assetReportModalContent = assetReportModal.querySelector('.modal-content-report');

    const cleanItemModal = document.getElementById('cleanItemListModal');
    const cleanItemModalContent = cleanItemModal.querySelector('.modal-content');

    const addCleanItemModal = document.getElementById('addCleanItemModal');
    const addCleanItemModalContent = addCleanItemModal.querySelector('.modal-content');

    const addMultiCleanItemModal = document.getElementById('uploadModal');
    const addMultiCleanItemModalContent = addMultiCleanItemModal.querySelector('.modal-content');

    const editMultiAssetsModal = document.getElementById('uploadEditMultiAssetsModal');
    const editMultiAssetsModalContent = editMultiAssetsModal.querySelector('.modal-content');

    const addMultiAssetsModal = document.getElementById('uploadAddMultiAssetsModal');
    const addMultiAssetsModalContent = addMultiAssetsModal.querySelector('.modal-content');

    const removeCleanItemModal = document.getElementById('removeCleanItemModal');
    const removeCleanItemModalContent = removeCleanItemModal.querySelector('.modal-content');

    const editCleanItemModal = document.getElementById('editCleanItemModal');
    const editCleanItemModalContent = editCleanItemModal.querySelector('.modal-content');

    const itemTraceabilityModal = document.getElementById('itemTraceabilityModal');
    const itemTraceabilityModalContent = itemTraceabilityModal.querySelector('.modal-content');

    const inventoryModal = document.getElementById("inventoryModal");
    const inventoryModalContent = inventoryModal.querySelector('.modal-content');

    const modalMess = document.getElementById("myMessage");
    const modalMessContent = modalMess.querySelector('.modal-content-mess');

    const cleanItemName = document.getElementById('item-name');
    const cleanItemTotalAmount = document.getElementById('total-amount');

    const removeCleanItemSearchInput = document.getElementById('removeCleanItemSearch');
    const removeCleanItemSearchDropdown = document.getElementById('removeCleanItemDropdown');
    const selectedRemoveCleanItemId = document.getElementById('selectedRemoveCleanItemId');

    const editCleanItemSearchInput = document.getElementById('editCleanItemSearch');
    const editCleanItemSearchDropdown = document.getElementById('editCleanItemDropdown');
    const selectedEditCleanItemId = document.getElementById('selectedEditCleanItemId');

    const selectAllAssetInput = document.getElementById('allAssetSearch');
    const selectAllAssetDropdown = document.getElementById('allAssetDropdown');

    const editAmount = document.getElementById('editAmount');

    const lostAssetSearchInput = document.getElementById('lostAssetName');
    const lostAssetSearchDropdown = document.getElementById('lostAssetNameDropdown');
    const selectedLostAssetId = document.getElementById('selectedLostAssetNameId');

    const lostAssetQuantity = document.getElementById('lostAssetQuantity');

    const assetSearchInput = document.getElementById('assetSearch');
    const assetSearchDropdown = document.getElementById('assetDropdown');
    const selectedAssetId = document.getElementById('selectedAssetId');

    const assetEps = document.getElementById('assetEpc');
    const assetCodeSearch = document.getElementById('assetCodeSearch');
    const assetAddName = document.getElementById('assetAddName');
    const assetAddCategorie = document.getElementById('addCategorie');
    const assetQuantity = document.getElementById('assetQuantity');
    const assetAddMrah = document.getElementById('assetAddMrah');
    const assetAddOwner = document.getElementById('assetAddOwner');
    const assetAddM2Inside = document.getElementById('assetAddM2Inside');
    const assetAddComments = document.getElementById('assetAddComments');
    const assetAddRestValue = document.getElementById('assetAddRestValue');
    const assetAddReplacedOff = document.getElementById('assetAddReplacedOff');
    const assetAddReplacedBy = document.getElementById('assetAddReplacedBy');
    const assetAddYearOfLifeCycle = document.getElementById('assetAddYearOfLifeCycle');
    const assetAddRestOfLifeCycle = document.getElementById('assetAddRestOfLifeCycle');
    const assetAddPurchasePrice = document.getElementById('assetAddPurchasePrice');
    const assetAddDatePurchase = document.getElementById('assetAddDatePurchase');
    const assetAddDateWrittenOff = document.getElementById('assetAddDateWrittenOff');
    const assetAddIsFixed = document.getElementById('assetAddIsFixed');
    const assetAddService = document.getElementById('assetAddService');
    const assetStatus = document.getElementById('assetStatus');
    const assetAddExpandable = document.getElementById('assetAddExpandable');
    const assetAddDescription = document.getElementById('assetAddDescription');

    const typeSearchInput = document.getElementById('typeSearch');
    const typeSearchDropdown = document.getElementById('typeDropdown');
    const selectedTypeId = document.getElementById('selectedTypeId');

    const typeAddSearchInput = document.getElementById('addTypeSearch');
    const typeAddSearchDropdown = document.getElementById('addTypeDropdown');
    const selectedAddTypeId = document.getElementById('selectedAddTypeId');

    const removeAssetTypeSearchInput = document.getElementById('removeAssetTypeSearch');
    const removeAssetTypeDropdown = document.getElementById('removeAssetTypeDropdown');
    const selectedRemoveAssetId = document.getElementById('selectedRemoveAssetId');

    const locationSearchInput = document.getElementById('locationSearch');
    const locationSearchDropdown = document.getElementById('locationDropdown');
    const selectedLocationId = document.getElementById('selectedLocationId');

    const addLocationSearchInput = document.getElementById('addLocationSearch');
    const addLocationSearchDropdown = document.getElementById('addLocationDropdown');
    const selectedAddLocationId = document.getElementById('selectedAddLocationId');

    const subLocationSearchInput = document.getElementById('subLocationSearch');
    const subLocationSearchDropdown = document.getElementById('subLocationDropdown');
    const selectedSubLocationId = document.getElementById('selectedSubLocationId');

    const addSubLocationSearchInput = document.getElementById('addSubLocationSearch');
    const addSubLocationSearchDropdown = document.getElementById('addSubLocationDropdown');
    const selectedAddSubLocationId = document.getElementById('selectedAddSubLocationId');

    const assetName = document.getElementById('assetName');
    const assetCategory = document.getElementById('categorie');
    const assetEditQuantity = document.getElementById('quantity');
    const assetMrah = document.getElementById('mrah');
    const assetOwner = document.getElementById('owner');
    const assetM2Inside = document.getElementById('m2_inside');
    const assetComments = document.getElementById('comments');
    const assetRestValue = document.getElementById('rest_value');
    const assetReplacedOff = document.getElementById('replaced_off');
    const assetReplacedBy = document.getElementById('replaced_by');
    const assetYearOfLifeCycle = document.getElementById('year_of_life_cycle');
    const assetRestOfLifeCycle = document.getElementById('rest_of_life_cycle');
    const assetPurchasePrice = document.getElementById('purchase_price');
    const assetDatePurchase = document.getElementById('date_purchase');
    const assetDateWrittenOff = document.getElementById('date_written_off');
    const assetIsFixed = document.getElementById('is_fixed');
    const assetService = document.getElementById('service');
    const assetEditStatus = document.getElementById('status');
    const assetExpandable = document.getElementById('expandable');
    const assetDescription = document.getElementById('description');
    const assetAddType = document.getElementById('assetType');

    const lostItemDescription = document.getElementById('assetDescription');

    const dropdownButton = document.getElementById('typeDropdownMenuButton');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    const mainRowsPerPage = 50;
    let mainCurrentPage = 1;
    let mainTotalRows = parseInt(document.getElementById("totalCount").value);
    let filters = [];

    const tableBody = document.getElementById("tableBody");
    const pagination = document.getElementById("pagination");
    const isFirstTime = document.getElementsByName("isFirstTime")[0];
    const headerCells = document.querySelectorAll(`#data-table thead th`);

    const mainHeaderMap = {
        'Room Number': 'nameroom',
        'Number of assets': 'count_assets'
    };

    const formateDate = isoString => {
        const date = new Date(isoString);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const hourStr = String(hours).padStart(2, '0');

        return `${year}-${month}-${day} ${hourStr}:${minutes}:${seconds} ${ampm}`;
    }

    let currentPage = 1;
    let secondCurrentPage = 1;
    let globalSearchFilters = [];
    let globalSearchFiltersDate = [];
    let globalSearchLargeFilters = [];
    let globalSearchSmallFilters = [];
    let globalSelectDate1;
    let globalSelectDate2;

    let globalRowId;
    let sortedPar;
    let mainSortedPar;
    let selectedBuilding = "";
    let globalAction = '';

    // Track sort order and priority for each column
    let sortOrder = {
        nameroom: true, // true means ascending, false means descending
        count_assets: true
    };

    // Track sort order and priority for each column
    let sortOrderAsset = {
        code: true, // true means ascending, false means descending
        name_assets: true,
        type_name: true,
        nameroom: true,
        description: true
    };

    // Maintain the sort priority sequence
    let allAsset = [];

    var nameAssetSetCount = [];
    var assetType = [];
    var assetLocation = [];
    var assetSubLocation = [];
    var uniqueRooms = [];
    var lostAssetsCode = [];
    var cleanItems = [];
    var isTotalAmound;
    var oldEditAssetId = "";

    var allCheckedRow = [];
    var allCheckedLargeRow = [];
    var allCheckedSmallRow = [];
    var oldAssetNameKey;
    var isInfo = true;

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

    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

    const checkForGlobalError = (response, responseBody) => {
        if (response.headers.get('X-Global-Error') === 'true')
            window.location.href = `/error?statusCode=${responseBody.statusCode}&message=${responseBody.message}&details=${responseBody.details}`;
    };

    const csrfToken = document.getElementsByName('_csrf')[0].value;

    // Show loading indicator
    const loadingIndicator = document.getElementById('loadingIndicator');

    function fetchTypeData() {
        startLoading();

        fetch(`/assets/getAllType`, {
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
                assetType = data;
            })
            .catch(error => {
                showMess('Error', error.message);
            })
            .finally(() => {
                stopLoading();
            });
    }

    fetchTypeData();

    startLoading();

    fetch(`/allKeys`, {
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
            assetSubLocation = data;
        })
        .catch(error => {
            showMess('Error', error.message);
        });

    fetch(`/asset/keys`, {
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

            assetLocation = data;
            uniqueRooms = Array.from(
                new Map(
                    data
                        // .filter(row => row.roomid != null) // Exclude rows with null roomid
                        .map(row => [row.roomid, { roomid: row.roomid, nameroom: row.nameroom }])
                ).values()
            );
        })
        .catch(error => {
            showMess('Error', error.message);
        })
        .finally(() => {
            stopLoading();
        });

    function buildQueryParams(page, mainSortedPar, numBuild) {
        const offset = (page - 1) * mainRowsPerPage;
        const params = new URLSearchParams({
            numBuild: numBuild,
            isFirstTime: isFirstTime.value,
            limit: mainRowsPerPage,
            offset: offset
        });

        if (Object.keys(mainSortedPar).length > 0) {
            params.append('sortedColumn', mainSortedPar.column);
            params.append('sortedDirection', mainSortedPar.direction);
        }

        filters.forEach(filter => {
            params.append('searchColumn', filter.column);
            params.append('searchValue', filter.value);
        });

        return params.toString();
    }

    async function fetchTableData(page, mainSortedPar = {}, numBuild = "") {

        startLoading();

        const query = buildQueryParams(page, mainSortedPar, numBuild);

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();
        const { signal } = currentFetchController;

        try {
            const res = await fetch(`/assets?${query}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }, 
                signal
            });

            if (!res.ok) {
                const error = await res.json();
                checkForGlobalError(res, error);
                showMess('Error', error.message);
                return;
            }

            const { inventory, totalCount } = await res.json();

            mainTotalRows = parseInt(totalCount);
            mainCurrentPage = page;

            renderTable(inventory);
            renderPagination();

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error fetching table data');
        } finally {
            stopLoading();
        }
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        data.forEach(item => {
            const row = document.createElement("tr");
            row.className = "data-room";
            row.id = item.id;

            row.innerHTML = `
                <td class="text-wrap" style="max-width: 200px;">${item.name}</td>
                <td class="text-wrap" style="max-width: 200px;">${item.quantity}</td>
            `;

            row.addEventListener('click', () => {
                openAssetsModal(item.id);
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
                fetchTableData(page, mainSortedPar, selectedBuilding);
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
            if (mainCurrentPage > 1) fetchTableData(mainCurrentPage - 1, mainSortedPar, selectedBuilding);
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
            if (mainCurrentPage < pageCount) fetchTableData(mainCurrentPage + 1, mainSortedPar, selectedBuilding);
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

            fetchTableData(1, mainSortedPar, selectedBuilding);
        }, 400));
    });

    // Function to sort data and update the table
    function sortTableData(column) {

        // Toggle sort order for the clicked column
        sortOrder[column] = !sortOrder[column];
        const direction = sortOrder[column] ? 'asc' : 'desc';

        mainSortedPar = { column, direction };

        // Update column headers with sort indicators
        updateSortIndicators(column);

        fetchTableData(1, mainSortedPar, selectedBuilding);
    }

    // Function to sort data and update the table
    function sortTableAssetsData(column) {

        // Toggle sort order for the clicked column
        sortOrderAsset[column] = !sortOrderAsset[column];
        const direction = sortOrderAsset[column] ? 'asc' : 'desc';

        sortedPar = { column, direction };

        // Update column headers with sort indicators
        updateSortIndicatorsAssets(column);

        currentPage = 1;
        fetchSortedAsset(globalRowId, 1, 10, [], sortedPar);
    }

    // Function to update sort indicators on column headers
    function updateSortIndicators(activeColumn) {
        // Get header elements
        const headers = {
            nameroom: document.getElementById('room-number-header'),
            count_assets: document.getElementById('room-number-assets'),
        };

        // Reset all headers by removing sort classes
        Object.keys(headers).forEach(column => {
            headers[column].classList.remove('ascending', 'descending');
        });

        // Apply the appropriate class to the active column
        if (sortOrder[activeColumn]) {
            headers[activeColumn].classList.add('ascending');
        } else {
            headers[activeColumn].classList.add('descending');
        }
    }

    // Function to update sort indicators on column headers
    function updateSortIndicatorsAssets(activeColumn) {
        // Get header elements
        const headers = {
            code: document.getElementById('asset-code-header'),
            name_assets: document.getElementById('asset-name-header'),
            type_name: document.getElementById('asset-type-header'),
            nameroom: document.getElementById('asset-location-header'),
            description: document.getElementById('asset-description-header')
        };

        // Reset all headers by removing sort classes
        Object.keys(headers).forEach(column => {
            headers[column].classList.remove('ascending', 'descending');
        });

        // Apply the appropriate class to the active column
        if (sortOrderAsset[activeColumn]) {
            headers[activeColumn].classList.add('ascending');
        } else {
            headers[activeColumn].classList.add('descending');
        }
    }

    // Show filtered soldiers in the dropdown
    function filterAsset(query) {
        assetSearchDropdown.innerHTML = '';
        const filteredAsset = nameAssetSetCount.filter(asset => asset.code.toLowerCase().includes(query.toLowerCase()));

        if (filteredAsset.length > 0) {
            assetSearchDropdown.style.display = 'block';
            filteredAsset.forEach(asset => {
                const li = document.createElement('li');
                li.textContent = asset.code;
                li.setAttribute('data-id', asset.id);
                assetSearchDropdown.appendChild(li);
            });
        } else {
            assetSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    assetSearchInput.addEventListener('input', function () {
        const query = assetSearchInput.value;
        if (query.length > 0) {
            filterAsset(query);
        } else {
            assetSearchDropdown.style.display = 'none';
            selectedAssetId.value = '';

            toggleInputValidity(assetSearchInput, false);
        }
    });

    // Handle bike selection
    assetSearchDropdown.addEventListener('click', function (event) {
        const selectedAsset = event.target;
        if (selectedAsset && selectedAsset.dataset.id) {

            const formatDate = (date) => {
                const dateObj = new Date(date);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
                const day = String(dateObj.getDate()).padStart(2, '0');

                return `${year}-${month}-${day}`;
            }

            assetSearchInput.value = selectedAsset.textContent;
            selectedAssetId.value = selectedAsset.getAttribute('data-id');
            assetSearchDropdown.style.display = 'none';

            assetName.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).name_assets;

            typeSearchInput.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).type_name;
            selectedTypeId.value = assetType.find(type => type.name === typeSearchInput.value).id;

            locationSearchInput.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).nameroom;
            selectedLocationId.value = assetLocation.find(item => item.nameroom === locationSearchInput.value) ? assetLocation.find(item => item.nameroom === locationSearchInput.value).roomid : '';

            subLocationSearchInput.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).namekey !== 'There is no associated key' ? nameAssetSetCount.find(item => item.id === selectedAssetId.value).namekey : '';
            selectedSubLocationId.value = nameAssetSetCount.find(item => item.namekey === subLocationSearchInput.value) ? nameAssetSetCount.find(item => item.namekey === subLocationSearchInput.value).keyid : '';

            assetCategory.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).categorie;
            assetEditQuantity.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).quantity;
            assetMrah.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).mrah;
            assetOwner.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).owner;
            assetM2Inside.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).m2_inside;
            assetComments.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).comments;
            assetRestValue.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).rest_value;
            assetReplacedOff.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).replaced_off;
            assetReplacedBy.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).replaced_by;
            assetYearOfLifeCycle.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).year_of_life_cycle;
            assetRestOfLifeCycle.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).rest_of_life_cycle;
            assetPurchasePrice.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).purchase_price;
            assetDatePurchase.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).date_purchase ?
                formatDate(nameAssetSetCount.find(item => item.id === selectedAssetId.value).date_purchase) : '';
            assetDateWrittenOff.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).date_written_off ?
                formatDate(nameAssetSetCount.find(item => item.id === selectedAssetId.value).date_written_off) : '';
            assetIsFixed.checked = !!nameAssetSetCount.find(item => item.id === selectedAssetId.value).is_fixed;
            assetService.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).service;
            assetEditStatus.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).status;
            assetExpandable.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).expandable;
            assetDescription.value = nameAssetSetCount.find(item => item.id === selectedAssetId.value).description;

            toggleInputValidity(assetSearchInput, true);
        }
    });

    function filterCleanItems(query) {
        removeCleanItemSearchDropdown.innerHTML = '';
        const filteredRemoveItem = cleanItems.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredRemoveItem.length > 0) {
            removeCleanItemSearchDropdown.style.display = 'block';
            filteredRemoveItem.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item.name;
                li.setAttribute('data-id', item.id);
                removeCleanItemSearchDropdown.appendChild(li);
            });
        } else {
            removeCleanItemSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    removeCleanItemSearchInput.addEventListener('input', function () {
        const query = removeCleanItemSearchInput.value;
        if (query.length > 0) {
            filterCleanItems(query);
        } else {
            removeCleanItemSearchDropdown.style.display = 'none';
            selectedRemoveCleanItemId.value = '';
            toggleInputValidity(removeCleanItemSearchInput, false);
        }
    });

    // Handle bike selection
    removeCleanItemSearchDropdown.addEventListener('click', function (event) {
        const selectedCleanItem = event.target;
        if (selectedCleanItem && selectedCleanItem.dataset.id) {
            removeCleanItemSearchInput.value = selectedCleanItem.textContent;
            selectedRemoveCleanItemId.value = selectedCleanItem.getAttribute('data-id');
            removeCleanItemSearchDropdown.style.display = 'none';

            toggleInputValidity(removeCleanItemSearchInput, true);
        }
    });

    function filterEditCleanItems(query) {
        editCleanItemSearchDropdown.innerHTML = '';
        const filterEdeditItem = cleanItems.filter(item => ((isTotalAmound && item.total_amount > 0) || (!isTotalAmound && item.count_get_item > 0)) && item.name.toLowerCase().includes(query.toLowerCase()));

        if (filterEdeditItem.length > 0) {
            editCleanItemSearchDropdown.style.display = 'block';
            filterEdeditItem.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item.name;
                li.setAttribute('data-id', item.id);
                editCleanItemSearchDropdown.appendChild(li);
            });
        } else {
            editCleanItemSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    editCleanItemSearchInput.addEventListener('input', function () {
        const query = editCleanItemSearchInput.value;
        if (query.length > 0) {
            filterEditCleanItems(query);
        } else {
            editCleanItemSearchDropdown.style.display = 'none';
            selectedEditCleanItemId.value = '';
            toggleInputValidity(editCleanItemSearchInput, false);
        }
    });

    // Handle bike selection
    editCleanItemSearchDropdown.addEventListener('click', function (event) {
        const selectedCleanItem = event.target;
        if (selectedCleanItem && selectedCleanItem.dataset.id) {
            editCleanItemSearchInput.value = selectedCleanItem.textContent;
            selectedEditCleanItemId.value = selectedCleanItem.getAttribute('data-id');
            editCleanItemSearchDropdown.style.display = 'none';

            toggleInputValidity(editCleanItemSearchInput, true);

            const countGetItem = cleanItems.find(item => item.name === selectedCleanItem.textContent).count_get_item;

            if (isTotalAmound) {
                editAmount.removeAttribute('max');
                editAmount.min = 1;
            } else {
                editAmount.value = countGetItem;
                editAmount.max = countGetItem;
                editAmount.min = 1;
            }
        }
    });

    fetchAllAsset(); // Fetch all assets when the page loads

    async function fetchAllAsset() {

        startLoading();

        try {
            const responseAsset = await fetch(`/getAllAssets`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            });

            if (!responseAsset.ok) {
                const error = await responseAsset.json();
                checkForGlobalError(responseAsset, error);
                showMess('Error', error.message);
                return;
            }

            allAsset = await responseAsset.json();

        } catch (error) {
            showMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    // Show filtered key in the dropdown
    function filterAllAsset(query) {
        selectAllAssetDropdown.innerHTML = '';
        const filteredAllAsset = allAsset.filter(asset =>
            asset.code.toLowerCase().includes(query.toLowerCase())
        );

        if (filteredAllAsset.length > 0) {
            selectAllAssetDropdown.style.display = 'block';
            filteredAllAsset.forEach(asset => {
                const li = document.createElement('li');
                li.textContent = `${asset.code}`;
                li.setAttribute('data-id', asset.id);
                li.setAttribute('data-code', asset.code);
                li.setAttribute('data-name', asset.name_assets);
                li.setAttribute('data-type-id', asset.type_id);
                li.setAttribute('data-location-room', asset.location_room);
                li.setAttribute('data-location-key', asset.location_key);
                li.setAttribute('data-categorie', asset.categorie || '');
                li.setAttribute('data-quantity', asset.quantity || '');
                li.setAttribute('data-mrah', asset.mrah || '');
                li.setAttribute('data-asset-owner', asset.asset_owner || '');
                li.setAttribute('data-status', asset.status || '');
                li.setAttribute('data-expandable', asset.expandable || '');
                li.setAttribute('data-description', asset.description || '');
                li.setAttribute('data-service', asset.service || '');
                li.setAttribute('data-asset-m2-inside', asset.m2_inside || '');
                li.setAttribute('data-asset-comments', asset.comments || '');
                li.setAttribute('data-asset-rest-value', asset.rest_value || '');
                li.setAttribute('data-asset-year-of-life-cycle', asset.year_of_life_cycle || '');
                li.setAttribute('data-asset-rest-of-life-cycle', asset.rest_of_life_cycle || '');
                li.setAttribute('data-asset-replaced-off', asset.replaced_off || '');
                li.setAttribute('data-asset-replaced-by', asset.replaced_by || '');
                li.setAttribute('data-asset-purchase-price', asset.purchase_price || '');
                li.setAttribute('data-asset-date-purchase', asset.date_purchase || '');
                li.setAttribute('data-asset-date-written-off', asset.date_written_off || '');
                li.setAttribute('data-asset-is-fixed', asset.is_fixed);
                selectAllAssetDropdown.appendChild(li);
            });
        } else {
            selectAllAssetDropdown.style.display = 'none';
        }
    }

    // Handle input change
    selectAllAssetInput.addEventListener('input', function () {
        const query = selectAllAssetInput.value;
        if (query.length > 0) {
            filterAllAsset(query);
        } else {
            selectAllAssetDropdown.style.display = 'none';
        }
    });

    // Handle bike selection
    selectAllAssetDropdown.addEventListener('click', function (event) {

        const selectedAllAsset = event.target;

        if (selectedAllAsset && selectedAllAsset.dataset.id) {

            const assetCode = selectedAllAsset.getAttribute('data-code');
            const name = selectedAllAsset.getAttribute('data-name');
            const typeId = selectedAllAsset.getAttribute('data-type-id');
            const location = selectedAllAsset.getAttribute('data-location-room');
            const assetNameKey = selectedAllAsset.getAttribute('data-location-key');
            const categorie = selectedAllAsset.getAttribute('data-categorie');
            const quantity = selectedAllAsset.getAttribute('data-quantity');
            const mrah = selectedAllAsset.getAttribute('data-mrah');
            const owner = selectedAllAsset.getAttribute('data-asset-owner');
            const m2_inside = selectedAllAsset.getAttribute('data-asset-m2-inside');
            const comments = selectedAllAsset.getAttribute('data-asset-comments');
            const rest_value = selectedAllAsset.getAttribute('data-asset-rest-value');
            const replaced_off = selectedAllAsset.getAttribute('data-asset-replaced-off');
            const replaced_by = selectedAllAsset.getAttribute('data-asset-replaced-by');
            const year_of_life_cycle = selectedAllAsset.getAttribute('data-asset-year-of-life-cycle');
            const rest_of_life_cycle = selectedAllAsset.getAttribute('data-asset-rest-of-life-cycle');
            const purchase_price = selectedAllAsset.getAttribute('data-asset-purchase-price');
            const date_purchase = selectedAllAsset.getAttribute('data-asset-date-purchase');
            const date_written_off = selectedAllAsset.getAttribute('data-asset-date-written-off');
            const is_fixed = selectedAllAsset.getAttribute('data-asset-is-fixed');
            const service = selectedAllAsset.getAttribute('data-service');
            const status = selectedAllAsset.getAttribute('data-status');
            const expandable = selectedAllAsset.getAttribute('data-expandable');
            const description = selectedAllAsset.getAttribute('data-description');

            startLoading();

            fetch(`/assets/getSortedAssets`, {
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

                    nameAssetSetCount = data;

                    openEditAssetsModal(
                        assetCode, name, assetType.find(item => item.id === Number(typeId)).name, assetLocation.find(item => item.roomid === location) ? assetLocation.find(item => item.roomid === location).nameroom : '',
                        assetLocation.find(item => item.id === assetNameKey) ? assetLocation.find(item => item.id === assetNameKey).name : '', categorie, quantity, mrah,
                        owner, status, expandable, description,
                        service, m2_inside, is_fixed, date_purchase,
                        date_written_off, purchase_price, comments, replaced_off,
                        year_of_life_cycle, rest_of_life_cycle, replaced_by, rest_value
                    );
                })
                .catch(error => showMess('Error', error.message))
                .finally(() => {
                    stopLoading();
                });

            selectAllAssetInput.value = '';
            selectAllAssetDropdown.style.display = 'none';
        }
    });

    function filterLostAsset(query) {
        lostAssetSearchDropdown.innerHTML = '';
        const filteredAsset = lostAssetsCode.filter(asset => asset.code.toLowerCase().includes(query.toLowerCase()));

        if (filteredAsset.length > 0) {
            lostAssetSearchDropdown.style.display = 'block';
            filteredAsset.forEach(asset => {
                const li = document.createElement('li');
                li.textContent = asset.code;
                li.setAttribute('data-id', asset.id);
                li.setAttribute('data-quantity', asset.quantity);
                lostAssetSearchDropdown.appendChild(li);
            });
        } else {
            lostAssetSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    lostAssetSearchInput.addEventListener('input', function () {
        const query = lostAssetSearchInput.value;
        if (query.length > 0) {
            filterLostAsset(query);
        } else {
            lostAssetSearchDropdown.style.display = 'none';
            selectedLostAssetId.value = '';
            lostAssetQuantity.value = '';
            lostAssetQuantity.removeAttribute('max');
            toggleInputValidity(lostAssetSearchInput, false);
            toggleInputValidity(lostAssetQuantity, false);
        }
    });

    // Handle bike selection
    lostAssetSearchDropdown.addEventListener('click', function (event) {
        const selectedAsset = event.target;
        if (selectedAsset && selectedAsset.dataset.id) {
            lostAssetSearchInput.value = selectedAsset.textContent;
            lostAssetQuantity.value = selectedAsset.getAttribute('data-quantity');
            lostAssetQuantity.max = selectedAsset.getAttribute('data-quantity');
            selectedLostAssetId.value = selectedAsset.getAttribute('data-id');
            lostAssetSearchDropdown.style.display = 'none';

            toggleInputValidity(lostAssetSearchInput, true);
            toggleInputValidity(lostAssetQuantity, true);
        }
    });

    // Show filtered soldiers in the dropdown
    function filterType(query) {
        typeSearchDropdown.innerHTML = '';
        const filteredType = assetType.filter(type => type.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredType.length > 0) {
            typeSearchDropdown.style.display = 'block';
            filteredType.forEach(type => {
                const li = document.createElement('li');
                li.textContent = type.name;
                li.setAttribute('data-id', type.id);
                typeSearchDropdown.appendChild(li);
            });
        } else {
            typeSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    typeSearchInput.addEventListener('input', function () {
        const query = typeSearchInput.value;
        if (query.length > 0) {
            filterType(query);
        } else {
            typeSearchDropdown.style.display = 'none';
            selectedTypeId.value = '';

            toggleInputValidity(typeSearchInput, false);
        }
    });

    // Handle bike selection
    typeSearchDropdown.addEventListener('click', function (event) {
        const selectedType = event.target;
        if (selectedType && selectedType.dataset.id) {
            typeSearchInput.value = selectedType.textContent;
            selectedTypeId.value = selectedType.getAttribute('data-id');
            typeSearchDropdown.style.display = 'none';

            toggleInputValidity(typeSearchInput, true);

            if (selectedTypeId.value !== '1') {
                subLocationSearchInput.disabled = true;
                oldAssetNameKey = subLocationSearchInput.value;
                subLocationSearchInput.value = '';
                selectedSubLocationId.value = '';
            } else {
                subLocationSearchInput.disabled = false;
                subLocationSearchInput.value = oldAssetNameKey;
                selectedSubLocationId.value = assetLocation.find(item => item.name === oldAssetNameKey) ? assetLocation.find(item => item.name === oldAssetNameKey).id : '';
            }
        }
    });

    // Show filtered soldiers in the dropdown
    function filterAddType(query) {
        typeAddSearchDropdown.innerHTML = '';
        const filteredType = assetType.filter(type => type.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredType.length > 0) {
            typeAddSearchDropdown.style.display = 'block';
            filteredType.forEach(type => {
                const li = document.createElement('li');
                li.textContent = type.name;
                li.setAttribute('data-id', type.id);
                typeAddSearchDropdown.appendChild(li);
            });
        } else {
            typeAddSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    typeAddSearchInput.addEventListener('input', function () {
        const query = typeAddSearchInput.value;
        if (query.length > 0) {
            filterAddType(query);
        } else {
            typeAddSearchDropdown.style.display = 'none';
            selectedAddTypeId.value = '';

            toggleInputValidity(typeAddSearchInput, false);
        }
    });

    // Handle bike selection
    typeAddSearchDropdown.addEventListener('click', function (event) {
        const selectedType = event.target;
        if (selectedType && selectedType.dataset.id) {
            typeAddSearchInput.value = selectedType.textContent;
            selectedAddTypeId.value = selectedType.getAttribute('data-id');
            typeAddSearchDropdown.style.display = 'none';

            toggleInputValidity(typeAddSearchInput, true);

            if (selectedAddTypeId.value !== '1') {
                addSubLocationSearchInput.disabled = true;
                oldAssetNameKey = addSubLocationSearchInput.value;
                addSubLocationSearchInput.value = '';
                selectedAddSubLocationId.value = '';
            } else {
                addSubLocationSearchInput.disabled = false;
                addSubLocationSearchInput.value = oldAssetNameKey ? oldAssetNameKey : '';
                selectedAddSubLocationId.value = assetLocation.find(item => item.name === oldAssetNameKey) ? assetLocation.find(item => item.name === oldAssetNameKey).id : '';
            }
        }
    });

    // Show filtered soldiers in the dropdown
    function filterLocation(query) {
        locationSearchDropdown.innerHTML = '';
        const filteredLocation = uniqueRooms.filter(location => location.nameroom.toLowerCase().includes(query.toLowerCase()));

        if (filteredLocation.length > 0) {
            locationSearchDropdown.style.display = 'block';
            filteredLocation.forEach(location => {
                const li = document.createElement('li');
                li.textContent = location.nameroom;
                li.setAttribute('data-id', location.roomid);
                locationSearchDropdown.appendChild(li);
            });
        } else {
            locationSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    locationSearchInput.addEventListener('input', function () {
        const query = locationSearchInput.value;
        if (query.length > 0) {
            filterLocation(query);
        } else {
            locationSearchDropdown.style.display = 'none';
            selectedLocationId.value = '';

            toggleInputValidity(locationSearchInput, false);
        }
    });

    // Handle bike selection
    locationSearchDropdown.addEventListener('click', function (event) {
        const selectedlocation = event.target;
        if (selectedlocation && selectedlocation.dataset.id) {
            locationSearchInput.value = selectedlocation.textContent;
            selectedLocationId.value = selectedlocation.getAttribute('data-id');
            locationSearchDropdown.style.display = 'none';

            toggleInputValidity(locationSearchInput, true);
            selectedSubLocationId.value = '';
            subLocationSearchInput.value = '';
        }
    });

    function filterAddLocation(query) {
        addLocationSearchDropdown.innerHTML = '';
        const filteredLocation = uniqueRooms.filter(location => location.nameroom.toLowerCase().includes(query.toLowerCase()));

        if (filteredLocation.length > 0) {
            addLocationSearchDropdown.style.display = 'block';
            filteredLocation.forEach(location => {
                const li = document.createElement('li');
                li.textContent = location.nameroom;
                li.setAttribute('data-id', location.roomid);
                addLocationSearchDropdown.appendChild(li);
            });
        } else {
            addLocationSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    addLocationSearchInput.addEventListener('input', function () {
        const query = addLocationSearchInput.value;
        if (query.length > 0) {
            filterAddLocation(query);
        } else {
            addLocationSearchDropdown.style.display = 'none';
            selectedAddLocationId.value = '';

            toggleInputValidity(addLocationSearchInput, false);
        }
    });

    // Handle bike selection
    addLocationSearchDropdown.addEventListener('click', function (event) {
        const selectedlocation = event.target;
        if (selectedlocation && selectedlocation.dataset.id) {
            addLocationSearchInput.value = selectedlocation.textContent;
            selectedAddLocationId.value = selectedlocation.getAttribute('data-id');
            addLocationSearchDropdown.style.display = 'none';

            toggleInputValidity(addLocationSearchInput, true);
            selectedAddSubLocationId.value = '';
            addSubLocationSearchInput.value = '';
        }
    });

    // Show filtered soldiers in the dropdown
    function filterSubLocation(query) {
        subLocationSearchDropdown.innerHTML = '';
        const filteredSubLocation = assetLocation.filter(location => selectedLocationId.value === location.roomid && location.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredSubLocation.length > 0) {
            subLocationSearchDropdown.style.display = 'block';
            filteredSubLocation.forEach(location => {
                const li = document.createElement('li');
                li.textContent = location.name;
                li.setAttribute('data-id', location.id);
                subLocationSearchDropdown.appendChild(li);
            });
        } else {
            subLocationSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    subLocationSearchInput.addEventListener('input', function () {
        const query = subLocationSearchInput.value;
        if (query.length > 0) {
            filterSubLocation(query);
        } else {
            subLocationSearchDropdown.style.display = 'none';
            selectedSubLocationId.value = '';

            toggleInputValidity(subLocationSearchInput, false);
        }
    });

    // Handle bike selection
    subLocationSearchDropdown.addEventListener('click', function (event) {
        const selectedSubLocation = event.target;
        if (selectedSubLocation && selectedSubLocation.dataset.id) {
            subLocationSearchInput.value = selectedSubLocation.textContent;
            selectedSubLocationId.value = selectedSubLocation.getAttribute('data-id');
            subLocationSearchDropdown.style.display = 'none';

            toggleInputValidity(subLocationSearchInput, true);
        }
    });

    // Show filtered soldiers in the dropdown
    function filterAddSubLocation(query) {
        addSubLocationSearchDropdown.innerHTML = '';
        const filteredSubLocation = assetSubLocation.filter(location => selectedAddLocationId.value === location.roomid && location.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredSubLocation.length > 0) {
            addSubLocationSearchDropdown.style.display = 'block';
            filteredSubLocation.forEach(location => {
                const li = document.createElement('li');
                li.textContent = location.name;
                li.setAttribute('data-id', location.id);
                addSubLocationSearchDropdown.appendChild(li);
            });
        } else {
            addSubLocationSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    addSubLocationSearchInput.addEventListener('input', function () {
        const query = addSubLocationSearchInput.value;
        if (query.length > 0) {
            filterAddSubLocation(query);
        } else {
            addSubLocationSearchDropdown.style.display = 'none';
            selectedAddSubLocationId.value = '';

            toggleInputValidity(addSubLocationSearchInput, false);
        }
    });

    // Handle bike selection
    addSubLocationSearchDropdown.addEventListener('click', function (event) {
        const selectedSubLocation = event.target;
        if (selectedSubLocation && selectedSubLocation.dataset.id) {
            addSubLocationSearchInput.value = selectedSubLocation.textContent;
            selectedAddSubLocationId.value = selectedSubLocation.getAttribute('data-id');
            addSubLocationSearchDropdown.style.display = 'none';

            toggleInputValidity(addSubLocationSearchInput, true);
        }
    });

    // Show filtered soldiers in the dropdown
    function filterRemoveType(query) {
        removeAssetTypeDropdown.innerHTML = '';
        const filteredType = assetType.filter(type => type.id !== 1 && type.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredType.length > 0) {
            removeAssetTypeDropdown.style.display = 'block';
            filteredType.forEach(type => {
                const li = document.createElement('li');
                li.textContent = type.name;
                li.setAttribute('data-id', type.id);
                removeAssetTypeDropdown.appendChild(li);
            });
        } else {
            removeAssetTypeDropdown.style.display = 'none';
        }
    }

    // Handle input change
    removeAssetTypeSearchInput.addEventListener('input', function () {
        const query = removeAssetTypeSearchInput.value;
        if (query.length > 0) {
            filterRemoveType(query);
        } else {
            removeAssetTypeDropdown.style.display = 'none';
            selectedRemoveAssetId.value = '';

            toggleInputValidity(removeAssetTypeSearchInput, false);
        }
    });

    // Handle bike selection
    removeAssetTypeDropdown.addEventListener('click', function (event) {
        const selectedType = event.target;
        if (selectedType && selectedType.dataset.id) {
            removeAssetTypeSearchInput.value = selectedType.textContent;
            selectedRemoveAssetId.value = selectedType.getAttribute('data-id');
            removeAssetTypeDropdown.style.display = 'none';

            toggleInputValidity(removeAssetTypeSearchInput, true);
        }
    });

    assetName.addEventListener('input', () => {
        toggleInputValidity(assetName, assetName.value !== '' && assetName.checkValidity());
    });

    assetCategory.addEventListener('input', () => {
        toggleInputValidity(assetCategory, assetCategory.checkValidity());
    });

    assetEditQuantity.addEventListener('input', () => {
        toggleInputValidity(assetEditQuantity, assetEditQuantity.checkValidity());
    });

    lostAssetQuantity.addEventListener('input', () => {
        toggleInputValidity(lostAssetQuantity, lostAssetQuantity.value !== '' && lostAssetQuantity.checkValidity());
    });

    editAmount.addEventListener('input', () => {
        if (!isTotalAmound)
            toggleInputValidity(editAmount, editAmount.value !== '' && parseInt(editAmount.value) <= parseInt(cleanItems.find(item => item.id === selectedEditCleanItemId.value).count_get_item) && editAmount.checkValidity());
        else
            toggleInputValidity(editAmount, editAmount.value !== '' && editAmount.checkValidity());
    });

    assetMrah.addEventListener('input', () => {
        toggleInputValidity(assetMrah, assetMrah.checkValidity());
    });

    assetOwner.addEventListener('input', () => {
        toggleInputValidity(assetOwner, assetOwner.checkValidity());
    });

    assetM2Inside.addEventListener('input', () => {
        toggleInputValidity(assetM2Inside, assetM2Inside.checkValidity());
    });

    assetComments.addEventListener('input', () => {
        toggleInputValidity(assetComments, assetComments.checkValidity());
    });

    assetRestValue.addEventListener('input', () => {
        toggleInputValidity(assetRestValue, assetRestValue.checkValidity());
    });

    assetReplacedOff.addEventListener('input', () => {
        toggleInputValidity(assetReplacedOff, assetReplacedOff.checkValidity());
    });

    assetReplacedBy.addEventListener('input', () => {
        toggleInputValidity(assetReplacedBy, assetReplacedBy.checkValidity());
    });

    assetYearOfLifeCycle.addEventListener('input', () => {
        toggleInputValidity(assetYearOfLifeCycle, assetYearOfLifeCycle.checkValidity());
    });

    assetRestOfLifeCycle.addEventListener('input', () => {
        toggleInputValidity(assetRestOfLifeCycle, assetRestOfLifeCycle.checkValidity());
    });

    assetPurchasePrice.addEventListener('input', () => {
        toggleInputValidity(assetPurchasePrice, assetPurchasePrice.checkValidity());
    });

    assetDatePurchase.addEventListener('input', () => {
        toggleInputValidity(assetDatePurchase, !assetDatePurchase.value.trim() || !isNaN(Date.parse(assetDatePurchase.value.trim())));
    });

    assetDateWrittenOff.addEventListener('input', () => {
        toggleInputValidity(assetDateWrittenOff, !assetDateWrittenOff.value.trim() || !isNaN(Date.parse(assetDateWrittenOff.value.trim())));
    });

    assetService.addEventListener('input', () => {
        toggleInputValidity(assetService, assetService.checkValidity());
    });

    assetEditStatus.addEventListener('input', () => {
        toggleInputValidity(assetEditStatus, /^[A-Za-z0-9]+$/.test(assetEditStatus.value));
    });

    assetExpandable.addEventListener('input', () => {
        toggleInputValidity(assetExpandable, assetExpandable.checkValidity());
    });

    assetDescription.addEventListener('input', () => {
        const regex = /^[a-zA-Z0-9\s]*$/;
        const isValid = regex.test(assetDescription.value);
        toggleInputValidity(assetDescription, isValid);
    });

    assetAddType.addEventListener('input', () => {
        toggleInputValidity(assetAddType, assetAddType.value !== '' && assetAddType.checkValidity());
    });

    assetEps.addEventListener('input', () => {
        toggleInputValidity(assetEps, assetEps.value !== '' && assetEps.checkValidity());
    });

    assetCodeSearch.addEventListener('input', () => {
        toggleInputValidity(assetCodeSearch, assetCodeSearch.value !== '' && assetCodeSearch.checkValidity());
    });

    assetAddName.addEventListener('input', () => {
        toggleInputValidity(assetAddName, assetAddName.value !== '' && assetAddName.checkValidity());
    });

    assetAddCategorie.addEventListener('input', () => {
        toggleInputValidity(assetAddCategorie, assetAddCategorie.checkValidity());
    });

    assetQuantity.addEventListener('input', () => {
        toggleInputValidity(assetQuantity, assetQuantity.checkValidity());

        if (assetEps.value && !assetEps.classList.contains('disabled-select')) {
            oldEditAssetId = assetEps.value;
            assetEps.value = "";
        }

        if (!assetEps.value && assetQuantity.value > 1) {
            assetEps.value = generateUUID();
            assetEps.classList.add('disabled-select');
            toggleInputValidity(assetEps, true);

        } else if (assetQuantity.value <= 1) {
            assetEps.value = oldEditAssetId;
            assetEps.classList.remove('disabled-select');
            toggleInputValidity(assetEps, assetEps.value !== '' && assetEps.checkValidity());
        }

        function generateUUID() {
            return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    });

    assetAddMrah.addEventListener('input', () => {
        toggleInputValidity(assetAddMrah, assetAddMrah.checkValidity());
    });

    assetAddOwner.addEventListener('input', () => {
        toggleInputValidity(assetAddOwner, assetAddOwner.checkValidity());
    });

    assetAddM2Inside.addEventListener('input', () => {
        toggleInputValidity(assetAddM2Inside, assetAddM2Inside.checkValidity());
    });

    assetAddComments.addEventListener('input', () => {
        toggleInputValidity(assetAddComments, assetAddComments.checkValidity());
    });

    assetAddRestValue.addEventListener('input', () => {
        toggleInputValidity(assetAddRestValue, assetAddRestValue.checkValidity());
    });

    assetAddReplacedOff.addEventListener('input', () => {
        toggleInputValidity(assetAddReplacedOff, assetAddReplacedOff.checkValidity());
    });

    assetAddReplacedBy.addEventListener('input', () => {
        toggleInputValidity(assetAddReplacedBy, assetAddReplacedBy.checkValidity());
    });

    assetAddYearOfLifeCycle.addEventListener('input', () => {
        toggleInputValidity(assetAddYearOfLifeCycle, assetAddYearOfLifeCycle.checkValidity());
    });

    assetAddRestOfLifeCycle.addEventListener('input', () => {
        toggleInputValidity(assetAddRestOfLifeCycle, assetAddRestOfLifeCycle.checkValidity());
    });

    assetAddPurchasePrice.addEventListener('input', () => {
        toggleInputValidity(assetAddPurchasePrice, assetAddPurchasePrice.checkValidity());
    });

    assetAddDatePurchase.addEventListener('input', () => {
        toggleInputValidity(assetAddDatePurchase, !assetAddDatePurchase.value.trim() || !isNaN(Date.parse(assetAddDatePurchase.value.trim())));
    });

    assetAddDateWrittenOff.addEventListener('input', () => {
        toggleInputValidity(assetAddDateWrittenOff, !assetAddDateWrittenOff.value.trim() || !isNaN(Date.parse(assetAddDateWrittenOff.value.trim())));
    });

    assetAddService.addEventListener('input', () => {
        toggleInputValidity(assetAddService, assetAddService.checkValidity());
    });

    assetStatus.addEventListener('input', () => {
        toggleInputValidity(assetStatus, /^[A-Za-z0-9]+$/.test(assetStatus.value));
    });

    assetAddExpandable.addEventListener('input', () => {
        toggleInputValidity(assetAddExpandable, assetAddExpandable.checkValidity());
    });

    assetAddDescription.addEventListener('input', () => {
        const regex = /^[a-zA-Z0-9\s]*$/;
        const isValid = regex.test(assetAddDescription.value);
        toggleInputValidity(assetAddDescription, isValid);
    });

    cleanItemName.addEventListener('input', () => {
        const regex = /^[a-zA-Z0-9\s.,\/\-:;]+$/;
        const isValid = regex.test(cleanItemName.value);
        toggleInputValidity(cleanItemName, isValid);
    });

    cleanItemTotalAmount.addEventListener('input', () => {
        toggleInputValidity(cleanItemTotalAmount, cleanItemTotalAmount.value !== '' && cleanItemTotalAmount.checkValidity());
    });

    function showMess(type, message) {

        const icon = document.getElementById('mess-icon');

        switch (type) {
            case 'Error':
                icon.src = "/icon/error.png";
                document.getElementById('mess-text').textContent = message;
                isInfo = false;
                break;

            case 'Warnning':
                icon.src = "/icon/timeout.png";
                document.getElementById('mess-text').textContent = message;
                isInfo = false;
                break;

            default:
                icon.src = "/icon/information.png";
                document.getElementById('mess-text').textContent = message;
                isInfo = true;
                break;
        }

        // Add the slide-in effect by adding the necessary classes
        modalMess.classList.add('show');
        modalMessContent.classList.add('show');
        modalMessContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalMessContent.classList.remove('slide-out');
    }

    function closeMessModal(action = '') {

        function clearInput(clearModalInput) {
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

        // Add the slide-out effect
        modalMessContent.classList.add('slide-out');
        modalMessContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalMess.classList.remove('show');
            modalMessContent.classList.remove('show');

            const button = modalMessContent.getElementsByTagName('button')
            if (button.length > 0)
                modalMessContent.removeChild(button[0]);

            if (isInfo) {

                const fullContent = document.getElementsByClassName('content')[0];

                switch (action) {

                    case 'addAssetType':
                        clearInput(addAssetsTypeModalContent);
                        break;

                    case 'removeAssetType':
                        clearInput(removeAssetsTypeModalContent);
                        break;

                    case 'addLostItem':
                    case 'restoreLostAsset':
                        clearInput(lostAssetsModalContent);
                        fetchLostAssets();
                        break;

                    case 'changeAmountLargeToSmall':
                    case 'changeAmountSmallToLarge':
                        allCheckedLargeRow = [];
                        allCheckedSmallRow = [];
                        clearInput(cleanItemModalContent);
                        fetchCleanItems();
                        break;

                    case 'removeCleanItem':
                        allCheckedLargeRow = [];
                        allCheckedSmallRow = [];
                        clearInput(removeCleanItemModalContent);
                        clearInput(cleanItemModalContent);
                        fetchCleanItems();
                        break;

                    case 'addCleanItem':
                        clearInput(addCleanItemModalContent);
                        clearInput(cleanItemModalContent);
                        fetchCleanItems();
                        break;

                    case 'editCleanItem':
                        allCheckedLargeRow = [];
                        allCheckedSmallRow = [];
                        clearInput(editCleanItemModalContent);
                        clearInput(cleanItemModalContent);
                        fetchCleanItems();
                        break;

                    case 'addMultiCleanItem':
                        clearMultiInput('progress', 'fileInput');
                        clearInput(cleanItemModalContent);
                        fetchCleanItems();
                        break;

                    case 'restorInventory':
                        fetchInventory();
                        break;

                    case 'deleteAsset':
                        allCheckedRow = [];
                        clearInput(fullContent);
                        clearInput(assetsModalContent);
                        fetchSortedAsset(globalRowId);
                        fetchTableData(1, mainSortedPar, selectedBuilding);
                        break;

                    case 'editAsset':
                        clearInput(fullContent);
                        clearInput(assetsModalContent);
                        clearInput(assetsEditModalContent);
                        fetchSortedAsset(globalRowId);
                        fetchTableData(1, mainSortedPar, selectedBuilding);
                        break;

                    case 'editMultiAssets':
                        clearInput(fullContent);
                        clearInput(assetsModalContent);
                        clearMultiInput('editMultiAssetsProgress', 'fileEditMultiAssetsInput');
                        fetchSortedAsset(globalRowId);
                        fetchTableData(1, mainSortedPar, selectedBuilding);
                        break;

                    case 'addAsset':
                        clearInput(fullContent);
                        clearInput(assetsModalContent);
                        clearInput(assetsAddModalContent);
                        fetchSortedAsset(globalRowId);
                        fetchTableData(1, mainSortedPar, selectedBuilding);
                        break;

                    case 'addMultiAssets':
                        clearInput(fullContent);
                        clearInput(assetsModalContent);
                        clearMultiInput('addMultiAssetsProgress', 'fileAddMultiAssetsInput');
                        fetchSortedAsset(globalRowId);
                        fetchTableData(1, mainSortedPar, selectedBuilding);
                        break;
                }

                fetchTypeData();
                fetchAllAsset();
            }

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAddAssetsModal() {
        // Add the slide-in effect by adding the necessary classes
        assetsAddModal.classList.add('show');
        assetsAddModalContent.classList.add('show');
        assetsAddModalContent.classList.add('slide-in');

        addSubLocationSearchInput.disabled = true;

        // Ensure that any 'slide-out' class is removed if it was previously added
        assetsAddModalContent.classList.remove('slide-out');
    }

    function closeAddAssetsModal() {

        // Add the slide-out effect
        assetsAddModalContent.classList.add('slide-out');
        assetsAddModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll(`
                #assetEpc, #assetCodeSearch, #assetAddName, #addTypeSearch, 
                #selectedAddTypeId, #addLocationSearch, #selectedAddLocationId, #addSubLocationSearch, 
                #selectedAddSubLocationId, #addCategorie, #assetAddDescription, #assetAddDatePurchase,
                #assetAddDateWrittenOff, #assetAddM2Inside, #assetAddPurchasePrice, #assetAddComments,
                #assetAddReplacedOff, #assetAddYearOfLifeCycle, #assetAddRestOfLifeCycle, #assetAddReplacedBy,
                #assetAddRestValue`).forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';

            });

            document.querySelectorAll(`
                #assetQuantity,
                #assetAddMrah,
                #assetAddOwner,
                #assetAddService,
                #assetStatus,
                #assetAddExpandable`).forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');
            });

            assetAddIsFixed.checked = false;
            assetQuantity.value = '1';
            assetAddMrah.value = 'Global RTS';
            assetAddOwner.value = 'Global RTS';
            assetAddService.value = 'Billeting';
            assetStatus.value = 'New';
            assetAddExpandable.value = 'Non Expandable';

            assetEps.classList.remove('disabled-select');

            assetsAddModal.classList.remove('show');
            assetsAddModalContent.classList.remove('show');

            typeAddSearchDropdown.style.display = 'none';
            addLocationSearchDropdown.style.display = 'none';
            addSubLocationSearchDropdown.style.display = 'none';

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAddAssetsTypeModal() {
        // Add the slide-in effect by adding the necessary classes
        addAssetsTypeModal.classList.add('show');
        addAssetsTypeModalContent.classList.add('show');
        addAssetsTypeModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        addAssetsTypeModalContent.classList.remove('slide-out');
    }

    function closeAddAssetsTypeModal() {

        // Add the slide-out effect
        addAssetsTypeModalContent.classList.add('slide-out');
        addAssetsTypeModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#assetType').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';

            });

            addAssetsTypeModal.classList.remove('show');
            addAssetsTypeModalContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    async function fetchLostAssets(page = 1, limit = 10, searchFilters = []) {

        const lostItemsTable = document.getElementById('lostItemsTableBody');
        lostItemsTable.innerHTML = '';

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

            const response = await fetch(`/allAssets?${searchParams.toString()}`, {
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

            const { assets, allLostItems, totalLostItems } = await response.json();

            lostAssetsCode = assets;

            allLostItems.forEach(item => {
                const row = document.createElement('tr');

                const nameCell = document.createElement('td');
                nameCell.textContent = item.nameItem;
                nameCell.classList.add("text-wrap");
                nameCell.style = "max-width: 200px;";
                row.appendChild(nameCell);

                const descriptionCell = document.createElement('td');
                descriptionCell.textContent = item.description ? item.description : 'No description';
                descriptionCell.classList.add("text-wrap");
                descriptionCell.style = "max-width: 200px;";
                row.appendChild(descriptionCell);

                const lostQuantityCell = document.createElement('td');
                lostQuantityCell.textContent = item.lostQuantity;
                lostQuantityCell.classList.add("text-wrap");
                lostQuantityCell.style = "max-width: 200px;";
                row.appendChild(lostQuantityCell);

                row.addEventListener('click', function () {
                    const submitButton = document.createElement('button');
                    var isSubmit = false;
                    let hasError = false;
                    var responseData = {};

                    submitButton.textContent = 'Yes';
                    submitButton.classList.add('btn', 'btn-success');

                    const quantityInput = document.createElement('input');
                    quantityInput.type = 'number';
                    quantityInput.classList.add('form-control');
                    quantityInput.value = item.lostQuantity;
                    quantityInput.min = 1;
                    quantityInput.max = item.lostQuantity;
                    quantityInput.style.marginBottom = '10px';

                    quantityInput.addEventListener('input', function () {
                        const isValid = quantityInput.value > 0 && quantityInput.value <= item.lostQuantity;
                        toggleInputValidity(quantityInput, isValid);
                    });

                    submitButton.addEventListener('click', async () => {

                        if (!quantityInput.value) {
                            return;
                        }

                        hasError = false;
                        isSubmit = true;

                        startLoading();

                        try {
                            const data = {
                                code: item.nameItem,
                                lost_quantity: quantityInput.value
                            };

                            const response = await fetch('/assets/restorLostAsset', {
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

                        } catch (error) {
                            hasError = true;
                        } finally {
                            stopLoading();
                        }
                    });

                    modalMessContent.appendChild(quantityInput);
                    modalMessContent.appendChild(submitButton);

                    // Wait for the modal to close, then check if the submit button was clicked
                    const observer = new MutationObserver(() => {
                        if (!modalMess.classList.contains('show') && isSubmit) {
                            observer.disconnect();

                            if (modalMessContent.contains(submitButton)) {
                                // Check if the button is still a child before removing
                                modalMessContent.removeChild(submitButton);
                            }

                            if (modalMessContent.contains(quantityInput)) {
                                // Check if the input is still a child before removing
                                modalMessContent.removeChild(quantityInput);
                            }
                        }
                    });

                    observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

                    // Close the warning modal and show appropriate messages based on the result
                    const closeWarningObserver = new MutationObserver(() => {
                        if (!modalMess.classList.contains('show')) {
                            closeWarningObserver.disconnect();

                            if (isSubmit && !hasError) {
                                globalAction = 'restoreLostAsset';
                                showMess('Info', 'The asset has been restored');
                            } else if (isSubmit) {
                                showMess('Error', responseData.message || 'An error occurred while restoring the asset');
                            }

                            if (modalMessContent.contains(quantityInput)) {
                                // Check if the input is still a child before removing
                                modalMessContent.removeChild(quantityInput);
                            }
                        }
                    });

                    closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

                    // Show the warning modal
                    showMess('Warnning', 'Are you sure you want to restore this lost item?\nPlease enter the quantity of assets you want to restore.');
                });

                lostItemsTable.appendChild(row);
            });

            const rowsTable = lostItemsTable.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumberTherd');

            setupTableNavigation("lostItemsTable", "prevBtnTherd", "nextBtnTherd", "pageNumberTherd", limit, totalLostItems, page, "", "", searchFilters);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'An error occurred while fetching lost items. Please try again later.');
        } finally {
            stopLoading();
        };
    }

    function openLostAssetsModal() {

        currentPage = 1;

        const headerDate = {
            'Item Name': 'nameitem',
            'Description': 'description',
            'Lost Quantity': 'lost_quantity'
        };

        rewriteTableSearch('.lost-item-search-input', 'lostItemsTable', headerDate);

        fetchLostAssets();

        lostAssetsModal.classList.add('show');
        lostAssetsModalContent.classList.add('show');
        lostAssetsModalContent.classList.add('slide-in');
        lostAssetsModalContent.classList.remove('slide-out');
    }

    function closeLostAssetsModal() {
        // Add the slide-out effect
        lostAssetsModalContent.classList.add('slide-out');
        lostAssetsModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#lostAssetName, #selectedLostAssetNameId, #assetLocation, #selectedAssetLocationId, #assetDescription, #lostAssetQuantity').forEach((input) => {
                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';
            });

            document.querySelectorAll('.lost-item-search-input').forEach((input) => {
                input.value = '';
            });

            lostAssetSearchDropdown.style.display = 'none';

            lostAssetsModal.classList.remove('show');
            lostAssetsModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAssetArchiveModal() {
        // Add the slide-in effect by adding the necessary classes
        assetArchiveModal.classList.add('show');
        assetArchiveModalContent.classList.add('show');
        assetArchiveModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        assetArchiveModalContent.classList.remove('slide-out');
    }

    function closeAssetArchiveModal() {
        // Add the slide-out effect
        assetArchiveModalContent.classList.add('slide-out');
        assetArchiveModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            const listItems = document.querySelectorAll('.dates li');
            listItems.forEach(li => li.classList.remove('selected'));

            document.getElementById('selectedDate1').value = '';
            document.getElementById('selectedDate2').value = '';

            assetArchiveModal.classList.remove('show');
            assetArchiveModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function setupTableNavigation(tableId, prevBtnId, nextBtnId, pageNumberId, rowsPerPage = 10, totalPages, page, selectDate1, selectDate2, searchFilters = [], searchFiltersDate = [], numRoom = "") {

        document.getElementById(`${pageNumberId}`).textContent = `${page}/${totalPages}`;

        switch (tableId) {
            case 'largeWorkhouse':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchCleanItems(currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersDate);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchCleanItems(currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersDate);
                    }
                };
                break;
            case 'smallWorkhouse':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (secondCurrentPage > 1) {
                        secondCurrentPage--;
                        fetchCleanItems(currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersDate);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (secondCurrentPage < totalPages) {
                        secondCurrentPage++;
                        fetchCleanItems(currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersDate);
                    }
                };
                break;
            case 'assetsTable':
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
            case 'assetDateTable':
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

            case 'lostItemsTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchLostAssets(currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchLostAssets(currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'itemTraceabilityTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchTracabilityItemData(currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchTracabilityItemData(currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'assetTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchSortedAsset(numRoom, currentPage, rowsPerPage, searchFilters, sortedPar);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchSortedAsset(numRoom, currentPage, rowsPerPage, searchFilters, sortedPar);
                    }
                };
                break;

            case 'mainAccordion':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchInventory(currentPage, rowsPerPage);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchInventory(currentPage, rowsPerPage);
                    }
                };
                break;
        };

    }

    function rewriteTableSearch(className, tableName, headerMap, selectDate1 = "", selectDate2 = "", numRoom = "") {

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
                    case 'assetsTable':
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            currentPage = 1;

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            if (headerLabel === 'Fixed' || headerLabel === 'Mobile') {
                                let boolValue;
                                if (searchTerm === 'yes') boolValue = true;
                                else if (searchTerm === 'no') boolValue = false;
                                else return;

                                if (headerLabel === 'Mobile') {
                                    boolValue = !boolValue;
                                }

                                searchFilters.push({ column: 'is_fixed', value: boolValue });
                            } else if (columnName) {
                                searchFilters.push({ column: columnName, value: searchTerm });
                            }
                        });

                        globalSearchFilters = searchFilters;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, 10, searchFilters, globalSearchFiltersDate);
                        break;

                    case 'assetDateTable':
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            secondCurrentPage = 1;

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        globalSearchFiltersDate = searchFilters;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, 10, globalSearchFilters, searchFilters);
                        break;

                    case 'lostItemsTable':
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            currentPage = 1;

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchLostAssets(currentPage, 10, searchFilters);
                        break;

                    case 'largeWorkhouse':
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            currentPage = 1;

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        globalSearchLargeFilters = searchFilters;
                        fetchCleanItems(currentPage, secondCurrentPage, 7, searchFilters, globalSearchSmallFilters);
                        break;

                    case 'smallWorkhouse':
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            secondCurrentPage = 1;

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        globalSearchSmallFilters = searchFilters;
                        fetchCleanItems(currentPage, secondCurrentPage, 7, globalSearchLargeFilters, searchFilters);
                        break;

                    case 'itemTraceabilityTable':
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            currentPage = 1;

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchTracabilityItemData(currentPage, 10, searchFilters);
                        break;

                    case 'assetTable':
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            currentPage = 1;

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchSortedAsset(numRoom, currentPage, 10, searchFilters, sortedPar);
                        break;
                }
            }, 400));
        });
    }

    function openReportModal() {

        // Add the slide-in effect by adding the necessary classes
        assetReportModal.classList.add('show');
        assetReportModalContent.classList.add('show');
        assetReportModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        assetReportModalContent.classList.remove('slide-out');
    }

    function closeReportModal() {
        // Add the slide-out effect
        assetReportModalContent.classList.add('slide-out');
        assetReportModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.search-input-view-assets').forEach((input) => {
                input.value = '';
            });

            document.querySelectorAll('.search-input-view-assets-second').forEach((input) => {
                input.value = '';
            });

            document.querySelectorAll('.column-toggle').forEach(function (checkbox) {
                checkbox.checked = true;
                var columnClass = checkbox.getAttribute('data-column');
                document.querySelectorAll(`#assetsTable th.${columnClass}`).forEach(header => {
                    header.style.display = '';
                });
                document.querySelectorAll(`#assetsTable td.${columnClass}`).forEach(td => {
                    td.style.display = '';
                });
            });

            assetReportModal.classList.remove('show');
            assetReportModalContent.classList.remove('show');
        }, 500); // Match the duration of the animation (0.4s)
    }

    async function fetchCleanItems(pageLarge = 1, pageSmall = 1, limit = 7, searchFiltersLarge = [], searchFiltersSmall = []) {

        const largeTbody = document.getElementById('largeWorkhouseBody');
        const smallTbody = document.getElementById('smallWorkhouseBody');

        const largeTableBody = document.getElementById('largeWorkhouse').getElementsByTagName('tbody')[0];
        largeTableBody.innerHTML = '';

        const smallTableBody = document.getElementById('smallWorkhouse').getElementsByTagName('tbody')[0];
        smallTableBody.innerHTML = '';

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();
        const { signal } = currentFetchController;

        startLoading();

        try {

            // Dynamically create the header checkbox
            const largeHeaderCheckbox = document.createElement('input');
            largeHeaderCheckbox.type = 'checkbox';
            largeHeaderCheckbox.className = 'form-check-input header-checkbox';
            largeHeaderCheckbox.style.border = '1px solid black'; // Make the border more bold
            largeHeaderCheckbox.style.backgroundColor = ''; // Clear any previous color

            largeHeaderCheckbox.addEventListener('change', (event) => {
                largeHeaderCheckbox.style.backgroundColor = event.target.checked ? 'green' : '';
                const isChecked = event.target.checked;

                // Get all visible rows
                const visibleRows = Array.from(largeTbody.querySelectorAll('tr')).filter(row => row.style.display !== 'none');

                visibleRows.forEach(row => {
                    const checkbox = row.querySelector('.form-check-input');
                    if (checkbox) {
                        checkbox.checked = isChecked;
                        checkbox.style.backgroundColor = isChecked ? 'green' : '';
                        if (isChecked) {
                            const amount = row.getElementsByTagName('td')[2].textContent;
                            allCheckedLargeRow.push({ code: checkbox.dataset.id, amount: amount });
                        } else {
                            allCheckedLargeRow = allCheckedLargeRow.filter(item => item.code !== checkbox.dataset.id);
                        }
                    }
                });

                // Ensure no duplicates in allCheckedLargeRow
                if (isChecked) {
                    allCheckedLargeRow = Array.from(new Set(allCheckedLargeRow.map(item => `${item.code}-${item.amount}`)))
                        .map(key => {
                            const [code, amount] = key.split('-');
                            return { code, amount };
                        });
                }
            });

            // Append the header checkbox to the table header
            const largeThead = largeTbody.parentElement.querySelector('thead');
            const largeHeaderRow = largeThead.querySelector('tr');

            largeHeaderRow.querySelectorAll('th').forEach(th => {
                if (!th.textContent.trim()) {
                    th.remove();
                }
            });

            const largeHeaderCell = document.createElement('th');
            largeHeaderCell.appendChild(largeHeaderCheckbox);
            largeHeaderRow.insertBefore(largeHeaderCell, largeHeaderRow.firstChild);

            // Dynamically create the header checkbox
            const smallHeaderCheckbox = document.createElement('input');
            smallHeaderCheckbox.type = 'checkbox';
            smallHeaderCheckbox.className = 'form-check-input header-checkbox';
            smallHeaderCheckbox.style.border = '1px solid black'; // Make the border more bold
            smallHeaderCheckbox.style.backgroundColor = ''; // Clear any previous color

            smallHeaderCheckbox.addEventListener('change', (event) => {
                smallHeaderCheckbox.style.backgroundColor = event.target.checked ? 'green' : '';
                const isChecked = event.target.checked;

                // Get all visible rows
                const visibleRows = Array.from(smallTbody.querySelectorAll('tr')).filter(row => row.style.display !== 'none');

                visibleRows.forEach(row => {
                    const checkbox = row.querySelector('.form-check-input');
                    if (checkbox) {
                        checkbox.checked = isChecked;
                        checkbox.style.backgroundColor = isChecked ? 'green' : '';
                        if (isChecked) {
                            const amount = row.getElementsByTagName('td')[2].textContent;
                            allCheckedSmallRow.push({ code: checkbox.dataset.id, amount: amount });
                        } else {
                            allCheckedSmallRow = allCheckedSmallRow.filter(item => item.code !== checkbox.dataset.id);
                        }
                    }
                });

                // Ensure no duplicates in allCheckedSmallRow
                if (isChecked) {
                    allCheckedSmallRow = Array.from(new Set(allCheckedSmallRow.map(item => `${item.code}-${item.amount}`)))
                        .map(key => {
                            const [code, amount] = key.split('-');
                            return { code, amount };
                        });
                }
            });

            // Append the header checkbox to the table header
            const smallThead = smallTbody.parentElement.querySelector('thead');
            const smallHeaderRow = smallThead.querySelector('tr');

            smallHeaderRow.querySelectorAll('th').forEach(th => {
                if (!th.textContent.trim()) {
                    th.remove();
                }
            });

            const smallHeaderCell = document.createElement('th');
            smallHeaderCell.appendChild(smallHeaderCheckbox);
            smallHeaderRow.insertBefore(smallHeaderCell, smallHeaderRow.firstChild);

            const searchParams = new URLSearchParams({
                pageLarge,
                pageSmall,
                limit
            });

            searchFiltersLarge.forEach(filter => {
                searchParams.append('searchColumnLarge', filter.column);
                searchParams.append('searchValueLarge', filter.value);
            });

            searchFiltersSmall.forEach(filter => {
                searchParams.append('searchColumnSmall', filter.column);
                searchParams.append('searchValueSmall', filter.value);
            });

            const response = await fetch(`/cleanItem?${searchParams.toString()}`, {
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

            const { data, filterDataLarge, filterDataSmall, totalPagesLarge, totalPagesSmall } = await response.json();

            cleanItems = data;

            filterDataLarge.forEach(item => {
                const largeRow = document.createElement("tr");

                // Add the checkbox cell
                const largeCheckboxCell = document.createElement('td');
                const largeCheckbox = document.createElement('input');
                largeCheckbox.type = 'checkbox';
                largeCheckbox.className = 'form-check-input';
                largeCheckbox.dataset.id = item.id;
                largeCheckbox.style.border = '1px solid black'; // Make the border more bold

                if (allCheckedLargeRow.some(i => i.code === item.id)) {
                    largeCheckbox.style.backgroundColor = 'green';
                    largeCheckbox.checked = true;
                }

                // Add change event to the checkbox
                largeCheckbox.addEventListener('change', () => {
                    if (largeCheckbox.checked) {
                        largeCheckbox.style.backgroundColor = 'green';
                        allCheckedLargeRow.push({ code: item.id, amount: item.total_amount });
                    } else {
                        largeCheckbox.style.backgroundColor = '';
                        allCheckedLargeRow = allCheckedLargeRow.filter(row => row.code !== item.id);
                    }
                });

                largeCheckboxCell.appendChild(largeCheckbox);
                largeRow.appendChild(largeCheckboxCell);

                const nameCell1 = document.createElement("td");
                nameCell1.textContent = item.name;
                nameCell1.classList.add("text-wrap");
                nameCell1.style = "max-width: 200px;";
                largeRow.appendChild(nameCell1);

                const totalAmountLargeCell = document.createElement("td");
                totalAmountLargeCell.textContent = item.total_amount;
                totalAmountLargeCell.classList.add("text-wrap");
                totalAmountLargeCell.style = "max-width: 200px;";
                largeRow.appendChild(totalAmountLargeCell);

                // Attach click event for each row
                largeRow.addEventListener('click', (event) => {
                    // Check if the clicked element is not the first td in the row
                    if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0 && item.total_amount > 0) {
                        openEditCleanItemModal(item.id, item.name, item.total_amount);
                    }
                });

                // Append row to the table body
                largeTbody.appendChild(largeRow);
            });

            filterDataSmall.forEach(item => {

                const smallRow = document.createElement("tr");

                // Add the checkbox cell
                const smallCheckboxCell = document.createElement('td');
                const smallCheckbox = document.createElement('input');
                smallCheckbox.type = 'checkbox';
                smallCheckbox.className = 'form-check-input';
                smallCheckbox.dataset.id = item.id;
                smallCheckbox.style.border = '1px solid black'; // Make the border more bold

                if (allCheckedSmallRow.some(i => i.code === item.id)) {
                    smallCheckbox.style.backgroundColor = 'green';
                    smallCheckbox.checked = true;
                }

                // Add change event to the checkbox
                smallCheckbox.addEventListener('change', () => {
                    if (smallCheckbox.checked) {
                        smallCheckbox.style.backgroundColor = 'green';
                        allCheckedSmallRow.push({ code: item.id, amount: item.count_get_item });
                    } else {
                        smallCheckbox.style.backgroundColor = '';
                        allCheckedSmallRow = allCheckedSmallRow.filter(row => row.code !== item.id);
                    }
                });

                smallCheckboxCell.appendChild(smallCheckbox);
                smallRow.appendChild(smallCheckboxCell);

                const nameCell2 = document.createElement("td");
                nameCell2.textContent = item.name;
                nameCell2.classList.add("text-wrap");
                nameCell2.style = "max-width: 200px;";
                smallRow.appendChild(nameCell2);

                const totalAmountSmallCell = document.createElement("td");
                totalAmountSmallCell.textContent = item.count_get_item;
                totalAmountSmallCell.classList.add("text-wrap");
                totalAmountSmallCell.style = "max-width: 200px;";
                smallRow.appendChild(totalAmountSmallCell);

                smallRow.addEventListener('click', (event) => {
                    // Check if the clicked element is not the first td in the row and count_get_item is not 0
                    if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0 && item.count_get_item > 0) {
                        openEditCleanItemModal(item.id, item.name, null, item.count_get_item);
                    }
                });

                // Append row to the table body
                smallTbody.appendChild(smallRow);
            });

            const rowsLargeTable = largeTableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsLargeTable, 0, 7, 'pageNumberFourth');

            const rowsSmallTable = smallTableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsSmallTable, 0, 7, 'pageNumberFifth');

            setupTableNavigation("largeWorkhouse", "prevBtnFourth", "nextBtnFourth", "pageNumberFourth", limit, totalPagesLarge, pageLarge, "", "", searchFiltersLarge, searchFiltersSmall);
            setupTableNavigation("smallWorkhouse", "prevBtnFifth", "nextBtnFifth", "pageNumberFifth", limit, totalPagesSmall, pageSmall, "", "", searchFiltersLarge, searchFiltersSmall);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'Cannot fetch clean item data');
        } finally {
            stopLoading();
        }
    }

    function openCleanItemListModal() {

        currentPage = 1;
        secondCurrentPage = 1;

        const headerLargeMap = {
            'Item name': 'itemname',
            'Count': 'total_amount'
        };

        const headerSmallMap = {
            'Item name': 'itemname',
            'Count': 'count_get_item'
        };

        rewriteTableSearch('.search-input-clean-item', 'largeWorkhouse', headerLargeMap);
        rewriteTableSearch('.second-search-input-clean-item', 'smallWorkhouse', headerSmallMap);

        fetchCleanItems();

        // Add the slide-in effect by adding the necessary classes
        cleanItemModal.classList.add('show');
        cleanItemModalContent.classList.add('show');
        cleanItemModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        cleanItemModalContent.classList.remove('slide-out');
    }

    function closeCleanItemListModal() {
        // Add the slide-out effect
        cleanItemModalContent.classList.add('slide-out');
        cleanItemModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.form-check-input').forEach((input) => {
                input.checked = false;
                input.style.backgroundColor = '';
            });

            allCheckedLargeRow = []; // Reset the global array
            allCheckedSmallRow = []; // Reset the global array

            document.querySelectorAll('.search-input-clean-item, .second-search-input-clean-item').forEach((input) => {
                input.value = '';
            });

            cleanItemModal.classList.remove('show');
            cleanItemModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAddCleanItemModal() {

        // Add the slide-in effect by adding the necessary classes
        addCleanItemModal.classList.add('show');
        addCleanItemModalContent.classList.add('show');
        addCleanItemModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        addCleanItemModalContent.classList.remove('slide-out');
    }

    function closeAddCleanItemModal() {
        // Add the slide-out effect
        addCleanItemModalContent.classList.add('slide-out');
        addCleanItemModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#item-name, #total-amount').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';
            });

            addCleanItemModal.classList.remove('show');
            addCleanItemModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAddMultiCleanItemModal() {

        // Add the slide-in effect by adding the necessary classes
        addMultiCleanItemModal.classList.add('show');
        addMultiCleanItemModalContent.classList.add('show');
        addMultiCleanItemModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        addMultiCleanItemModalContent.classList.remove('slide-out');
    }

    function closeAddMultiCleanItemModal() {
        // Add the slide-out effect
        addMultiCleanItemModalContent.classList.add('slide-out');
        addMultiCleanItemModalContent.classList.remove('slide-in');

        document.getElementById("progress").style.width = 0 + "%";
        document.getElementById("fileInput").value = '';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            addMultiCleanItemModal.classList.remove('show');
            addMultiCleanItemModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)

    }

    function openRemoveCleanItemModal() {

        // Add the slide-in effect by adding the necessary classes
        removeCleanItemModal.classList.add('show');
        removeCleanItemModalContent.classList.add('show');
        removeCleanItemModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        removeCleanItemModalContent.classList.remove('slide-out');
    }

    function closeRemoveCleanItemModal() {
        // Add the slide-out effect
        removeCleanItemModalContent.classList.add('slide-out');
        removeCleanItemModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#removeCleanItemSearch, #selectedRemoveCleanItemId').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';
            });

            removeCleanItemModal.classList.remove('show');
            removeCleanItemModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openEditCleanItemModal(id, name, totalAmount = null, countGetItem = null) {

        // Add the slide-in effect by adding the necessary classes
        editCleanItemModal.classList.add('show');
        editCleanItemModalContent.classList.add('show');
        editCleanItemModalContent.classList.add('slide-in');

        selectedEditCleanItemId.value = id;
        editCleanItemSearchInput.value = name;

        editAmount.value = totalAmount ? '' : countGetItem;

        if (totalAmount) {
            const secondLabel = editCleanItemModal.querySelectorAll('label')[1];
            if (secondLabel) {
                secondLabel.textContent = 'Additional amount';
            }
            isTotalAmound = true;
            editAmount.removeAttribute('max');
            editAmount.min = 1;
            editAmount.placeholder = 'Additional amount';
        } else {
            const secondLabel = editCleanItemModal.querySelectorAll('label')[1];
            if (secondLabel) {
                secondLabel.textContent = 'Taken amount';
            }
            isTotalAmound = false;
            editAmount.max = countGetItem;
            editAmount.min = 1;
            editAmount.placeholder = 'Taken amount';
        }

        // Ensure that any 'slide-out' class is removed if it was previously added
        editCleanItemModalContent.classList.remove('slide-out');
    }

    function closeEditCleanItemModal() {
        // Add the slide-out effect
        editCleanItemModalContent.classList.add('slide-out');
        editCleanItemModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#editCleanItemSearch, #selectedEditCleanItemId, #editAmount').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';
            });

            editCleanItemModal.classList.remove('show');
            editCleanItemModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    async function fetchTracabilityItemData(page = 1, limit = 10, searchFilters = []) {

        const tbody = document.getElementById('tableBodyItemTraceabilityModal');
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

            const response = await fetch(`/getItemTraceability?${searchParams.toString()}`, {
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
                nameCell.textContent = item.item_name;
                nameCell.classList.add("text-wrap");
                nameCell.style = "max-width: 200px;";
                row.appendChild(nameCell);

                // Room status cell
                const amountCell = document.createElement("td");
                amountCell.textContent = item.amount;
                amountCell.classList.add("text-wrap");
                amountCell.style = "max-width: 200px;";
                row.appendChild(amountCell);

                // Room status cell
                const dateChangeCell = document.createElement("td");
                dateChangeCell.textContent = formateDate(item.date_change);
                dateChangeCell.classList.add("text-wrap");
                dateChangeCell.style = "max-width: 200px;";
                row.appendChild(dateChangeCell);

                // Room status cell
                const descriptionCell = document.createElement("td");
                descriptionCell.textContent = item.description;
                descriptionCell.classList.add("text-wrap");
                descriptionCell.style = "max-width: 200px;";
                row.appendChild(descriptionCell);

                // Append row to the table body
                tbody.appendChild(row);
            });

            const itemTraceabilityTableBody = document.getElementById('itemTraceabilityTable').getElementsByTagName('tbody')[0];
            const rowsTable = itemTraceabilityTableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumberSixth');

            setupTableNavigation("itemTraceabilityTable", "prevBtnSixth", "nextBtnSixth", "pageNumberSixth", limit, totalPages, page, "", "", searchFilters);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'An error occurred while fetching item tracability. Please try again later.');
        } finally {
            stopLoading();
        };
    }

    function openItemTraceabilityModal() {

        // Add the slide-in effect by adding the necessary classes
        itemTraceabilityModal.classList.add('show');
        itemTraceabilityModalContent.classList.add('show');
        itemTraceabilityModalContent.classList.add('slide-in');

        currentPage = 1;

        const headerDate = {
            'Item name': 'item_name',
            'Item amount': 'amount',
            'Date change': 'date_change',
            'Description': 'description'
        };

        rewriteTableSearch('.search-input-traceability', 'itemTraceabilityTable', headerDate);

        fetchTracabilityItemData();

        // Ensure that any 'slide-out' class is removed if it was previously added
        itemTraceabilityModalContent.classList.remove('slide-out');
    }

    function closeItemTraceabilityModal() {
        // Add the slide-out effect
        itemTraceabilityModalContent.classList.add('slide-out');
        itemTraceabilityModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.search-input-traceability').forEach((input) => {
                input.value = '';
            });

            itemTraceabilityModal.classList.remove('show');
            itemTraceabilityModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    async function fetchInventory(page = 1, limit = 7) {

        const mainAccordion = document.getElementById('mainAccordion');
        mainAccordion.innerHTML = '';

        startLoading();

        try {

            const param = new URLSearchParams({
                page,
                limit
            });

            const response = await fetch(`/getInventoryData?${param.toString()}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showMess('Error', error.message);
                return;
            }

            const { allBuilding, allRooms, allAssets, totalPages } = await response.json();

            const roomMap = new Map();
            allRooms.forEach(room => {
                if (!roomMap.has(room.buildid)) roomMap.set(room.buildid, []);
                roomMap.get(room.buildid).push(room);
            });

            const assetMap = new Map();
            allAssets.forEach(asset => {
                if (!assetMap.has(asset.location_room)) assetMap.set(asset.location_room, []);
                assetMap.get(asset.location_room).push(asset);
            });

            allBuilding.forEach(build => {
                const accordionItem = document.createElement('div');
                accordionItem.className = 'accordion-item accordion-main-item';

                const statusIcon = build.inventory_status === 'unfinished' ? '❌' :
                    build.inventory_status === 'actions' ? '⏳' : '✅';

                accordionItem.innerHTML = `
                    <button class="accordion-header">
                        <span>${statusIcon} ${build.namebuilding}</span>
                        <span class="arrow">&#9656;</span>
                    </button>
                    <div class="accordion-body"></div>
                `;

                const accordionBody = accordionItem.querySelector('.accordion-body');

                (roomMap.get(build.id) || []).forEach(room => {
                    const roomStatus = room.inventory_status === 'unfinished' ? '❌' :
                        room.inventory_status === 'actions' ? '⏳' : '✅';

                    const subAccordion = document.createElement('div');
                    subAccordion.className = 'accordion sub-accordion';
                    subAccordion.innerHTML = `
                        <div class="accordion-item">
                            <button class="sub-accordion-header">
                                <span>${roomStatus} ${room.nameroom}</span>
                                <span class="arrow">&#9656;</span>
                            </button>
                            <div class="accordion-body">
                                <ul class="list-group"></ul>
                            </div>
                        </div>
                    `;

                    const assetList = subAccordion.querySelector('.list-group');

                    (assetMap.get(room.id) || []).forEach(asset => {
                        const icon = asset.inventory_status === 'undiscovered' ? '❌' :
                            asset.inventory_status === 'edited' ? '✏️' : '✅';
                        const li = document.createElement('li');
                        li.className = 'list-group-item';
                        li.textContent = `${icon} ${asset.code} (${asset.name_assets})`;
                        assetList.appendChild(li);
                    });

                    accordionBody.appendChild(subAccordion);
                });

                mainAccordion.appendChild(accordionItem);
            });

            setupAccordion(mainAccordion);

            const accordeonRows = mainAccordion.querySelectorAll(".accordion-main-item");
            firstUpdateTable(accordeonRows, 0, limit, 'pageNumberSeventh');

            setupTableNavigation("mainAccordion", "prevBtnSeventh", "nextBtnSeventh", "pageNumberSeventh", limit, totalPages, page);

        } catch (error) {
            showMess('Error', 'An error occurred while fetching inventory. Please try again later.');
        } finally {
            stopLoading();
        };
    }

    function openInventoryModal() {

        // Add the slide-in effect by adding the necessary classes
        inventoryModal.classList.add('show');
        inventoryModalContent.classList.add('show');
        inventoryModalContent.classList.add('slide-in');

        currentPage = 1;

        fetchInventory();

        // Ensure that any 'slide-out' class is removed if it was previously added
        inventoryModalContent.classList.remove('slide-out');
    }

    function closeInventoryModal() {
        // Start slide-out animation
        inventoryModalContent.classList.add('slide-out');
        inventoryModalContent.classList.remove('slide-in');

        // Close all accordions (trigger transition)
        const openBodies = inventoryModal.querySelectorAll('.accordion-body.open');
        const activeHeaders = inventoryModal.querySelectorAll('.accordion-header.active');
        const activeSubHeaders = inventoryModal.querySelectorAll('.sub-accordion-header.active');

        openBodies.forEach(body => {
            body.classList.remove('open'); // triggers transition (max-height, opacity)
        });

        activeHeaders.forEach(header => {
            header.classList.remove('active');
        });

        activeSubHeaders.forEach(header => {
            header.classList.remove('active');
        });

        const bodies = inventoryModal.querySelectorAll('.accordion-body');
        bodies.forEach(body => {
            body.style.maxHeight = null;
        });

        // Hide modal after animation ends
        setTimeout(() => {
            inventoryModal.classList.remove('show');
            inventoryModalContent.classList.remove('show', 'slide-out');

        }, 500); // Wait for accordion and slide-out transitions to finish
    }

    function openRemoveAssetsTypeModal() {
        // Add the slide-in effect by adding the necessary classes
        removeAssetsTypeModal.classList.add('show');
        removeAssetsTypeModalContent.classList.add('show');
        removeAssetsTypeModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        removeAssetsTypeModalContent.classList.remove('slide-out');
    }

    function closeRemoveAssetsTypeModal() {

        // Add the slide-out effect
        removeAssetsTypeModalContent.classList.add('slide-out');
        removeAssetsTypeModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#removeAssetTypeSearch, #selectedRemoveAssetId').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';

            });

            removeAssetTypeDropdown.style.display = 'none';

            removeAssetsTypeModal.classList.remove('show');
            removeAssetsTypeModalContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openEditAssetsModal(assetCode, name, type, location, assetNameKey, categorie, quantity, mrah, owner, status, expandable, description, service, m2_inside, is_fixed, date_purchase, date_written_off, purchase_price, comments, replaced_off, year_of_life_cycle, rest_of_life_cycle, replaced_by, rest_value) {

        assetSearchInput.value = assetCode;
        selectedAssetId.value = nameAssetSetCount.find(asset => asset.code === assetCode).id;

        assetName.value = name;

        typeSearchInput.value = type;
        selectedTypeId.value = assetType.find(item => item.name === type).id;

        locationSearchInput.value = location;
        selectedLocationId.value = assetLocation.find(item => item.nameroom === location) ? assetLocation.find(item => item.nameroom === location).roomid : '';

        if (selectedTypeId.value !== '1') {
            subLocationSearchInput.disabled = true;
            oldAssetNameKey = subLocationSearchInput.value;
            subLocationSearchInput.value = '';
            selectedSubLocationId.value = '';
        } else {
            subLocationSearchInput.disabled = false;
            subLocationSearchInput.value = assetNameKey !== 'There is no associated key' ? assetNameKey : '';
            selectedSubLocationId.value = assetLocation.find(item => item.name === assetNameKey) ? assetLocation.find(item => item.name === assetNameKey).id : '';
        }

        const formatDate = (date) => {
            const dateObj = new Date(date);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
            const day = String(dateObj.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
        }

        assetCategory.value = categorie || '';
        assetEditQuantity.value = quantity || '';
        assetMrah.value = mrah || '';
        assetOwner.value = owner || '';
        assetM2Inside.value = m2_inside || '';
        assetComments.value = comments || '';
        assetRestValue.value = rest_value || '';
        assetReplacedOff.value = replaced_off || '';
        assetReplacedBy.value = replaced_by || '';
        assetYearOfLifeCycle.value = year_of_life_cycle || '';
        assetRestOfLifeCycle.value = rest_of_life_cycle || '';
        assetPurchasePrice.value = purchase_price || '';
        assetDatePurchase.value = date_purchase ? formatDate(date_purchase) : '';
        assetDateWrittenOff.value = date_written_off ? formatDate(date_written_off) : '';
        assetIsFixed.checked = !!is_fixed;
        assetService.value = service || '';
        assetEditStatus.value = status || '';
        assetExpandable.value = expandable || '';
        assetDescription.value = description || '';

        // Add the slide-in effect by adding the necessary classes
        assetsEditModal.classList.add('show');
        assetsEditModalContent.classList.add('show');
        assetsEditModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        assetsEditModalContent.classList.remove('slide-out');
    }

    function closeEditAssetsModal() {

        // Add the slide-out effect
        assetsEditModalContent.classList.add('slide-out');
        assetsEditModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll(`
                #assetSearch, #selectedAssetId, #assetName, #typeSearch, 
                #selectedTypeId, #locationSearch, #selectedLocationId, #subLocationSearch, 
                #selectedSubLocationId, #categorie, #description, #m2_inside,
                #date_purchase, #date_written_off, #purchase_price, #comments,
                #replaced_off, #year_of_life_cycle, #rest_of_life_cycle, #replaced_by,
                #rest_value`).forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';

            });

            document.querySelectorAll(`
                #quantity,
                #mrah,
                #owner,
                #service,
                #status,
                #expandable`).forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');
            });

            assetIsFixed.checked = false;
            assetEditQuantity.value = '1';
            assetMrah.value = 'Global RTS';
            assetOwner.value = 'Global RTS';
            assetService.value = 'Billeting';
            assetEditStatus.value = 'New';
            assetExpandable.value = 'Non Expandable';

            assetSearchInput.classList.remove('disabled-select');

            assetsEditModal.classList.remove('show');
            assetsEditModalContent.classList.remove('show');

            assetSearchDropdown.style.display = 'none';
            typeSearchDropdown.style.display = 'none';
            locationSearchDropdown.style.display = 'none';
            subLocationSearchDropdown.style.display = 'none';

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openEditMultiAssetsModal() {

        // Add the slide-in effect by adding the necessary classes
        editMultiAssetsModal.classList.add('show');
        editMultiAssetsModalContent.classList.add('show');
        editMultiAssetsModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        editMultiAssetsModalContent.classList.remove('slide-out');
    }

    function closeEditMultiAssetsModal() {
        // Add the slide-out effect
        editMultiAssetsModalContent.classList.add('slide-out');
        editMultiAssetsModalContent.classList.remove('slide-in');

        document.getElementById("editMultiAssetsProgress").style.width = 0 + "%";
        document.getElementById("fileEditMultiAssetsInput").value = '';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            editMultiAssetsModal.classList.remove('show');
            editMultiAssetsModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)

    }

    function openAddMultiAssetsModal() {

        // Add the slide-in effect by adding the necessary classes
        addMultiAssetsModal.classList.add('show');
        addMultiAssetsModalContent.classList.add('show');
        addMultiAssetsModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        addMultiAssetsModalContent.classList.remove('slide-out');
    }

    function closeAddMultiAssetsModal() {
        // Add the slide-out effect
        addMultiAssetsModalContent.classList.add('slide-out');
        addMultiAssetsModalContent.classList.remove('slide-in');

        document.getElementById("addMultiAssetsProgress").style.width = 0 + "%";
        document.getElementById("fileAddMultiAssetsInput").value = '';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            addMultiAssetsModal.classList.remove('show');
            addMultiAssetsModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)

    }

    async function fetchSortedAsset(numRoom = "", page = 1, limit = 10, searchFilters = [], sortedPar = {}) {

        const assetTableBody = document.getElementById('assetTable').getElementsByTagName('tbody')[0];
        const tbody = document.getElementById('tableBodyModal');
        tbody.innerHTML = '';

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();
        const { signal } = currentFetchController;

        startLoading();

        try {

            const searchParams = new URLSearchParams({
                numRoom,
                page,
                limit
            });

            if (Object.keys(sortedPar).length > 0) {
                searchParams.append('sortedColumn', sortedPar.column);
                searchParams.append('sortedDirection', sortedPar.direction);
            }

            searchFilters.forEach(filter => {
                searchParams.append('searchColumn', filter.column);
                searchParams.append('searchValue', filter.value);
            });

            const response = await fetch(`/assets/getSortedAssets?${searchParams.toString()}`, {
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

            const { data, filterData, totalPages } = await response.json();

            nameAssetSetCount = data;

            const headerCheckbox = document.createElement('input');
            headerCheckbox.type = 'checkbox';
            headerCheckbox.className = 'form-check-input header-checkbox';
            headerCheckbox.style.border = '1px solid black'; // Make the border more bold
            headerCheckbox.style.backgroundColor = ''; // Clear any previous color

            headerCheckbox.addEventListener('change', (event) => {
                const isChecked = event.target.checked;
                headerCheckbox.style.backgroundColor = isChecked ? 'green' : '';

                // Get all visible rows
                const visibleRows = Array.from(document.querySelectorAll('.data-asset')).filter(row => row.style.display !== 'none');

                visibleRows.forEach(row => {
                    const checkbox = row.querySelector('.form-check-input:not(.header-checkbox)');
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

                // Remove duplicates from allCheckedRow if needed
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

            filterData.forEach(item => {
                const row = document.createElement("tr");
                row.classList.add('data-asset');

                // Add the checkbox cell
                const checkboxCell = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input';
                checkbox.dataset.id = item.id;
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
                codeCell.textContent = item.code;
                codeCell.classList.add("text-wrap");
                codeCell.style = "max-width: 200px;";
                row.appendChild(codeCell);

                // Room status cell
                const nameCell = document.createElement("td");
                nameCell.textContent = item.name;
                nameCell.classList.add("text-wrap");
                nameCell.style = "max-width: 200px;";
                row.appendChild(nameCell);

                // Room status cell
                const typeCell = document.createElement("td");
                typeCell.textContent = item.type;
                typeCell.classList.add("text-wrap");
                typeCell.style = "max-width: 200px;";
                row.appendChild(typeCell);

                // Room status cell
                const locationCell = document.createElement("td");
                locationCell.textContent = item.location;
                locationCell.classList.add("text-wrap");
                locationCell.style = "max-width: 200px;";
                row.appendChild(locationCell);

                // Room status cell
                const descriptionCell = document.createElement("td");
                descriptionCell.textContent = item.description ? item.description : 'No description';
                descriptionCell.classList.add("text-wrap");
                descriptionCell.style = "max-width: 200px;";
                row.appendChild(descriptionCell);

                // Attach click event for each row
                row.addEventListener('click', (event) => {
                    // Check if the clicked element is not the first td in the row
                    if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0) {
                        openEditAssetsModal(
                            item.code, item.name, item.type, item.location,
                            item.namekey, item.categorie, item.quantity, item.mrah,
                            item.owner, item.status, item.expandable, item.description,
                            item.service, item.m2_inside, item.is_fixed, item.date_purchase,
                            item.date_written_off, item.purchase_price, item.comments, item.replaced_off,
                            item.year_of_life_cycle, item.rest_of_life_cycle, item.replaced_by, item.rest_value
                        );
                    }
                });

                // Append row to the table body
                tbody.appendChild(row);
            });

            const rowsTable = assetTableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumberSecond');

            setupTableNavigation("assetTable", "prevBtnSecond", "nextBtnSecond", "pageNumberSecond", limit, totalPages, page, "", "", searchFilters, [], numRoom);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'An error occurred while fetching sort asset. Please try again later.');
        } finally {
            stopLoading();
        };
    }

    function openAssetsModal(rowId) {

        // Add the slide-in effect by adding the necessary classes
        assetsModal.classList.add('show');
        assetsModalContent.classList.add('show');
        assetsModalContent.classList.add('slide-in');

        currentPage = 1;
        globalRowId = rowId;

        const headerDate = {
            'Asset code': 'code',
            'Asset name': 'name_assets',
            'Asset type': 'type_name',
            'Asset location': 'nameroom',
            'Description': 'description'
        };

        rewriteTableSearch('.asset-search-input', 'assetTable', headerDate, "", "", rowId);

        fetchSortedAsset(rowId);

        // Ensure that any 'slide-out' class is removed if it was previously added
        assetsModalContent.classList.remove('slide-out');
    }

    function closeAssetsModal() {
        // Add the slide-out effect
        assetsModalContent.classList.add('slide-out');
        assetsModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            Array.from(document.getElementsByClassName('asset-search-input')).forEach(item => {
                item.value = '';
            });

            allCheckedRow = []; // Reset the global array

            // Get header elements
            const headers = {
                code: document.getElementById('asset-code-header'),
                name: document.getElementById('asset-name-header'),
                type: document.getElementById('asset-type-header'),
                location: document.getElementById('asset-location-header'),
                description: document.getElementById('asset-description-header')
            };

            // Reset all headers by removing sort classes
            Object.keys(headers).forEach(column => {
                headers[column].classList.remove('ascending', 'descending');
            });

            assetsModal.classList.remove('show');
            assetsModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    document.getElementsByClassName('close-btn')[0].onclick = closeAssetsModal;
    document.getElementsByClassName('close-btn')[1].onclick = closeEditAssetsModal;
    document.getElementsByClassName('close-btn')[2].onclick = closeAddAssetsModal;
    document.getElementsByClassName('close-btn')[3].onclick = closeAddAssetsTypeModal;
    document.getElementsByClassName('close-btn')[4].onclick = closeRemoveAssetsTypeModal;
    document.getElementsByClassName('close-btn')[5].onclick = closeLostAssetsModal;
    document.getElementsByClassName('close-btn')[6].onclick = closeAssetArchiveModal;
    document.getElementsByClassName('close-btn')[7].onclick = closeReportModal;
    document.getElementsByClassName('close-btn')[8].onclick = closeCleanItemListModal;
    document.getElementsByClassName('close-btn')[9].onclick = closeAddCleanItemModal;
    document.getElementsByClassName('close-btn')[10].onclick = closeAddMultiCleanItemModal;
    document.getElementsByClassName('close-btn')[11].onclick = closeRemoveCleanItemModal;
    document.getElementsByClassName('close-btn')[12].onclick = closeEditCleanItemModal;
    document.getElementsByClassName('close-btn')[13].onclick = closeItemTraceabilityModal;
    document.getElementsByClassName('close-btn')[14].onclick = closeInventoryModal;
    document.getElementsByClassName('close-btn')[15].onclick = closeEditMultiAssetsModal;
    document.getElementsByClassName('close-btn')[16].onclick = closeAddMultiAssetsModal;
    document.getElementsByClassName('close-btn')[17].onclick = function () {
        closeMessModal(globalAction);
    };

    // Close the modal if the user clicks outside of it
    window.addEventListener("click", function (event) {

        switch (event.target) {
            case assetsModal:
                closeAssetsModal();
                break;

            case modalMess:
                closeMessModal(globalAction);
                break;

            case cleanItemModal:
                closeCleanItemListModal();
                break;

            case addCleanItemModal:
                closeAddCleanItemModal();
                break;

            case addMultiCleanItemModal:
                closeAddMultiCleanItemModal();
                break;

            case editMultiAssetsModal:
                closeEditMultiAssetsModal();
                break;

            case addMultiAssetsModal:
                closeAddMultiAssetsModal();
                break;

            case removeCleanItemModal:
                closeRemoveCleanItemModal();
                break;

            case editCleanItemModal:
                closeEditCleanItemModal();
                break;

            case itemTraceabilityModal:
                closeItemTraceabilityModal();
                break;

            case inventoryModal:
                closeInventoryModal();
                break;

            case assetsEditModal:
                closeEditAssetsModal();
                break;

            case assetsAddModal:
                closeAddAssetsModal();
                break;

            case addAssetsTypeModal:
                closeAddAssetsTypeModal();
                break;

            case removeAssetsTypeModal:
                closeRemoveAssetsTypeModal();
                break;

            case lostAssetsModal:
                closeLostAssetsModal();
                break;

            case assetArchiveModal:
                closeAssetArchiveModal();
                break;

            case assetReportModal:
                closeReportModal();
                break;
        }
    });

    // Hide dropdown if clicked outside
    window.addEventListener('click', function (event) {
        if (!assetSearchDropdown.contains(event.target) && event.target !== assetSearchDropdown) {
            assetSearchDropdown.style.display = 'none';
        }

        if (!typeSearchDropdown.contains(event.target) && event.target !== typeSearchDropdown) {
            typeSearchDropdown.style.display = 'none';
        }

        if (!locationSearchDropdown.contains(event.target) && event.target !== locationSearchDropdown) {
            locationSearchDropdown.style.display = 'none';
        }

        if (!subLocationSearchDropdown.contains(event.target) && event.target !== subLocationSearchDropdown) {
            subLocationSearchDropdown.style.display = 'none';
        }

        if (!addLocationSearchDropdown.contains(event.target) && event.target !== addLocationSearchDropdown) {
            addLocationSearchDropdown.style.display = 'none';
        }

        if (!addSubLocationSearchDropdown.contains(event.target) && event.target !== addSubLocationSearchDropdown) {
            addSubLocationSearchDropdown.style.display = 'none';
        }

        if (!typeAddSearchDropdown.contains(event.target) && event.target !== typeAddSearchDropdown) {
            typeAddSearchDropdown.style.display = 'none';
        }

        if (!removeAssetTypeDropdown.contains(event.target) && event.target !== removeAssetTypeDropdown) {
            removeAssetTypeDropdown.style.display = 'none';
        }

        if (!removeCleanItemSearchDropdown.contains(event.target) && event.target !== removeCleanItemSearchDropdown) {
            removeCleanItemSearchDropdown.style.display = 'none';
        }

        if (!editCleanItemSearchDropdown.contains(event.target) && event.target !== editCleanItemSearchDropdown) {
            editCleanItemSearchDropdown.style.display = 'none';
        }

        if (!selectAllAssetDropdown.contains(event.target) && event.target !== selectAllAssetDropdown) {
            selectAllAssetDropdown.style.display = 'none';
        }

        if (!dropdownButton.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.style.display = 'none'; // Hide the dropdown if clicked outside
        }
    });

    // Add event listeners to table headers for sorting
    document.getElementById('room-number-header').addEventListener('click', function () {
        sortTableData('nameroom');
    });

    document.getElementById('room-number-assets').addEventListener('click', function () {
        sortTableData('count_assets');
    });

    document.getElementById('asset-code-header').addEventListener('click', function () {
        sortTableAssetsData('code');
    });

    document.getElementById('asset-name-header').addEventListener('click', function () {
        sortTableAssetsData('name_assets');
    });

    document.getElementById('asset-type-header').addEventListener('click', function () {
        sortTableAssetsData('type_name');
    });

    document.getElementById('asset-location-header').addEventListener('click', function () {
        sortTableAssetsData('nameroom');
    });

    document.getElementById('asset-description-header').addEventListener('click', function () {
        sortTableAssetsData('description');
    });

    // Add event listeners to the buttons
    document.getElementById('btnAddTypeAsset').addEventListener('click', () => {
        document.getElementById('selectTypeDropdown').style.display = 'none';
        openAddAssetsTypeModal();
    });

    document.getElementById('btnRemoveTypeAsset').addEventListener('click', () => {
        document.getElementById('selectTypeDropdown').style.display = 'none';
        openRemoveAssetsTypeModal();
    });

    document.getElementById('btnLostAsset').addEventListener('click', () => {
        openLostAssetsModal();
    });

    document.getElementById('reportButton').addEventListener('click', () => {
        openAssetArchiveModal();
    });

    document.getElementById('btnCleaningItem').addEventListener('click', () => {
        openCleanItemListModal();
    });

    document.getElementById('addCleanItem').addEventListener('click', () => {
        openAddCleanItemModal();
    });

    document.getElementById('confirmBtnAddMultiCleanItem').addEventListener('click', () => {
        openAddMultiCleanItemModal();
    });

    document.getElementById('removeCleanItem').addEventListener('click', () => {
        openRemoveCleanItemModal();
    });

    document.getElementById('btnItemTraceability').addEventListener('click', () => {
        openItemTraceabilityModal();
    });

    document.getElementById('inventoryButton').addEventListener('click', () => {
        openInventoryModal();
    });

    document.getElementById('upload-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInput");
        const file = fileInput.files[0];

        if (!file) {
            showMess("Error", "You have not selected a file to upload");
            return;
        }

        const url = "/uploadCleanItems";
        const progressBar = document.getElementById("progress");

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
                    globalAction = 'addMultiCleanItem';
                    showMess("Info", "File uploaded successfully!");
                }, 1000);
            } else {
                stopLoading();
                const data = JSON.parse(xhr.responseText);
                if (data.errors) {
                    data.errors.forEach(error => {
                        if (error.type === 'DuplicateInFile' || error.type === 'DuplicateInDB' || error.type === 'InvalidFormat') {
                            showMess("Error", error.message);
                        } else if (error.type === 'Validation') {
                            showMess("Error", `Invalid data in row with item name: ${error.row.itemName}. Check the syntax of name, and amount.`);
                        }
                    });
                } else {
                    showMess("Error", data.error || "File upload failed.");
                }
            }
        };

        xhr.onerror = function () {
            stopLoading();
            showMess("Error", "An unexpected error occurred.");
        };

        xhr.send(formData);
    });

    document.getElementById('upload-edit-multi-assets-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileEditMultiAssetsInput");
        const file = fileInput.files[0];

        if (!file) {
            showMess("Error", "You have not selected a file to upload");
            return;
        }

        const url = "/assets/editMultiAsset";
        const progressBar = document.getElementById("editMultiAssetsProgress");

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
                    globalAction = 'editMultiAssets';
                    showMess("Info", "File uploaded successfully!");
                }, 1000);
            } else {
                stopLoading();
                const data = JSON.parse(xhr.responseText);
                if (data.errors) {
                    data.errors.forEach(error => {
                        if (error.type === 'DuplicateInFile' || error.type === 'NotFound') {
                            showMess("Error", error.message);
                        } else if (error.type === 'Validation') {
                            showMess("Error", `Invalid data in row with item name: ${error.row.code}. Check the syntax of columns in this row.`);
                        }
                    });
                } else {
                    showMess("Error", data.error || "File upload failed.");
                }
            }
        };

        xhr.onerror = function () {
            stopLoading();
            showMess("Error", "An unexpected error occurred.");
        };

        xhr.send(formData);
    });

    document.getElementById('upload-add-multi-assets-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileAddMultiAssetsInput");
        const file = fileInput.files[0];

        if (!file) {
            showMess("Error", "You have not selected a file to upload");
            return;
        }

        const url = "/assets/addMultiAsset";
        const progressBar = document.getElementById("addMultiAssetsProgress");

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
                    globalAction = 'addMultiAssets';
                    showMess("Info", "File uploaded successfully!");
                }, 1000);
            } else {
                stopLoading();
                const data = JSON.parse(xhr.responseText);
                if (data.errors) {
                    data.errors.forEach(error => {
                        if (error.type === 'DuplicateInFile' || error.type === 'IsExistAsset' || error.type === 'NotFound') {
                            showMess("Error", error.message);
                        } else if (error.type === 'Validation') {
                            showMess("Error", `Invalid data in row with item code: ${error.row.assetCode}. Check the syntax of all columns in this row.`);
                        }
                    });
                } else {
                    showMess("Error", data.error || "File upload failed.");
                }
            }
        };

        xhr.onerror = function () {
            stopLoading();
            showMess("Error", "An unexpected error occurred.");
        };

        xhr.send(formData);
    });

    document.getElementById('largeToSmallBtn').addEventListener('click', function () {

        if (allCheckedLargeRow.length === 0) {
            showMess('Error', 'You have not selected any items to move');
            return;
        }

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        const quantityInput = document.createElement('input');
        const maxAmount = Math.min(...allCheckedLargeRow.map(item => parseInt(item.amount, 10)));
        quantityInput.type = 'number';
        quantityInput.classList.add('form-control');
        quantityInput.min = 1;
        quantityInput.max = maxAmount;
        quantityInput.style.marginBottom = '10px';

        quantityInput.addEventListener('input', function () {
            const isValid = quantityInput.value > 0 && quantityInput.value <= maxAmount;
            toggleInputValidity(quantityInput, isValid);
        });

        submitButton.addEventListener('click', async () => {

            if (!quantityInput.value || quantityInput.value < 0 || quantityInput.value > maxAmount) {
                toggleInputValidity(quantityInput, false);
                return;
            }

            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const data = {
                    checkList: allCheckedLargeRow,
                    moveAmount: quantityInput.value
                };

                const response = await fetch('/changeAmountLargeToSmall', {
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

            } catch (error) {
                hasError = true;
            } finally {
                stopLoading();
            }
        });

        modalMessContent.appendChild(quantityInput);
        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }

                if (modalMessContent.contains(quantityInput)) {
                    // Check if the input is still a child before removing
                    modalMessContent.removeChild(quantityInput);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'changeAmountLargeToSmall';
                    showMess('Info', 'The items has been move from small to large workhouse succesful');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while move items');
                }

                if (modalMessContent.contains(quantityInput)) {
                    // Check if the input is still a child before removing
                    modalMessContent.removeChild(quantityInput);
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'Are you sure you want to move this item from small to large workhouse?\nPlease enter the quantity of items you want to move.');
    });

    document.getElementById('smallToLargeBtn').addEventListener('click', function () {

        if (allCheckedSmallRow.length === 0) {
            showMess('Error', 'You have not selected any items to move');
            return;
        }

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        const quantityInput = document.createElement('input');
        const maxAmount = Math.min(...allCheckedSmallRow.map(item => parseInt(item.amount, 10)));
        quantityInput.type = 'number';
        quantityInput.classList.add('form-control');
        quantityInput.min = 1;
        quantityInput.max = maxAmount;
        quantityInput.style.marginBottom = '10px';

        quantityInput.addEventListener('input', function () {
            const isValid = quantityInput.value > 0 && quantityInput.value <= maxAmount;
            toggleInputValidity(quantityInput, isValid);
        });

        submitButton.addEventListener('click', async () => {

            if (!quantityInput.value || quantityInput.value < 0 || quantityInput.value > maxAmount) {
                toggleInputValidity(quantityInput, false);
                return;
            }

            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const data = {
                    checkList: allCheckedSmallRow,
                    moveAmount: quantityInput.value
                };

                const response = await fetch('/changeAmountSmallToLarge', {
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

            } catch (error) {
                hasError = true;
            } finally {
                stopLoading();
            }
        });

        modalMessContent.appendChild(quantityInput);
        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }

                if (modalMessContent.contains(quantityInput)) {
                    // Check if the input is still a child before removing
                    modalMessContent.removeChild(quantityInput);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'changeAmountSmallToLarge';
                    showMess('Info', 'The items has been move from small to large workhouse succesful');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while move items');
                }

                if (modalMessContent.contains(quantityInput)) {
                    // Check if the input is still a child before removing
                    modalMessContent.removeChild(quantityInput);
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'Are you sure you want to move this item from large to small workhouse?\nPlease enter the quantity of items you want to move.');
    });

    document.getElementById('btnRestartInventory').addEventListener('click', function () {

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

                const response = await fetch('/restorInventory', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    }
                });

                responseData = await response.json();

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

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'restorInventory';
                    showMess('Info', 'The inventory is restor succesful');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while restor inventory');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'The current inventory sequence will be lost, are you sure you want to restor inventor.');
    });

    // Toggle dropdown on button click
    dropdownButton.addEventListener('click', function () {
        const isExpanded = dropdownMenu.style.display === 'block';
        // Close the dropdown if it is open, or open it if it's closed
        dropdownMenu.style.display = isExpanded ? 'none' : 'block';
    });

    function firstUpdateTable(rows, currentIndex, rowsPerPage, pageNumberId) {
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display =
                pageNumberId !== "pageNumberSeventh" && i >= currentIndex && i < currentIndex + rowsPerPage ?
                    "table-row" : i >= currentIndex && i < currentIndex + rowsPerPage ? "block" : "none";
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

            const response = await fetch(`/assets/viewReport?${searchParams.toString()}`, {
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

            const { data, data_asset_count, totalPages, totalPagesDate } = await response.json();

            const assetTableBody = document.getElementById('assetsTable').getElementsByTagName('tbody')[0];
            const assetDateTableBody = document.getElementById('assetDateTable').getElementsByTagName('tbody')[0];

            assetTableBody.innerHTML = '';
            assetDateTableBody.innerHTML = '';

            const dateFormat = (date) => {
                const dateObj = new Date(date);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
                const day = String(dateObj.getDate()).padStart(2, '0');

                return `${year}-${month}-${day}`;
            }

            data.forEach(row => {
                const newRow = assetTableBody.insertRow();
                let cell;

                cell = newRow.insertCell();
                cell.classList.add('asset-rfid-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.id;

                cell = newRow.insertCell();
                cell.classList.add('asset-code-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.code;

                cell = newRow.insertCell();
                cell.classList.add('asset-name-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.name_assets;

                cell = newRow.insertCell();
                cell.classList.add('asset-type-header');

                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.type;

                cell = newRow.insertCell();
                cell.classList.add('asset-building-header');

                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.location_building;

                cell = newRow.insertCell();
                cell.classList.add('asset-room-header');

                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.location_room;

                cell = newRow.insertCell();
                cell.classList.add('asset-category-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.categorie ? row.categorie : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-quantity-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.quantity ? row.quantity : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-mrah-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.mrah ? row.mrah : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-owner-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.asset_owner ? row.asset_owner : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-status-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.status ? row.status : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-expandable-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.expandable ? row.expandable : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-description-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.description ? row.description : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-create-date-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.create_date ? formateDate(row.create_date) : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-last-inventory-date-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.last_inventory_date ? formateDate(row.last_inventory_date) : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-service-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.service ? row.service : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-m2-inside-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.m2_inside ? row.m2_inside : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-fixed-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = !!row.is_fixed ? 'Yes' : 'No';

                cell = newRow.insertCell();
                cell.classList.add('asset-mobile-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = !!row.is_fixed ? 'No' : 'Yes';

                cell = newRow.insertCell();
                cell.classList.add('asset-date-purchase-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.date_purchase ? dateFormat(row.date_purchase) : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-date-written-off-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.date_written_off ? dateFormat(row.date_written_off) : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-purchase-price-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.purchase_price ? row.purchase_price : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-comments-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.comments ? row.comments : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-replaced-off-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.replaced_off ? row.replaced_off : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-year-of-life-cycle-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.year_of_life_cycle ? row.year_of_life_cycle : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-rest-of-life-cycle-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.rest_of_life_cycle ? row.rest_of_life_cycle : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-replaced-by-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.replaced_by ? row.replaced_by : 'N/A';

                cell = newRow.insertCell();
                cell.classList.add('asset-rest-value-header');
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";
                cell.textContent = row.rest_value ? row.rest_value : 'N/A';
            });

            data_asset_count.forEach(row => {
                const newRow = assetDateTableBody.insertRow();
                let cell;

                cell = newRow.insertCell();
                cell.textContent = row.event_date;
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";

                cell = newRow.insertCell();
                cell.textContent = row.total_assets;
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";

                cell = newRow.insertCell();
                cell.textContent = row.total_new_assets;
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";

                cell = newRow.insertCell();
                cell.textContent = row.total_updated_assets;
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";

                cell = newRow.insertCell();
                cell.textContent = row.total_removed_assets;
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";

                cell = newRow.insertCell();
                cell.textContent = row.total_missing_assets;
                cell.classList.add("text-wrap");
                cell.style = "max-width: 200px;";

            });

            const rowsTable = assetTableBody.getElementsByTagName("tr");
            const rowsTableDate = assetDateTableBody.getElementsByTagName("tr");

            firstUpdateTable(rowsTable, 0, 10, 'pageNumber');
            firstUpdateTable(rowsTableDate, 0, 10, 'pageNumberDate');

            document.querySelectorAll('.column-toggle').forEach(function (checkbox) {
                const isChecked = checkbox.checked;
                var columnClass = checkbox.getAttribute('data-column');
                document.querySelectorAll(`#assetsTable th.${columnClass}`).forEach(header => {
                    header.style.display = isChecked ? '' : 'none';
                });
                document.querySelectorAll(`#assetsTable td.${columnClass}`).forEach(td => {
                    td.style.display = isChecked ? '' : 'none';
                });
            });

            setupTableNavigation("assetsTable", "prevBtn", "nextBtn", "pageNumber", limit, totalPages, page, selectDate1, selectDate2, searchFilters, searchFiltersDate);
            setupTableNavigation("assetDateTable", "prevBtnDate", "nextBtnDate", "pageNumberDate", limit, totalPagesDate, pageDate, selectDate1, selectDate2, searchFilters, searchFiltersDate);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'Cannot fetch report data');

        } finally {
            stopLoading();
        }
    }

    document.getElementById('confirmReportBtn').addEventListener('click', () => {

        const selectDate1 = document.getElementById('selectedDate1').value;
        const selectDate2 = document.getElementById('selectedDate2').value;

        if (!selectDate1 || !selectDate2) {
            showMess('Error', 'Both dates must be selected!');
            return;
        }

        if (new Date(selectDate1) > new Date(selectDate2)) {
            showMess('Error', 'Invalid time slot!');
            return;
        }

        closeAssetArchiveModal();

        currentPage = 1;
        secondCurrentPage = 1;

        const headerMap = {
            'RFID': 'a.id',
            'Asset code': 'code',
            'Asset Name': 'name_assets',
            'Asset type': 'type_name',
            'Building': 'namebuilding',
            'Room': 'nameroom',
            'Asset category': 'categorie',
            'Asset quantity': 'quantity',
            'MRAH': 'mrah',
            'Asset owner': 'asset_owner',
            'Asset status': 'status',
            'Asset expandable': 'expandable',
            'Asset description': 'description',
            'Asset create date': 'create_date',
            'Asset last inventory date': 'last_inventory_date',
            'Service': 'service',
            'M2 Inside': 'm2_inside',
            'Fixed': 'is_fixed',
            'Mobile': 'is_mobile',
            'Date Purchase': 'date_purchase',
            'Date Written Off': 'date_written_off',
            'Purchase Price': 'purchase_price',
            'Comments': 'comments',
            'Replaced Off': 'replaced_off',
            'Year of Life Cycle': 'year_of_life_cycle',
            'Rest of Life Cycle': 'rest_of_life_cycle',
            'Replaced by': 'replaced_by',
            'Rest Value': 'rest_value'
        };

        const headerDateMap = {
            'Date': 'event_date',
            'Total Assets': 'total_assets',
            'Total New Assets': 'total_new_assets',
            'Total Update Assets': 'total_updated_assets',
            'Total Remove Assets': 'total_removed_assets',
            'Total Missing Assets': 'total_missing_assets'
        };

        rewriteTableSearch('.search-input-view-assets', 'assetsTable', headerMap, selectDate1, selectDate2);
        rewriteTableSearch('.search-input-view-assets-second', 'assetDateTable', headerDateMap, selectDate1, selectDate2);

        globalSelectDate1 = selectDate1;
        globalSelectDate2 = selectDate2;

        fetchReport(selectDate1, selectDate2);
        openReportModal();
    });

    document.querySelector('.left-nav').addEventListener('click', function (event) {
        if (event.target.tagName === 'BUTTON') {
            const id = event.target.id;

            document.querySelectorAll('.left-nav ul li button').forEach(btn => {
                btn.classList.remove('focus-persistent');
            });

            // Add focus class to the clicked button
            event.target.classList.add('focus-persistent');

            const headers = {
                nameroom: document.getElementById('room-number-header'),
                count_assets: document.getElementById('room-number-assets'),
            };

            // Reset all headers by removing sort classes
            Object.keys(headers).forEach(column => {
                headers[column].classList.remove('ascending', 'descending');
            });

            document.getElementById('numBuild').value = id;
            selectedBuilding = id;
            fetchTableData(1, {}, id);

        }
    });

    document.querySelectorAll('.data-room').forEach((element) => {
        element.addEventListener('click', (event) => {
            const rowId = event.currentTarget.id;
            openAssetsModal(rowId);
        });
    });

    document.getElementById('removeAsset').addEventListener('click', async () => {

        const submitButton = document.createElement('button');
        var isRemove = false;
        let hasError = false;
        var result = {};

        if (allCheckedRow.length === 0) {
            showMess('Error', 'You have not selected any asset to remove');
            return;
        }

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');
        submitButton.addEventListener('click', async () => {

            isRemove = true;
            hasError = false;

            startLoading();

            try {
                for (const data of allCheckedRow) {
                    const checkResponse = await fetch('/assets/checkDeleteAsset', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        body: JSON.stringify(data)
                    });

                    if (!checkResponse.ok) {
                        hasError = true;
                        result = await checkResponse.json();
                        checkForGlobalError(checkResponse, result);
                        break;
                    }
                }

                if (!hasError) {
                    for (const data of allCheckedRow) {
                        const deleteResponse = await fetch('/assets/deleteAsset', {
                            method: 'DELETE',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                'CSRF-Token': csrfToken
                            },
                            body: JSON.stringify(data)
                        });

                        if (!deleteResponse.ok) {
                            hasError = true;
                            result = await deleteResponse.json();
                            checkForGlobalError(deleteResponse, result);
                            break;
                        }
                    }
                }
            } catch (error) {
                hasError = true;
                result = { message: 'An error occurred while processing the request.' };
            } finally {
                stopLoading();
            }

            closeMessModal();
        });

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isRemove) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show the info modal
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isRemove) {
                closeWarningObserver.disconnect();
                if (isRemove && !hasError) {
                    globalAction = 'deleteAsset';
                    showMess('Info', 'The selected assets have been removed');
                } else if (hasError) {
                    showMess('Error', result.message);
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        showMess('Warnning', 'Are you sure you want to remove the selected assets?');
    });

    document.getElementById('addAsset').addEventListener('click', () => {
        openAddAssetsModal();
    });

    document.getElementById('multiEditAsset').addEventListener('click', () => {
        openEditMultiAssetsModal();
    });

    document.getElementById('add-multi-button').addEventListener('click', () => {
        openAddMultiAssetsModal();
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

    document.getElementById('form7').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form8').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form9').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form1').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: assetSearchInput, condition: selectedAssetId.value === '' },
            { input: assetName, condition: assetName.value === '' || !assetName.checkValidity() },
            { input: typeSearchInput, condition: selectedTypeId.value === '' },
            { input: locationSearchInput, condition: selectedLocationId.value === '' },
            { input: subLocationSearchInput, condition: !subLocationSearchInput.disabled && selectedSubLocationId.value === '' },
            { input: assetCategory, condition: !assetCategory.checkValidity() },
            { input: assetEditQuantity, condition: !assetEditQuantity.checkValidity() },
            { input: assetMrah, condition: !assetMrah.checkValidity() },
            { input: assetOwner, condition: !assetOwner.checkValidity() },
            { input: assetService, condition: !assetService.checkValidity() },
            { input: assetEditStatus, condition: !/^[A-Za-z0-9]+$/.test(assetEditStatus.value) },
            { input: assetExpandable, condition: !assetExpandable.checkValidity() },
            { input: assetDescription, condition: !/^[a-zA-Z0-9\s]*$/.test(assetDescription.value) },
            { input: assetM2Inside, condition: !assetM2Inside.checkValidity() },
            { input: assetDatePurchase, condition: assetDatePurchase.value.trim() && isNaN(Date.parse(assetDatePurchase.value.trim())) },
            { input: assetDateWrittenOff, condition: assetDateWrittenOff.value.trim() && isNaN(Date.parse(assetDateWrittenOff.value.trim())) },
            { input: assetPurchasePrice, condition: !assetPurchasePrice.checkValidity() },
            { input: assetComments, condition: !assetComments.checkValidity() },
            { input: assetRestValue, condition: !assetRestValue.checkValidity() },
            { input: assetReplacedOff, condition: !assetReplacedOff.checkValidity() },
            { input: assetReplacedBy, condition: !assetReplacedBy.checkValidity() },
            { input: assetYearOfLifeCycle, condition: !assetYearOfLifeCycle.checkValidity() },
            { input: assetRestOfLifeCycle, condition: !assetRestOfLifeCycle.checkValidity() }

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
            assetId: selectedAssetId.value,
            assetName: assetName.value,
            assetType: selectedTypeId.value,
            assetLocation: selectedLocationId.value,
            assetSubLocation: selectedSubLocationId.value,
            assetCategory: assetCategory.value,
            assetQuantity: assetEditQuantity.value,
            assetMrah: assetMrah.value,
            assetOwner: assetOwner.value,
            assetService: assetService.value,
            assetStatus: assetEditStatus.value,
            assetExpandable: assetExpandable.value,
            assetDescription: assetDescription.value,
            assetM2Inside: assetM2Inside.value,
            assetIsFixed: assetIsFixed.checked,
            assetDatePurchase: assetDatePurchase.value,
            assetDateWrittenOff: assetDateWrittenOff.value,
            assetPurchasePrice: assetPurchasePrice.value,
            assetComments: assetComments.value,
            assetReplacedOff: assetReplacedOff.value,
            assetYearOfLifeCycle: assetYearOfLifeCycle.value,
            assetRestOfLifeCycle: assetRestOfLifeCycle.value,
            assetReplacedBy: assetReplacedBy.value,
            assetRestValue: assetRestValue.value
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

                responseData = await response.json();

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

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'editAsset';
                    showMess('Info', 'The asset has been updated');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while updating the asset');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'Are you sure you want to update this asset?');
    };

    document.getElementById('form2').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: assetEps, condition: assetEps.value === '' || !assetEps.checkValidity() },
            { input: assetCodeSearch, condition: assetCodeSearch.value === '' || !assetCodeSearch.checkValidity() },
            { input: assetAddName, condition: assetAddName.value === '' || !assetAddName.checkValidity() },
            { input: typeAddSearchInput, condition: selectedAddTypeId.value === '' },
            { input: addLocationSearchInput, condition: selectedAddLocationId.value === '' },
            { input: addSubLocationSearchInput, condition: !addSubLocationSearchInput.disabled && selectedAddSubLocationId.value === '' },
            { input: assetAddCategorie, condition: !assetAddCategorie.checkValidity() },
            { input: assetQuantity, condition: !assetQuantity.checkValidity() },
            { input: assetAddMrah, condition: !assetAddMrah.checkValidity() },
            { input: assetAddOwner, condition: !assetAddOwner.checkValidity() },
            { input: assetStatus, condition: !/^[A-Za-z0-9]*$/.test(assetStatus.value) },
            { input: assetAddExpandable, condition: !assetAddExpandable.checkValidity() },
            { input: assetAddService, condition: !assetAddService.checkValidity() },
            { input: assetAddDescription, condition: !/^[a-zA-Z0-9\s]*$/.test(assetAddDescription.value) },
            { input: assetAddM2Inside, condition: !assetAddM2Inside.checkValidity() },
            { input: assetAddDatePurchase, condition: assetAddDatePurchase.value.trim() && isNaN(Date.parse(assetAddDatePurchase.value.trim())) },
            { input: assetAddDateWrittenOff, condition: assetAddDateWrittenOff.value.trim() && isNaN(Date.parse(assetAddDateWrittenOff.value.trim())) },
            { input: assetAddPurchasePrice, condition: !assetAddPurchasePrice.checkValidity() },
            { input: assetAddComments, condition: !assetAddComments.checkValidity() },
            { input: assetAddReplacedOff, condition: !assetAddReplacedOff.checkValidity() },
            { input: assetAddReplacedBy, condition: !assetAddReplacedBy.checkValidity() },
            { input: assetAddYearOfLifeCycle, condition: !assetAddYearOfLifeCycle.checkValidity() },
            { input: assetAddRestOfLifeCycle, condition: !assetAddRestOfLifeCycle.checkValidity() },
            { input: assetAddRestValue, condition: !assetAddRestValue.checkValidity() }
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
            assetEps: assetEps.value,
            assetCodeSearch: assetCodeSearch.value,
            assetAddName: assetAddName.value,
            selectedAddTypeId: selectedAddTypeId.value,
            selectedAddLocationId: selectedAddLocationId.value,
            selectedAddSubLocationId: selectedAddSubLocationId.value,
            assetAddCategorie: assetAddCategorie.value,
            assetQuantity: assetQuantity.value,
            assetAddMrah: assetAddMrah.value,
            assetAddOwner: assetAddOwner.value,
            assetStatus: assetStatus.value,
            assetAddExpandable: assetAddExpandable.value,
            assetAddService: assetAddService.value,
            assetAddDescription: assetAddDescription.value,
            assetAddM2Inside: assetAddM2Inside.value,
            assetAddIsFixed: assetAddIsFixed.checked,
            assetAddDatePurchase: assetAddDatePurchase.value,
            assetAddDateWrittenOff: assetAddDateWrittenOff.value,
            assetAddPurchasePrice: assetAddPurchasePrice.value,
            assetAddComments: assetAddComments.value,
            assetAddReplacedOff: assetAddReplacedOff.value,
            assetAddYearOfLifeCycle: assetAddYearOfLifeCycle.value,
            assetAddRestOfLifeCycle: assetAddRestOfLifeCycle.value,
            assetAddReplacedBy: assetAddReplacedBy.value,
            assetAddRestValue: assetAddRestValue.value
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

                responseData = await response.json();

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

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'addAsset';
                    showMess('Info', 'The asset has been added');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while adding the asset');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'Are you sure you want to add this asset?');
    };

    document.getElementById('form3').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: assetAddType, condition: assetAddType.value === '' || !assetAddType.checkValidity() }
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
            assetType: assetAddType.value
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

                responseData = await response.json();

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

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'addAssetType';
                    showMess('Info', 'The asset type has been added');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while adding the asset type');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'Are you sure you want to add this asset type?');
    };

    document.getElementById('form4').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: removeAssetTypeSearchInput, condition: selectedRemoveAssetId.value === '' }
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
            assetTypeId: selectedRemoveAssetId.value
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

                responseData = await response.json();

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

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'removeAssetType';
                    showMess('Info', 'The asset type has been removed');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while removing the asset type');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'Are you sure you want to remove this asset type?');
    };

    document.getElementById('form5').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: lostAssetSearchInput, condition: selectedLostAssetId.value === '' },
            { input: lostItemDescription, condition: !/^[a-zA-Z0-9\s]*$/.test(lostItemDescription.value) },
            { input: lostAssetQuantity, condition: lostAssetQuantity.value === '' || !lostAssetQuantity.checkValidity() }
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
            itemName: lostAssetSearchInput.value,
            description: lostItemDescription.value,
            lostQuantity: lostAssetQuantity.value
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

                responseData = await response.json();

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

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'addLostItem';
                    showMess('Info', 'The lost asset has been reported');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while reporting the lost asset');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'Are you sure you want to report this lost asset?');
    };

    document.getElementById('form6').onsubmit = async (event) => {

        event.preventDefault();

        startLoading();

        try {

            const headers = Array.from(document.querySelectorAll("#assetsTable th"))
                .filter(th => th.style.display !== 'none')
                .map(th => th.querySelector('input').name);

            const response = await fetch(document.getElementById('form6').action, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    selectedDate1: globalSelectDate1,
                    selectedDate2: globalSelectDate2,
                    headers: headers,
                    filtersAssets: globalSearchFilters,
                    filtersAssetsData: globalSearchFiltersDate
                })
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                throw new Error(error.message);
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'report_assets.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

        } catch (error) {
            showMess('Error', error.message || 'Failed to download the report.');

        } finally {
            stopLoading();
        }
    }

    document.getElementById('form7').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: cleanItemName, condition: !/^[a-zA-Z0-9\s.,\/\-:;]+$/.test(cleanItemName.value) },
            { input: cleanItemTotalAmount, condition: cleanItemTotalAmount.value === '' }
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
            itemName: cleanItemName.value,
            totalAmount: cleanItemTotalAmount.value
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

                responseData = await response.json();

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

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'addCleanItem';
                    showMess('Info', 'The clean item is added successfully');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while add the clean item');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'Are you sure you want to add this clean item?');
    };

    document.getElementById('form8').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: removeCleanItemSearchInput, condition: selectedRemoveCleanItemId.value === '' }
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
            itemId: selectedRemoveCleanItemId.value
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

                responseData = await response.json();

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

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'removeCleanItem';
                    showMess('Info', 'The clean item is removed successfully');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while remove the clean item');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'Are you sure you want to remove this clean item?');
    };

    document.getElementById('form9').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: editCleanItemSearchInput, condition: selectedEditCleanItemId.value === '' },
            {
                input: editAmount, condition: editAmount.value === '' ||
                    (!isTotalAmound && parseInt(editAmount.value) > parseInt(cleanItems.find(item => item.id === selectedEditCleanItemId.value).count_get_item))
            }
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
            itemId: selectedEditCleanItemId.value,
            editAmount: editAmount.value,
            isTotalAmound: isTotalAmound
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

                responseData = await response.json();

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

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'editCleanItem';
                    showMess('Info', 'The clean item is change successfully');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while change the clean item');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warnning', 'Are you sure you want to change this clean item?');
    };

    lostItemDescription.addEventListener('input', function () {
        const regex = /^[a-zA-Z0-9\s]*$/;
        const isValid = regex.test(lostItemDescription.value);
        toggleInputValidity(lostItemDescription, isValid);
    });

    const filterToggleBtn = document.querySelector('.dropdown-button');
    const filterOptions = document.querySelector('.dropdown-content');

    let hideDropdownTimeout;

    function showDropdown() {
        clearTimeout(hideDropdownTimeout);
        filterOptions.style.display = 'grid';
    }

    function hideDropdown() {
        hideDropdownTimeout = setTimeout(() => {
            filterOptions.style.display = 'none';
        }, 200); // Small delay to allow transition
    }

    filterToggleBtn.addEventListener('mouseenter', showDropdown);
    filterToggleBtn.addEventListener('mouseleave', hideDropdown);
    filterOptions.addEventListener('mouseenter', showDropdown);
    filterOptions.addEventListener('mouseleave', hideDropdown);

    document.querySelectorAll('.column-toggle').forEach(function (checkbox) {
        checkbox.addEventListener('change', function (event) {
            var columnClass = this.getAttribute('data-column');
            const isChecked = event.target.checked;

            // Count currently visible columns
            const visibleColumns = Array.from(document.querySelectorAll('.column-toggle'))
                .filter(cb => cb.checked);

            // Prevent hiding the last visible column
            if (!isChecked && visibleColumns.length <= 2) {
                this.checked = true; // Re-check the checkbox
                return;
            }

            // Toggle visibility of headers
            document.querySelectorAll(`#assetsTable th.${columnClass}`).forEach(header => {
                header.style.display = isChecked ? '' : 'none';
            });

            // Toggle visibility of table cells
            document.querySelectorAll(`#assetsTable td.${columnClass}`).forEach(td => {
                td.style.display = isChecked ? '' : 'none';
            });
        });
    });

    function setupAccordion(scope = document) {
        const headers = scope.querySelectorAll('.accordion-header');
        const subHeaders = scope.querySelectorAll('.sub-accordion-header');

        function resizeMainBody(mainBody) {
            // Set maxHeight to scrollHeight to fit all open content inside
            mainBody.style.maxHeight = 10 * Number(mainBody.scrollHeight) + 'px';
        }

        headers.forEach(header => {
            header.addEventListener('click', () => {
                const body = header.nextElementSibling;
                const isOpen = body.classList.contains('open');

                // Close other accordions within the same accordion container
                headers.forEach(h => {
                    const b = h.nextElementSibling;
                    if (h !== header && h.closest('.accordion') === header.closest('.accordion')) {
                        h.classList.remove('active');
                        b.classList.remove('open');
                        b.style.maxHeight = null;

                        // Also close sub-accordions inside the closed main accordion
                        const openSubs = b.querySelectorAll('.sub-accordion-header.active');
                        openSubs.forEach(subH => {
                            subH.classList.remove('active');
                            const subBody = subH.nextElementSibling;
                            if (subBody) {
                                subBody.classList.remove('open');
                                subBody.style.maxHeight = null;
                            }
                        });
                    }
                });

                if (isOpen) {
                    header.classList.remove('active');
                    body.classList.remove('open');
                    body.style.maxHeight = null;
                } else {
                    header.classList.add('active');
                    body.classList.add('open');
                    body.style.maxHeight = body.scrollHeight + 'px';
                }
            });
        });

        // Sub accordion logic:
        subHeaders.forEach(subHeader => {
            subHeader.addEventListener('click', () => {
                const subBody = subHeader.nextElementSibling;
                const isSubOpen = subBody.classList.contains('open');

                if (isSubOpen) {
                    subHeader.classList.remove('active');
                    subBody.classList.remove('open');
                    subBody.style.maxHeight = null;
                } else {
                    subHeader.classList.add('active');
                    subBody.classList.add('open');
                    subBody.style.maxHeight = subBody.scrollHeight + 'px';
                }

                // After toggling sub-accordion, resize the main accordion body
                // Find the main accordion body (parent of this subHeader)
                const mainBody = subHeader.closest('.accordion-body'); // assuming this class on main accordion content
                if (mainBody) {
                    resizeMainBody(mainBody);
                }
            });
        });
    }

    document.getElementById("toggleFormButton").addEventListener("click", function () {
        let form = document.getElementById("form5");
        let table = document.getElementById("lostItemsTable");
        let groupNav = document.getElementById("groupNav");

        form.style.display = form.style.display === "none" || form.style.display === "" ? "flex" : "none";
        table.style.display = form.style.display === "flex" ? "none" : "table";

        if (form.style.display === "flex") {
            groupNav.classList.remove('d-flex');
            groupNav.style.display = 'none';
        } else {
            groupNav.classList.add('d-flex');
        }
    });

});