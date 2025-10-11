document.addEventListener('DOMContentLoaded', function () {

    const modal = document.getElementById('roomModal');
    const modalContent = modal.querySelector('.modal-content');

    const modalGlobalMess = document.getElementById('myGlobalMessage');
    const modalGlobalMessContent = modalGlobalMess.querySelector('.modal-content-mess');

    const modalAddDest = document.getElementById('destinationModal');
    const modalAddDestContent = modalAddDest.querySelector('.modal-content');

    const modalRep = document.getElementById('reportViewModal');
    const modalRepContent = modalRep.querySelector('.modal-content-view');

    const modalViewRep = document.getElementById('reportModal');
    const modalViewRepContent = modalViewRep.querySelector('.modal-content-multi-calendar');

    const additionalItemModal = document.getElementById('additionalItemModal');
    const additionalItemModalContent = additionalItemModal.querySelector('.modal-content');

    const modalUploadMultiSoldier = document.getElementById('accommodattionModal');
    const modalUploadMultiSoldierContent = modalUploadMultiSoldier.querySelector('.modal-content');

    const modalDeleteSoldier = document.getElementById('deleteModal');
    const modalDeleteSoldierContent = modalDeleteSoldier.querySelector('.modal-content');

    const modalMove = document.getElementById('moveModal');
    const modalMoveContent = modalMove.querySelector('.modal-content');

    const modalAddSoldier = document.getElementById('addSoldierModal');
    const modalAddSoldierContent = modalAddSoldier.querySelector('.modal-content');

    const modalListSoldier = document.getElementById('soldierListModal');
    const modalListSoldierContent = modalListSoldier.querySelector('.modal-content');

    const modalEditSoldier = document.getElementById('editSoldierModal');
    const modalEditSoldierContent = modalEditSoldier.querySelector('.modal-content');

    const modalUpcomingActionSoldierList = document.getElementById('upcomingActionSoldierListModal');
    const modalUpcomingActionSoldierListContent = modalUpcomingActionSoldierList.querySelector('.modal-content');

    const modalAddMultiSoldier = document.getElementById('uploadModal');
    const modalAddMultiSoldierContent = modalAddMultiSoldier.querySelector('.modal-content');

    const modalRoomAddModal = document.getElementById('roomAddModal');
    const modalRoomAddModalContent = modalRoomAddModal.querySelector('.modal-content');

    const modalRoomAddMultiModal = document.getElementById('uploadRoomModal');
    const modalRoomAddMultiModalContent = modalRoomAddMultiModal.querySelector('.modal-content');

    const modalKeyAddMultiModal = document.getElementById('uploadKeyModal');
    const modalKeyAddMultiModalContent = modalKeyAddMultiModal.querySelector('.modal-content');

    const modalReleaseMultiRoomModal = document.getElementById('releaseRoomsModal');
    const modalReleaseMultiRoomModalContent = modalReleaseMultiRoomModal.querySelector('.modal-content');

    const modalRoomRemoveModal = document.getElementById('roomRemoveModal');
    const modalRoomRemoveModalContent = modalRoomRemoveModal.querySelector('.modal-content');

    const modalKeyAddModal = document.getElementById('keyAddModal');
    const modalKeyAddModalContent = modalKeyAddModal.querySelector('.modal-content');

    const modalKeyRemoveModal = document.getElementById('keyRemoveModal');
    const modalKeyRemoveModalContent = modalKeyRemoveModal.querySelector('.modal-content');

    const modalKey = document.getElementById('keyModal');
    const modalKeyContent = modalKey.querySelector('.modal-content');

    const soldierInput = document.getElementById('soldierSearch');

    const moveButton = document.getElementById('move-button');
    const additionalItemButtoon = document.getElementById('addtional-item-button');
    const additionalItemEditSoldierButtoon = document.getElementById('addtional-item-edit-soldier-button');
    const typeBuild = document.getElementById('typeBuild');

    const soldierSearchInput = document.getElementById('soldierSearch');
    const soldierSearchDropdown = document.getElementById('soldierDropdown');
    const selectedSoldierId = document.getElementById('selectedSoldierId');

    const soldierAccommodationRoomSearchInput = document.getElementById('upcomingAccommodationRoom');
    const soldierAccommodationRoomSearchDropdown = document.getElementById('upcomingAccommodationRoomDropdown');
    const selectedSoldierAccommodationRoomId = document.getElementById('selectedUpcomingAccommodationRoomId');

    const editSoldierAccommodationRoomSearchInput = document.getElementById('editUpcomingAccommodationRoom');
    const editSoldierAccommodationRoomSearchDropdown = document.getElementById('editUpcomingAccommodationRoomDropdown');
    const editSelectedSoldierAccommodationRoomId = document.getElementById('selectedEditUpcomingAccommodationRoomId');

    const additionalItemSoldierSearchInput = document.getElementById('additionalItemSoldierCode');
    const additionalItemSoldierSearchDropdown = document.getElementById('additionalItemSoldierDropdown');
    const additionalItemSelectedSoldierId = document.getElementById('selectedAdditionalItemSoldierId');

    const selectKeyInput = document.getElementById('keySearch');
    const selectKeyDropdown = document.getElementById('keyDropdown');
    const selectedKeyId = document.getElementById('selectedKeyId');
    const newKeyName = document.getElementById('newKeyName');

    const selectAllKeyInput = document.getElementById('allKeySearch');
    const selectAllKeyDropdown = document.getElementById('allKeyDropdown');

    const selectRoomInput = document.getElementById('roomSearch');
    const selectRoomDropdown = document.getElementById('roomDropdown');
    const selectedRoomId = document.getElementById('selectedRoomId');

    const bagSearchInput = document.getElementById('laundryBagSearch');
    const bagSearchDropdown = document.getElementById('bagDropdown');
    const selectedBagId = document.getElementById('selectedBagId');

    const bagSoldierSearchInput = document.getElementById('laundryBagSoldierSearch');
    const bagSoldierSearchDropdown = document.getElementById('bagSoldierDropdown');
    const selectedBagSoldierId = document.getElementById('selectedBagSoldierId');
    const mealCardSoldier = document.getElementById('meal-card-soldier-value');

    const bagEditSoldierSearchInput = document.getElementById('laundryBagEditSoldierSearch');
    const bagEditSoldierSearchDropdown = document.getElementById('bagEditSoldierDropdown');
    const selectedBagEditSoldierId = document.getElementById('selectedBagEditSoldierId');
    const mealCardEditSoldier = document.getElementById('meal-card-edit-soldier-value');

    const additionBagsSearchInput = document.getElementById('additionalBagCode');
    const additionBagsSearchDropdown = document.getElementById('additionalBagCodeDropdown');
    const selectedAdditionBagsId = document.getElementById('selectedAdditionalBagId');

    const additionalItemDescription = document.getElementById('additionalItemDescription');
    const additionalItemQuantity = document.getElementById('additionalItemQuantity');
    const mealCard = document.getElementById('meal-card-value');

    const soldierSearchMoveInput = document.getElementById('soldierSearchMove');
    const soldierSearchMoveDropdown = document.getElementById('soldierDropdownMove');
    const selectedSoldierMoveId = document.getElementById('selectedKeyMoveId');

    const buildId = document.getElementById('build-id');
    const buildName = document.getElementById('build-name');
    const buildType = document.getElementById('build-type');

    const roomId = document.getElementById('room-id');
    const roomName = document.getElementById('room-name');
    const clickBuildNumber = document.getElementById('click-build-number');
    const clickBuild = document.getElementById('click-build');

    const soldierId = document.getElementById('soldier-number');
    const soldierName = document.getElementById('soldier-name');
    const soldierCountry = document.getElementById('soldier-country');
    const soldierDate1 = document.getElementById('addDate1');
    const soldierDate2 = document.getElementById('addDate2');

    const editSoldierId = document.getElementById('edit-soldier-number');
    const editOldSoldierId = document.getElementById('edit-old-soldier-id');
    const editSoldierName = document.getElementById('edit-soldier-name');
    const editSoldierCountry = document.getElementById('edit-soldier-country');
    const editSoldierUpcomeAccom = document.getElementById('edit-upcoming-accommodation');
    const editSoldierUpcomeRel = document.getElementById('edit-upcoming-release');

    const keyId = document.getElementById('key-id');
    const keyName = document.getElementById('key-name');
    const selectedRoomForKey = document.getElementById('selected-room-for-key');

    const deleteBuildId = document.getElementById('selectedBuildId');
    const buildSearchInput = document.getElementById('buildSearch');
    const buildSearchDropdown = document.getElementById('buildDropdown');

    const realCode = document.getElementById('randomTextValue');
    const enterCode = document.getElementById("deleteCode");

    const isAccommodation = document.getElementById('isAccommodation');
    const loadingIndicator = document.getElementById('loadingIndicator');

    const csrfToken = document.getElementsByName('_csrf')[0].value;

    const mainRowsPerPage = 50;
    let mainCurrentPage = 1;
    let selectedBuilding = "";
    let mainSortedPar;
    let mainTotalRows = parseInt(document.getElementById("totalCount").value);
    const mainHeader = document.querySelector(".visualization-header h3");
    let filters = [];

    // Track sort order and priority for each column
    let sortOrder = {
        nameroom: true,
        room_status: true,
        countFreeBeds: true
    };

    const tableBody = document.getElementById("tableBody");
    const pagination = document.getElementById("pagination");
    const isFirstTime = document.getElementsByName("isFirstTime")[0];
    const headerCells = document.querySelectorAll(`#data-table thead th`);

    const mainHeaderMap = {
        'Room Number': 'nameroom',
        'Room Status': 'room_status',
        'Count Free Beds': 'countFreeBeds'
    };

    let soldiers = [];
    let rooms = [];
    let bags = [];
    let allBags = [];
    let specialRooms = [];
    let specialKeys = [];
    let allKeys = [];
    let allBuilds = [];
    let allCheckedRow = [];
    let moveList = [];

    let currentPage = 1;
    let secondCurrentPage = 1;
    let globalUpcomingActionSearchFilters = [];

    let globalSelectDate1 = "";
    let globalSelectDate2 = "";
    let globalSearchFilters = [];
    let globalSearchFiltersDate = [];
    let globalAction = '';
    let globalCleanedRoomNumber = '';

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

    var isWarning = false;

    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

    const checkForGlobalError = (response, responseBody) => {
        if (response.headers.get('X-Global-Error') === 'true')
            window.location.href = `/web/error?statusCode=${responseBody.statusCode}&message=${responseBody.message}&details=${responseBody.details}`;
    };

    const formatDate = (date) => {
        const accommodationDate = new Date(date);
        const year = accommodationDate.getFullYear();
        const month = String(accommodationDate.getMonth() + 1).padStart(2, "0");
        const day = String(accommodationDate.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    // Function to fetch soldier from the server
    async function fetchSpecialRoom(numBuild) {

        startLoading();

        try {
            const response = await fetch(`/web/specialRooms?numBuild=${numBuild}`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message);
                return;
            }

            specialRooms = await response.json(); // Store fetched bikes in the global variable

        } catch (error) {
            showGlobalMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    // Show filtered soldiers in the dropdown
    function filterRoom(query) {
        selectRoomDropdown.innerHTML = '';
        const filteredRoom = specialRooms.filter(room => room.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredRoom.length > 0) {
            selectRoomDropdown.style.display = 'block';
            filteredRoom.forEach(room => {
                const li = document.createElement('li');
                li.textContent = room.name;
                li.setAttribute('data-id', room.id);
                selectRoomDropdown.appendChild(li);
            });
        } else {
            selectRoomDropdown.style.display = 'none';
        }
    }

    // Handle input change
    selectRoomInput.addEventListener('input', function () {
        const query = selectRoomInput.value;
        if (query.length > 0) {
            filterRoom(query);
        } else {
            selectRoomDropdown.style.display = 'none';
            selectedRoomId.value = '';

            toggleInputValidity(selectRoomInput, false);
        }
    });

    // Handle bike selection
    selectRoomDropdown.addEventListener('click', function (event) {
        const selectedRoom = event.target;
        if (selectedRoom && selectedRoom.dataset.id) {

            toggleInputValidity(selectRoomInput, true);

            selectRoomInput.value = selectedRoom.textContent;
            selectedRoomId.value = selectedRoom.getAttribute('data-id');

            selectRoomDropdown.style.display = 'none';
        }
    });

    // Function to fetch soldier from the server
    async function fetchSpecialKey(numRoom) {

        startLoading();

        try {
            const response = await fetch(`/web/specialKeys?numRoom=${numRoom}`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message);
                return;
            }

            specialKeys = await response.json(); // Store fetched bikes in the global variable

        } catch (error) {
            showGlobalMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    // Show filtered soldiers in the dropdown
    function filterKey(query) {
        selectKeyDropdown.innerHTML = '';
        const filteredKey = specialKeys.filter(key => key.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredKey.length > 0) {
            selectKeyDropdown.style.display = 'block';
            filteredKey.forEach(key => {
                const li = document.createElement('li');
                li.textContent = key.name;
                li.setAttribute('data-id', key.id);
                selectKeyDropdown.appendChild(li);
            });
        } else {
            selectKeyDropdown.style.display = 'none';
        }
    }

    // Handle input change
    selectKeyInput.addEventListener('input', function () {
        const query = selectKeyInput.value;
        if (query.length > 0) {
            filterKey(query);
        } else {
            selectKeyDropdown.style.display = 'none';
            selectedKeyId.value = '';

            toggleInputValidity(selectKeyInput, false);
        }
    });

    // Handle bike selection
    selectKeyDropdown.addEventListener('click', function (event) {
        const selectedKey = event.target;
        if (selectedKey && selectedKey.dataset.id) {

            toggleInputValidity(selectKeyInput, true);

            selectKeyInput.value = selectedKey.textContent;
            selectedKeyId.value = selectedKey.getAttribute('data-id');

            selectKeyDropdown.style.display = 'none';
        }
    });

    // Function to fetch all keys from the server
    async function fetchAllKey() {

        startLoading();

        try {
            const response = await fetch(`/web/keys`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message);
                return;
            }

            allKeys = await response.json(); // Store fetched bikes in the global variable

        } catch (error) {
            showGlobalMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    // Show filtered key in the dropdown
    function filterAllKey(query) {
        selectAllKeyDropdown.innerHTML = '';
        const filteredAllKey = allKeys.filter(key =>
            key.name.toLowerCase().includes(query.toLowerCase()) ||
            key.id.toString().includes(query) ||
            key.soldierName.toLowerCase().includes(query.toLowerCase()) ||
            key.maleCard.toString().includes(query) ||
            key.laundryBag.toString().includes(query)
        );

        if (filteredAllKey.length > 0) {
            selectAllKeyDropdown.style.display = 'block';
            filteredAllKey.forEach(key => {
                const li = document.createElement('li');
                li.textContent = `${key.name} (Number: ${key.id})`;
                li.setAttribute('data-id', key.id);
                li.setAttribute('data-name', key.name);
                li.setAttribute('data-name-soldier', key.soldierName);
                li.setAttribute('data-country', key.country);
                li.setAttribute('data-male-card', key.maleCard);
                li.setAttribute('data-laundry-bag', key.laundryBag);

                if (key.isLock) {
                    li.setAttribute('title', 'This key is locked');
                    li.setAttribute('aria-disabled', 'true');
                    li.classList.add('disabled', 'locked');
                    const lockIcon = document.createElement('i');
                    lockIcon.className = 'bi bi-lock ms-2';
                    li.appendChild(lockIcon);
                }

                selectAllKeyDropdown.appendChild(li);
            });
        } else {
            selectAllKeyDropdown.style.display = 'none';
        }
    }

    // Handle input change
    selectAllKeyInput.addEventListener('input', function () {
        const query = selectAllKeyInput.value;
        if (query.length > 0) {
            filterAllKey(query);
        } else {
            selectAllKeyDropdown.style.display = 'none';
        }
    });

    // Handle bike selection
    selectAllKeyDropdown.addEventListener('click', async function (event) {

        const selectedAllKey = event.target;

        if (selectedAllKey && selectedAllKey.dataset.id) {

            const keycode = selectedAllKey.getAttribute('data-id');
            const keynum = selectedAllKey.getAttribute('data-name');
            const soldierName = selectedAllKey.getAttribute('data-name-soldier');
            const country = selectedAllKey.getAttribute('data-country');
            const maleCard = selectedAllKey.getAttribute('data-male-card');
            const laundryBag = selectedAllKey.getAttribute('data-laundry-bag');

            startLoading();

            const response = await fetch(`/web/getKeyBuildigType?keyId=${keycode}`, {
                method: 'GET'
            })
                .then(async response => {

                    if (!response.ok) {
                        const errorData = await response.json();
                        checkForGlobalError(response, errorData);
                        showGlobalMess('Error', errorData.message);
                        return;
                    }
                    return response.json();
                })
                .catch(error => {
                    showGlobalMess('Error', error.message);
                })
                .finally(() => {
                    stopLoading();
                });

            typeBuild.value = response.type;

            globalCleanedRoomNumber = keynum.substring(0, keynum.lastIndexOf('/'));

            // Open the modal with the soldier's cleaned data
            openModal(keynum, soldierName, country, keycode, maleCard, laundryBag);

            selectAllKeyDropdown.style.display = 'none';
            selectAllKeyInput.value = '';
        }
    });

    // Function to fetch soldier from the server
    async function fetchItem() {

        startLoading();

        try {
            const response = await fetch(`/web/clients`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message);
                return;
            }
            soldiers = await response.json(); // Store fetched bikes in the global variable

        } catch (error) {
            showGlobalMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    // Show filtered soldiers in the dropdown
    function filterAdditionalItemSoldiers(query) {
        additionalItemSoldierSearchDropdown.innerHTML = '';
        const filteredSoldier = soldiers.filter(soldier => (soldier.date_accommodation === '' || (soldier.date_accommodation !== '' && soldier.date_free === '')) && soldier.name.toLowerCase().includes(query.toLowerCase()));
        const uniqueSoldiers = Array.from(
            new Map(filteredSoldier.map(s => [s.name.toLowerCase(), s])).values()
        );

        if (uniqueSoldiers.length > 0) {
            additionalItemSoldierSearchDropdown.style.display = 'block';
            uniqueSoldiers.forEach(soldier => {
                const li = document.createElement('li');
                li.textContent = soldier.name;
                li.setAttribute('data-id', soldier.id);
                additionalItemSoldierSearchDropdown.appendChild(li);
            });
        } else {
            additionalItemSoldierSearchDropdown.style.display = 'none';
        }
    }

    additionalItemSoldierSearchInput.addEventListener('input', function () {
        const query = additionalItemSoldierSearchInput.value;
        if (query.length > 0) {
            filterAdditionalItemSoldiers(query);
        } else {
            additionalItemSoldierSearchDropdown.style.display = 'none';
            additionalItemSelectedSoldierId.value = '';
            toggleInputValidity(additionalItemSoldierSearchInput, false);
        }
    });

    // Handle bike selection
    additionalItemSoldierSearchDropdown.addEventListener('click', function (event) {
        const selectedSoldier = event.target;
        if (selectedSoldier && selectedSoldier.dataset.id) {
            additionalItemSoldierSearchInput.value = selectedSoldier.textContent;
            additionalItemSelectedSoldierId.value = selectedSoldier.getAttribute('data-id');
            toggleInputValidity(additionalItemSoldierSearchInput, true);
            additionalItemSoldierSearchDropdown.style.display = 'none';
        }
    });

    // Show filtered soldiers in the dropdown
    function filterSoldiers(query, keynum) {
        soldierSearchDropdown.innerHTML = '';

        let filteredSoldier;

        const isSpecialKey = /^(\d+\/\d+\/E\d*\/\d+|\d+\/D\d*\/\d+)$/.test(keynum);

        if (!isSpecialKey && (typeBuild.value === 'Accommodation' || typeBuild.value === ''))
            filteredSoldier = soldiers.filter(soldier => ((soldier.date_accommodation === '' && soldier.date_free === '') || (soldier.date_accommodation !== '' && soldier.date_free !== '')) && soldier.name.toLowerCase().includes(query.toLowerCase()));
        else
            filteredSoldier = soldiers.filter(soldier => (soldier.name.toLowerCase().includes(query.toLowerCase())));


        const uniqueSoldiers = Array.from(
            new Map(filteredSoldier.map(s => [s.name.toLowerCase(), s])).values()
        );

        if (uniqueSoldiers.length > 0) {
            soldierSearchDropdown.style.display = 'block';
            uniqueSoldiers.forEach(soldier => {
                const li = document.createElement('li');
                li.textContent = soldier.name;
                li.setAttribute('data-id', soldier.id);
                li.setAttribute('data-country', soldier.country);
                li.setAttribute('data-etc', soldier.etc);
                li.setAttribute('data-code', soldier.code);
                li.setAttribute('data-meal-card', soldier.meal_card);
                soldierSearchDropdown.appendChild(li);
            });
        } else {
            soldierSearchDropdown.style.display = 'none';
        }
    }

    function filterUpcomingKey(query, dropDown) {
        dropDown.innerHTML = '';
        const filteredKey = allKeys.filter(key =>
            key.building_type === 'Accommodation' &&
            !/(E|D)[0-9]*/.test(key.name) &&
            !key.isLock &&
            key.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredKey.length > 0) {
            dropDown.style.display = 'block';
            filteredKey.forEach(key => {
                const li = document.createElement('li');
                li.textContent = key.name;
                li.setAttribute('data-id', key.id);
                dropDown.appendChild(li);
            });
        } else {
            dropDown.style.display = 'none';
        }
    }

    // Handle input change
    soldierAccommodationRoomSearchInput.addEventListener('input', function () {
        const query = soldierAccommodationRoomSearchInput.value;
        if (query.length > 0) {
            filterUpcomingKey(query, soldierAccommodationRoomSearchDropdown);
        } else {
            soldierAccommodationRoomSearchDropdown.style.display = 'none';
            selectedSoldierAccommodationRoomId.value = '';
        }
    });

    // Handle bike selection
    soldierAccommodationRoomSearchDropdown.addEventListener('click', function (event) {
        const selectedKey = event.target;
        if (selectedKey && selectedKey.dataset.id) {
            soldierAccommodationRoomSearchInput.value = selectedKey.textContent;
            selectedSoldierAccommodationRoomId.value = selectedKey.getAttribute('data-id');
            soldierAccommodationRoomSearchDropdown.style.display = 'none';
        }

        toggleInputValidity(soldierAccommodationRoomSearchInput, true);
    });

    editSoldierAccommodationRoomSearchInput.addEventListener('input', function () {
        const query = editSoldierAccommodationRoomSearchInput.value;
        if (query.length > 0) {
            filterUpcomingKey(query, editSoldierAccommodationRoomSearchDropdown);
        } else {
            editSoldierAccommodationRoomSearchDropdown.style.display = 'none';
            editSelectedSoldierAccommodationRoomId.value = '';
        }
    });

    // Handle bike selection
    editSoldierAccommodationRoomSearchDropdown.addEventListener('click', function (event) {
        const selectedKey = event.target;
        if (selectedKey && selectedKey.dataset.id) {
            editSoldierAccommodationRoomSearchInput.value = selectedKey.textContent;
            editSelectedSoldierAccommodationRoomId.value = selectedKey.getAttribute('data-id');
            editSoldierAccommodationRoomSearchDropdown.style.display = 'none';
        }

        toggleInputValidity(editSoldierAccommodationRoomSearchInput, true);
    });

    // Function to fetch soldier from the server
    async function fetchFreeBag() {

        startLoading();

        try {
            const responseBag = await fetch(`/web/freeBags`, {
                method: 'GET'
            });

            if (!responseBag.ok) {
                const error = await responseBag.json();
                checkForGlobalError(responseBag, error);
                showGlobalMess('Error', error.message);
                return;
            }

            const data = await responseBag.json(); // Store the parsed JSON response once
            bags = data.bags; // Access Bags from the parsed data

        } catch (error) {
            showGlobalMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    // Function to fetch soldier from the server
    async function fetchBag() {

        startLoading();

        try {
            const responseBag = await fetch(`/web/bags`, {
                method: 'GET'
            });

            if (!responseBag.ok) {
                const error = await responseBag.json();
                checkForGlobalError(responseBag, error);
                showGlobalMess('Error', error.message);
                return;
            }

            const data = await responseBag.json(); // Store the parsed JSON response once
            allBags = data.allBags; // Access allBags from the parsed data

        } catch (error) {
            showGlobalMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    // Show filtered soldiers in the dropdown
    function filterBags(query, dropDownElement) {
        dropDownElement.innerHTML = '';
        const filteredBag = bags.filter(bag => bag.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredBag.length > 0) {
            dropDownElement.style.display = 'block';
            filteredBag.forEach(bag => {
                const li = document.createElement('li');
                li.textContent = bag.name;
                li.setAttribute('data-id', bag.id);
                dropDownElement.appendChild(li);
            });
        } else {
            dropDownElement.style.display = 'none';
        }
    }

    // Handle input change
    bagSearchInput.addEventListener('input', function () {
        const query = bagSearchInput.value;
        if (query.length > 0) {
            filterBags(query, bagSearchDropdown);
        } else {
            bagSearchDropdown.style.display = 'none';
            selectedBagId.value = '';
        }
    });

    // Handle bike selection
    bagSearchDropdown.addEventListener('click', function (event) {
        const selectBag = event.target;
        if (selectBag && selectBag.dataset.id) {
            bagSearchInput.value = selectBag.textContent;
            selectedBagId.value = selectBag.getAttribute('data-id');
            bagSearchDropdown.style.display = 'none';
        }
    });

    bagSoldierSearchInput.addEventListener('input', function () {
        const query = bagSoldierSearchInput.value;
        if (query.length > 0) {
            filterBags(query, bagSoldierSearchDropdown);
        } else {
            bagSoldierSearchDropdown.style.display = 'none';
            selectedBagSoldierId.value = '';
        }
    });

    // Handle bike selection
    bagSoldierSearchDropdown.addEventListener('click', function (event) {
        const selectBag = event.target;
        if (selectBag && selectBag.dataset.id) {
            bagSoldierSearchInput.value = selectBag.textContent;
            selectedBagSoldierId.value = selectBag.getAttribute('data-id');
            bagSoldierSearchDropdown.style.display = 'none';
        }
        toggleInputValidity(bagSoldierSearchInput, true);
    });

    bagEditSoldierSearchInput.addEventListener('input', function () {
        const query = bagEditSoldierSearchInput.value;
        if (query.length > 0) {
            filterBags(query, bagEditSoldierSearchDropdown);
        } else {
            bagEditSoldierSearchDropdown.style.display = 'none';
            selectedBagEditSoldierId.value = '';
        }
    });

    // Handle bike selection
    bagEditSoldierSearchDropdown.addEventListener('click', function (event) {
        const selectBag = event.target;
        if (selectBag && selectBag.dataset.id) {
            bagEditSoldierSearchInput.value = selectBag.textContent;
            selectedBagEditSoldierId.value = selectBag.getAttribute('data-id');
            bagEditSoldierSearchDropdown.style.display = 'none';
        }
        toggleInputValidity(bagEditSoldierSearchInput, true);
    });

    // Show filtered soldiers in the dropdown
    function filterAdditoinalBags(query) {
        additionBagsSearchDropdown.innerHTML = '';
        const filteredBag = bags.filter(bag => bag.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredBag.length > 0) {
            additionBagsSearchDropdown.style.display = 'block';
            filteredBag.forEach(bag => {
                const li = document.createElement('li');
                li.textContent = bag.name;
                li.setAttribute('data-id', bag.id);
                additionBagsSearchDropdown.appendChild(li);
            });
        } else {
            additionBagsSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    additionBagsSearchInput.addEventListener('input', function () {
        const query = additionBagsSearchInput.value;
        if (query.length > 0) {
            filterAdditoinalBags(query);
        } else {
            additionBagsSearchDropdown.style.display = 'none';
            selectedAdditionBagsId.value = '';
            additionalItemQuantity.value = '';
            additionalItemQuantity.removeAttribute('max');
            toggleInputValidity(additionBagsSearchInput, false);
            toggleInputValidity(additionalItemQuantity, false);
        }
    });

    // Handle bike selection
    additionBagsSearchDropdown.addEventListener('click', function (event) {
        const selectBag = event.target;
        if (selectBag && selectBag.dataset.id) {
            additionBagsSearchInput.value = selectBag.textContent;
            selectedAdditionBagsId.value = selectBag.getAttribute('data-id');
            additionalItemQuantity.value = 1;
            additionalItemQuantity.setAttribute('max', 1);
            additionBagsSearchDropdown.style.display = 'none';
            toggleInputValidity(additionBagsSearchInput, true);
            toggleInputValidity(additionalItemQuantity, true);
        }
    });

    // Function to fetch soldier from the server
    async function fetchBuilding() {

        startLoading();

        try {
            const responseBuild = await fetch(`/web/builds`, {
                method: 'GET'
            });

            if (!responseBuild.ok) {
                const error = await responseBuild.json();
                checkForGlobalError(responseBuild, error);
                showGlobalMess('Error', error.message);
                return;
            }

            allBuilds = await responseBuild.json(); // Store the parsed JSON response once

        } catch (error) {
            showGlobalMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    // Show filtered soldiers in the dropdown
    function filterBuilds(query) {
        buildSearchDropdown.innerHTML = '';
        const filteredBuild = allBuilds.filter(build => build.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredBuild.length > 0) {
            buildSearchDropdown.style.display = 'block';
            filteredBuild.forEach(build => {
                const li = document.createElement('li');
                li.textContent = build.name;
                li.setAttribute('data-id', build.id);
                buildSearchDropdown.appendChild(li);
            });
        } else {
            buildSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    buildSearchInput.addEventListener('input', function () {
        const query = buildSearchInput.value;
        if (query.length > 0) {
            filterBuilds(query);
        } else {
            buildSearchDropdown.style.display = 'none';
            deleteBuildId.value = '';
        }
    });

    // Handle bike selection
    buildSearchDropdown.addEventListener('click', function (event) {
        const selectBuild = event.target;
        if (selectBuild && selectBuild.dataset.id) {
            buildSearchInput.value = selectBuild.textContent;
            deleteBuildId.value = selectBuild.getAttribute('data-id');

            toggleInputValidity(buildSearchInput, true);

            buildSearchDropdown.style.display = 'none';
        }
    });

    // Function to fetch room from the server
    async function fetchRoom() {

        startLoading();

        try {
            const response = await fetch(`/web/rooms`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message);
                return;
            }
            rooms = await response.json(); // Store fetched bikes in the global variable

            // Find the room where rooms.id === the last item.keyMoveId in moveList
            const lastMoveItem = moveList[moveList.length - 1];
            const roomToUpdate = moveList.length > 0 ? rooms.find(room => room.id === lastMoveItem.keyMoveId) : '';

            if (roomToUpdate) {
                // Replace the last 2 characters in rooms.name
                rooms.find(room => room.id === moveList[0].keyId).name = rooms.find(room => room.id === moveList[0].keyId).name.slice(0, -2) + '✅';
                rooms.find(room => room.id === lastMoveItem.keyMoveId).name = roomToUpdate.name.slice(0, -2) + '🚫';
            }

        } catch (error) {
            showGlobalMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    // Show filtered soldiers in the dropdown
    function filterRooms(query) {
        soldierSearchMoveDropdown.innerHTML = '';
        const filteredSoldier = rooms.filter(room => room.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredSoldier.length > 0) {
            soldierSearchMoveDropdown.style.display = 'block';
            filteredSoldier.forEach(room => {
                const li = document.createElement('li');
                li.textContent = room.name;
                li.setAttribute('data-id', room.id);
                soldierSearchMoveDropdown.appendChild(li);
            });
        } else {
            soldierSearchMoveDropdown.style.display = 'none';
        }
    }

    // Handle input change
    soldierSearchMoveInput.addEventListener('input', function () {
        const query = soldierSearchMoveInput.value;
        if (query.length > 0) {
            filterRooms(query);
        } else {
            soldierSearchMoveDropdown.style.display = 'none';
            selectedSoldierMoveId.value = '';
        }
    });

    // Handle bike selection
    soldierSearchMoveDropdown.addEventListener('click', async function (event) {
        const selectedSoldier = event.target;
        if (selectedSoldier && selectedSoldier.dataset.id) {

            startLoading();

            toggleInputValidity(soldierSearchMoveInput, true);

            soldierSearchMoveInput.value = selectedSoldier.textContent;
            selectedSoldierMoveId.value = selectedSoldier.getAttribute('data-id');
            soldierSearchMoveDropdown.style.display = 'none';

            const responseSoldier = await fetch(`/web/move/getSoldier?keyId=${selectedSoldierMoveId.value}`, {
                method: 'GET'
            })
                .finally(() => {
                    stopLoading();
                });

            if (!responseSoldier.ok) {
                const error = await responseSoldier.json();
                checkForGlobalError(responseSoldier, error);
                showGlobalMess('Error', error.message);
                return;
            }

            const result = await responseSoldier.json();

            if (moveList.length > 0 && moveList[0].keyId === selectedSoldierMoveId.value) {
                document.getElementById('modal-soldier-2').textContent = `Soldier: None`;
                document.getElementById('selectedSoldMoveId').value = '';

            } else {
                let soldierId = moveList.find(item => item.keyMoveId === selectedSoldierMoveId.value) ?
                    moveList.find(item => item.keyMoveId === selectedSoldierMoveId.value).soldId :
                    result.id;

                let soldierName = soldiers.find(soldier => soldier.id === soldierId) ? soldiers.find(soldier => soldier.id === soldierId).name : 'None';

                document.getElementById('modal-soldier-2').textContent = `Soldier: ${soldierName}`;
                document.getElementById('selectedSoldMoveId').value = soldierId;
            }
        }
    });

    // Fetch the soldier when the script loads
    fetchItem();

    // Fetch the bags when the script loads
    fetchBag();

    // Fetch the free bags when the script loads
    fetchFreeBag();

    // Fetch all keys when the script loads
    fetchAllKey();

    fetchBuilding();

    function openModal(keynum, soldierName, country, keycode, maleCard, laundryBag) {

        // Clean the data by removing unwanted prefixes or suffixes
        soldierName = cleanData(soldierName);
        country = cleanData(country);
        keycode = cleanData(keycode);
        keynum = cleanData(keynum);

        maleCard = maleCard ? cleanData(maleCard) : maleCard;
        laundryBag = laundryBag ? cleanData(laundryBag) : laundryBag;

        // Set the value of the input fields with the cleaned data
        document.getElementById('modal-keycode').textContent = `Key Code: ${keycode}`;
        document.getElementById('key-code-value').value = keycode;
        document.getElementById('country-value').value = country;
        document.getElementById('modal-keynum').textContent = `Key number: ${keynum}`;
        document.getElementById('modal-country').textContent = `Nationality: ${country}`;

        isAccommodation.value = soldierName === "Free" ? '' : true;

        soldierInput.value = soldierName === "Free" ? '' : soldierName;
        selectedSoldierId.value = soldierName === "Free" ? '' : soldiers.find(soldier => soldier.name === soldierInput.value).id;

        const isSpecialKey = /^(\d+\/\d+\/E\d*\/\d+|\d+\/D\d*\/\d+)$/.test(keynum);

        // Handle input change
        soldierSearchInput.addEventListener('input', function () {
            const query = soldierSearchInput.value;
            if (query.length > 0) {
                filterSoldiers(query, keynum);
            } else {
                soldierSearchDropdown.style.display = 'none';
                selectedSoldierId.value = '';
                document.getElementById('modal-country').textContent = "Nationality: Undefined";
            }
        });

        // Handle bike selection
        soldierSearchDropdown.addEventListener('click', function (event) {
            const selectedSoldier = event.target;
            if (selectedSoldier && selectedSoldier.dataset.id) {
                soldierSearchInput.value = selectedSoldier.textContent;
                selectedSoldierId.value = selectedSoldier.getAttribute('data-id');
                document.getElementById('modal-country').textContent = "Nationality: " + selectedSoldier.getAttribute('data-country');
                document.getElementById('country-value').value = selectedSoldier.getAttribute('data-country');
                bagSearchInput.value = selectedSoldier.getAttribute('data-code');
                selectedBagId.value = selectedSoldier.getAttribute('data-etc');
                mealCard.value = selectedSoldier.getAttribute('data-meal-card');
                soldierSearchDropdown.style.display = 'none';
            }
        });

        if (!isSpecialKey && (typeBuild.value === 'Accommodation' || typeBuild.value === '')) {
            handleSoldierInputs(soldierName);

            document.getElementById('search-laundry-bag-container').style.display = 'block';
            document.getElementById('input-meal-card').style.display = 'block';

            bagSearchInput.value = laundryBag === "Undefined" ? '' : laundryBag;
            selectedBagId.value = laundryBag === "Undefined" ? '' : allBags.find(bag => bag.name === bagSearchInput.value).id;

            mealCard.value = maleCard === "Undefined" ? '' : maleCard;

        } else {
            handleOtherInputs();

            document.getElementById('search-laundry-bag-container').style.display = 'none';
            document.getElementById('input-meal-card').style.display = 'none';
        }

        typeBuild.value = document.getElementById('previewTypeBuild').value;

        function handleOtherInputs() {
            moveButton.style.display = 'none';
            additionalItemButtoon.style.display = 'none';
        }

        function handleSoldierInputs(soldierName) {
            if (soldierName === 'Free') {

                soldierInput.value = '';
                selectedSoldierId.value = '';

            } else {

                soldierInput.value = soldierName;
                selectedSoldierId.value = soldiers.find(soldier => soldier.name === soldierInput.value).id;

            }

            moveButton.style.display = 'block';
            additionalItemButtoon.style.display = 'block';
        }

        additionalItemButtoon.setAttribute('soldier-id', selectedSoldierId.value);

        // Add the slide-in effect by adding the necessary classes
        modal.classList.add('show');
        modalContent.classList.add('show');
        modalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalContent.classList.remove('slide-out');
    }

    async function fetchListKeys(cleanedRoomNumber, page = 1, limit = 10, searchFilters = []) {

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();

        startLoading();

        try {

            const searchParams = new URLSearchParams({
                roomNumber: cleanedRoomNumber,
                page,
                limit
            });

            searchFilters.forEach(filter => {
                searchParams.append('searchColumn', filter.column);
                searchParams.append('searchValue', filter.value);
            });

            const response = await fetch(`/web/getRoomKeys?${searchParams.toString()}`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message);
                return;
            }

            const { keyListData, totalKeyListData } = await response.json();

            const tableBody = document.querySelector("#keyModal .modal-content tbody");
            const header_tr = document.querySelector("#keyModal .modal-content thead tr");
            const headerCells = Array.from(header_tr.children);
            const lastTwoCells = headerCells.slice(-2);
            const isSpecialKey = /^(\d+\/\d+\/E\d*|\d+\/D\d*)$/.test(cleanedRoomNumber);
            const isAccommodation = typeBuild.value === 'Accommodation' || typeBuild.value === '';

            tableBody.innerHTML = "";

            if (isAccommodation && !isSpecialKey)
                lastTwoCells.forEach(cell => { cell.style.display === 'none' ? cell.style.display = 'table-cell' : '' });
            else
                lastTwoCells.forEach(cell => { cell.style.display = 'none' });

            const headerCheckbox = document.createElement('input');
            headerCheckbox.type = 'checkbox';
            headerCheckbox.className = 'form-check-input header-checkbox';
            headerCheckbox.style.border = '1px solid black';
            headerCheckbox.style.backgroundColor = '';

            headerCheckbox.addEventListener('change', (event) => {
                headerCheckbox.style.backgroundColor = event.target.checked ? 'green' : '';
                const isChecked = event.target.checked;

                // Get all visible rows
                const visibleRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => row.style.display !== 'none');

                visibleRows.forEach(row => {
                    const checkbox = row.querySelector('.form-check-input');
                    if (checkbox) {
                        checkbox.checked = isChecked;
                        checkbox.style.backgroundColor = isChecked ? 'green' : '';
                        const keyId = checkbox.getAttribute('data-id');
                        if (isChecked) {
                            allCheckedRow.push({ code: keyId });
                        } else {
                            allCheckedRow = allCheckedRow.filter(item => item.code !== keyId);
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
            const thead = tableBody.parentElement.querySelector('thead');
            const headerRow = thead.querySelector('tr');

            headerRow.querySelectorAll('th').forEach(th => {
                if (!th.textContent.trim()) {
                    th.remove();
                }
            });

            const headerCell = document.createElement('th');
            headerCell.appendChild(headerCheckbox);
            headerRow.insertBefore(headerCell, headerRow.firstChild);

            keyListData.forEach(item => {
                const row = document.createElement("tr");
                row.classList.add("data-room-key");

                // Handle Accommodation logic
                const isDisabled = isAccommodation && !isSpecialKey && item.location_key === null;

                if (isAccommodation && !isSpecialKey) {
                    if (isDisabled) {
                        row.classList.add("disabled-row");
                        row.setAttribute("aria-disabled", "true");

                        row.addEventListener("click", function (event) {
                            event.stopPropagation();
                            event.preventDefault();
                        });
                    } else {
                        row.addEventListener("click", function (event) {
                            if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0)
                                openModal(
                                    item.namekey,
                                    item.namesoldier || "Free",
                                    item.country || "Undefined",
                                    item.code,
                                    item.mealcard || "Undefined",
                                    item.lbcode || "Undefined"
                                );
                        });
                    }

                    row.innerHTML = `
                        <td></td> <!-- Placeholder for checkbox -->
                        <td>${item.namekey}</td>
                        <td>${item.code}</td>
                        <td class="${!item.namesoldier ? "undefined-data" : ""}">${item.namesoldier || "Free"}</td>
                        <td class="${!item.country ? "undefined-data" : ""}">${item.country || "Undefined"}</td>
                        <td class="mealcard-column ${!item.mealcard ? "undefined-data" : ""}">${item.mealcard || "Undefined"}</td>
                        <td class="lbcode-column ${!item.lbcode ? "undefined-data" : ""}">${item.lbcode || "Undefined"}</td>`;
                } else {
                    row.innerHTML = `
                        <td></td> <!-- Placeholder for checkbox -->
                        <td>${item.namekey}</td>
                        <td>${item.code}</td>
                        <td class="${!item.namesoldier ? "undefined-data" : ""}">${item.namesoldier || "Free"}</td>
                        <td class="${!item.country ? "undefined-data" : ""}">${item.country || "Undefined"}</td>`;

                    row.addEventListener('click', function () {
                        openModal(
                            item.namekey,
                            item.namesoldier || "Free",
                            item.country || "Undefined",
                            item.code
                        );
                    });
                }

                // Now insert the checkbox into the first cell
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input';
                checkbox.dataset.id = item.code;
                checkbox.style.border = '1px solid black';

                if (allCheckedRow.some(i => i.code === item.code)) {
                    checkbox.style.backgroundColor = 'green';
                    checkbox.checked = true;
                }

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        checkbox.style.backgroundColor = 'green';
                        allCheckedRow.push({ code: item.code });
                    } else {
                        checkbox.style.backgroundColor = '';
                        allCheckedRow = allCheckedRow.filter(row => row.code !== item.code);
                    }
                });

                // Insert checkbox into the first <td>
                const firstCell = row.querySelector('td');
                if (firstCell) firstCell.appendChild(checkbox);

                tableBody.appendChild(row);
            });

            const rowsTable = tableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumberFifth');

            setupTableNavigation("keyListTable", "prevBtnFifth", "nextBtnFifth", "pageNumberFifth", limit, totalKeyListData, page, searchFilters, [], cleanedRoomNumber);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showGlobalMess('Error', 'An error occurred while fetching keys items. Please try again later.');

        } finally {
            stopLoading();
        };

    }

    function openModalKey(roomNumber) {
        // Remove all slashes from roomNumber
        const cleanedRoomNumber = roomNumber.trim();
        globalCleanedRoomNumber = cleanedRoomNumber;
        selectedRoomForKey.value = cleanedRoomNumber;

        // Fetch the keys when the script loads
        fetchSpecialKey(cleanedRoomNumber);

        // Add the slide-in effect by adding the necessary classes
        modalKey.classList.add('show');
        modalKeyContent.classList.add('show');
        modalKeyContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalKeyContent.classList.remove('slide-out');

        currentPage = 1;

        const headerDate = {
            'Number Key': 'namekey',
            'Key code': 'k.id',
            'Soldier': 'namesoldier',
            'Nationality': 'country',
            'Meal card': 'meal_card',
            'Laundry bag': 'lb.code'
        };

        rewriteTableSearch('.search-input-key-list', 'keyListTable', headerDate, "", "", cleanedRoomNumber);

        fetchListKeys(cleanedRoomNumber);
    }

    function setupTableNavigation(tableId, prevBtnId, nextBtnId, pageNumberId, rowsPerPage = 10, totalPages, page, searchFilters = [], searchFiltersMove = [], cleanedRoomNumber = "", selectDate1 = "", selectDate2 = "") {

        document.getElementById(`${pageNumberId}`).textContent = `${page}/${totalPages}`;

        switch (tableId) {
            case 'additonalItemTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchAdditionalItem(currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchAdditionalItem(currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'upcomingActionTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchUpcomingAction(currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchUpcomingAction(currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'soldierTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchSoldierList(currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchSoldierList(currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'keyListTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchListKeys(cleanedRoomNumber, currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchListKeys(cleanedRoomNumber, currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'soldierUsageTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersMove);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersMove);
                    }
                };
                break;

            case 'soldierMoveTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (secondCurrentPage > 1) {
                        secondCurrentPage--;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersMove);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (secondCurrentPage < totalPages) {
                        secondCurrentPage++;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersMove);
                    }
                };
                break;
        };
    }

    function rewriteTableSearch(className, tableName, headerMap, selectDate1 = "", selectDate2 = "", cleanedRoomNumber = "") {

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

                    case 'additonalItemTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchAdditionalItem(currentPage, 10, searchFilters);
                        break;

                    case 'upcomingActionTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        globalUpcomingActionSearchFilters = searchFilters;
                        fetchUpcomingAction(currentPage, 10, searchFilters);
                        break;

                    case 'soldierTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchSoldierList(currentPage, 10, searchFilters);
                        break;

                    case 'keyListTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchListKeys(cleanedRoomNumber, currentPage, 10, searchFilters);
                        break;

                    case 'soldierUsageTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        globalSearchFilters = searchFilters;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, 10, searchFilters, globalSearchFiltersDate);
                        break;

                    case 'soldierMoveTable':
                        secondCurrentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        globalSearchFiltersDate = searchFilters;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, 10, globalSearchFilters, searchFilters);
                        break;
                }
            }, 400));
        });
    }

    async function fetchAdditionalItem(page = 1, limit = 10, searchFilters = []) {

        const soldierId = additionalItemButtoon.getAttribute('soldier-id') || additionalItemEditSoldierButtoon.getAttribute('soldier-id');
        additionalItemSoldierSearchInput.value = soldierId ? soldiers.filter(soldier => soldier.id === soldierId)[0].name : '';
        additionalItemSelectedSoldierId.value = soldierId;

        const tableBody = document.getElementById("additionalItemTableBody");
        tableBody.innerHTML = "";

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();

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

            const response = await fetch(`/web/accommodation/getAllAdditionalItem?${searchParams.toString()}`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message);
                return;
            }

            const { allAdditionalItems, totalAdditionalItems } = await response.json();

            allAdditionalItems.forEach(item => {
                const row = document.createElement("tr");

                const soldierCell = document.createElement("td");
                soldierCell.textContent = item.soldierName;
                soldierCell.classList.add("text-wrap");
                soldierCell.style = "max-width: 200px;";
                row.appendChild(soldierCell);

                const descriptionCell = document.createElement("td");
                descriptionCell.textContent = item.description;
                descriptionCell.classList.add("text-wrap");
                descriptionCell.style = "max-width: 200px;";
                row.appendChild(descriptionCell);

                const codeCell = document.createElement("td");
                codeCell.textContent = item.code || "N/A";
                codeCell.classList.add("text-wrap");
                codeCell.style = "max-width: 200px;";
                row.appendChild(codeCell);

                const quantityCell = document.createElement("td");
                quantityCell.textContent = item.quantity;
                quantityCell.classList.add("text-wrap");
                quantityCell.style = "max-width: 200px;";
                row.appendChild(quantityCell);

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
                    quantityInput.value = item.quantity;
                    quantityInput.min = 1;
                    quantityInput.max = item.quantity;
                    quantityInput.style.marginBottom = '10px';

                    quantityInput.addEventListener('input', function () {
                        const isValid = quantityInput.value > 0 && quantityInput.value <= item.quantity;
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
                                id: item.id,
                                quantity: quantityInput.value
                            };

                            const response = await fetch('/web/accommodation/returnAddtionalItem', {
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

                            closeGlobalMessModal();

                        } catch (error) {
                            hasError = true;
                        } finally {
                            stopLoading();
                        }
                    });

                    modalGlobalMessContent.appendChild(quantityInput);
                    modalGlobalMessContent.appendChild(submitButton);

                    // Wait for the modal to close, then check if the submit button was clicked
                    const observer = new MutationObserver(() => {
                        if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                            observer.disconnect();

                            if (modalGlobalMessContent.contains(submitButton)) {
                                // Check if the button is still a child before removing
                                modalGlobalMessContent.removeChild(submitButton);
                            }

                            if (modalGlobalMessContent.contains(quantityInput)) {
                                // Check if the input is still a child before removing
                                modalGlobalMessContent.removeChild(quantityInput);
                            }
                        }
                    });

                    observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

                    // Close the warning modal and show appropriate messages based on the result
                    const closeWarningObserver = new MutationObserver(() => {
                        if (!modalGlobalMess.classList.contains('show')) {
                            closeWarningObserver.disconnect();

                            if (isSubmit && !hasError) {
                                globalAction = 'returnAddtionalItem';
                                showGlobalMess('Info', 'The item has been returned or reduced successfully');
                            } else if (isSubmit) {
                                showGlobalMess('Error', responseData.message || 'An error occurred while restoring or reducing the item');
                            }

                            if (modalGlobalMessContent.contains(quantityInput)) {
                                // Check if the input is still a child before removing
                                modalGlobalMessContent.removeChild(quantityInput);
                            }
                        }
                    });

                    closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

                    // Show the warning modal
                    showGlobalMess('Warning', 'Are you sure you want to return this additional item?\nPlease enter the quantity of items who you want to return.');
                });

                tableBody.appendChild(row);

            });

            const rowsTable = tableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumberTherd');

            setupTableNavigation("additonalItemTable", "prevBtnTherd", "nextBtnTherd", "pageNumberTherd", limit, totalAdditionalItems, page, searchFilters);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showGlobalMess('Error', 'An error occurred while fetching additional items. Please try again later.');

        } finally {
            stopLoading();
        };

    }

    function openAdditionalItemModal() {

        currentPage = 1;

        const headerDate = {
            'Soldier name': 's.namesoldier',
            'Description': 'ai.description',
            'Bag code': 'lb.code',
            'Item quantity': 'ai.quantity'
        };

        rewriteTableSearch('.additional-item-search-input', 'additonalItemTable', headerDate);

        fetchAdditionalItem();

        additionalItemModal.classList.add('show');
        additionalItemModalContent.classList.add('show');
        additionalItemModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        additionalItemModalContent.classList.remove('slide-out');
    }

    function closeAdditionalItemModal() {
        // Add the slide-out effect
        additionalItemModalContent.classList.add('slide-out');
        additionalItemModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.additional-item-search-input').forEach((input) => {
                input.value = '';
            });

            document.querySelectorAll('#additionalItemModal .form-control').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';
            });

            additionalItemSelectedSoldierId.value = '';
            selectedAdditionBagsId.value = '';

            additionalItemModal.classList.remove('show');
            additionalItemModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openViewReportModal() {
        modalViewRep.classList.add('show');
        modalViewRepContent.classList.add('show');
        modalViewRepContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalViewRepContent.classList.remove('slide-out');
    }

    function closeViewReportModal() {
        // Add the slide-out effect
        modalViewRepContent.classList.add('slide-out');
        modalViewRepContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            const listItems = document.querySelectorAll('.dates li');
            listItems.forEach(li => li.classList.remove('selected'));

            document.getElementById('selectedDate1').value = '';
            document.getElementById('selectedDate2').value = '';

            modalViewRep.classList.remove('show');
            modalViewRepContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openViewModal() {

        // Add the slide-in effect by adding the necessary classes
        modalRep.classList.add('show');
        modalRepContent.classList.add('show');
        modalRepContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalRepContent.classList.remove('slide-out');

        // Clear existing rows from bike usage details table
        const soldierUsageTableBody = document.getElementById('soldierUsageTable').getElementsByTagName('tbody')[0];
        soldierUsageTableBody.innerHTML = ''; // Clear all existing rows

        // Clear existing rows from bike usage details table
        const soldierMoveTableBody = document.getElementById('soldierMoveTable').getElementsByTagName('tbody')[0];
        soldierMoveTableBody.innerHTML = ''; // Clear all existing rows

    }

    function closeViewModal() {

        Array.from(document.getElementsByClassName('search-input-view')).forEach(item => {
            item.value = '';
        });

        Array.from(document.getElementsByClassName('search-input-view-second')).forEach(item => {
            item.value = '';
        });

        // Add the slide-out effect
        modalRepContent.classList.add('slide-out');
        modalRepContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            modalRep.classList.remove('show');
            modalRepContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAddSoldierModal() {

        // Add the slide-in effect by adding the necessary classes
        modalAddSoldier.classList.add('show');
        modalAddSoldierContent.classList.add('show');
        modalAddSoldierContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalAddSoldierContent.classList.remove('slide-out');
    }

    function closeAddSoldierModal() {
        // Add the slide-out effect
        modalAddSoldierContent.classList.add('slide-out');
        modalAddSoldierContent.classList.remove('slide-in');

        document.querySelectorAll(`
            #soldier-number, 
            #soldier-name, 
            #soldier-country,
            #upcomingAccommodationRoom,
            #selectedUpcomingAccommodationRoomId,
            #addDate1, 
            #addDate2, 
            #laundryBagSoldierSearch, 
            #selectedBagSoldierId, 
            #meal-card-soldier-value`).forEach((input) => {

            input.classList.remove('is-valid');
            input.classList.remove('is-invalid');

            input.value = '';

        });

        soldierAccommodationRoomSearchDropdown.style.display = 'none';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalAddSoldier.classList.remove('show');
            modalAddSoldierContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)

    }

    async function fetchSoldierList(page = 1, limit = 10, searchFilters = []) {

        const tbody = document.getElementById('tableBodyModal');
        const assetTableBody = document.getElementById('soldierTable').getElementsByTagName('tbody')[0];
        tbody.innerHTML = '';

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();

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

            const response = await fetch(`/web/clients?${searchParams.toString()}`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message);
                return;
            }

            let { soldierListData, totalSoldierListData } = await response.json();

            soldierListData = Array.from(
                new Map(soldierListData.map(s => [s.name.toLowerCase(), s])).values()
            );

            const headerCheckbox = document.createElement('input');
            headerCheckbox.type = 'checkbox';
            headerCheckbox.className = 'form-check-input header-checkbox';
            headerCheckbox.style.border = '1px solid black';
            headerCheckbox.style.backgroundColor = '';

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

            soldierListData.forEach(item => {
                const row = document.createElement("tr");
                row.classList.add('data-soldier');

                // Add the checkbox cell
                const checkboxCell = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input';
                checkbox.dataset.id = item.id;
                checkbox.style.border = '1px solid black'; // Make the border more bold

                if (allCheckedRow.some(i => i.code === item.code)) {
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

                // Room status cell
                const countryCell = document.createElement("td");
                countryCell.textContent = item.country;
                countryCell.classList.add("text-wrap");
                countryCell.style = "max-width: 200px;";
                row.appendChild(countryCell);

                const upcomingKeyCell = document.createElement("td");
                upcomingKeyCell.textContent = item.upcoming_key || "N/A";
                upcomingKeyCell.classList.add("text-wrap");
                upcomingKeyCell.style = "max-width: 200px;";
                row.appendChild(upcomingKeyCell);

                const bagCodeCell = document.createElement("td");
                bagCodeCell.textContent = item.code || "N/A";
                bagCodeCell.classList.add("text-wrap");
                bagCodeCell.style = "max-width: 200px;";
                row.appendChild(bagCodeCell);

                const mealCardCell = document.createElement("td");
                mealCardCell.textContent = item.meal_card || "N/A";
                mealCardCell.classList.add("text-wrap");
                mealCardCell.style = "max-width: 200px;";
                row.appendChild(mealCardCell);

                const upcoming_accommodation = document.createElement("td");
                const accommodationDate = new Date(item.upcoming_accommodation);
                upcoming_accommodation.textContent = item.upcoming_accommodation
                    ? formatDate(accommodationDate)
                    : 'N/A';
                upcoming_accommodation.classList.add("text-wrap");
                upcoming_accommodation.style = "max-width: 200px;";
                row.appendChild(upcoming_accommodation);

                const upcoming_release = document.createElement("td");
                const releaseDate = new Date(item.upcoming_release);
                upcoming_release.textContent = item.upcoming_release
                    ? formatDate(releaseDate)
                    : 'N/A';
                upcoming_release.classList.add("text-wrap");
                upcoming_release.style = "max-width: 200px;";
                row.appendChild(upcoming_release);

                // Attach click event for each row
                row.addEventListener('click', (event) => {
                    // Check if the clicked element is not the first td in the row
                    if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0) {
                        openEditSoldierModal(item.id, item.name, item.country, item.upcoming_key, item.code, item.etc, item.meal_card, item.upcoming_accommodation, item.upcoming_release);
                    }
                });

                // Append row to the table body
                tbody.appendChild(row);
            });

            const rowsTable = assetTableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumberSecond');

            setupTableNavigation("soldierTable", "prevBtnSecond", "nextBtnSecond", "pageNumberSecond", limit, totalSoldierListData, page, searchFilters);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showGlobalMess('Error', 'An error occurred while fetching upcoming data. Please try again later.');

        } finally {
            stopLoading();
        };
    }

    function openSoldierListModal() {

        // Add the slide-in effect by adding the necessary classes
        modalListSoldier.classList.add('show');
        modalListSoldierContent.classList.add('show');
        modalListSoldierContent.classList.add('slide-in');

        currentPage = 1;

        const headerDate = {
            'Soldier number': 's.id',
            'Soldier name': 'namesoldier',
            'Soldier country': 'country',
            'Upcoming key': 'upcoming_key',
            'Bag code': 'code',
            'Meal card': 'meal_card',
            'Upcoming accommodation date': 'upcoming_accommodation',
            'Upcoming release date': 'upcoming_release'
        };

        rewriteTableSearch('.search-input-soldier', 'soldierTable', headerDate);

        fetchSoldierList();

        modalListSoldierContent.classList.remove('slide-out');
    }

    function closeSoldierListModal() {
        // Add the slide-out effect
        modalListSoldierContent.classList.add('slide-out');
        modalListSoldierContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.form-check-input').forEach((input) => {
                input.checked = false;
                input.style.backgroundColor = '';
            });

            allCheckedRow = [];

            document.querySelectorAll('.search-input-soldier').forEach((input) => {
                input.value = '';
            });

            modalListSoldier.classList.remove('show');
            modalListSoldierContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)

    }

    function openEditSoldierModal(id, name, country, upcommig_key, code, etc, meal_card, upcoming_accommodation, upcoming_release) {

        function convertDate(date) {
            const dateObj = new Date(date);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const day = String(dateObj.getDate()).padStart(2, "0");

            return `${year}-${month}-${day}`;
        }

        // Add the slide-in effect by adding the necessary classes
        modalEditSoldier.classList.add('show');
        modalEditSoldierContent.classList.add('show');
        modalEditSoldierContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalEditSoldierContent.classList.remove('slide-out');

        document.getElementById('edit-soldier-number').value = id;
        document.getElementById('edit-old-soldier-id').value = id;
        document.getElementById('edit-soldier-name').value = name;
        document.getElementById('edit-soldier-country').value = country === 'None' ? '' : country;
        document.getElementById('editUpcomingAccommodationRoom').value = upcommig_key === 'N/A' ? '' : upcommig_key;
        document.getElementById('selectedEditUpcomingAccommodationRoomId').value = allKeys.find(key => key.name === upcommig_key) ? allKeys.find(key => key.name === upcommig_key).id : '';
        document.getElementById('laundryBagEditSoldierSearch').value = code === 'N/A' ? '' : code;
        document.getElementById('selectedBagEditSoldierId').value = etc;
        document.getElementById('meal-card-edit-soldier-value').value = meal_card === 'N/A' ? '' : meal_card;

        additionalItemEditSoldierButtoon.setAttribute('soldier-id', id);

        const accommodationDate = new Date(upcoming_accommodation);
        const releaseDate = new Date(upcoming_release);

        editSoldierUpcomeAccom.value = convertDate(accommodationDate);
        editSoldierUpcomeRel.value = convertDate(releaseDate);
    }

    function closeEditSoldierModal() {
        // Add the slide-out effect
        modalEditSoldierContent.classList.add('slide-out');
        modalEditSoldierContent.classList.remove('slide-in');

        document.querySelectorAll(`
            #edit-soldier-number, 
            #edit-soldier-name, 
            #edit-soldier-country, 
            #edit-upcoming-accommodation, 
            #edit-upcoming-release, 
            #laundryBagEditSoldierSearch, 
            #selectedBagEditSoldierId,
            #meal-card-edit-soldier-value,
            #editUpcomingAccommodationRoom,
            #selectedEditUpcomingAccommodationRoomId`).forEach((input) => {

            input.classList.remove('is-valid');
            input.classList.remove('is-invalid');

            input.value = '';

        });

        editSoldierAccommodationRoomSearchDropdown.style.display = 'none';
        additionalItemEditSoldierButtoon.removeAttribute('soldier-id');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalEditSoldier.classList.remove('show');
            modalEditSoldierContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    async function fetchUpcomingAction(page = 1, limit = 10, searchFilters = []) {

        const tbody = document.getElementById('upcomingActionTableBodyModal');
        const upcomingActionTableBody = document.getElementById('upcomingActionTable').getElementsByTagName('tbody')[0];
        tbody.innerHTML = '';

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();

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

            const response = await fetch(`/web/getUpcomingAction?${searchParams.toString()}`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message);
                return;
            }

            const { upcomingActionData, totalUpcomingAction } = await response.json();

            upcomingActionData.forEach(item => {
                const row = document.createElement("tr");
                row.classList.add('data-upcoming-action');

                // Room status cell
                const nameCell = document.createElement("td");
                nameCell.textContent = item.name;
                nameCell.classList.add("text-wrap");
                nameCell.style = "max-width: 200px;";
                row.appendChild(nameCell);

                const bagCell = document.createElement("td");
                bagCell.textContent = item.code || 'N/A';
                bagCell.classList.add("text-wrap");
                bagCell.style = "max-width: 200px;";
                row.appendChild(bagCell);

                const mealCardCell = document.createElement("td");
                mealCardCell.textContent = item.meal_card || 'N/A';
                mealCardCell.classList.add("text-wrap");
                mealCardCell.style = "max-width: 200px;";
                row.appendChild(mealCardCell);

                const upcoming_key = document.createElement("td");
                upcoming_key.textContent = allKeys.find(key => key.id === item.upcoming_accommodation_key)
                    ? allKeys.find(key => key.id === item.upcoming_accommodation_key).name
                    : 'N/A';
                upcoming_key.classList.add("text-wrap");
                upcoming_key.style = "max-width: 200px;";
                row.appendChild(upcoming_key);

                const upcoming_accommodation = document.createElement("td");
                const accommodationDate = formatDate(item.upcoming_accommodation);
                upcoming_accommodation.textContent = item.upcoming_accommodation
                    ? accommodationDate
                    : 'N/A';
                upcoming_accommodation.classList.add("text-wrap");
                upcoming_accommodation.style = "max-width: 200px;";
                row.appendChild(upcoming_accommodation);

                const upcoming_release = document.createElement("td");
                const releaseDate = formatDate(item.upcoming_release);
                upcoming_release.textContent = item.upcoming_release
                    ? releaseDate
                    : 'N/A';
                upcoming_release.classList.add("text-wrap");
                upcoming_release.style = "max-width: 200px;";
                row.appendChild(upcoming_release);

                // Append row to the table body
                tbody.appendChild(row);
            });

            const rowsTable = upcomingActionTableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumberFourth');

            setupTableNavigation("upcomingActionTable", "prevBtnFourth", "nextBtnFourth", "pageNumberFourth", limit, totalUpcomingAction, page, searchFilters);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showGlobalMess('Error', 'An error occurred while fetching upcoming data. Please try again later.');

        } finally {
            stopLoading();
        };
    }

    function openUpcomingActionSoldierListModal() {

        currentPage = 1;

        const headerDate = {
            'Soldier name': 's.namesoldier',
            'Bag code': 'l.code',
            'Meal card': 's.meal_card',
            'Upcoming key': 'k.namekey',
            'Upcoming accommodation date': 's.upcoming_accommodation',
            'Upcoming release date': 's.upcoming_release'
        };

        rewriteTableSearch('.search-input-upcoming-action', 'upcomingActionTable', headerDate);

        fetchUpcomingAction();

        // Add the slide-in effect by adding the necessary classes
        modalUpcomingActionSoldierList.classList.add('show');
        modalUpcomingActionSoldierListContent.classList.add('show');
        modalUpcomingActionSoldierListContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalUpcomingActionSoldierListContent.classList.remove('slide-out');
    }

    function closeUpcomingActionSoldierListModal() {
        // Add the slide-out effect
        modalUpcomingActionSoldierListContent.classList.add('slide-out');
        modalUpcomingActionSoldierListContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalUpcomingActionSoldierList.classList.remove('show');
            modalUpcomingActionSoldierListContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)

    }

    function openAddMultiSoldierModal() {

        // Add the slide-in effect by adding the necessary classes
        modalAddMultiSoldier.classList.add('show');
        modalAddMultiSoldierContent.classList.add('show');
        modalAddMultiSoldierContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalAddMultiSoldierContent.classList.remove('slide-out');
    }

    function closeAddMultiSoldierModal() {
        // Add the slide-out effect
        modalAddMultiSoldierContent.classList.add('slide-out');
        modalAddMultiSoldierContent.classList.remove('slide-in');

        document.getElementById("progress").style.width = 0 + "%";
        document.getElementById("fileInput").value = '';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalAddMultiSoldier.classList.remove('show');
            modalAddMultiSoldierContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)

    }

    function openMoveModal(roomNumber1, soldierName1) {

        // Add the slide-in effect by adding the necessary classes
        modalMove.classList.add('show');
        modalMoveContent.classList.add('show');
        modalMoveContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalMoveContent.classList.remove('slide-out');

        // Fetch the rooms when the script loads
        fetchRoom();

        document.getElementById('modal-move-room-1').textContent = roomNumber1;
        document.getElementById('modal-soldier-1').textContent = `Soldier: ${soldierName1}`;
        document.getElementById('previewKey').value = document.getElementById('key-code-value').value;
        document.getElementById('previewSoldier').value = selectedSoldierId.value;
    }

    function closeMoveModal() {

        // Add the slide-out effect
        modalMoveContent.classList.add('slide-out');
        modalMoveContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalMove.classList.remove('show');
            modalMoveContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)

        soldierSearchMoveInput.classList.remove("is-invalid");
        soldierSearchMoveInput.classList.remove("is-valid");

        moveList = [];
        soldierSearchMoveInput.value = '';
        selectedSoldierMoveId.value = '';
        document.getElementById('modal-soldier-2').textContent = 'Soldier: Undefined'
    }

    function openUploadMultiSoldierModal() {

        // Add the slide-in effect by adding the necessary classes
        modalUploadMultiSoldier.classList.add('show');
        modalUploadMultiSoldierContent.classList.add('show');
        modalUploadMultiSoldierContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalUploadMultiSoldierContent.classList.remove('slide-out');
    }

    function closeUploadMultiSoldierModal() {

        // Add the slide-out effect
        modalUploadMultiSoldierContent.classList.add('slide-out');
        modalUploadMultiSoldierContent.classList.remove('slide-in');

        // Clear upload file from modal
        document.getElementById("progress-multi-soldier").style.width = 0 + "%";
        document.getElementById('fileInputSoldier').value = '';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalUploadMultiSoldier.classList.remove('show');
            modalUploadMultiSoldierContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function generateRandomText(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    function openDeleteModal() {

        // Add the slide-in effect by adding the necessary classes
        modalDeleteSoldier.classList.add('show');
        modalDeleteSoldierContent.classList.add('show');
        modalDeleteSoldierContent.classList.add('slide-in');

        // Generate random text of desired length
        const randomText = generateRandomText(12); // Change 12 to your desired length
        document.getElementById('randomText').textContent = randomText;
        document.getElementById('randomTextValue').value = randomText;

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalDeleteSoldierContent.classList.remove('slide-out');
    }

    function closeDeleteModal() {

        // Add the slide-out effect
        modalDeleteSoldierContent.classList.add('slide-out');
        modalDeleteSoldierContent.classList.remove('slide-in');

        buildSearchInput.classList.remove('is-valid');
        buildSearchInput.classList.remove('is-invalid');
        buildSearchInput.value = '';
        deleteBuildId.value = '';

        buildSearchDropdown.style.display = 'none';

        // Clear upload file from modal
        enterCode.classList.remove('is-valid');
        enterCode.classList.remove('is-invalid');
        enterCode.value = '';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalDeleteSoldier.classList.remove('show');
            modalDeleteSoldierContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function cleanData(data) {
        return data
            .replace(/^Sgt\.|^Mr\.|^Dr\.|^Capt\./i, '')
            .replace(/,? Jr\.|,? Sr\.|,? PhD$/i, '')
            .trim();
    }

    function openModalDest() {
        // Add the slide-in effect by adding the necessary classes
        modalAddDest.classList.add('show');
        modalAddDestContent.classList.add('show');
        modalAddDestContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalAddDestContent.classList.remove('slide-out');
    }

    function closeModalDest() {
        // Add the slide-out effect
        modalAddDestContent.classList.add('slide-out');
        modalAddDestContent.classList.remove('slide-in');

        buildId.value = '';
        buildName.value = '';
        buildType.value = '';

        buildId.classList.remove('is-valid');
        buildId.classList.remove('is-invalid');

        buildName.classList.remove('is-valid');
        buildName.classList.remove('is-invalid');

        buildType.classList.remove('is-valid');
        buildType.classList.remove('is-invalid');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalAddDest.classList.remove('show');
            modalAddDestContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openModalAddRoom() {
        // Add the slide-in effect by adding the necessary classes
        modalRoomAddModal.classList.add('show');
        modalRoomAddModalContent.classList.add('show');
        modalRoomAddModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalRoomAddModalContent.classList.remove('slide-out');
    }

    function closeModalAddRoom() {
        // Add the slide-out effect
        modalRoomAddModalContent.classList.add('slide-out');
        modalRoomAddModalContent.classList.remove('slide-in');

        roomId.value = '';
        document.getElementById('add-room-btn').value = '';

        document.querySelectorAll('#room-name, #room-id').forEach((input) => {

            input.classList.remove('is-valid');
            input.classList.remove('is-invalid');

            input.value = '';

        });

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalRoomAddModal.classList.remove('show');
            modalRoomAddModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openModalAddMultiRoom() {
        // Add the slide-in effect by adding the necessary classes
        modalRoomAddMultiModal.classList.add('show');
        modalRoomAddMultiModalContent.classList.add('show');
        modalRoomAddMultiModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalRoomAddMultiModalContent.classList.remove('slide-out');
    }

    function closeModalAddMultiRoom() {
        // Add the slide-out effect
        modalRoomAddMultiModalContent.classList.add('slide-out');
        modalRoomAddMultiModalContent.classList.remove('slide-in');

        document.getElementById("progress-multi-room").style.width = 0 + "%";
        document.getElementById("fileInputRoom").value = '';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalRoomAddMultiModal.classList.remove('show');
            modalRoomAddMultiModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openModalAddMultiKey() {
        // Add the slide-in effect by adding the necessary classes
        modalKeyAddMultiModal.classList.add('show');
        modalKeyAddMultiModalContent.classList.add('show');
        modalKeyAddMultiModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalKeyAddMultiModalContent.classList.remove('slide-out');
    }

    function closeModalAddMultiKey() {
        // Add the slide-out effect
        modalKeyAddMultiModalContent.classList.add('slide-out');
        modalKeyAddMultiModalContent.classList.remove('slide-in');

        document.getElementById("progress-multi-key").style.width = 0 + "%";
        document.getElementById("fileInputKey").value = '';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalKeyAddMultiModal.classList.remove('show');
            modalKeyAddMultiModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openReleaseRoomsModal() {
        // Add the slide-in effect by adding the necessary classes
        modalReleaseMultiRoomModal.classList.add('show');
        modalReleaseMultiRoomModalContent.classList.add('show');
        modalReleaseMultiRoomModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalReleaseMultiRoomModalContent.classList.remove('slide-out');
    }

    function closeReleaseRoomsModal() {
        // Add the slide-out effect
        modalReleaseMultiRoomModalContent.classList.add('slide-out');
        modalReleaseMultiRoomModalContent.classList.remove('slide-in');

        document.getElementById("progress-multi-release-rooms").style.width = 0 + "%";
        document.getElementById("fileInputReleaseRooms").value = '';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalReleaseMultiRoomModal.classList.remove('show');
            modalReleaseMultiRoomModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openModalAddKey() {
        // Add the slide-in effect by adding the necessary classes
        modalKeyAddModal.classList.add('show');
        modalKeyAddModalContent.classList.add('show');
        modalKeyAddModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalKeyAddModalContent.classList.remove('slide-out');
    }

    function closeModalAddKey() {
        // Add the slide-out effect
        modalKeyAddModalContent.classList.add('slide-out');
        modalKeyAddModalContent.classList.remove('slide-in');

        document.querySelectorAll('#key-name, #key-id').forEach((input) => {

            input.classList.remove('is-valid');
            input.classList.remove('is-invalid');

            input.value = '';

        });

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalKeyAddModal.classList.remove('show');
            modalKeyAddModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openModalRemoveRoom() {

        // Add the slide-in effect by adding the necessary classes
        modalRoomRemoveModal.classList.add('show');
        modalRoomRemoveModalContent.classList.add('show');
        modalRoomRemoveModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalRoomRemoveModalContent.classList.remove('slide-out');
    }

    function closeModalRemoveRoom() {
        // Add the slide-out effect
        modalRoomRemoveModalContent.classList.add('slide-out');
        modalRoomRemoveModalContent.classList.remove('slide-in');

        selectRoomInput.value = '';
        selectRoomDropdown.style.display = 'none';
        selectedRoomId.value = '';

        selectRoomInput.classList.remove('is-valid');
        selectRoomInput.classList.remove('is-invalid');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalRoomRemoveModal.classList.remove('show');
            modalRoomRemoveModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openModalRemoveKey() {

        // Add the slide-in effect by adding the necessary classes
        modalKeyRemoveModal.classList.add('show');
        modalKeyRemoveModalContent.classList.add('show');
        modalKeyRemoveModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalKeyRemoveModalContent.classList.remove('slide-out');
    }

    function closeModalRemoveKey() {
        // Add the slide-out effect
        modalKeyRemoveModalContent.classList.add('slide-out');
        modalKeyRemoveModalContent.classList.remove('slide-in');

        selectKeyInput.value = '';
        selectKeyDropdown.style.display = 'none';
        selectedKeyId.value = '';
        newKeyName.value = '';

        selectKeyInput.classList.remove('is-valid');
        selectKeyInput.classList.remove('is-invalid');

        newKeyName.classList.remove('is-valid');
        newKeyName.classList.remove('is-invalid');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalKeyRemoveModal.classList.remove('show');
            modalKeyRemoveModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function closeModalKey() {

        // Add the slide-out effect
        modalKeyContent.classList.add('slide-out');
        modalKeyContent.classList.remove('slide-in');

        document.querySelectorAll('.search-input-key-list').forEach((input) => {
            input.value = '';
        });

        allCheckedRow = [];

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalKey.classList.remove('show');
            modalKeyContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function closeModal() {

        // Add the slide-out effect
        modalContent.classList.add('slide-out');
        modalContent.classList.remove('slide-in');

        bagSearchDropdown.style.display = 'none';
        additionalItemButtoon.removeAttribute('soldier-id');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modal.classList.remove('show');
            modalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function closeGlobalMessModal(action = '') {

        function clearInput(clearModalInput) {
            const inputs = clearModalInput.querySelectorAll('input, textarea, select');
            inputs.forEach(el => {
                if (el.type === 'hidden') return;
                
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

        async function updateLeftNavigation() {

            startLoading();

            try {
                const res = await fetch(`/web/accommodation?isFirstTime=${isFirstTime.value}`, {
                    method: 'GET'
                });

                if (!res.ok) {
                    const error = await res.json();
                    checkForGlobalError(res, error);
                    showGlobalMess('Error', error.message);
                    return;
                }
                const { navBuild, permissions } = await res.json();

                const leftNav = document.querySelector('.left-nav');
                leftNav.innerHTML = '';

                // Add title container
                const titleContainer = document.createElement('div');
                titleContainer.className = 'title-container mb-2 sticky-top w-100 bg-light';
                if (permissions && !(permissions.some(p => p.permission_name === 'Full permission' || p.permission_name === 'Add destination'))) {
                    titleContainer.style.cursor = 'not-allowed';
                }

                titleContainer.innerHTML = `
                    <div class="btn-container" style="width: 100%;">
                        <button type="button" id="btnAddDestination"
                            class="btn-add-destination w-100 ${permissions && !(permissions.some(p => p.permission_name === 'Full permission' || p.permission_name === 'Add destination')) ? 'disabled-button' : ''}">
                            <i class="bi bi-plus-circle"></i> Add Destination
                        </button>
                        <div class="tooltip-custom">
                            <i class="bi bi-question-circle"></i>
                            <span class="tooltiptext">Add building to the list of destinations</span>
                        </div>
                    </div>
                `;

                // Add event listener for Add Destination button
                titleContainer.querySelector('#btnAddDestination')?.addEventListener('click', function () {
                    openModalDest();
                });

                leftNav.appendChild(titleContainer);

                // Create the list
                const ul = document.createElement('ul');

                navBuild.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';

                    const button = document.createElement('button');
                    button.className = 'flex-grow-1 text-decoration-none full-back main-button';
                    button.id = item.id;
                    button.innerHTML = `${item.name}`;
                    if (item.nameAdd) {
                        button.innerHTML += `<span class="name-add d-block">(${item.nameAdd} free beds)</span>`;
                    }

                    const match = button.textContent.trim().match(/^(.+?)\s*\((\d+)\s*free beds\)$/);
                    const nameOnly = mainHeader.textContent.split('(')[0].trim();

                    if (item.name === nameOnly && match)
                        mainHeader.innerHTML = `${match[1]} <div class="name-add">(${match[2]} free beds)</div>`;

                    const buttonGroup = document.createElement('div');
                    buttonGroup.classList.add("button-group");
                    if (permissions && !(permissions.some(p => p.permission_name === 'Full permission' || p.permission_name === 'Add room' || p.permission_name === 'Remove room' || p.permission_name === 'Remove destination')))
                        buttonGroup.style.cursor = 'not-allowed';

                    buttonGroup.innerHTML = `
                        <button type="button"
                            class="btn btn-success btn-sm btn-add ${permissions && !(permissions.some(p => p.permission_name === 'Full permission' || p.permission_name === 'Add room')) ? 'disabled-button' : ''}"
                            numberBuild="${item.nameBuilding}" name="${item.id}">
                            <i class="bi bi-plus"></i>
                        </button>
                        <button type="button"
                            class="btn btn-danger btn-sm btn-remove ${permissions && !(permissions.some(p => p.permission_name === 'Full permission' || p.permission_name === 'Remove room')) ? 'disabled-button' : ''}"
                            name="${item.id}">
                            <i class="bi bi-dash"></i>
                        </button>
                        <button type="button"
                            class="btn btn-outline-secondary btn-sm ${permissions && !(permissions.some(p => p.permission_name === 'Full permission' || p.permission_name === 'Remove destination')) ? 'disabled-button' : ''}"
                            name="${item.id}" data-name-room="${item.name}">
                            <i class="bi bi-trash"></i>
                        </button>
                    `;

                    li.appendChild(button);
                    li.appendChild(buttonGroup);
                    ul.appendChild(li);
                });

                leftNav.appendChild(ul);

            } catch (error) {
                showGlobalMess('Error', error.message);
            } finally {
                stopLoading();
            }
        }

        // Add the slide-out effect
        modalGlobalMessContent.classList.add('slide-out');
        modalGlobalMessContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(async function () {
            modalGlobalMess.classList.remove('show');
            modalGlobalMessContent.classList.remove('show');

            // Remove all buttons from modalGlobalMessContent
            const buttons = modalGlobalMessContent.getElementsByTagName('button');
            while (buttons.length > 0) {
                buttons[0].remove();
            }

            // Check if the Delete button exists and remove it
            const deleteBtn = document.getElementById('delete-btn');
            if (deleteBtn) {
                deleteBtn.remove();
            }

            const fullContent = document.getElementsByClassName('content')[0];

            if (!isWarning) {
                switch (action) {

                    case 'addAdditionalItems':
                    case 'returnAddtionalItem':
                        clearInput(additionalItemModalContent);
                        await fetchAdditionalItem();
                        break;

                    case 'removeSoldier':
                        allCheckedRow = [];
                        clearInput(modalListSoldierContent);
                        await fetchSoldierList();
                        break;

                    case 'addSoldier':
                        clearInput(modalAddSoldierContent);
                        clearInput(modalListSoldierContent);
                        await fetchSoldierList();
                        break;

                    case 'releaseAllSoldier':
                        closeDeleteModal();
                        clearInput(fullContent);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'saveKey':
                        closeModal();
                        clearInput(modalKeyContent);
                        clearInput(fullContent);
                        await fetchListKeys(globalCleanedRoomNumber);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'addDestination':
                        clearInput(modalAddDestContent);
                        clearInput(fullContent);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'addRoomToDestination':
                        clearInput(modalRoomAddModalContent);
                        clearInput(fullContent);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'removeRoomToDestination':
                        clearInput(modalRoomRemoveModalContent);
                        clearInput(fullContent);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'addKeyToRoom':
                        clearInput(modalKeyContent);
                        clearInput(fullContent);
                        clearInput(modalKeyAddModalContent);
                        await fetchListKeys(globalCleanedRoomNumber);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'replaceKeyToRoom':
                        allCheckedRow = [];
                        clearInput(modalKeyContent);
                        clearInput(fullContent);
                        clearInput(modalKeyRemoveModalContent);
                        await fetchListKeys(globalCleanedRoomNumber);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'editSoldier':
                        allCheckedRow = [];
                        closeEditSoldierModal();
                        clearInput(modalListSoldierContent);
                        await fetchSoldierList();
                        break;

                    case 'moveSoldier':
                        closeMoveModal();
                        clearInput(modalKeyContent);
                        clearInput(fullContent);
                        await fetchListKeys(globalCleanedRoomNumber);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'removeDestination':
                        clearInput(fullContent);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'uploadSoldier':
                        clearMultiInput('progress', 'fileInput');
                        clearInput(modalListSoldierContent);
                        await fetchSoldierList();
                        break;

                    case 'uploadRooms':
                        clearMultiInput('progress-multi-room', 'fileInputRoom');
                        clearInput(fullContent);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'uploadKeys':
                        clearInput(modalKeyContent);
                        clearInput(fullContent);
                        clearMultiInput('progress-multi-key', 'fileInputKey');
                        await fetchListKeys(globalCleanedRoomNumber);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'uploadReleaseRooms':
                        clearInput(modalKeyContent);
                        clearInput(fullContent);
                        clearMultiInput('progress-multi-release-rooms', 'fileInputReleaseRooms');
                        await fetchListKeys(globalCleanedRoomNumber);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'uploadMultiSoldier':
                        clearInput(fullContent);
                        clearMultiInput('progress-multi-soldier', 'fileInputSoldier');
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();
                        break;

                    case 'deleteKey':
                        allCheckedRow = [];
                        clearInput(modalKeyContent);
                        clearInput(fullContent);
                        await fetchListKeys(globalCleanedRoomNumber);
                        await fetchTableData(1, mainSortedPar, selectedBuilding);
                        await updateLeftNavigation();

                }

                await fetchItem();
                await fetchBag();
                await fetchFreeBag();
                await fetchAllKey();
                await fetchBuilding();
            }

        }, 400); // Match the duration of the animation (0.4s)
    }

    document.getElementsByClassName('close-btn')[0].onclick = closeModalKey;
    document.getElementsByClassName('close-btn')[1].onclick = closeModal;
    document.getElementsByClassName('close-btn')[2].onclick = closeViewReportModal;
    document.getElementsByClassName('close-btn')[3].onclick = closeViewModal;
    document.getElementsByClassName('close-btn')[4].onclick = closeMoveModal;
    document.getElementsByClassName('close-btn')[5].onclick = closeSoldierListModal;
    document.getElementsByClassName('close-btn')[6].onclick = closeUpcomingActionSoldierListModal;
    document.getElementsByClassName('close-btn')[7].onclick = closeEditSoldierModal;
    document.getElementsByClassName('close-btn')[8].onclick = closeAddSoldierModal;
    document.getElementsByClassName('close-btn')[9].onclick = closeAddMultiSoldierModal;
    document.getElementsByClassName('close-btn')[10].onclick = closeUploadMultiSoldierModal;
    document.getElementsByClassName('close-btn')[11].onclick = closeDeleteModal;
    document.getElementsByClassName('close-btn')[12].onclick = closeModalDest;
    document.getElementsByClassName('close-btn')[13].onclick = closeModalAddRoom;
    document.getElementsByClassName('close-btn')[14].onclick = closeModalAddMultiRoom;
    document.getElementsByClassName('close-btn')[15].onclick = closeModalRemoveRoom;
    document.getElementsByClassName('close-btn')[16].onclick = closeModalAddKey;
    document.getElementsByClassName('close-btn')[17].onclick = closeModalAddMultiKey;
    document.getElementsByClassName('close-btn')[18].onclick = closeModalRemoveKey;
    document.getElementsByClassName('close-btn')[19].onclick = closeAdditionalItemModal;
    document.getElementsByClassName('close-btn')[20].onclick = closeReleaseRoomsModal;
    document.getElementsByClassName('close-btn')[21].onclick = function () {
        closeGlobalMessModal(globalAction);
    };

    // Hide dropdown if clicked outside
    window.addEventListener('click', function (event) {
        if (!soldierSearchDropdown.contains(event.target) && event.target !== soldierSearchDropdown) {
            soldierSearchDropdown.style.display = 'none';
        }

        if (!selectKeyDropdown.contains(event.target) && event.target !== selectKeyDropdown) {
            selectKeyDropdown.style.display = 'none';
        }

        if (!selectAllKeyDropdown.contains(event.target) && event.target !== selectAllKeyDropdown) {
            selectAllKeyDropdown.style.display = 'none';
        }

        if (!selectRoomDropdown.contains(event.target) && event.target !== selectRoomDropdown) {
            selectRoomDropdown.style.display = 'none';
        }

        if (!bagSearchDropdown.contains(event.target) && event.target !== bagSearchDropdown) {
            bagSearchDropdown.style.display = 'none';
        }

        if (!soldierSearchMoveDropdown.contains(event.target) && event.target !== soldierSearchMoveDropdown) {
            soldierSearchMoveDropdown.style.display = 'none';
        }

        if (!buildSearchDropdown.contains(event.target) && event.target !== buildSearchDropdown) {
            buildSearchDropdown.style.display = 'none';
        }

        if (!additionBagsSearchDropdown.contains(event.target) && event.target !== additionBagsSearchDropdown) {
            additionBagsSearchDropdown.style.display = 'none';
        }

        if (!additionalItemSoldierSearchDropdown.contains(event.target) && event.target !== additionalItemSoldierSearchDropdown) {
            additionalItemSoldierSearchDropdown.style.display = 'none';
        }
    });

    document.querySelectorAll('tr.data-room').forEach(cell => {
        cell.addEventListener('click', function () {
            const roomnumber = this.querySelector('td:nth-child(1)').textContent;

            openModalKey(roomnumber);
        });
    });

    // Add event listener to each soldier cell
    document.querySelectorAll('tr.data-room-key').forEach(cell => {
        cell.addEventListener('click', function () {
            const keynum = this.querySelector('td:nth-child(1)').textContent;
            const keycode = this.querySelector('td:nth-child(2)').textContent;
            const soldierName = this.querySelector('td:nth-child(3)').textContent;
            const country = this.querySelector('td:nth-child(4)').textContent;
            const maleCard = this.querySelector('td:nth-child(5)') ? this.querySelector('td:nth-child(5)').textContent : null;
            const laundryBag = this.querySelector('td:nth-child(6)') ? this.querySelector('td:nth-child(6)').textContent : null;

            // Open the modal with the soldier's cleaned data
            openModal(keynum, soldierName, country, keycode, maleCard, laundryBag);
        });
    });

    document.querySelector('.left-nav').addEventListener('click', function (event) {
        // Get the closest button ancestor if the clicked element is a span
        let button = event.target.closest('button');

        if (button && button.classList.contains('main-button')) {
            const id = button.id;

            const headers = {
                nameroom: document.getElementById('room-number-header'),
                room_status: document.getElementById('room-status-header'),
                countFreeBeds: document.getElementById('count-free-beds-header')
            };

            // Reset all headers by removing sort classes
            Object.keys(headers).forEach(column => {
                headers[column].classList.remove('ascending', 'descending');
            });

            const match = button.textContent.trim().match(/^(.+?)\s*\((\d+)\s*free beds\)$/);
            if (match)
                mainHeader.innerHTML = `${match[1]} <div class="name-add">(${match[2]} free beds)</div>`;
            else
                mainHeader.textContent = button.textContent;

            selectedBuilding = id;
            document.getElementById('curent-dest').value = id;
            fetchTableData(1, mainSortedPar, selectedBuilding);
        }
    });

    function showGlobalMess(type, message) {

        const icon = document.getElementById('mess-global-icon');

        switch (type) {

            case 'Super Warning':
                icon.src = "/icon/delete_warning.png";
                document.getElementById('mess-global-text').textContent = message;
                isWarning = true;
                break;

            case 'Warning':
                icon.src = "/icon/timeout.png";
                document.getElementById('mess-global-text').textContent = message;
                isWarning = true;
                break;

            case 'Error':
                icon.src = "/icon/error.png";
                document.getElementById('mess-global-text').textContent = message;
                isWarning = true;
                break;

            default:
                icon.src = "/icon/information.png";
                document.getElementById('mess-global-text').textContent = message;
                isWarning = false;
                break;
        }

        // Add the slide-in effect by adding the necessary classes
        modalGlobalMess.classList.add('show');
        modalGlobalMessContent.classList.add('show');
        modalGlobalMessContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalGlobalMessContent.classList.remove('slide-out');
    }

    // Close the modal if the user clicks outside of it
    window.addEventListener("click", function (event) {

        switch (event.target) {
            case modal:
                closeModal();
                break;

            case modalRep:
                closeViewModal();
                break;

            case modalViewRep:
                closeViewReportModal();
                break;

            case modalMove:
                closeMoveModal();
                break;

            case modalAddSoldier:
                closeAddSoldierModal();
                break;

            case modalListSoldier:
                closeSoldierListModal();
                break;

            case modalEditSoldier:
                closeEditSoldierModal();
                break;

            case modalUpcomingActionSoldierList:
                closeUpcomingActionSoldierListModal();
                break;

            case modalAddMultiSoldier:
                closeAddMultiSoldierModal();
                break;

            case modalGlobalMess:
                closeGlobalMessModal(globalAction);
                break;

            case modalUploadMultiSoldier:
                closeUploadMultiSoldierModal();
                break;

            case modalDeleteSoldier:
                closeDeleteModal();
                break;

            case modalKey:
                closeModalKey();
                break;

            case modalAddDest:
                closeModalDest();
                break;

            case modalRoomAddModal:
                closeModalAddRoom();
                break;

            case modalRoomAddMultiModal:
                closeModalAddMultiRoom();
                break;

            case modalKeyAddMultiModal:
                closeModalAddMultiKey();
                break;

            case modalReleaseMultiRoomModal:
                closeReleaseRoomsModal();
                break;

            case modalRoomRemoveModal:
                closeModalRemoveRoom();
                break;

            case modalKeyAddModal:
                closeModalAddKey();
                break;

            case modalKeyRemoveModal:
                closeModalRemoveKey();
                break;
            case additionalItemModal:
                closeAdditionalItemModal();
                break;
        }
    });

    function firstUpdateTable(rows, currentIndex, rowsPerPage, pageNumberId) {
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display = i >= currentIndex && i < currentIndex + rowsPerPage ? "table-row" : "none";
        }

        let totalPages = Math.ceil(rows.length / rowsPerPage) || 1; // Recalculate total pages (avoid division by zero)
        let currentPage = Math.floor(currentIndex / rowsPerPage) + 1;
        document.getElementById(pageNumberId).textContent = `${currentPage}/${totalPages}`;
    }

    async function fetchReport(selectDate1, selectDate2, page = 1, pageDate = 1, limit = 10, searchFilters = [], searchFiltersMove = []) {

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();

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

            searchFiltersMove.forEach(filter => {
                searchParams.append('searchColumnDate', filter.column);
                searchParams.append('searchValueDate', filter.value);
            });

            const response = await fetch(`/web/accommodation/viewReport?${searchParams.toString()}`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message);
                return;
            }

            const { data, data_move, totalPages, totalPagesMove } = await response.json();

            // Clear existing rows from bike usage details table
            const soldierUsageTableBody = document.getElementById('soldierUsageTable').getElementsByTagName('tbody')[0];
            const soldierMoveTableBody = document.getElementById('soldierMoveTable').getElementsByTagName('tbody')[0];

            soldierUsageTableBody.innerHTML = '';
            soldierMoveTableBody.innerHTML = '';

            data.forEach(row => {
                const newRow = soldierUsageTableBody.insertRow();
                [
                    row.namekey ? row.namekey : 'No key assigned',
                    row.namesoldier,
                    row.country,
                    row.date_accommodation ? row.date_accommodation : 'Not accommodated',
                    row.date_free ? row.date_free : 'No departure date',
                    row.meal_card ? row.meal_card : 'No meal card set',
                    row.code ? row.code : 'No bag set'
                ].forEach(cellValue => {
                    const cell = newRow.insertCell();
                    cell.textContent = cellValue;
                    cell.style = "max-width: 200px;";
                    cell.classList.add('text-wrap');
                });
            });

            data_move.forEach(row => {
                const newRow = soldierMoveTableBody.insertRow();
                [
                    row.previous_room,
                    row.current_room,
                    row.name_soldier,
                    row.datemove
                ].forEach(cellValue => {
                    const cell = newRow.insertCell();
                    cell.textContent = cellValue;
                    cell.style = "max-width: 200px;";
                    cell.classList.add('text-wrap');
                });
            });

            const rowsTable = soldierUsageTableBody.getElementsByTagName("tr");
            const rowsTableMove = soldierMoveTableBody.getElementsByTagName("tr");

            firstUpdateTable(rowsTable, 0, 10, 'pageNumber');
            firstUpdateTable(rowsTableMove, 0, 10, 'pageNumberDate');

            setupTableNavigation("soldierUsageTable", "prevBtn", "nextBtn", "pageNumber", limit, totalPages, page, searchFilters, searchFiltersMove, "", selectDate1, selectDate2);
            setupTableNavigation("soldierMoveTable", "prevBtnDate", "nextBtnDate", "pageNumberDate", limit, totalPagesMove, pageDate, searchFilters, searchFiltersMove, "", selectDate1, selectDate2);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showGlobalMess('Error', 'Cannot fetch report data');

        } finally {
            stopLoading();
        }
    }

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

    document.getElementById('form10').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form11').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form12').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    additionalItemDescription.addEventListener('input', function (event) {
        const description = event.target;
        toggleInputValidity(description, /^[a-zA-Z0-9\s]+$/.test(description.value));
    });

    additionalItemQuantity.addEventListener('input', function (event) {
        const quantity = event.target;
        toggleInputValidity(quantity, /^[0-9]+$/.test(quantity.value));
    });

    // Open the report modal when the Reports button is clicked
    document.getElementById("btnReport").addEventListener("click", function () {
        openViewReportModal();
        // openViewModal();
    });

    // Open the list soldier modal when the Add soldier button is clicked
    document.getElementById("btnListSoldier").addEventListener("click", function () {
        openSoldierListModal();
    });

    // Open the add soldier modal when the Add soldier button is clicked
    document.getElementById("addSoldier").addEventListener("click", function () {
        openAddSoldierModal();
    });

    document.getElementById("confirmReportBtnAddMultiRooms").addEventListener("click", function () {
        openModalAddMultiRoom();
    });

    document.getElementById("confirmReportBtnAddMultiKeys").addEventListener("click", function () {
        openModalAddMultiKey();
    });

    document.getElementById("releaseRoom").addEventListener("click", function () {
        openReleaseRoomsModal();
    });

    document.getElementById('confirmReportBtn').addEventListener('click', () => {

        const selectDate1 = document.getElementById('selectedDate1').value;
        const selectDate2 = document.getElementById('selectedDate2').value;

        if (!selectDate1 || !selectDate2) {
            showGlobalMess('Error', 'Both dates must be selected!');
            return;
        }

        if (new Date(selectDate1) > new Date(selectDate2)) {
            showGlobalMess('Error', 'Invalid time slot!');
            return;
        }

        closeViewReportModal();

        currentPage = 1;
        secondCurrentPage = 1;

        const headerMap = {
            'Room Number': 'k.namekey',
            'Soldier Name': 'namesoldier',
            'Country': 'country',
            'Accommodation Date': 'date_accommodation',
            'Release Date': 'date_free',
            'Meal card': 'meal_card',
            'Laundry bag': 'code'
        };

        const headerDateMap = {
            'Previous Key': 'k_previous.namekey',
            'New Key': 'k_current.namekey',
            'Soldier': 'soldier_name.namesoldier',
            'Date Relocation': 'ms.datemove'
        };

        rewriteTableSearch('.search-input-view', 'soldierUsageTable', headerMap, selectDate1, selectDate2);
        rewriteTableSearch('.search-input-view-second', 'soldierMoveTable', headerDateMap, selectDate1, selectDate2);

        globalSelectDate1 = selectDate1;
        globalSelectDate2 = selectDate2;

        fetchReport(selectDate1, selectDate2);
        openViewModal();
    });

    // Open the delete soldier modal when the Delete soldier button is clicked
    document.getElementById("removeSoldier").addEventListener("click", function () {

        const submitButton = document.createElement('button');
        var isRemove = false;
        var isError = false;
        var result = {};

        if (allCheckedRow.length === 0) {
            showGlobalMess('Error', 'You have not selected any soldiers to remove');
            return;
        }

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');
        submitButton.addEventListener('click', async () => {

            startLoading();

            for (const data of allCheckedRow) {

                isRemove = true;

                const response = await fetch('/web/accommodation/removeSoldier', {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                result = await response.json();

                if (!response.ok) {
                    checkForGlobalError(response, result);
                    isError = true;
                }
            }

            stopLoading();
            closeGlobalMessModal();
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isRemove) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show the info modal
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isRemove) {
                closeWarningObserver.disconnect();
                if (isRemove && !isError) {
                    globalAction = 'removeSoldier';
                    showGlobalMess('Info', 'Soldiers removed successfully');
                } else if (isError) {
                    showGlobalMess('Error', result.message);
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        showGlobalMess('Warning', 'Are you sure you want to remove the selected soldiers, this action will remove all data for the selected soldiers?');
    });

    document.getElementById("listUpcomingSoldierAction").addEventListener("click", function () {
        openUpcomingActionSoldierListModal();
    });

    // Open the add multi soldier modal when the Add soldier button is clicked
    document.getElementById("confirmReportBtnAddMultiSoldier").addEventListener("click", function () {
        openAddMultiSoldierModal();
    });

    // Open the upload multi soldier modal when the Add soldier button is clicked
    document.getElementById("btnAccommSoldier").addEventListener("click", function () {
        openUploadMultiSoldierModal();
    });

    document.getElementById('form2').onsubmit = async (event) => {

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
                    filtersAccommodation: globalSearchFilters,
                    filtersAccommodationDate: globalSearchFiltersDate
                })
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message || 'Failed to download the report.');
                return;
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'report_accommodation.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

        } catch (error) {
            showGlobalMess('Error', error.message || 'Failed to download the report.');

        } finally {
            stopLoading();
        }
    }

    // Open the move modal when the Move button is clicked
    moveButton.addEventListener("click", function () {

        const roomNum1 = document.getElementById('modal-keynum').textContent;
        const solNum1 = soldierInput.value;

        if (!soldierInput.value) {
            return showGlobalMess('Error', 'You must select soldier');
        }

        if (!isAccommodation.value) {
            return showGlobalMess('Error', 'This room is empty. To move a soldier, select a room that is occupied!');
        }

        closeModal();

        openMoveModal(roomNum1, solNum1);
    });

    additionalItemButtoon.addEventListener("click", function () {
        openAdditionalItemModal();
    });

    additionalItemEditSoldierButtoon.addEventListener("click", function () {
        openAdditionalItemModal();
    });

    document.getElementById('upload-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInput");
        const file = fileInput.files[0];

        if (!file) {
            showGlobalMess("Error", "You have not selected a file to upload");
            return;
        }

        const url = "/web/accommodation/uploadSoldier";
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
                    globalAction = 'uploadSoldier';
                    showGlobalMess("Info", "File uploaded successfully!");
                }, 1000);
            } else {
                stopLoading();
                const data = JSON.parse(xhr.responseText);
                if (data.errors) {
                    data.errors.forEach(error => {
                        if (error.type === 'DuplicateInFile' || error.type === 'DuplicateInDB' || error.type === 'InvalidFormat' || error.type === 'InvalidDate' || error.type === 'CheckBag' || error.type === 'CheckKey') {
                            showGlobalMess("Error", error.message);
                        } else if (error.type === 'Validation') {
                            showGlobalMess("Error", `Invalid data in row with Id: ${error.row.soldierId}. Check the syntax of data in this rows.`);
                        }
                    });
                } else {
                    showGlobalMess("Error", data.error || "File upload failed.");
                }
            }
        };

        xhr.onerror = function () {
            stopLoading();
            showGlobalMess("Error", "An unexpected error occurred.");
        };

        xhr.send(formData);
    });

    document.getElementById('upload-room-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInputRoom");
        const file = fileInput.files[0];

        if (!file) {
            showGlobalMess("Error", "You have not selected a file to upload");
            return;
        }

        const url = "/web/accommodation/uploadRooms";
        const progressBar = document.getElementById("progress-multi-room");

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
                    globalAction = 'uploadRooms';
                    showGlobalMess("Info", "File uploaded successfully!");
                }, 1000);
            } else {
                stopLoading();
                const data = JSON.parse(xhr.responseText);
                if (data.errors) {
                    data.errors.forEach(error => {
                        if (error.type === 'DuplicateInFile' || error.type === 'DuplicateInDB' || error.type === 'InvalidFormat' || error.type === 'InvalidDate' || error.type === 'CheckBag' || error.type === 'CheckKey') {
                            showGlobalMess("Error", error.message);
                        } else if (error.type === 'Validation') {
                            showGlobalMess("Error", `Invalid data in row with Id: ${error.row.roomId}. Check the syntax of data in this rows.`);
                        }
                    });
                } else {
                    showGlobalMess("Error", data.error || "File upload failed.");
                }
            }
        };

        xhr.onerror = function () {
            stopLoading();
            showGlobalMess("Error", "An unexpected error occurred.");
        };

        xhr.send(formData);
    });

    document.getElementById('upload-key-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInputKey");
        const file = fileInput.files[0];

        if (!file) {
            showGlobalMess("Error", "You have not selected a file to upload");
            return;
        }

        const url = "/web/accommodation/uploadKeys";
        const progressBar = document.getElementById("progress-multi-key");

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
                    globalAction = 'uploadKeys';
                    showGlobalMess("Info", "File uploaded successfully!");
                }, 1000);
            } else {
                stopLoading();
                const data = JSON.parse(xhr.responseText);
                if (data.errors) {
                    data.errors.forEach(error => {
                        if (error.type === 'DuplicateInFile' || error.type === 'DuplicateInDB' || error.type === 'InvalidFormat' || error.type === 'InvalidDate' || error.type === 'CheckBag' || error.type === 'CheckKey') {
                            showGlobalMess("Error", error.message);
                        } else if (error.type === 'Validation') {
                            showGlobalMess("Error", `Invalid data in row with Id: ${error.row.keyId}. Check the syntax of data in this rows.`);
                        }
                    });
                } else {
                    showGlobalMess("Error", data.error || "File upload failed.");
                }
            }
        };

        xhr.onerror = function () {
            stopLoading();
            showGlobalMess("Error", "An unexpected error occurred.");
        };

        xhr.send(formData);
    });

    document.getElementById('upload-multi-release-rooms-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInputReleaseRooms");
        const file = fileInput.files[0];

        if (!file) {
            showGlobalMess("Error", "You have not selected a file to upload");
            return;
        }

        const url = "/web/accommodation/uploadReleaseRooms";
        const progressBar = document.getElementById("progress-multi-release-rooms");

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
                    globalAction = 'uploadReleaseRooms';
                    showGlobalMess("Info", "File uploaded successfully!");
                }, 1000);
            } else {
                stopLoading();
                const data = JSON.parse(xhr.responseText);
                if (data.errors) {
                    data.errors.forEach(error => {
                        if (error.type === 'DuplicateInFile' || error.type === 'DuplicateInDB' || error.type === 'InvalidFormat' || error.type === 'CheckBike' || error.type === 'CheckBag' || error.type === 'CheckAI') {
                            showGlobalMess("Error", error.message);
                        } else if (error.type === 'Validation') {
                            showGlobalMess("Error", `Invalid data in row with key name: ${error.row.keyName}. Check the syntax of data in this rows.`);
                        }
                    });
                } else {
                    showGlobalMess("Error", data.error || "File upload failed.");
                }
            }
        };

        xhr.onerror = function () {
            stopLoading();
            showGlobalMess("Error", "An unexpected error occurred.");
        };

        xhr.send(formData);
    });

    document.getElementById('upload-multi-soldier-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInputSoldier");
        const file = fileInput.files[0];

        if (!file) {
            showGlobalMess("Error", "You have not selected a file to upload");
            return;
        }

        const url = "/web/accommodation/uploadMultiSoldier";
        const progressBar = document.getElementById("progress-multi-soldier");

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
                    globalAction = 'uploadMultiSoldier';
                    showGlobalMess("Info", "File uploaded successfully!");
                }, 1000);
            } else {
                stopLoading();
                const data = JSON.parse(xhr.responseText);
                if (data.errors) {

                    data.errors.forEach(error => {

                        switch (error.type) {
                            case 'CheckId':
                            case 'CheckExist':
                            case 'UniqueIdCheck':
                            case 'CheckBag':
                                showGlobalMess("Error", error.message);
                                break;

                            case 'Validation':
                                showGlobalMess("Error", `Invalid data in row with Id: ${error.row.soldierid}. Check the syntax of ID number.`);
                                break;
                        }
                    });

                } else {
                    showGlobalMess("Error", data.error || "File upload failed.");
                }

            }
        };

        xhr.onerror = function () {
            stopLoading();
            showGlobalMess("Error", "An unexpected error occurred.");
        };

        xhr.send(formData);
    });

    document.getElementById('form4').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const soldierNamePattern = new RegExp(`^${soldierId.value} [A-Za-z0-9\\s\\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇ]+$`);
        const inputsToCheck = [
            { input: soldierId, condition: soldierId.value === "" },
            { input: soldierName, condition: soldierName.value === "" || !soldierNamePattern.test(soldierName.value) },
            { input: soldierCountry, condition: soldierCountry.value === "" },
            { input: soldierAccommodationRoomSearchInput, condition: false },
            { input: bagSoldierSearchInput, condition: false },
            { input: mealCardSoldier, condition: false },
            { input: soldierDate1, condition: false },
            { input: soldierDate2, condition: false }
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
            soldierId: soldierId.value,
            soldierName: soldierName.value,
            soldierCountry: soldierCountry.value,
            upcomingKey: selectedSoldierAccommodationRoomId.value,
            soldierBag: selectedBagSoldierId.value,
            soldierMealCard: mealCardSoldier.value,
            upcomingAccommodationDate: soldierDate1.value,
            upcomingReleaseDate: soldierDate2.value
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

            } catch (error) {
                hasError = true;
            } finally {
                stopLoading();
            }

            closeGlobalMessModal();
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'addSoldier'
                    showGlobalMess('Info', 'Soldier successfully added');
                } else if (isSubmit) {
                    showGlobalMess('Error', responseData.message || 'An error occurred while adding the soldier');
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showGlobalMess('Warning', 'Are you sure you want to add this soldier?');
    };

    document.querySelectorAll('#soldier-number, #soldier-country').forEach((input) => {
        input.addEventListener('input', function () {
            toggleInputValidity(input, input.value !== "" && input.checkValidity());
        });
    });

    document.querySelectorAll('#soldier-name').forEach((input) => {
        input.addEventListener('input', function () {
            const soldierId = document.getElementById('soldier-number').value;
            const soldierNamePattern = new RegExp(`^${soldierId} [A-Za-z0-9\\s\\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇ]+$`);
            toggleInputValidity(input, input.value !== "" && soldierNamePattern.test(input.value));
        });
    });

    document.querySelectorAll('#edit-soldier-number, #edit-soldier-country').forEach((input) => {
        input.addEventListener('input', function () {
            toggleInputValidity(input, input.value !== "" && input.checkValidity());
        });
    });

    document.querySelectorAll('#edit-soldier-name').forEach((input) => {

        input.addEventListener('input', function () {
            const soldierId = document.getElementById('edit-soldier-number').value;
            const soldierNamePattern = new RegExp(`^${soldierId} [A-Za-z0-9\\s\\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇ]+$`);
            toggleInputValidity(input, input.value !== "" && soldierNamePattern.test(input.value));
        });
    });

    soldierDate1.addEventListener('change', function () {
        toggleInputValidity(soldierDate1, true);
    });

    soldierDate2.addEventListener('change', function () {
        toggleInputValidity(soldierDate2, true);
    });

    editSoldierUpcomeAccom.addEventListener('change', function () {
        toggleInputValidity(editSoldierUpcomeAccom, true);
    });

    editSoldierUpcomeRel.addEventListener('change', function () {
        toggleInputValidity(editSoldierUpcomeRel, true);
    });

    document.getElementById('btnAddDestination').addEventListener("click", () => {
        openModalDest();
    });

    document.getElementById('btnFreeAllRoom').addEventListener("click", function () {

        openDeleteModal();

        setTimeout(() => {
            showGlobalMess('Super Warning', 'WARNING: In the next window, you are given the right to release all the rooms in the building of your choice. Be extremely careful as this process is irreversible.');
        }, 500); // Adjust the time as needed
    });

    document.getElementById('form5').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const data = {
            buildId: deleteBuildId.value
        };

        if (deleteBuildId.value === "") {
            toggleInputValidity(buildSearchInput, false);
            return;
        }

        if (realCode.value !== enterCode.value) {
            toggleInputValidity(enterCode, false);
            return showGlobalMess('Error', 'The two codes do not match. Try again');
        }

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

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;
            } finally {
                stopLoading();
            }
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'releaseAllSoldier'
                    showGlobalMess('Info', 'All rooms in the building have been released');
                } else if (isSubmit) {
                    showGlobalMess('Error', responseData.message || 'An error occurred while releasing the rooms');
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showGlobalMess('Warning', 'Are you sure you want to release all rooms in this building?');
    };

    buildSearchInput.addEventListener('input', () => {
        toggleInputValidity(buildSearchInput, deleteBuildId.value !== "")
    });

    enterCode.addEventListener('input', () => {
        toggleInputValidity(enterCode, realCode.value === enterCode.value)
    });

    document.getElementById('form1').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const data = {
            keyCodeId: document.getElementById('key-code-value').value,
            soldierId: document.getElementById('selectedSoldierId').value,
            countryId: document.getElementById('country-value').value,
            bagId: document.getElementById('selectedBagId').value,
            mealCardId: document.getElementById('meal-card-value').value
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

            } catch (error) {
                hasError = true;
            } finally {
                stopLoading();
            }

            closeGlobalMessModal();
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'saveKey';
                    showGlobalMess('Info', 'Key status successfully changed');
                } else if (isSubmit) {
                    showGlobalMess('Error', responseData.message || 'An error occurred while accommodation the soldier');
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showGlobalMess('Warning', 'Are you sure you want to accommodation this soldier?');
    };

    buildId.addEventListener('input', () => {
        toggleInputValidity(buildId, buildId.value !== "" && /^[a-zA-Z0-9]+$/.test(buildId.value));
    });

    buildName.addEventListener('input', () => {
        toggleInputValidity(buildName, buildName.value !== "" && new RegExp(`^Building ${buildId.value}$`).test(buildName.value));
    });

    buildType.addEventListener('input', () => {
        toggleInputValidity(buildType, buildType.value !== "" && /^[a-zA-Z]+$/.test(buildType.value));
    });

    document.getElementById('form6').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: buildId, condition: buildId.value === "" || !/^[a-zA-Z0-9]+$/.test(buildId.value) },
            { input: buildName, condition: buildName.value === "" || !new RegExp(`^Building ${buildId.value}$`).test(buildName.value) },
            { input: buildType, condition: buildType.value === "" || !/^[a-zA-Z]+$/.test(buildType.value) }
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
            buildId: buildId.value,
            buildName: buildName.value,
            buildType: buildType.value
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

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'addDestination';
                    showGlobalMess('Info', 'Building successfully added');
                } else if (isSubmit) {
                    showGlobalMess('Error', responseData.message || 'An error occurred while adding the building');
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showGlobalMess('Warning', 'Are you sure you want to add this building?');
    };

    roomId.addEventListener('input', () => {
        toggleInputValidity(roomId, roomId.value !== "" && /^[a-zA-Z0-9\s\-]+$/.test(roomId.value));
    });

    roomName.addEventListener('input', function () {

        if (clickBuildNumber.value)
            toggleInputValidity(roomName, roomName.value !== "" && new RegExp(`^${clickBuildNumber.value}\/${roomId.value}$`).test(roomName.value));
        else
            toggleInputValidity(roomName, true);
    });

    document.getElementById('form7').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        let inputsToCheck;
        if (clickBuildNumber.value) {
            inputsToCheck = [
                { input: roomId, condition: roomId.value === "" || !/^[a-zA-Z0-9\s\-]+$/.test(roomId.value) },
                { input: roomName, condition: roomName.value === "" || !new RegExp(`^${clickBuildNumber.value}\/${roomId.value}$`).test(roomName.value) },
            ];
        } else {
            inputsToCheck = [
                { input: roomId, condition: false },
                { input: roomName, condition: false },
            ];
        }

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
            roomId: roomId.value,
            roomName: roomName.value,
            clickBuild: clickBuild.value
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

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'addRoomToDestination';
                    showGlobalMess('Info', 'Room successfully added');
                } else if (isSubmit) {
                    showGlobalMess('Error', responseData.message || 'An error occurred while adding the room');
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showGlobalMess('Warning', 'Are you sure you want to add this room?');
    };

    document.getElementById('form8').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const roomId = selectedRoomId.value;

        if (roomId === "") {
            toggleInputValidity(selectRoomInput, false);
            return;
        }

        const data = {
            roomId: roomId
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

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'removeRoomToDestination';
                    showGlobalMess('Info', 'Room successfully removed');
                } else if (isSubmit) {
                    showGlobalMess('Error', responseData.message || 'An error occurred while removing the room');
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showGlobalMess('Warning', 'Are you sure you want to remove this room?');
    };

    keyId.addEventListener('input', () => {
        toggleInputValidity(keyId, keyId.value !== "" && /^[a-zA-Z0-9]+$/.test(keyId.value));
    });

    keyName.addEventListener('input', () => {
        let roomId = selectedRoomForKey.value;
        toggleInputValidity(keyName, keyName.value !== "" && new RegExp(`^${roomId}\/[0-9]+$`).test(keyName.value));
    });

    document.getElementById('form9').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: keyId, condition: keyId.value === "" || !/^[a-zA-Z0-9]+$/.test(keyId.value) },
            { input: keyName, condition: keyName.value === "" || !new RegExp(`^${selectedRoomForKey.value}\/[0-9]+$`).test(keyName.value) }
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
            keyId: keyId.value,
            keyName: keyName.value,
            selectedRoomForKey: selectedRoomForKey.value
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

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'addKeyToRoom';
                    showGlobalMess('Info', 'Key successfully added');
                } else if (isSubmit) {
                    showGlobalMess('Error', responseData.message || 'An error occurred while adding the key');
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showGlobalMess('Warning', 'Are you sure you want to add this key?');
    };

    document.getElementById('form10').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: selectKeyInput, condition: selectedKeyId.value === "" },
            { input: newKeyName, condition: newKeyName.value === "" },
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
            oldKeyId: selectedKeyId.value,
            newKeyId: newKeyName.value
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

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'replaceKeyToRoom';
                    showGlobalMess('Info', 'Key successfully renamed');
                } else if (isSubmit) {
                    showGlobalMess('Error', responseData.message || 'An error occurred while renaming the key');
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showGlobalMess('Warning', 'Are you sure you want to rename this key?');
    };

    document.getElementById('form11').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const soldierNamePattern = new RegExp(`^${editSoldierId.value} [A-Za-z0-9\\s\\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇ]+$`);
        const inputsToCheck = [
            { input: editSoldierId, condition: editSoldierId.value === "" },
            { input: editSoldierName, condition: editSoldierName.value === "" || !soldierNamePattern.test(editSoldierName.value) },
            { input: editSoldierCountry, condition: editSoldierCountry.value === "" },
            { input: editSoldierAccommodationRoomSearchInput, condition: false },
            { input: bagEditSoldierSearchInput, condition: false },
            { input: mealCardEditSoldier, condition: false },
            { input: editSoldierUpcomeAccom, condition: false },
            { input: editSoldierUpcomeRel, condition: false }
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
            soldierId: editOldSoldierId.value,
            soldierNewId: editSoldierId.value,
            soldierName: editSoldierName.value,
            soldierCountry: editSoldierCountry.value,
            soldierUpcomingKey: editSelectedSoldierAccommodationRoomId.value,
            soldierBag: selectedBagEditSoldierId.value,
            soldierMealCard: mealCardEditSoldier.value,
            soldierUpcomeAccom: editSoldierUpcomeAccom.value,
            soldierUpcomeRel: editSoldierUpcomeRel.value
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
                    method: 'PUT',
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

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }

            closeGlobalMessModal();
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'editSoldier';
                    showGlobalMess('Info', 'Soldier successfully edited');
                } else if (isSubmit) {
                    showGlobalMess('Error', responseData.message || 'An error occurred while editing the soldier');
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showGlobalMess('Warning', 'Are you sure you want to edit this soldier?');
    };

    document.getElementById('form12').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: additionalItemSoldierSearchInput, condition: additionalItemSelectedSoldierId.value === "" },
            { input: additionalItemDescription, condition: !/^[a-zA-Z0-9\s]+$/.test(additionalItemDescription.value) },
            { input: additionBagsSearchInput, condition: false },
            { input: additionalItemQuantity, condition: !/^[0-9]+$/.test(additionalItemQuantity.value) }
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
            soldierId: additionalItemSelectedSoldierId.value,
            description: additionalItemDescription.value,
            bagId: selectedAdditionBagsId.value,
            quantity: additionalItemQuantity.value
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

            } catch (error) {
                hasError = true;

            } finally {
                stopLoading();
            }

            closeGlobalMessModal();
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    globalAction = 'addAdditionalItems';
                    showGlobalMess('Info', 'Additional item successfully added');
                } else if (isSubmit) {
                    showGlobalMess('Error', responseData.message || 'An error occurred while adding the additional item');
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showGlobalMess('Warning', 'Are you sure you want to add this additional item?');
    };

    function handleSoldierRelocation() {

        startLoading();

        try {

            const keyId = document.getElementById('previewKey')?.value;
            const soldId = document.getElementById('previewSoldier')?.value;
            const keyMoveId = document.getElementById('selectedKeyMoveId')?.value;
            const soldMoveId = document.getElementById('selectedSoldMoveId')?.value;

            const yesButton = document.createElement('button');
            const noButton = document.createElement('button');

            yesButton.textContent = 'Yes';
            yesButton.classList.add('btn', 'btn-success', 'me-2');
            modalGlobalMessContent.appendChild(yesButton);

            noButton.textContent = 'No';
            noButton.classList.add('btn', 'btn-danger');
            modalGlobalMessContent.appendChild(noButton);

            if (soldMoveId) {

                const soldierName = document.getElementById('modal-soldier-2').textContent.split(': ')[1];
                const keyNumber = soldierSearchMoveInput.value.slice(0, -2);

                showGlobalMess('Warning', `The room already has ${soldierName}. Do you want to relocate them?`);

                yesButton.onclick = () => {
                    moveList.push({ keyId, soldId, keyMoveId, soldMoveId: '' });

                    document.getElementById('key-code-value').value = keyMoveId;
                    selectedSoldierId.value = soldMoveId;
                    soldierSearchMoveInput.value = '';
                    selectedSoldierMoveId.value = '';
                    document.getElementById('modal-soldier-2').textContent = 'Soldier: Undefined';
                    soldierSearchMoveInput.classList.remove("is-invalid");
                    soldierSearchMoveInput.classList.remove("is-valid");

                    closeGlobalMessModal();
                    openMoveModal(`Key number: ${keyNumber}`, soldierName);
                }

                noButton.onclick = () => {
                    closeGlobalMessModal();
                    setTimeout(async () => {
                        moveList.push({ keyId, soldId, keyMoveId, soldMoveId });
                        if (moveList.length > 0) {
                            const respons = await fetch('/web/accommodation/moveSoldier', {
                                method: 'POST',
                                credentials: 'include',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'CSRF-Token': csrfToken
                                },
                                body: JSON.stringify({ moves: moveList })
                            });

                            if (!respons.ok) {
                                const error = await respons.json();
                                checkForGlobalError(respons, error);
                                showGlobalMess('Error', error.message);
                                return;
                            }

                            globalAction = 'moveSoldier';
                            showGlobalMess('Info', 'Soldier(s) moved successfully!');
                        } else {
                            globalAction = '';
                            showGlobalMess('Info', 'No data to move.');
                        }
                    }, 500); // Adjust timeout if needed
                }

            } else {
                showGlobalMess('Warning', 'The room is empty. Are you sure you want to proceed?');

                yesButton.onclick = () => {
                    closeGlobalMessModal();
                    setTimeout(async () => {
                        moveList.push({ keyId, soldId, keyMoveId, soldMoveId: '' });
                        if (moveList.length > 0) {
                            const respons = await fetch('/web/accommodation/moveSoldier', {
                                method: 'POST',
                                credentials: 'include',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'CSRF-Token': csrfToken
                                },
                                body: JSON.stringify({ moves: moveList })
                            });

                            if (!respons.ok) {
                                const error = await respons.json();
                                checkForGlobalError(respons, error);
                                showGlobalMess('Error', error.message);
                                return;
                            }

                            globalAction = 'moveSoldier';
                            showGlobalMess('Info', 'Soldier(s) moved successfully!');
                        }
                    }, 500); // Adjust timeout if needed
                }

                noButton.onclick = () => {
                    closeGlobalMessModal();
                }
            }
        } catch (error) {
            showGlobalMess('Error', error.message);

        } finally {
            stopLoading();
        }
    }

    document.getElementById('form3').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        if (selectedSoldierMoveId.value === "") {
            toggleInputValidity(soldierSearchMoveInput, false);
            return;
        }

        handleSoldierRelocation();
    };

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

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();

        startLoading();

        const query = buildQueryParams(page, mainSortedPar, numBuild);
        try {
            const res = await fetch(`/web/accommodation?${query}`, {
                method: 'GET'
            });

            if (!res.ok) {
                const error = await res.json();
                checkForGlobalError(res, error);
                showGlobalMess('Error', error.message);
                return;
            }

            const { nameroomSetCount, totalCount, totalFreeBeds, totalOccupiedBeds, buildType } = await res.json();

            mainTotalRows = parseInt(totalCount);
            mainCurrentPage = page;
            document.getElementById('freeBed').textContent = `Free Beds: ${totalFreeBeds}`;
            document.getElementById('totalOccupiedBeds').textContent = `Occupied Beds: ${totalOccupiedBeds}`;

            typeBuild.value = buildType;
            document.getElementById('previewTypeBuild').value = buildType;

            renderTable(nameroomSetCount);
            renderPagination();
        } catch (error) {
            if (error.name === 'AbortError') return;
            showGlobalMess('Error', error.message);
        } finally {
            stopLoading();
        }
    }

    function renderTable(data) {
        const rows = data.map(item => {
            const isCompletelyFree = item.countAllBeds == item.countFreeBeds;
            const isPartiallyFree = item.countFreeBeds != 0;
            const statusClass = (isCompletelyFree || isPartiallyFree) ? 'undefined-data' : '';

            return `
            <tr class="data-room" data-room="${item.nameroom}">
                <td class="text-wrap" style="max-width: 200px;">${item.nameroom}</td>
                <td class="text-wrap ${statusClass}" style="max-width: 200px;">${item.roomStatus}</td>
                <td>${item.countFreeBeds}</td>
            </tr>`;
        }).join("");

        tableBody.innerHTML = rows;

        // Use event delegation instead of per-row listeners
        tableBody.onclick = (e) => {
            const row = e.target.closest('.data-room');
            if (row) openModalKey(row.dataset.room);
        };
    }

    function renderPagination() {
        const pageCount = Math.ceil(mainTotalRows / mainRowsPerPage) || 1;
        const fragment = document.createDocumentFragment();

        function createPageItem(page, isActive = false) {
            const li = document.createElement("li");
            li.className = "page-item" + (isActive ? " active" : "");
            li.innerHTML = `<a class="page-link" href="#">${page}</a>`;
            li.querySelector("a").onclick = (e) => {
                e.preventDefault();
                fetchTableData(page, mainSortedPar, selectedBuilding);
            };
            return li;
        }

        // prev
        const prevBtn = document.createElement("li");
        prevBtn.className = "page-item";
        prevBtn.innerHTML = `<a class="page-link">&laquo;</a>`;
        prevBtn.onclick = (e) => {
            e.preventDefault();
            if (mainCurrentPage > 1) fetchTableData(mainCurrentPage - 1, mainSortedPar, selectedBuilding);
        };
        fragment.appendChild(prevBtn);

        const maxVisiblePages = 5;
        const halfVisible = Math.floor(maxVisiblePages / 2);
        let startPage = Math.max(1, mainCurrentPage - halfVisible);
        let endPage = Math.min(pageCount, mainCurrentPage + halfVisible);

        if (mainCurrentPage <= halfVisible) {
            endPage = Math.min(pageCount, maxVisiblePages);
        } else if (mainCurrentPage > pageCount - halfVisible) {
            startPage = Math.max(1, pageCount - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            fragment.appendChild(createPageItem(1));
            if (startPage > 2) {
                const ellipsis = document.createElement("li");
                ellipsis.className = "page-item disabled";
                ellipsis.innerHTML = `<span class="page-link">...</span>`;
                fragment.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            fragment.appendChild(createPageItem(i, i === mainCurrentPage));
        }

        if (endPage < pageCount) {
            if (endPage < pageCount - 1) {
                const ellipsis = document.createElement("li");
                ellipsis.className = "page-item disabled";
                ellipsis.innerHTML = `<span class="page-link">...</span>`;
                fragment.appendChild(ellipsis);
            }
            fragment.appendChild(createPageItem(pageCount));
        }

        // next
        const nextBtn = document.createElement("li");
        nextBtn.className = "page-item";
        nextBtn.innerHTML = `<a class="page-link">&raquo;</a>`;
        nextBtn.onclick = (e) => {
            e.preventDefault();
            if (mainCurrentPage < pageCount) fetchTableData(mainCurrentPage + 1, mainSortedPar, selectedBuilding);
        };
        fragment.appendChild(nextBtn);

        pagination.innerHTML = "";
        pagination.appendChild(fragment);
    }

    renderPagination();

    // Attach filter input events
    document.querySelectorAll('.search-input').forEach((input, index) => {
        const headerLabel = headerCells[index]?.innerText.trim();
        const columnName = mainHeaderMap[headerLabel];

        input.addEventListener('input', debounce(() => {
            const searchTerm = input.value.trim().toLowerCase();

            // Remove old filter for this column
            filters = filters.filter(f => f.column !== columnName);

            if (columnName && searchTerm) {
                filters.push({ column: columnName, value: searchTerm });
            }

            fetchTableData(1, mainSortedPar, selectedBuilding);
        }, 400));
    });


    // Function to sort data and update the table
    function sortTableData(column) {

        sortOrder[column] = !sortOrder[column];
        const direction = sortOrder[column] ? 'asc' : 'desc';

        mainSortedPar = { column, direction };

        // Update column headers with sort indicators
        updateSortIndicators(column);

        fetchTableData(1, mainSortedPar, selectedBuilding);
    }

    // Function to update sort indicators on column headers
    function updateSortIndicators(activeColumn) {
        // Get header elements
        const headers = {
            nameroom: document.getElementById('room-number-header'),
            room_status: document.getElementById('room-status-header'),
            countFreeBeds: document.getElementById('count-free-beds-header')
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

    // Add event listeners to table headers for sorting
    document.getElementById('room-number-header').addEventListener('click', function () {
        sortTableData('nameroom');
    });

    document.getElementById('room-status-header').addEventListener('click', function () {
        sortTableData('room_status');
    });

    document.getElementById('count-free-beds-header').addEventListener('click', function () {
        sortTableData('countFreeBeds');
    });

    document.getElementById('addKey').addEventListener('click', function () {
        openModalAddKey();
    });

    document.addEventListener('click', function (event) {

        const target = event.target;

        // Check if the clicked element is a trash button
        if (target.closest('.bi-trash')) {

            const button = event.target.closest('button');
            const numBuild = button.name;
            const nameBuild = button.dataset.nameRoom;

            // Create a new Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.id = 'delete-btn';
            deleteBtn.className = 'btn btn-danger';
            deleteBtn.textContent = 'Delete';

            // Add click event to the Delete button
            deleteBtn.addEventListener('click', async () => {

                startLoading();

                try {
                    if (document.getElementById('curent-dest').value !== numBuild) {
                        const response = await fetch(`/web/accommodation/removeDestination`, {
                            method: 'DELETE',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                'CSRF-Token': csrfToken
                            },
                            body: JSON.stringify({ buildId: numBuild })
                        });

                        if (response.ok) {
                            globalAction = 'removeDestination';
                            showGlobalMess('Info', `${nameBuild} has been deleted.`);
                            deleteBtn.remove();
                        } else {
                            // Handle the error response
                            const errorData = await response.json();
                            checkForGlobalError(response, errorData);
                            showGlobalMess("Error", errorData.message || "Failed to delete the building.");
                            deleteBtn.remove();

                        }
                    } else {
                        showGlobalMess("Error", "You can only delete a destination when you are outside of it.");
                        deleteBtn.remove();
                    }
                } catch (error) {
                    showGlobalMess("Error", "An unexpected error occurred.");
                    deleteBtn.remove();

                } finally {
                    stopLoading();
                }
            });

            // Append the Delete button to the modal content
            modalGlobalMessContent.appendChild(deleteBtn);
            showGlobalMess("Warning", `Are you sure you want to delete ${nameBuild}?`);

        }

        // Check if the clicked element is an Add button (+)
        if (target.closest('.btn-add')) {
            const button = event.target.closest('button');
            const numBuild = button.name;
            const nameBuild = button.getAttribute('numberBuild');

            clickBuild.value = numBuild;
            clickBuildNumber.value = nameBuild;
            openModalAddRoom();

        }

        // Check if the clicked element is a Remove button (−)
        if (target.closest('.btn-remove')) {
            const button = event.target.closest('button');
            const numBuild = button.name;

            // Fetch the special rooms when the script loads
            fetchSpecialRoom(numBuild);

            openModalRemoveRoom();

        }
    });

    document.getElementById('removeKey').addEventListener('click', async () => {
        openModalRemoveKey();
    });

    document.getElementById('deleteKey').addEventListener('click', async () => {
        const submitButton = document.createElement('button');
        var isRemove = false;
        var isError = false;
        var result = {};

        if (allCheckedRow.length === 0) {
            showGlobalMess('Error', 'You have not selected any keys to remove');
            return;
        }

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');
        submitButton.addEventListener('click', async () => {

            startLoading();

            for (const data of allCheckedRow) {

                isRemove = true;

                const response = await fetch('/web/accommodation/deleteKeys', {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                result = await response.json();

                if (!response.ok) {
                    checkForGlobalError(response, result);
                    isError = true;
                }
            }

            stopLoading();
            closeGlobalMessModal();
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isRemove) {
                observer.disconnect();

                if (modalGlobalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalGlobalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show the info modal
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isRemove) {
                closeWarningObserver.disconnect();
                if (isRemove && !isError) {
                    globalAction = 'deleteKey';
                    showGlobalMess('Info', 'Keys removed successfully');
                } else if (isError) {
                    showGlobalMess('Error', result.message);
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        showGlobalMess('Warning', 'Are you sure you want to remove the selected keys, this action will remove all data for the selected keys?');
    });

    document.getElementById('newKeyName').addEventListener('input', function () {
        if (newKeyName.value === "") {
            toggleInputValidity(newKeyName, false);
            return;
        } else {
            toggleInputValidity(newKeyName, true);
        }
    });

    mealCardSoldier.addEventListener('input', function () {
        toggleInputValidity(mealCardSoldier, /^[a-zA-Z0-9]*$/.test(mealCardSoldier.value));
    });

    mealCardEditSoldier.addEventListener('input', function () {
        toggleInputValidity(mealCardEditSoldier, /^[a-zA-Z0-9]*$/.test(mealCardEditSoldier.value));
    });

    document.getElementById("toggleFormButton").addEventListener("click", function () {
        let form = document.getElementById("form12");
        let table = document.getElementById("additonalItemTable");
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

    document.getElementById('downloadUpcomingActions').addEventListener("click", async function () {

        startLoading();

        try {

            const response = await fetch('/web/accommodation/downloadUpcomingSoldier', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ filtersSoldier: globalUpcomingActionSearchFilters })
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showGlobalMess('Error', error.message || 'Failed to download the file.');
                return;
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'upcoming_actions_soldiers.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

        } catch (error) {
            showGlobalMess('Error', error.message || 'Failed to download the file.');

        } finally {
            stopLoading();
        }
    });
});
