document.addEventListener('DOMContentLoaded', function () {

    const modal = document.getElementById('roomModal');
    const modalContent = modal.querySelector('.modal-content');

    const modalMess = document.getElementById('myMessage');
    const modalContentMess = modalMess.querySelector('.modal-content-mess');

    const modalGlobalMess = document.getElementById('myGlobalMessage');
    const modalGlobalMessContent = modalGlobalMess.querySelector('.modal-content-mess');

    const modalAddDest = document.getElementById('destinationModal');
    const modalAddDestContent = modalAddDest.querySelector('.modal-content');

    const modalRep = document.getElementById('reportViewModal');
    const modalRepContent = modalRep.querySelector('.modal-content-view');

    const modalUploadMultiSoldier = document.getElementById('accommodattionModal');
    const modalUploadMultiSoldierContent = modalUploadMultiSoldier.querySelector('.modal-content');

    const modalDeleteSoldier = document.getElementById('deleteModal');
    const modalDeleteSoldierContent = modalDeleteSoldier.querySelector('.modal-content');

    const modalMove = document.getElementById('moveModal');
    const modalMoveContent = modalMove.querySelector('.modal-content');

    const modalAddSoldier = document.getElementById('addSoldierModal');
    const modalAddSoldierContent = modalAddSoldier.querySelector('.modal-content');

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
    const typeBuild = document.getElementById('typeBuild');

    const soldierSearchInput = document.getElementById('soldierSearch');
    const soldierSearchDropdown = document.getElementById('soldierDropdown');
    const selectedSoldierId = document.getElementById('selectedSoldierId');

    const selectKeyInput = document.getElementById('keySearch');
    const selectKeyDropdown = document.getElementById('keyDropdown');
    const selectedKeyId = document.getElementById('selectedKeyId');

    const selectAllKeyInput = document.getElementById('allKeySearch');
    const selectAllKeyDropdown = document.getElementById('allKeyDropdown');

    const selectRoomInput = document.getElementById('roomSearch');
    const selectRoomDropdown = document.getElementById('roomDropdown');
    const selectedRoomId = document.getElementById('selectedRoomId');

    const bagSearchInput = document.getElementById('laundryBagSearch');
    const bagSearchDropdown = document.getElementById('bagDropdown');
    const selectedBagId = document.getElementById('selectedBagId');

    const mealCard = document.getElementById('meal-card-value');

    const soldierSearchMoveInput = document.getElementById('soldierSearchMove');
    const soldierSearchMoveDropdown = document.getElementById('soldierDropdownMove');
    const selectedSoldierMoveId = document.getElementById('selectedKeyMoveId');

    const buildId = document.getElementById('build-id');
    const buildName = document.getElementById('build-name');
    const buildType = document.getElementById('build-type');

    const roomId = document.getElementById('room-id');
    const roomName = document.getElementById('room-name');
    const clickBuild = document.getElementById('click-build');

    const soldierId = document.getElementById('soldier-number');
    const soldierName = document.getElementById('soldier-name');
    const soldierCountry = document.getElementById('soldier-country');

    const keyId = document.getElementById('key-id');
    const keyName = document.getElementById('key-name');
    const selectedRoomForKey = document.getElementById('selected-room-for-key');

    const isAccommodation = document.getElementById('isAccommodation');

    let soldiers = [];
    let rooms = [];
    let allBags = [];
    let specialRooms = [];
    let specialKeys = [];
    let allKeys = [];

    var isWarning = false;

    // Function to fetch soldier from the server
    async function fetchSpecialRoom(numBuild) {
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

            selectRoomInput.classList.remove('is-valid');
            selectRoomInput.classList.add('is-invalid');
        }
    });

    // Handle bike selection
    selectRoomDropdown.addEventListener('click', function (event) {
        const selectedRoom = event.target;
        if (selectedRoom && selectedRoom.dataset.id) {

            selectRoomInput.classList.add('is-valid');
            selectRoomInput.classList.remove('is-invalid');

            selectRoomInput.value = selectedRoom.textContent;
            selectedRoomId.value = selectedRoom.getAttribute('data-id');

            selectRoomDropdown.style.display = 'none';
        }
    });

    // Function to fetch soldier from the server
    async function fetchSpecialKey(numBuild, numRoom) {
        try {
            const responseBike = await fetch(`/specialKeys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ numBuild: numBuild, numRoom: numRoom })
            });

            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }

            specialKeys = await responseBike.json(); // Store fetched bikes in the global variable

        } catch (error) {
            console.log(error);
            showGlobalMess('Error', 'There was a problem with the fetch operation');
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

            selectKeyInput.classList.remove('is-valid');
            selectKeyInput.classList.add('is-invalid');
        }
    });

    // Handle bike selection
    selectKeyDropdown.addEventListener('click', function (event) {
        const selectedKey = event.target;
        if (selectedKey && selectedKey.dataset.id) {

            selectKeyInput.classList.add('is-valid');
            selectKeyInput.classList.remove('is-invalid');

            selectKeyInput.value = selectedKey.textContent;
            selectedKeyId.value = selectedKey.getAttribute('data-id');

            selectKeyDropdown.style.display = 'none';
        }
    });

    // Function to fetch all keys from the server
    async function fetchAllKey() {
        try {
            const responseBike = await fetch(`/allKeys`, {
                method: 'GET'
            });

            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }

            allKeys = await responseBike.json(); // Store fetched bikes in the global variable

        } catch (error) {
            console.log(error);
            showGlobalMess('Error', 'There was a problem with the fetch operation');
        }
    }

    // Show filtered key in the dropdown
    function filterAllKey(query) {
        selectAllKeyDropdown.innerHTML = '';
        const filteredAllKey = allKeys.filter(key =>
            key.name.toLowerCase().includes(query.toLowerCase()) ||
            key.id.toString().includes(query) ||
            key.soldierName.toLowerCase().includes(query.toLowerCase())
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

            const response = await fetch('/getKeyBuildigType', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keyId: keycode })
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
        try {
            const responseBike = await fetch(`/clients`);
            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }
            soldiers = await responseBike.json(); // Store fetched bikes in the global variable

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);
        }
    }

    // Show filtered soldiers in the dropdown
    function filterSoldiers(query) {
        soldierSearchDropdown.innerHTML = '';
        const filteredSoldier = soldiers.filter(soldier => soldier.name.toLowerCase().includes(query.toLowerCase()));

        if (filteredSoldier.length > 0) {
            soldierSearchDropdown.style.display = 'block';
            filteredSoldier.forEach(soldier => {
                const li = document.createElement('li');
                li.textContent = soldier.name;
                li.setAttribute('data-id', soldier.id);
                li.setAttribute('data-country', soldier.country);
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
            soldierSearchDropdown.style.display = 'none';
        }
    });

    // Function to fetch soldier from the server
    async function fetchBag() {
        try {
            const responseBag = await fetch(`/bags`);
            if (!responseBag.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await responseBag.json(); // Store the parsed JSON response once
            allBags = data.allBags; // Access allBags from the parsed data

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);
        }
    }

    // Show filtered soldiers in the dropdown
    function filterBags(query) {
        bagSearchDropdown.innerHTML = '';
        const filteredBag = allBags.filter(bag => bag.name.toLowerCase().includes(query.toLowerCase()));

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

    // Function to fetch room from the server
    async function fetchRoom() {
        try {
            const responseBike = await fetch(`/rooms`);
            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }
            rooms = await responseBike.json(); // Store fetched bikes in the global variable

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);
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

            soldierSearchMoveInput.classList.remove("is-invalid");
            soldierSearchMoveInput.classList.add("is-valid");

            soldierSearchMoveInput.value = selectedSoldier.textContent;
            selectedSoldierMoveId.value = selectedSoldier.getAttribute('data-id');
            soldierSearchMoveDropdown.style.display = 'none';

            const responseSoldier = await fetch(`/move/getSoldier`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ keyId: selectedSoldierMoveId.value })
            });

            if (!responseSoldier.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await responseSoldier.json();
            document.getElementById('modal-soldier-2').textContent = `Soldier: ${result.name}`;
            document.getElementById('selectedSoldMoveId').value = result.id;
        }
    });

    // Hide dropdown if clicked outside
    window.addEventListener('click', function (event) {
        if (!soldierSearchDropdown.contains(event.target) && event.target !== soldierSearchInput) {
            soldierSearchDropdown.style.display = 'none';
        }

        if (!soldierSearchMoveDropdown.contains(event.target) && event.target !== soldierSearchInput) {
            soldierSearchMoveDropdown.style.display = 'none';
        }
    });

    // Fetch the soldier when the script loads
    fetchItem();

    // Fetch the rooms when the script loads
    fetchRoom();

    // Fetch the bags when the script loads
    fetchBag();

    // Fetch all keys when the script loads
    fetchAllKey();

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
                saveButton.onclick = function () {
                    showMess("Info", 'Are you sure you want to proceed?');
                };

                document.getElementById('search-laundry-bag-container').style.display = 'block';
                document.getElementById('input-meal-card').style.display = 'block';

                bagSearchInput.value = laundryBag === "Undefined" ? '' : laundryBag;
                selectedBagId.value = laundryBag === "Undefined" ? '' : allBags.find(bag => bag.name === bagSearchInput.value).id;

                mealCard.value = maleCard === "Undefined" ? '' : maleCard;
                break;

            default:
                handleOtherInputs();
                saveButton.onclick = function () {
                    showMess("Info", 'Are you sure you want to proceed?');
                };

                document.getElementById('search-laundry-bag-container').style.display = 'none';
                document.getElementById('input-meal-card').style.display = 'none';

                break;
        }

        typeBuild.value = document.getElementById('previewTypeBuild').value;

        function handleOtherInputs() {
            moveButton.style.display = 'none';
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

        // Add the slide-in effect by adding the necessary classes
        modal.classList.add('show');
        modalContent.classList.add('show');
        modalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalContent.classList.remove('slide-out');
    }

    function openModalKey(roomNumber) {
        // Remove all slashes from roomNumber
        const cleanedRoomNumber = roomNumber.replace(/[/\s]/g, '');

        // Fetch the keys when the script loads
        fetchSpecialKey(document.getElementById('numBuild').value, cleanedRoomNumber);

        // Add the slide-in effect by adding the necessary classes
        modalKey.classList.add('show');
        modalKeyContent.classList.add('show');
        modalKeyContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalKeyContent.classList.remove('slide-out');

        selectedRoomForKey.value = cleanedRoomNumber;

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
            .catch(error => console.error("Error fetching keys:", error));

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
                    row.innerHTML = `
                        <td>${item.namekey}</td>
                        <td>${item.code}</td>
                        <td class="${!item.namesoldier ? "undefined-data" : ""}">${item.namesoldier || "Free"}</td>
                        <td class="${!item.country ? "undefined-data" : ""}">${item.country || "Undefined"}</td>
                        <td class="${!item.mealcard ? "undefined-data" : ""}">${item.mealcard || "Undefined"}</td>
                        <td class="${!item.lbcode ? "undefined-data" : ""}">${item.lbcode || "Undefined"}</td>`;

                    // Attach click event for each row
                    row.addEventListener('click', function () {
                        openModal(
                            item.namekey,
                            item.namesoldier || "Free",
                            item.country || "Undefined",
                            item.code,
                            item.mealcard || "Undefined",
                            item.lbcode || "Undefined"
                        );
                    });
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

        // Clear upload file from modal
        document.getElementById("deleteCode").value = '';

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

        selectKeyInput.classList.remove('is-valid');
        selectKeyInput.classList.remove('is-invalid');

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

    function closeMessModal() {
        // Add the slide-out effect
        modalContentMess.classList.add('slide-out');
        modalContentMess.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalMess.classList.remove('show');
            modalContentMess.classList.remove('show');
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
    document.getElementsByClassName('close-btn')[2].onclick = closeMessModal;
    document.getElementsByClassName('close-btn')[3].onclick = closeViewModal;
    document.getElementsByClassName('close-btn')[4].onclick = closeMoveModal;
    document.getElementsByClassName('close-btn')[5].onclick = closeAddSoldierModal;
    document.getElementsByClassName('close-btn')[6].onclick = closeAddMultiSoldierModal;
    document.getElementsByClassName('close-btn')[7].onclick = closeUploadMultiSoldierModal;
    document.getElementsByClassName('close-btn')[8].onclick = closeDeleteModal;
    document.getElementsByClassName('close-btn')[9].onclick = closeModalDest;
    document.getElementsByClassName('close-btn')[10].onclick = closeModalAddRoom;
    document.getElementsByClassName('close-btn')[11].onclick = closeModalRemoveRoom;
    document.getElementsByClassName('close-btn')[12].onclick = closeModalAddKey;
    document.getElementsByClassName('close-btn')[13].onclick = closeModalRemoveKey;
    document.getElementsByClassName('close-btn')[14].onclick = closeGlobalMessModal;

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

    function showMess(type, message) {

        const icon = document.getElementById('mess-icon');

        if (type === "Error") {
            icon.src = "/icon/error.png";
            document.getElementById('btnYes').style.display = 'none';
            document.getElementById('mess-text').textContent = message;
        } else {
            icon.src = "/icon/information.png";
            document.getElementById('btnYes').style.display = 'block';
            document.getElementById('mess-text').textContent = message;
        }

        // Add the slide-in effect by adding the necessary classes
        modalMess.classList.add('show');
        modalContentMess.classList.add('show');
        modalContentMess.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalContentMess.classList.remove('slide-out');
    }

    function showGlobalMess(type, message) {

        const icon = document.getElementById('mess-global-icon');

        switch (type) {

            case 'Warning':
                icon.src = "/icon/delete_warning.png";
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

            case modalMess:
                closeMessModal();
                break;

            case modalRep:
                closeViewModal();
                break;

            case modalMove:
                closeMoveModal();
                break;

            case modalAddSoldier:
                closeAddSoldierModal();
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
        }
    };

    async function fetchReport() {
        try {

            const response = await fetch(`/accommodation/viewReport`, {
                method: 'GET',
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

        } catch (error) {
            console.error('Error fetching the report:', error);
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

    // Open the report modal when the Reports button is clicked
    document.getElementById("btnReport").addEventListener("click", function () {
        openViewModal();
        fetchReport();
    });

    // Open the add soldier modal when the Add soldier button is clicked
    document.getElementById("btnAddSoldier").addEventListener("click", function () {
        openAddSoldierModal();
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
    
        try {
            const table1 = document.getElementById("soldierUsageTable");
            const rows1 = Array.from(table1.querySelectorAll("tbody tr"));

            const table2 = document.getElementById("soldierMoveTable");
            const rows2 = Array.from(table2.querySelectorAll("tbody tr"));
    
            const data = rows1
            .filter(row => row.style.display !== 'none')
            .map((row) => {
                const cells = row.querySelectorAll("td");
                return {
                    soldierName: cells[0]?.innerText.trim(),
                    country: cells[1]?.innerText.trim(),
                    dataIn: cells[2]?.innerText.trim(),
                    dateOut: cells[3]?.innerText.trim(),
                    mealCard: cells[4]?.innerText.trim(),
                    laundryBag: cells[5]?.innerText.trim(),
                };
            }).filter(row => row.soldierName); // Exclude empty rows

            const data_1 = rows2
            .filter(row => row.style.display !== 'none')
            .map((row) => {
                const cells = row.querySelectorAll("td");
                return {
                    oldRoom: cells[0]?.innerText.trim(),
                    newRoom: cells[1]?.innerText.trim(),
                    soldierName: cells[2]?.innerText.trim(),
                    dateRelock: cells[3]?.innerText.trim(),
                };
            }).filter(row => row.oldRoom); // Exclude empty rows
    
            const response = await fetch(document.getElementById('form2').action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ result: data, result_nationality: data_1 })
            });
    
            if (!response.ok) throw new Error(await response.text());
    
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'report_laundry.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'Failed to download the report.');
        }
    }

    // Open the move modal when the Move button is clicked
    moveButton.addEventListener("click", function () {

        const roomNum1 = document.getElementById('modal-keynum').textContent;
        const solNum1 = soldierInput.value;

        if (!soldierInput.value) {
            return showMess('Error', 'You must select soldier');
        }

        if (!isAccommodation.value) {
            return showMess('Error', 'This room is empty. To move a soldier, select a room that is occupied!');
        }

        openMoveModal(roomNum1, solNum1);
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
                        if (error.type === 'Duplicate') {
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

        if(soldierId.value  === "") {
            soldierId.classList.remove('is-valid');
            soldierId.classList.add('is-invalid');
            return;
        }

        if(soldierName.value  === "") {
            soldierName.classList.remove('is-valid');
            soldierName.classList.add('is-invalid');
            return;
        }

        if(soldierCountry.value  === "") {
            soldierCountry.classList.remove('is-valid');
            soldierCountry.classList.add('is-invalid');
            return;
        }

        const data = {
            soldierId: soldierId.value,
            soldierName: soldierName.value,
            soldierCountry: soldierCountry.value
        };

        try {
            const response = await fetch(this.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                showGlobalMess('Error', errorData.message);
            } else {
                const data = await response.json();
                showGlobalMess('Info', data.message);
            }

        } catch (error) {
            showGlobalMess('Error', `Network error: ${error.message}`);
        }
    };

    document.querySelectorAll('#soldier-number, #soldier-name, #soldier-country').forEach((input) => {
        input.addEventListener('input', function () {
            if (input.value !== "" && input.checkValidity()) {
                input.classList.add('is-valid');
                input.classList.remove('is-invalid');
            } else {
                input.classList.add('is-invalid');
                input.classList.remove('is-valid');
            }
        });
    });

    document.getElementById('btnAddDestination').addEventListener("click", () => {
        openModalDest();
    });

    document.getElementById('btnFreeAllRoom').addEventListener("click", function () {

        openDeleteModal();

        setTimeout(() => {
            showGlobalMess('Warning', 'WARNING: In the next window you are given the right to release all rooms. Be extremely careful as this process is irreversible.');
        }, 500); // Adjust the time as needed
    });

    document.getElementById('form5').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const data = {
            realCode: document.getElementById('randomTextValue').value,
            enterCode: document.getElementById('deleteCode').value
        };

        if (data.realCode !== data.enterCode)
            return showGlobalMess('Error', 'The two codes do not match. Try again');

        try {
            const response = await fetch(this.action, {
                method: 'GET'
            });

            if (!response.ok) {
                const errorData = await response.json();
                showGlobalMess('Error', errorData.message);
            } else {
                const data = await response.json();
                showGlobalMess('Info', data.message);
            }

            closeDeleteModal();

        } catch (error) {
            showGlobalMess('Error', `Network error: ${error.message}`);
        }
    };

    document.getElementById('form1').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const data = {
            keyCodeId: document.getElementById('key-code-value').value,
            soldierId: document.getElementById('selectedSoldierId').value,
            countryId: document.getElementById('country-value').value,
            bagId: document.getElementById('selectedBagId').value,
            mealCardId: document.getElementById('meal-card-value').value
        };

        try {
            const response = await fetch(this.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                showGlobalMess('Error', errorData.message);
            } else {
                const data = await response.json();
                showGlobalMess('Info', data.message);
            }

            closeMessModal();

        } catch (error) {
            showGlobalMess('Error', `Network error: ${error.message}`);
        }
    };

    buildId.addEventListener('input', () => {
        if (buildId.value === "") {
            buildId.classList.remove('is-valid');
            buildId.classList.add('is-invalid');
        } else {
            buildId.classList.add('is-valid');
            buildId.classList.remove('is-invalid');
        }
    });

    buildName.addEventListener('input', () => {
        if (buildName.value === "") {
            buildName.classList.remove('is-valid');
            buildName.classList.add('is-invalid');
        } else {
            buildName.classList.add('is-valid');
            buildName.classList.remove('is-invalid');
        }
    });

    buildType.addEventListener('input', () => {
        if (buildType.value === "") {
            buildType.classList.remove('is-valid');
            buildType.classList.add('is-invalid');
        } else {
            buildType.classList.add('is-valid');
            buildType.classList.remove('is-invalid');
        }
    });

    document.getElementById('form6').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        if (buildId.value === "") {
            buildId.classList.remove('is-valid');
            buildId.classList.add('is-invalid');
            return;
        }

        if (buildName.value === "") {
            buildName.classList.remove('is-valid');
            buildName.classList.add('is-invalid');
            return;
        }

        if (buildType.value === "") {
            buildType.classList.remove('is-valid');
            buildType.classList.add('is-invalid');
            return;
        }

        const data = {
            buildId: buildId.value,
            buildName: buildName.value,
            buildType: buildType.value
        };

        try {
            const response = await fetch(this.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)

            });

            if (!response.ok) {
                const errorData = await response.json();
                showGlobalMess('Error', errorData.message);

            } else {
                const data = await response.json();
                showGlobalMess('Info', data.message);
            }

            closeModalDest();

        } catch (error) {
            showGlobalMess('Error', `Network error: ${error.message}`);
        }
    };

    roomId.addEventListener('input', () => {
        if (roomId.value === "") {
            roomId.classList.remove('is-valid');
            roomId.classList.add('is-invalid');
        } else {
            roomId.classList.add('is-valid');
            roomId.classList.remove('is-invalid');
        }
    });

    document.getElementById('form7').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        if (roomId.value === "") {
            roomId.classList.remove('is-valid');
            roomId.classList.add('is-invalid');
            return;
        }

        if (roomName.value === "") {
            roomName.classList.remove('is-valid');
            roomName.classList.add('is-invalid');
            return;
        }

        // Remove all '/' from roomId
        const cleanedRoomName = roomName.value.replace(/\//g, '');

        // Check if the cleaned roomId is equal to the original roomId
        if (roomId !== cleanedRoomName) {
            showGlobalMess('Error', 'The room number must equal with room name with remove delimiter (/).');
            return;
        }

        const data = {
            roomId: roomId.value,
            roomName: roomName.value,
            clickBuild: clickBuild.value
        };

        try {
            const response = await fetch(this.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                showGlobalMess('Error', errorData.message);
            } else {
                const responseData = await response.json();
                showGlobalMess('Info', responseData.message);
            }

            closeModalAddRoom();

        } catch (error) {
            showGlobalMess('Error', `Network error: ${error.message}`);
        }
    };

    document.querySelectorAll('#room-name').forEach((input) => {
        input.addEventListener('input', function () {
            if (input.value !== "" && input.checkValidity()) {
                input.classList.add('is-valid');
                input.classList.remove('is-invalid');
            } else {
                input.classList.add('is-invalid');
                input.classList.remove('is-valid');
            }
        });
    });

    document.getElementById('form8').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const roomId = selectedRoomId.value;

        if(roomId === "") {
            selectRoomInput.classList.remove('is-valid');
            selectRoomInput.classList.add('is-invalid');
            return;
        }

        const data = {
            roomId: roomId
        };

        try {
            const response = await fetch(this.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                showGlobalMess('Error', errorData.message);
            } else {
                const responseData = await response.json();
                showGlobalMess('Info', responseData.message);
            }

            closeModalRemoveRoom();

        } catch (error) {
            showGlobalMess('Error', `Network error: ${error.message}`);
        }
    };

    document.getElementById('form9').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        if(keyId.value === "") {
            keyId.classList.remove('is-valid');
            keyId.classList.add('is-invalid');
            return;
        }

        if(keyName.value === "") {
            keyName.classList.remove('is-valid');
            keyName.classList.add('is-invalid');
            return;
        }

        const cleanedKeyName = keyName.value.replace(/\//g, '');

        // Check if the cleaned roomId is equal to the original roomId
        if (keyId !== cleanedKeyName) {
            showGlobalMess('Error', 'The room number must equal with room name with remove delimiter (/).');
            return;
        }

        const data = {
            keyId: keyId,
            keyName: keyName,
            selectedRoomForKey: selectedRoomForKey
        };

        try {
            const response = await fetch(this.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                showGlobalMess('Error', errorData.message);
            } else {
                const responseData = await response.json();
                showGlobalMess('Info', responseData.message);
            }

            closeModalAddKey();

        } catch (error) {
            showGlobalMess('Error', `Network error: ${error.message}`);
        }
    };

    document.querySelectorAll('#key-name, #key-id').forEach((input) => {
        input.addEventListener('input', function () {
            if (input.value !== "" && input.checkValidity()) {
                input.classList.add('is-valid');
                input.classList.remove('is-invalid');
            } else {
                input.classList.add('is-invalid');
                input.classList.remove('is-valid');
            }
        });
    });

    document.getElementById('form10').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        if(selectedKeyId.value === "") {
            selectKeyInput.classList.remove('is-valid');
            selectKeyInput.classList.add('is-invalid');
            return;
        } else {
            selectKeyInput.classList.add('is-valid');
            selectKeyInput.classList.remove('is-invalid');
        }

        const data = {
            keyId: selectedKeyId.value
        };

        try {
            const response = await fetch(this.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                showGlobalMess('Error', errorData.message);

            } else {
                const responseData = await response.json();
                showGlobalMess('Info', responseData.message);
            }

            closeModalRemoveKey();

        } catch (error) {
            showGlobalMess('Error', `Network error: ${error.message}`);
        }
    };

    document.getElementById('form3').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        if (selectedSoldierMoveId.value === "") {
            soldierSearchMoveInput.classList.add("is-invalid");
            soldierSearchMoveInput.classList.remove("is-valid");
            return;
        }

        const keyId = document.getElementById('previewKey').value;
        const soldId = document.getElementById('previewSoldier').value;
        const keyMoveId = document.getElementById('selectedKeyMoveId').value;
        const soldMoveId = document.getElementById('selectedSoldMoveId').value;

        const data = {
            keyId: keyId,
            soldId: soldId,
            keyMoveId: keyMoveId,
            soldMoveId: soldMoveId
        };

        try {
            const response = await fetch(this.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                showGlobalMess('Error', errorData.message);

            }

            closeModalRemoveKey();

        } catch (error) {
            showGlobalMess('Error', `Network error: ${error.message}`);
        }
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

    fetch(`/accommodation?isFirstTime=true&numBuild=${numBuild}`, {
        method: 'GET'
    })
        .then(response => response.json())
        .then(data => {
            // Parse the JSON string into an array of objects
            nameroomSetCount = data;
        })
        .catch(error => console.error("Error fetching keys:", error));

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

            clickBuild.value = numBuild;
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

});
