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

    const modalAddMultiSoldier = document.getElementById('uploadModal');
    const modalAddMultiSoldierContent = modalAddMultiSoldier.querySelector('.modal-content');

    const modalRoomAddModal = document.getElementById('roomAddModal');
    const modalRoomAddModalContent = modalRoomAddModal.querySelector('.modal-content');

    const modalRoomRemoveModal = document.getElementById('roomRemoveModal');
    const modalRoomRemoveModalContent = modalRoomRemoveModal.querySelector('.modal-content');

    const modalKeyAddModal = document.getElementById('keyAddModal');
    const modalKeyAddModalContent = modalKeyAddModal.querySelector('.modal-content');

    const modalKeyRemoveModal = document.getElementById('keyRemoveModal');
    const modalKeyRemoveModalContent = modalKeyRemoveModal.querySelector('.modal-content');

    const modalKey = document.getElementById('keyModal');
    const modalKeyContent = modalKey.querySelector('.modal-content');

    const soldierInput = document.getElementById('soldierSearch');

    const saveButton = document.getElementById('save-button');
    const moveButton = document.getElementById('move-button');
    const additionalItemButtoon = document.getElementById('addtional-item-button');
    const typeBuild = document.getElementById('typeBuild');

    const soldierSearchInput = document.getElementById('soldierSearch');
    const soldierSearchDropdown = document.getElementById('soldierDropdown');
    const selectedSoldierId = document.getElementById('selectedSoldierId');

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

    const editSoldierId = document.getElementById('edit-soldier-number');
    const editOldSoldierId = document.getElementById('edit-old-soldier-id');
    const editSoldierName = document.getElementById('edit-soldier-name');
    const editSoldierCountry = document.getElementById('edit-soldier-country');

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
    let allAdditionalItems = [];

    var isWarning = false;

    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

    // Function to fetch soldier from the server
    async function fetchSpecialRoom(numBuild) {

        loadingIndicator.style.display = 'flex';

        try {
            const responseBike = await fetch(`/specialRooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ numBuild: numBuild })
            });

            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }

            specialRooms = await responseBike.json(); // Store fetched bikes in the global variable

        } catch (error) {
            console.log(error);
            showGlobalMess('Error', 'There was a problem with the fetch operation:');
        } finally {
            loadingIndicator.style.display = 'none';
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

        loadingIndicator.style.display = 'flex';

        try {
            const responseBike = await fetch(`/specialKeys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ numRoom: numRoom })
            });

            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }

            specialKeys = await responseBike.json(); // Store fetched bikes in the global variable

        } catch (error) {
            console.log(error);
            showGlobalMess('Error', 'There was a problem with the fetch operation');

        } finally {
            loadingIndicator.style.display = 'none';
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

        loadingIndicator.style.display = 'flex';

        try {
            const responseBike = await fetch(`/keys`, {
                method: 'GET'
            });

            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }

            allKeys = await responseBike.json(); // Store fetched bikes in the global variable

        } catch (error) {
            console.log(error);
            showGlobalMess('Error', 'There was a problem with the fetch operation');

        } finally {
            loadingIndicator.style.display = 'none';
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

            loadingIndicator.style.display = 'flex';

            const response = await fetch('/getKeyBuildigType', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keyId: keycode })
            })
                .finally(() => {
                    loadingIndicator.style.display = 'none';
                });

            const result = await response.json();
            typeBuild.value = result.type;

            // Open the modal with the soldier's cleaned data
            openModal(keynum, soldierName, country, keycode, maleCard, laundryBag);

            selectAllKeyDropdown.style.display = 'none';
            selectAllKeyInput.value = '';
        }
    });

    // Function to fetch soldier from the server
    async function fetchItem() {

        loadingIndicator.style.display = 'flex';

        try {
            const responseBike = await fetch(`/clients`);
            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }
            soldiers = await responseBike.json(); // Store fetched bikes in the global variable

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);

        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // Function to fetch soldier from the server
    async function fetchAllAdditionalItem() {

        loadingIndicator.style.display = 'flex';

        try {
            const responseBike = await fetch(`/accommodation/getAllAdditionalItem`);
            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }

            allAdditionalItems = await responseBike.json();

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);

        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // Show filtered soldiers in the dropdown
    function filterAdditionalItemSoldiers(query) {
        additionalItemSoldierSearchDropdown.innerHTML = '';
        const filteredSoldier = soldiers.filter(soldier => (soldier.date_accommodation !== '' && soldier.date_free === '') && soldier.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredSoldier.length > 0) {
            additionalItemSoldierSearchDropdown.style.display = 'block';
            filteredSoldier.forEach(soldier => {
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
    function filterSoldiers(query) {
        soldierSearchDropdown.innerHTML = '';
        const filteredSoldier = soldiers.filter(soldier => ((soldier.date_accommodation === '' && soldier.date_free === '') || (soldier.date_accommodation !== '' && soldier.date_free !== '')) && soldier.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredSoldier.length > 0) {
            soldierSearchDropdown.style.display = 'block';
            filteredSoldier.forEach(soldier => {
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

    // Handle input change
    soldierSearchInput.addEventListener('input', function () {
        const query = soldierSearchInput.value;
        if (query.length > 0) {
            filterSoldiers(query);
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

    // Function to fetch soldier from the server
    async function fetchFreeBag() {

        loadingIndicator.style.display = 'flex';

        try {
            const responseBag = await fetch(`/freeBags`);
            if (!responseBag.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await responseBag.json(); // Store the parsed JSON response once
            bags = data.bags; // Access Bags from the parsed data

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);

        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // Function to fetch soldier from the server
    async function fetchBag() {

        loadingIndicator.style.display = 'flex';

        try {
            const responseBag = await fetch(`/bags`, { method: "POST" });
            if (!responseBag.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await responseBag.json(); // Store the parsed JSON response once
            allBags = data.allBags; // Access allBags from the parsed data

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);

        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // Show filtered soldiers in the dropdown
    function filterBags(query) {
        bagSearchDropdown.innerHTML = '';
        const filteredBag = bags.filter(bag => bag.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredBag.length > 0) {
            bagSearchDropdown.style.display = 'block';
            filteredBag.forEach(bag => {
                const li = document.createElement('li');
                li.textContent = bag.name;
                li.setAttribute('data-id', bag.id);
                bagSearchDropdown.appendChild(li);
            });
        } else {
            bagSearchDropdown.style.display = 'none';
        }
    }

    // Handle input change
    bagSearchInput.addEventListener('input', function () {
        const query = bagSearchInput.value;
        if (query.length > 0) {
            filterBags(query);
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

        loadingIndicator.style.display = 'flex';

        try {
            const responseBuild = await fetch(`/builds`);
            if (!responseBuild.ok) {
                throw new Error('Network response was not ok');
            }

            allBuilds = await responseBuild.json(); // Store the parsed JSON response once

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);
        } finally {
            loadingIndicator.style.display = 'none';
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

        loadingIndicator.style.display = 'flex';

        try {
            const responseBike = await fetch(`/rooms`);
            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }
            rooms = await responseBike.json(); // Store fetched bikes in the global variable

            // Find the room where rooms.id === the last item.keyMoveId in moveList
            const lastMoveItem = moveList[moveList.length - 1];
            const roomToUpdate = moveList.length > 0 ? rooms.find(room => room.id === lastMoveItem.keyMoveId) : '';

            if (roomToUpdate) {
                // Replace the last 2 characters in rooms.name
                rooms.find(room => room.id === moveList[0].keyId).name = rooms.find(room => room.id === moveList[0].keyId).name.slice(0, -2) + '✅';
                rooms.find(room => room.id === lastMoveItem.keyMoveId).name = roomToUpdate.name.slice(0, -2) + '🚫';
            }

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);

        } finally {
            loadingIndicator.style.display = 'none';
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

            loadingIndicator.style.display = 'flex';

            toggleInputValidity(soldierSearchMoveInput, true);

            soldierSearchMoveInput.value = selectedSoldier.textContent;
            selectedSoldierMoveId.value = selectedSoldier.getAttribute('data-id');
            soldierSearchMoveDropdown.style.display = 'none';

            const responseSoldier = await fetch(`/move/getSoldier`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keyId: selectedSoldierMoveId.value })
            })
                .finally(() => {
                    loadingIndicator.style.display = 'none';
                });

            if (!responseSoldier.ok) {
                throw new Error('Network response was not ok');
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

    fetchAllAdditionalItem();

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

        switch (typeBuild.value) {
            case "Accommodation":
            case "":
                handleSoldierInputs(soldierName);

                document.getElementById('search-laundry-bag-container').style.display = 'block';
                document.getElementById('input-meal-card').style.display = 'block';

                bagSearchInput.value = laundryBag === "Undefined" ? '' : laundryBag;
                selectedBagId.value = laundryBag === "Undefined" ? '' : allBags.find(bag => bag.name === bagSearchInput.value).id;

                mealCard.value = maleCard === "Undefined" ? '' : maleCard;
                break;

            default:
                handleOtherInputs();

                document.getElementById('search-laundry-bag-container').style.display = 'none';
                document.getElementById('input-meal-card').style.display = 'none';

                break;
        }

        typeBuild.value = document.getElementById('previewTypeBuild').value;

        function handleOtherInputs() {
            moveButton.style.display = 'none';
            additionalItemButtoon.style.display = 'none';
            saveButton.style.display = 'block';
        }

        function handleSoldierInputs(soldierName) {
            if (soldierName === 'Free') {

                soldierInput.value = '';
                selectedSoldierId.value = '';

            } else {

                soldierInput.value = soldierName;
                selectedSoldierId.value = soldiers.find(soldier => soldier.name === soldierInput.value).id;

            }
        }

        additionalItemButtoon.setAttribute('soldier-id', selectedSoldierId.value);

        // Add the slide-in effect by adding the necessary classes
        modal.classList.add('show');
        modalContent.classList.add('show');
        modalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalContent.classList.remove('slide-out');
    }

    function openModalKey(roomNumber) {
        // Remove all slashes from roomNumber
        const cleanedRoomNumber = roomNumber.replace(/\s/g, '');

        // Fetch the keys when the script loads
        fetchSpecialKey(cleanedRoomNumber);

        // Add the slide-in effect by adding the necessary classes
        modalKey.classList.add('show');
        modalKeyContent.classList.add('show');
        modalKeyContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalKeyContent.classList.remove('slide-out');

        selectedRoomForKey.value = cleanedRoomNumber;

        loadingIndicator.style.display = 'flex';

        // Fetch and display keys only for the specific room using POST request with body
        fetch('/getRoomKeys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomNumber: cleanedRoomNumber
            })
        })
            .then(response => response.json())
            .then(data => {
                // Populate modal with room-specific keys data
                populateModalWithKeys(data);
            })
            .catch(error => console.error("Error fetching keys:", error))
            .finally(() => {
                loadingIndicator.style.display = 'none';
            });
    }

    function populateModalWithKeys(data) {
        const tableBody = document.querySelector("#keyModal .modal-content tbody");
        tableBody.innerHTML = "";

        data.forEach(item => {
            const row = document.createElement("tr");
            row.classList.add("data-room-key");

            switch (typeBuild.value) {
                case 'Accommodation':
                case '':

                    if (item.location_key === null) {
                        row.classList.add("disabled-row");
                        row.setAttribute("aria-disabled", "true");

                        row.addEventListener("click", function (event) {
                            event.stopPropagation();
                            event.preventDefault();
                        });
                    } else {
                        row.addEventListener("click", function () {
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
                        <td>${item.namekey}</td>
                        <td>${item.code}</td>
                        <td class="${!item.namesoldier ? "undefined-data" : ""}">${item.namesoldier || "Free"}</td>
                        <td class="${!item.country ? "undefined-data" : ""}">${item.country || "Undefined"}</td>
                        <td class="${!item.mealcard ? "undefined-data" : ""}">${item.mealcard || "Undefined"}</td>
                        <td class="${!item.lbcode ? "undefined-data" : ""}">${item.lbcode || "Undefined"}</td>`;

                    break;

                default:
                    row.innerHTML = `
                        <td>${item.namekey}</td>
                        <td>${item.code}</td>
                        <td class="${!item.namesoldier ? "undefined-data" : ""}">${item.namesoldier || "Free"}</td>
                        <td class="${!item.country ? "undefined-data" : ""}">${item.country || "Undefined"}</td>`;

                    // Attach click event for each row
                    row.addEventListener('click', function () {
                        openModal(
                            item.namekey,
                            item.namesoldier || "Free",
                            item.country || "Undefined",
                            item.code
                        );
                    });
                    break;
            }

            tableBody.appendChild(row);
        });
    }

    function setupTableNavigation(tableId, prevBtnId, nextBtnId, pageNumberId) {
        const table = document.getElementById(tableId).getElementsByTagName("tbody")[0];
        const rows = table.getElementsByTagName("tr");
        const rowsPerPage = 10; // Number of rows visible at a time
        let currentIndex = 0;
        let totalPages = Math.ceil(rows.length / rowsPerPage);
        const pageNumberDisplay = document.getElementById(pageNumberId);

        function updateTable() {
            for (let i = 0; i < rows.length; i++) {
                rows[i].style.display = i >= currentIndex && i < currentIndex + rowsPerPage ? "table-row" : "none";
            }

            totalPages = Math.ceil(rows.length / rowsPerPage) || 1; // Recalculate total pages (avoid division by zero)
            let currentPage = Math.floor(currentIndex / rowsPerPage) + 1;
            pageNumberDisplay.textContent = `${currentPage}/${totalPages}`;
        }

        document.getElementById(prevBtnId).onclick = function () {
            if (currentIndex > 0) {
                currentIndex -= rowsPerPage;
                updateTable();
            }
        };

        document.getElementById(nextBtnId).onclick = function () {
            if (currentIndex + rowsPerPage < rows.length) {
                currentIndex += rowsPerPage;
                updateTable();
            }
        };

        updateTable(); // Initialize table view
    }

    function openAdditionalItemModal() {
        additionalItemModal.classList.add('show');
        additionalItemModalContent.classList.add('show');
        additionalItemModalContent.classList.add('slide-in');

        const soldierId = additionalItemButtoon.getAttribute('soldier-id');
        additionalItemSoldierSearchInput.value = soldiers.filter(soldier => soldier.id === soldierId)[0].name;
        additionalItemSelectedSoldierId.value = soldierId;

        const tableBody = document.getElementById("additionalItemTableBody");
        tableBody.innerHTML = "";

        allAdditionalItems.forEach(item => {
            const row = document.createElement("tr");

            const soldierCell = document.createElement("td");
            soldierCell.textContent = item.soldierName;
            row.appendChild(soldierCell);

            const descriptionCell = document.createElement("td");
            descriptionCell.textContent = item.description;
            row.appendChild(descriptionCell);

            const codeCell = document.createElement("td");
            codeCell.textContent = item.code || "N/A";
            row.appendChild(codeCell);

            const quantityCell = document.createElement("td");
            quantityCell.textContent = item.quantity;
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

                    loadingIndicator.style.display = 'flex';

                    try {
                        const data = {
                            id: item.id,
                            quantity: quantityInput.value
                        };

                        const response = await fetch('/accommodation/returnAddtionalItem', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(data)
                        });

                        if (!response.ok) {
                            hasError = true;
                        }

                        responseData = await response.json();

                        closeGlobalMessModal();

                    } catch (error) {
                        hasError = true;
                    } finally {
                        loadingIndicator.style.display = 'none';
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
                            closeAdditionalItemModal();
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

        setupTableNavigation("additonalItemTable", "prevBtnTherd", "nextBtnTherd", "pageNumberTherd");

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

        document.querySelectorAll('#soldier-number, #soldier-name, #soldier-country').forEach((input) => {

            input.classList.remove('is-valid');
            input.classList.remove('is-invalid');

            input.value = '';

        });

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalAddSoldier.classList.remove('show');
            modalAddSoldierContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)

    }

    function openSoldierListModal() {

        // Add the slide-in effect by adding the necessary classes
        modalListSoldier.classList.add('show');
        modalListSoldierContent.classList.add('show');
        modalListSoldierContent.classList.add('slide-in');

        loadingIndicator.style.display = 'flex';

        fetch(`/clients`, {
            method: 'GET'
        })
            .then(response => response.json())
            .then(data => {
                // Parse the JSON string into an array of objects
                var soldierListData = data;
                soldierListData = soldierListData.filter(item => item.id !== '4');

                const tbody = document.getElementById('tableBodyModal');
                const assetTableBody = document.getElementById('soldierTable').getElementsByTagName('tbody')[0];
                tbody.innerHTML = '';

                allCheckedRow = []; // Reset the global array

                // Dynamically create the header checkbox
                const headerCheckbox = document.createElement('input');
                headerCheckbox.type = 'checkbox';
                headerCheckbox.className = 'form-check-input header-checkbox';
                headerCheckbox.style.border = '1px solid black'; // Make the border more bold
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
                    row.appendChild(codeCell);

                    // Room status cell
                    const nameCell = document.createElement("td");
                    nameCell.textContent = item.name;
                    row.appendChild(nameCell);

                    // Room status cell
                    const countryCell = document.createElement("td");
                    countryCell.textContent = item.country;
                    row.appendChild(countryCell);

                    // Attach click event for each row
                    row.addEventListener('click', (event) => {
                        // Check if the clicked element is not the first td in the row
                        if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0) {
                            openEditSoldierModal(item.id, item.name, item.country);
                        }
                    });

                    // Append row to the table body
                    tbody.appendChild(row);
                });

                const rowsTable = assetTableBody.getElementsByTagName("tr");
                firstUpdateTable(rowsTable, 0, 10, 'pageNumberSecond');

                setupTableNavigation("soldierTable", "prevBtnSecond", "nextBtnSecond", "pageNumberSecond");
            })
            .catch(error => console.error("Error fetching keys:", error))
            .finally(() => {
                loadingIndicator.style.display = 'none';
            })

        // Ensure that any 'slide-out' class is removed if it was previously added
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

            document.querySelectorAll('.search-input-soldier').forEach((input) => {
                input.value = '';
            });

            modalListSoldier.classList.remove('show');
            modalListSoldierContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)

    }

    function openEditSoldierModal(id, name, country) {

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
    }

    function closeEditSoldierModal() {
        // Add the slide-out effect
        modalEditSoldierContent.classList.add('slide-out');
        modalEditSoldierContent.classList.remove('slide-in');

        document.querySelectorAll('#edit-soldier-number, #edit-soldier-name, #edit-soldier-country').forEach((input) => {

            input.classList.remove('is-valid');
            input.classList.remove('is-invalid');

            input.value = '';

        });

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalEditSoldier.classList.remove('show');
            modalEditSoldierContent.classList.remove('show');
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

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modal.classList.remove('show');
            modalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function closeGlobalMessModal() {
        // Add the slide-out effect
        modalGlobalMessContent.classList.add('slide-out');
        modalGlobalMessContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
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

            if (!isWarning) {
                // Refresh the page after the modal is closed
                window.location.reload();
            }

        }, 400); // Match the duration of the animation (0.4s)
    }

    document.getElementsByClassName('close-btn')[0].onclick = closeModalKey;
    document.getElementsByClassName('close-btn')[1].onclick = closeModal;
    document.getElementsByClassName('close-btn')[2].onclick = closeViewReportModal;
    document.getElementsByClassName('close-btn')[3].onclick = closeViewModal;
    document.getElementsByClassName('close-btn')[4].onclick = closeMoveModal;
    document.getElementsByClassName('close-btn')[5].onclick = closeSoldierListModal;
    document.getElementsByClassName('close-btn')[6].onclick = closeEditSoldierModal;
    document.getElementsByClassName('close-btn')[7].onclick = closeAddSoldierModal;
    document.getElementsByClassName('close-btn')[8].onclick = closeAddMultiSoldierModal;
    document.getElementsByClassName('close-btn')[9].onclick = closeUploadMultiSoldierModal;
    document.getElementsByClassName('close-btn')[10].onclick = closeDeleteModal;
    document.getElementsByClassName('close-btn')[11].onclick = closeModalDest;
    document.getElementsByClassName('close-btn')[12].onclick = closeModalAddRoom;
    document.getElementsByClassName('close-btn')[13].onclick = closeModalRemoveRoom;
    document.getElementsByClassName('close-btn')[14].onclick = closeModalAddKey;
    document.getElementsByClassName('close-btn')[15].onclick = closeModalRemoveKey;
    document.getElementsByClassName('close-btn')[16].onclick = closeAdditionalItemModal;
    document.getElementsByClassName('close-btn')[17].onclick = closeGlobalMessModal;

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

            document.getElementById('room-number-header').classList.remove('ascending', 'descending');
            document.getElementById('room-status-header').classList.remove('ascending', 'descending');
            document.getElementById('count-free-beds-header').classList.remove('ascending', 'descending');

            loadingIndicator.style.display = 'flex';

            fetch(`/accommodation?isFirstTime=true&numBuild=${id}`, {
                method: 'GET'
            })
                .then(response => response.json())
                .then(data => {
                    nameroomSetCount = data.nameroomSetCount;
                    document.getElementById('previewTypeBuild').value = data.type;
                    document.getElementById('typeBuild').value = data.type;

                    const headerTable = data.headerTable;
                    const tableHeader = document.querySelector('#keyModal .modal-content .table-container table thead tr');
                    tableHeader.innerHTML = '';

                    headerTable.forEach(function (item) {
                        const th = document.createElement('th');
                        th.textContent = item.name;
                        tableHeader.appendChild(th);
                    });

                    const titlePage = data.titlePage;
                    const countBeds = data.countFreeBeds;

                    document.querySelector('.col-md-auto h3 div').textContent = titlePage;
                    if (countBeds) {
                        document.querySelector('.col-md-auto h3 .name-add').textContent = `(${countBeds} free beds)`;
                    } else {
                        document.querySelector('.col-md-auto h3 .name-add').textContent = '';
                    }

                    const tbody = document.getElementById('tableBody');
                    tbody.innerHTML = '';

                    nameroomSetCount.forEach(item => {
                        const row = document.createElement("tr");
                        row.classList.add('data-room');

                        const nameroomCell = document.createElement("td");
                        nameroomCell.textContent = item.nameroom;
                        row.appendChild(nameroomCell);

                        const statusCell = document.createElement("td");
                        if (item.countFreeBeds != 0) {
                            statusCell.classList.add('undefined-data');
                        }
                        statusCell.textContent = item.countFreeBeds != 0 ? 'Free' : 'Occupied';
                        row.appendChild(statusCell);

                        const quantityCell = document.createElement("td");
                        quantityCell.textContent = item.countFreeBeds;
                        row.appendChild(quantityCell);

                        row.addEventListener('click', function (event) {
                            const roomnumber = event.currentTarget.querySelector('td:nth-child(1)').textContent;
                            document.getElementById('numBuild').value = id;

                            openModalKey(roomnumber);
                        });

                        tbody.appendChild(row);
                    });
                })
                .catch(error => console.error("Error fetching keys:", error))
                .finally(() => {
                    loadingIndicator.style.display = 'none';
                });
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
    window.onclick = function (event) {

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

            case modalAddMultiSoldier:
                closeAddMultiSoldierModal();
                break;

            case modalGlobalMess:
                closeGlobalMessModal();
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
    };

    function firstUpdateTable(rows, currentIndex, rowsPerPage, pageNumberId) {
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display = i >= currentIndex && i < currentIndex + rowsPerPage ? "table-row" : "none";
        }

        let totalPages = Math.ceil(rows.length / rowsPerPage) || 1; // Recalculate total pages (avoid division by zero)
        let currentPage = Math.floor(currentIndex / rowsPerPage) + 1;
        document.getElementById(pageNumberId).textContent = `${currentPage}/${totalPages}`;
    }

    async function fetchReport(selectDate1, selectDate2) {

        loadingIndicator.style.display = 'flex';

        try {

            const response = await fetch(`/accommodation/viewReport`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ selectedDate1: selectDate1, selectedDate2: selectDate2 }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Error fetching the report:', error.details || 'Network response was not ok');
            }

            const { data, data_move } = await response.json();

            // Clear existing rows from bike usage details table
            const soldierUsageTableBody = document.getElementById('soldierUsageTable').getElementsByTagName('tbody')[0];
            const soldierMoveTableBody = document.getElementById('soldierMoveTable').getElementsByTagName('tbody')[0];

            data.forEach(row => {
                const newRow = soldierUsageTableBody.insertRow();
                newRow.insertCell().textContent = row.namekey ? row.namekey : 'No key assigned';
                newRow.insertCell().textContent = row.namesoldier;
                newRow.insertCell().textContent = row.country;
                newRow.insertCell().textContent = row.date_accommodation ? row.date_accommodation : 'Not accommodated';
                newRow.insertCell().textContent = row.date_free ? row.date_free : 'No departure date';
                newRow.insertCell().textContent = row.meal_card ? row.meal_card : 'No meal card set';
                newRow.insertCell().textContent = row.code ? row.code : 'No bag set';
            });

            data_move.forEach(row => {
                const newRow = soldierMoveTableBody.insertRow();
                newRow.insertCell().textContent = row.previous_room;
                newRow.insertCell().textContent = row.current_room;
                newRow.insertCell().textContent = row.name_soldier;
                newRow.insertCell().textContent = row.datemove;
            });

            const rowsTable = soldierUsageTableBody.getElementsByTagName("tr");
            const rowsTableMove = soldierMoveTableBody.getElementsByTagName("tr");

            firstUpdateTable(rowsTable, 0, 10, 'pageNumber');
            firstUpdateTable(rowsTableMove, 0, 10, 'pageNumberDate');

            setupTableNavigation("soldierUsageTable", "prevBtn", "nextBtn", "pageNumber");
            setupTableNavigation("soldierMoveTable", "prevBtnDate", "nextBtnDate", "pageNumberDate");

        } catch (error) {
            console.error('Error fetching the report:', error);
        } finally {
            loadingIndicator.style.display = 'none';
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

    document.getElementById('confirmReportBtn').addEventListener('click', () => {

        const selectDate1 = document.getElementById('selectedDate1').value;
        const selectDate2 = document.getElementById('selectedDate2').value;
        const today = new Date().toISOString().split('T')[0];

        if (!selectDate1 || !selectDate2) {
            showGlobalMess('Error', 'Both dates must be selected!');
            return;
        }

        if (new Date(selectDate1) > new Date(selectDate2)) {
            showGlobalMess('Error', 'Invalid time slot!');
            return;
        }

        closeViewReportModal();

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

            loadingIndicator.style.display = 'flex';

            for (const data of allCheckedRow) {

                isRemove = true;

                const response = await fetch('/accommodation/removeSoldier', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });

                if (!response.ok) {
                    isError = true;
                }

                result = await response.json();
            }

            loadingIndicator.style.display = 'none';
            closeGlobalMessModal();
        });

        modalGlobalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isRemove) {
                modalGlobalMessContent.removeChild(submitButton);
            }
        });

        observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show the info modal
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalGlobalMess.classList.contains('show') && isRemove) {
                closeWarningObserver.disconnect();
                if (isRemove && !isError) {
                    showGlobalMess('Info', 'Soldiers removed successfully');
                } else if (isError) {
                    showGlobalMess('Error', result.message);
                }
            }
        });

        closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        showGlobalMess('Warning', 'Are you sure you want to remove the selected soldiers, this action will remove all data for the selected soldiers?');
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

        loadingIndicator.style.display = 'flex';

        try {
            const table1 = document.getElementById("soldierUsageTable");
            const rows1 = Array.from(table1.querySelectorAll("tbody tr"));

            const table2 = document.getElementById("soldierMoveTable");
            const rows2 = Array.from(table2.querySelectorAll("tbody tr"));

            const data = rows1
                .map((row) => {
                    const cells = row.querySelectorAll("td");
                    return {
                        roomNumber: cells[0]?.innerText.trim(),
                        soldierName: cells[1]?.innerText.trim(),
                        country: cells[2]?.innerText.trim(),
                        dateIn: cells[3]?.innerText.trim(),
                        dateOut: cells[4]?.innerText.trim(),
                        mealCard: cells[5]?.innerText.trim(),
                        laundryBag: cells[6]?.innerText.trim(),
                    };
                }).filter(row => row.soldierName); // Exclude empty rows

            const data_1 = rows2
                .map((row) => {
                    const cells = row.querySelectorAll("td");
                    return {
                        oldRoom: cells[0]?.innerText.trim(),
                        newRoom: cells[1]?.innerText.trim(),
                        soldierName: cells[2]?.innerText.trim(),
                        dateRelock: cells[3]?.innerText.trim(),
                    };
                }).filter(row => row.oldRoom); // Exclude empty rows

            // Collect filter values if the search inputs are visible
            const filtersSoldier = {};
            document.querySelectorAll('.search-input-view').forEach(input => {
                filtersSoldier[input.name || input.id] = input.value.trim();
            });

            // Collect filter values if the search inputs are visible
            const filtersSoldierMove = {};
            document.querySelectorAll('.search-input-view-second').forEach(input => {
                filtersSoldierMove[input.name || input.id] = input.value.trim();
            });

            const response = await fetch(document.getElementById('form2').action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ result: data, result_nationality: data_1, filtersSoldier: filtersSoldier, filtersSoldierMove: filtersSoldierMove })
            });

            if (!response.ok) throw new Error(await response.text());

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
            console.error('Error:', error);
            alert(error.message || 'Failed to download the report.');

        } finally {
            loadingIndicator.style.display = 'none';
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

    document.getElementById('upload-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInput");
        const file = fileInput.files[0];

        if (!file) {
            showGlobalMess("Error", "You have not selected a file to upload");
            return;
        }

        const url = "/accommodation/uploadSoldier";
        const progressBar = document.getElementById("progress");

        const updateProgressBar = (percentage) => {
            progressBar.style.width = percentage + "%";
        };

        updateProgressBar(0);

        const formData = new FormData();
        formData.append("file", file);

        // Use XMLHttpRequest to track upload progress
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);

        xhr.upload.onprogress = function (event) {
            if (event.lengthComputable) {
                const percentage = (event.loaded / event.total) * 100;
                updateProgressBar(percentage);
            }
        };

        xhr.onload = function () {
            if (xhr.status === 200) {
                setTimeout(() => {
                    closeAddMultiSoldierModal();
                    showGlobalMess("Info", "File uploaded successfully!");
                }, 1000);
            } else {
                const data = JSON.parse(xhr.responseText);
                if (data.errors) {
                    data.errors.forEach(error => {
                        if (error.type === 'DuplicateInFile' || error.type === 'DuplicateInDB' || error.type === 'InvalidFormat') {
                            closeAddMultiSoldierModal();
                            showGlobalMess("Error", error.message);
                        } else if (error.type === 'Validation') {
                            closeAddMultiSoldierModal();
                            showGlobalMess("Error", `Invalid data in row with Id: ${error.row.soldierId}. Check the syntax of ID, name, and country.`);
                        }
                    });
                } else {
                    closeAddMultiSoldierModal();
                    showGlobalMess("Error", data.error || "File upload failed.");
                }
            }
        };

        xhr.onerror = function () {
            console.error('Error:', xhr.statusText);
            closeAddMultiSoldierModal();
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

        const url = "/accommodation/uploadMultiSoldier";
        const progressBar = document.getElementById("progress-multi-soldier");

        const updateProgressBar = (percentage) => {
            progressBar.style.width = percentage + "%";
        };

        updateProgressBar(0);

        const formData = new FormData();
        formData.append("file", file);

        // Use XMLHttpRequest to track upload progress
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);

        xhr.upload.onprogress = function (event) {
            if (event.lengthComputable) {
                const percentage = (event.loaded / event.total) * 100;
                updateProgressBar(percentage);
            }
        };

        xhr.onload = function () {
            if (xhr.status === 200) {
                setTimeout(() => {
                    closeUploadMultiSoldierModal();
                    showGlobalMess("Info", "File uploaded successfully!");
                }, 1000);
            } else {
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

                closeUploadMultiSoldierModal();
            }
        };

        xhr.onerror = function () {
            console.error('Error:', xhr.statusText);
            closeUploadMultiSoldierModal();
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
            { input: soldierCountry, condition: soldierCountry.value === "" }
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
            soldierCountry: soldierCountry.value
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

            loadingIndicator.style.display = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    hasError = true;
                }

            } catch (error) {
                hasError = true;
            } finally {
                loadingIndicator.style.display = 'none';
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

            loadingIndicator.style.display = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    hasError = true;
                }

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;
            } finally {
                loadingIndicator.style.display = 'none';
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
                    closeDeleteModal();
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

            loadingIndicator.style.display = 'flex';

            try {

                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    hasError = true;
                }

            } catch (error) {
                hasError = true;
            } finally {
                loadingIndicator.style.display = 'none';
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
                    showGlobalMess('Info', 'Soldier accommodation successfully');
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

            loadingIndicator.style.display = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)

                });

                responseData = await response.json();

                if (!response.ok) {
                    hasError = true;
                }

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    closeModalDest();
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
        toggleInputValidity(roomId, roomId.value !== "" && /^[a-zA-Z0-9]+$/.test(roomId.value));
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
                { input: roomId, condition: roomId.value === "" || !/^[a-zA-Z0-9]+$/.test(roomId.value) },
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

            loadingIndicator.style.display = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });

                responseData = await response.json();

                if (!response.ok) {
                    hasError = true;
                }

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    closeModalAddRoom();
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

            loadingIndicator.style.display = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    hasError = true;
                }

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    closeModalRemoveRoom();
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

            loadingIndicator.style.display = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    hasError = true;
                }

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    closeModalAddKey();
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

            loadingIndicator.style.display = 'flex';

            try {

                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    hasError = true;
                }

                closeGlobalMessModal();

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    closeModalRemoveKey();
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
            { input: editSoldierCountry, condition: editSoldierCountry.value === "" }
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
            soldierCountry: editSoldierCountry.value
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

            loadingIndicator.style.display = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    hasError = true;
                }

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    closeEditSoldierModal();
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

            loadingIndicator.style.display = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    hasError = true;
                }

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    closeAdditionalItemModal();
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
                            await fetch('/accommodation/moveSoldier', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ moves: moveList })
                            });
                            showGlobalMess('Info', 'Soldier(s) moved successfully!');
                        } else {
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
                            await fetch('/accommodation/moveSoldier', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ moves: moveList })
                            });
                            showGlobalMess('Info', 'Soldier(s) moved successfully!');
                        }
                    }, 500); // Adjust timeout if needed
                }

                noButton.onclick = () => {
                    closeGlobalMessModal();
                }
            }
        } catch (error) {
            console.error('Error handling soldier relocation:', error);
        }
    }

    document.getElementById('form3').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        if (selectedSoldierMoveId.value === "") {
            toggleInputValidity(soldierSearchMoveInput, false);
            return;
        }

        handleSoldierRelocation();

        // const keyId = document.getElementById('previewKey').value;
        // const soldId = document.getElementById('previewSoldier').value;
        // const keyMoveId = document.getElementById('selectedKeyMoveId').value;
        // const soldMoveId = document.getElementById('selectedSoldMoveId').value;

        // const data = {
        //     keyId: keyId,
        //     soldId: soldId,
        //     keyMoveId: keyMoveId,
        //     soldMoveId: soldMoveId
        // };

        // const submitButton = document.createElement('button');
        // var isSubmit = false;
        // let hasError = false;
        // var responseData = {};

        // submitButton.textContent = 'Yes';
        // submitButton.classList.add('btn', 'btn-success');

        // submitButton.addEventListener('click', async () => {
        //     hasError = false;
        //     isSubmit = true;

        //     loadingIndicator.style.display = 'flex';

        //     try {
        //         const response = await fetch(this.action, {
        //             method: 'POST',
        //             headers: {
        //                 'Content-Type': 'application/json',
        //             },
        //             body: JSON.stringify(data)
        //         });

        //         responseData = await response.json();

        //         if (!response.ok) {
        //             hasError = true;
        //         }

        //         closeGlobalMessModal();

        //     } catch (error) {
        //         hasError = true;

        //     } finally {
        //         loadingIndicator.style.display = 'none';
        //     }
        // });

        // modalGlobalMessContent.appendChild(submitButton);

        // // Wait for the modal to close, then check if the submit button was clicked
        // const observer = new MutationObserver(() => {
        //     if (!modalGlobalMess.classList.contains('show') && isSubmit) {
        //         observer.disconnect();

        //         if (modalGlobalMessContent.contains(submitButton)) {
        //             // Check if the button is still a child before removing
        //             modalGlobalMessContent.removeChild(submitButton);
        //         }
        //     }
        // });

        // observer.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // // Close the warning modal and show appropriate messages based on the result
        // const closeWarningObserver = new MutationObserver(() => {
        //     if (!modalGlobalMess.classList.contains('show')) {
        //         closeWarningObserver.disconnect();

        //         if (isSubmit && !hasError) {
        //             closeModalRemoveKey();
        //             showGlobalMess('Info', 'Soldier moved successfully');
        //         } else if (isSubmit) {
        //             showGlobalMess('Error', responseData.message || 'An error occurred while moving the soldier');
        //         }
        //     }
        // });

        // closeWarningObserver.observe(modalGlobalMess, { attributes: true, attributeFilter: ['class'] });

        // // Show the warning modal
        // showGlobalMess('Warning', 'Are you sure you want to move this soldier?');
    };

    // Track sort order and priority for each column
    let sortOrder = {
        nameroom: true, // true means ascending, false means descending
        status: true,
        countFreeBeds: true
    };

    // Maintain the sort priority sequence
    let sortPriority = [];
    var nameroomSetCount;
    var numBuild;

    switch (typeBuild.value) {
        case 'Entrance':
            numBuild = 'E';
            break;

        case 'Dryer':
            numBuild = 'D';
            break;

        default:
            numBuild = document.getElementById('numBuild').value;
            break;
    }

    loadingIndicator.style.display = 'flex';

    fetch(`/accommodation?isFirstTime=true&numBuild=${numBuild}`, {
        method: 'GET'
    })
        .then(response => response.json())
        .then(data => {
            // Parse the JSON string into an array of objects
            nameroomSetCount = data.nameroomSetCount;
        })
        .catch(error => console.error("Error fetching keys:", error))
        .finally(() => {
            loadingIndicator.style.display = 'none';
        });

    // Function to sort data and update the table
    function sortTableData(column) {

        // Toggle sort order for the clicked column
        sortOrder[column] = !sortOrder[column];

        // Update sort priority for multi-sort
        const index = sortPriority.indexOf(column);
        if (index > -1) {
            sortPriority.splice(index, 1);
        }
        sortPriority.unshift(column);

        // Sort nameroomSetCount array using multiple columns based on sortPriority
        nameroomSetCount.sort((a, b) => {
            for (let i = 0; i < sortPriority.length; i++) {
                const col = sortPriority[i];
                let valA, valB;

                if (col === 'nameroom') {
                    valA = a.nameroom.toLowerCase();
                    valB = b.nameroom.toLowerCase();
                } else if (col === 'status') {
                    valA = a.countFreeBeds != 0 ? "Free" : "Occupied";
                    valB = b.countFreeBeds != 0 ? "Free" : "Occupied";
                } else if (col === 'countFreeBeds') {
                    valA = a.countFreeBeds;
                    valB = b.countFreeBeds;
                }

                // Compare values for the current column
                if (valA < valB) return sortOrder[col] ? -1 : 1;
                if (valA > valB) return sortOrder[col] ? 1 : -1;
            }
            return 0;
        });

        // Clear existing rows in the table
        const tbody = document.getElementById("tableBody");
        tbody.innerHTML = "";

        // Populate table with sorted data
        nameroomSetCount.forEach(item => {
            const row = document.createElement("tr");
            row.classList.add("data-room");

            // Room number cell
            const nameroomCell = document.createElement("td");
            nameroomCell.textContent = item.nameroom;
            row.appendChild(nameroomCell);

            // Room status cell
            const statusCell = document.createElement("td");
            if (item.countFreeBeds != 0) {
                statusCell.classList.add('undefined-data');
            }
            statusCell.textContent = item.countFreeBeds != 0 ? 'Free' : 'Occupied';
            row.appendChild(statusCell);

            // Count free beds cell
            const countFreeBedsCell = document.createElement("td");
            countFreeBedsCell.textContent = item.countFreeBeds;
            row.appendChild(countFreeBedsCell);

            // Attach click event for each row
            row.addEventListener('click', function () {
                openModalKey(item.nameroom);
            });

            // Append row to the table body
            tbody.appendChild(row);
        });

        // Update column headers with sort indicators
        updateSortIndicators(column);
    }

    // Function to update sort indicators on column headers
    function updateSortIndicators(activeColumn) {
        // Get header elements
        const headers = {
            nameroom: document.getElementById('room-number-header'),
            status: document.getElementById('room-status-header'),
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
        sortTableData('status');
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

                loadingIndicator.style.display = 'flex';

                try {
                    if (document.getElementById('curent-dest').value !== numBuild) {
                        const response = await fetch(`/accommodation/removeDestination`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ buildId: numBuild })
                        });

                        if (response.ok) {
                            // Show a success message and refresh the page
                            showGlobalMess("Success", `${nameBuild} has been deleted.`);
                            deleteBtn.remove();
                        } else {
                            // Handle the error response
                            const errorData = await response.json();
                            showGlobalMess("Error", errorData.message || "Failed to delete the building.");
                            deleteBtn.remove();

                        }
                    } else {
                        showGlobalMess("Error", "You can only delete a destination when you are outside of it.");
                        deleteBtn.remove();
                    }
                } catch (error) {
                    console.error("Error:", error);
                    showGlobalMess("Error", "An unexpected error occurred.");
                    deleteBtn.remove();

                } finally {
                    loadingIndicator.style.display = 'none';
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

    document.getElementById('newKeyName').addEventListener('input', function () {
        if (newKeyName.value === "") {
            toggleInputValidity(newKeyName, false);
            return;
        } else {
            toggleInputValidity(newKeyName, true);
        }
    });

    document.getElementById("toggleFormButton").addEventListener("click", function () {
        let form = document.getElementById("form12");
        let table = document.getElementById("additonalItemTable");
        form.style.display = form.style.display === "none" ? "flex" : "none";
        table.style.display = form.style.display === "flex" ? "none" : "flex";
    });
});
