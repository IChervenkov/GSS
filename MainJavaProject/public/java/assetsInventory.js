document.addEventListener('DOMContentLoaded', function () {

    const assetsModal = document.getElementById('assetsModal');
    const assetsModalContent = assetsModal.querySelector('.modal-content');

    const assetsEditModal = document.getElementById('editAssetsModal');
    const assetsEditModalContent = assetsEditModal.querySelector('.modal-content');

    const assetsAddModal = document.getElementById('addAssetsModal');
    const assetsAddModalContent = assetsAddModal.querySelector('.modal-content');

    const modalMess = document.getElementById("myMessage");
    const modalMessContent = modalMess.querySelector('.modal-content-mess');

    const assetSearchInput = document.getElementById('assetSearch');
    const assetSearchDropdown = document.getElementById('assetDropdown');
    const selectedAssetId = document.getElementById('selectedAssetId');

    const assetEps = document.getElementById('assetEpc');
    const assetCodeSearch = document.getElementById('assetCodeSearch');
    const assetAddName = document.getElementById('assetAddName');

    const typeSearchInput = document.getElementById('typeSearch');
    const typeSearchDropdown = document.getElementById('typeDropdown');
    const selectedTypeId = document.getElementById('selectedTypeId');

    const typeAddSearchInput = document.getElementById('addTypeSearch');
    const typeAddSearchDropdown = document.getElementById('addTypeDropdown');
    const selectedAddTypeId = document.getElementById('selectedAddTypeId');

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

    // Track sort order and priority for each column
    let sortOrder = {
        nameroom: true, // true means ascending, false means descending
        count_assets: true
    };

    // Track sort order and priority for each column
    let sortOrderAsset = {
        code: true, // true means ascending, false means descending
        name: true,
        type: true,
        location: true
    };

    // Maintain the sort priority sequence
    let sortPriority = [];
    let sortPriorityAsset = [];

    var nameroomSetCount;
    var nameAssetSetCount;
    var assetType;
    var assetLocation;
    var uniqueRooms;

    var allCheckedRow = [];
    var oldAssetNameKey;
    var isInfo = true;

    var numBuild = document.getElementById('numBuild').value;

    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

    fetch(`/assets/getSortedRoom?numBuild=${numBuild}`, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            // Parse the JSON string into an array of objects
            nameroomSetCount = data;
        })
        .catch(error => console.error("Error fetching keys:", error));

    fetch(`/assets/getAllType`, {
        method: 'GET'
    })
        .then(response => response.json())
        .then(data => {
            // Parse the JSON string into an array of objects
            assetType = data;
        })
        .catch(error => console.error("Error fetching keys:", error));

    fetch(`/allKeys`, {
        method: 'GET'
    })
        .then(response => response.json())
        .then(data => {
            // Parse the JSON string into an array of objects
            assetLocation = data;
            uniqueRooms = Array.from(
                new Map(
                    data
                        .filter(row => row.roomid != null) // Exclude rows with null roomid
                        .map(row => [row.roomid, { roomid: row.roomid, nameroom: row.nameroom }])
                ).values()
            );
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
                } else if (col === 'count_assets') {
                    valA = a.count_assets;
                    valB = b.count_assets;
                }

                // Compare values for the current column
                if (valA < valB) return sortOrder[col] ? -1 : 1;
                if (valA > valB) return sortOrder[col] ? 1 : -1;
            }
            return 0;
        });

        // Clear existing rows in the table
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = "";

        // Populate table with sorted data
        nameroomSetCount.forEach(item => {
            const row = document.createElement("tr");
            row.classList.add('data-room');
            row.setAttribute("id", item.id);

            // Room number cell
            const nameroomCell = document.createElement("td");
            nameroomCell.textContent = item.nameroom;
            row.appendChild(nameroomCell);

            // Room status cell
            const quantityCell = document.createElement("td");
            quantityCell.textContent = item.count_assets;
            row.appendChild(quantityCell);

            // Attach click event for each row
            row.addEventListener('click', function (event) {
                const rowId = event.currentTarget.id;
                openAssetsModal(rowId);
            });

            // Append row to the table body
            tbody.appendChild(row);
        });

        // Update column headers with sort indicators
        updateSortIndicators(column);
    }

    // Function to sort data and update the table
    function sortTableAssetsData(column) {

        // Toggle sort order for the clicked column
        sortOrderAsset[column] = !sortOrderAsset[column];

        // Update sort priority for multi-sort
        const index = sortPriorityAsset.indexOf(column);
        if (index > -1) {
            sortPriorityAsset.splice(index, 1);
        }
        sortPriorityAsset.unshift(column);

        // Sort nameroomSetCount array using multiple columns based on sortPriority
        nameAssetSetCount.sort((a, b) => {
            for (let i = 0; i < sortPriorityAsset.length; i++) {
                const col = sortPriorityAsset[i];
                let valA, valB;

                if (col === 'code') {
                    valA = a.code.toLowerCase();
                    valB = b.code.toLowerCase();
                } else if (col === 'name') {
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                } else if (col === 'type') {
                    valA = a.type.toLowerCase();
                    valB = b.type.toLowerCase();
                } else if (col === 'location') {
                    valA = a.location.toLowerCase();
                    valB = b.location.toLowerCase();
                }

                // Compare values for the current column
                if (valA < valB) return sortOrderAsset[col] ? -1 : 1;
                if (valA > valB) return sortOrderAsset[col] ? 1 : -1;
            }
            return 0;
        });

        // Clear existing rows in the table
        const tbody = document.getElementById('tableBodyModal');
        tbody.innerHTML = "";

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
            document.querySelectorAll('.form-check-input:not(.header-checkbox)').forEach(checkbox => {
                checkbox.checked = isChecked;
                if (isChecked) {
                    checkbox.style.backgroundColor = 'green';
                    allCheckedRow.push({ code: checkbox.dataset.id });
                } else {
                    checkbox.style.backgroundColor = '';
                    allCheckedRow = [];
                }
            });
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

        // Populate table with sorted data
        nameAssetSetCount.forEach(item => {
            const row = document.createElement("tr");
            row.classList.add('data-asset');

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
            codeCell.textContent = item.code;
            row.appendChild(codeCell);

            // Room status cell
            const nameCell = document.createElement("td");
            nameCell.textContent = item.name;
            row.appendChild(nameCell);

            // Room status cell
            const typeCell = document.createElement("td");
            typeCell.textContent = item.type;
            row.appendChild(typeCell);

            // Room status cell
            const locationCell = document.createElement("td");
            locationCell.textContent = item.location;
            row.appendChild(locationCell);

            const subLocationCell = document.createElement("td");
            subLocationCell.textContent = item.namekey;
            row.appendChild(subLocationCell);

            // Attach click event for each row
            row.addEventListener('click', (event) => {
                // Check if the clicked element is not the first td in the row
                if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0) {
                    openEditAssetsModal(item.code, item.name, item.type, item.location, item.namekey);
                }
            });

            // Append row to the table body
            tbody.appendChild(row);
        });

        // Update column headers with sort indicators
        updateSortIndicatorsAssets(column);
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
            name: document.getElementById('asset-name-header'),
            type: document.getElementById('asset-type-header'),
            location: document.getElementById('asset-location-header'),
            namekey: document.getElementById('asset-sub-location-header')
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
            assetSearchInput.value = selectedAsset.textContent;
            selectedAssetId.value = selectedAsset.getAttribute('data-id');
            assetSearchDropdown.style.display = 'none';

            toggleInputValidity(assetSearchInput, true);
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
        const filteredSubLocation = assetLocation.filter(location => selectedAddLocationId.value === location.roomid && location.name.toLowerCase().includes(query.toLowerCase()));

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

    assetName.addEventListener('input', () => {
        toggleInputValidity(assetName, assetName.value !== '' && assetName.checkValidity());
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

    function closeMessModal() {
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

            if (isInfo)
                window.location.reload();

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAddAssetsModal() {
        // Add the slide-in effect by adding the necessary classes
        assetsAddModal.classList.add('show');
        assetsAddModalContent.classList.add('show');
        assetsAddModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        assetsAddModalContent.classList.remove('slide-out');
    }

    function closeAddAssetsModal() {

        // Add the slide-out effect
        assetsAddModalContent.classList.add('slide-out');
        assetsAddModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#assetEpc, #assetCodeSearch, #assetAddName, #addTypeSearch, #selectedAddTypeId, #addLocationSearch, #selectedAddLocationId, #addSubLocationSearch, #selectedAddSubLocationId').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';

            });

            assetsAddModal.classList.remove('show');
            assetsAddModalContent.classList.remove('show');

            typeAddSearchDropdown.style.display = 'none';
            addLocationSearchDropdown.style.display = 'none';
            addSubLocationSearchDropdown.style.display = 'none';

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openEditAssetsModal(assetCode, name, type, location, assetNameKey) {

        assetSearchInput.value = assetCode;
        selectedAssetId.value = nameAssetSetCount.find(asset => asset.code === assetCode).id;

        assetName.value = name;

        typeSearchInput.value = type;
        selectedTypeId.value = assetType.find(item => item.name === type).id;

        locationSearchInput.value = location;
        selectedLocationId.value = assetLocation.find(item => item.nameroom === location).roomid;

        if (selectedTypeId.value !== '1') {
            subLocationSearchInput.disabled = true;
            oldAssetNameKey = subLocationSearchInput.value;
            subLocationSearchInput.value = '';
            selectedSubLocationId.value = '';
        } else {
            subLocationSearchInput.disabled = false;
            subLocationSearchInput.value = assetNameKey;
            selectedSubLocationId.value = assetLocation.find(item => item.name === assetNameKey).id;
        }


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

            document.querySelectorAll('#assetSearch, #selectedAssetId, #assetName, #typeSearch, #selectedTypeId, #locationSearch, #selectedLocationId, #subLocationSearch, #selectedSubLocationId').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';

            });

            assetsEditModal.classList.remove('show');
            assetsEditModalContent.classList.remove('show');

            assetSearchDropdown.style.display = 'none';
            typeSearchDropdown.style.display = 'none';
            locationSearchDropdown.style.display = 'none';
            subLocationSearchDropdown.style.display = 'none';

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAssetsModal(rowId) {

        // Add the slide-in effect by adding the necessary classes
        assetsModal.classList.add('show');
        assetsModalContent.classList.add('show');
        assetsModalContent.classList.add('slide-in');

        fetch(`/assets/getSortedAssets?numRoom=${rowId}`, {
            method: 'POST'
        })
            .then(response => response.json())
            .then(data => {
                // Parse the JSON string into an array of objects
                nameAssetSetCount = data;

                const tbody = document.getElementById('tableBodyModal');
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
                    document.querySelectorAll('.form-check-input:not(.header-checkbox)').forEach(checkbox => {
                        checkbox.checked = isChecked;
                        if (isChecked) {
                            checkbox.style.backgroundColor = 'green';
                            allCheckedRow.push({ code: checkbox.dataset.id });
                        } else {
                            checkbox.style.backgroundColor = '';
                            allCheckedRow = [];
                        }
                    });
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

                nameAssetSetCount.forEach(item => {
                    const row = document.createElement("tr");
                    row.classList.add('data-asset');

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
                    codeCell.textContent = item.code;
                    row.appendChild(codeCell);

                    // Room status cell
                    const nameCell = document.createElement("td");
                    nameCell.textContent = item.name;
                    row.appendChild(nameCell);

                    // Room status cell
                    const typeCell = document.createElement("td");
                    typeCell.textContent = item.type;
                    row.appendChild(typeCell);

                    // Room status cell
                    const locationCell = document.createElement("td");
                    locationCell.textContent = item.location;
                    row.appendChild(locationCell);

                    // Room status cell
                    const subLocationCell = document.createElement("td");
                    subLocationCell.textContent = item.namekey;
                    row.appendChild(subLocationCell);

                    // Attach click event for each row
                    row.addEventListener('click', (event) => {
                        // Check if the clicked element is not the first td in the row
                        if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0) {
                            openEditAssetsModal(item.code, item.name, item.type, item.location, item.namekey);
                        }
                    });

                    // Append row to the table body
                    tbody.appendChild(row);
                });
            })
            .catch(error => console.error("Error fetching keys:", error));

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

            // Get header elements
            const headers = {
                code: document.getElementById('asset-code-header'),
                name: document.getElementById('asset-name-header'),
                type: document.getElementById('asset-type-header'),
                location: document.getElementById('asset-location-header'),
                namekey: document.getElementById('asset-sub-location-header')
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
    document.getElementsByClassName('close-btn')[3].onclick = closeMessModal;

    // Close the modal if the user clicks outside of it
    window.onclick = function (event) {

        switch (event.target) {
            case assetsModal:
                closeAssetsModal();
                break;

            case modalMess:
                closeMessModal();
                break;

            case assetsEditModal:
                closeEditAssetsModal();
                break;

            case assetsAddModal:
                closeAddAssetsModal();
                break;
        }
    };

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
        sortTableAssetsData('name');
    });

    document.getElementById('asset-type-header').addEventListener('click', function () {
        sortTableAssetsData('type');
    });

    document.getElementById('asset-location-header').addEventListener('click', function () {
        sortTableAssetsData('location');
    });

    document.getElementById('asset-sub-location-header').addEventListener('click', function () {
        sortTableAssetsData('namekey');
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

            for (const data of allCheckedRow) {

                const response = await fetch('/assets/deleteAsset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });

                result = await response.json();

                if (!response.ok) {
                    hasError = true;
                }
            }

            closeMessModal();
        });
        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isRemove) {
                modalMessContent.removeChild(submitButton);
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show the info modal
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isRemove) {
                closeWarningObserver.disconnect();
                if (isSubmit && !hasError) {
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

    document.getElementById('form1').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        if (selectedAssetId.value === '') {
            toggleInputValidity(assetSearchInput, false);
            return;
        }

        if (assetName.value === '' || !assetName.checkValidity()) {
            toggleInputValidity(assetName, false);
            return;
        }

        if (selectedTypeId.value === '') {
            toggleInputValidity(typeSearchInput, false);
            return;
        }

        if (selectedLocationId.value === '') {
            toggleInputValidity(locationSearchInput, false);
            return;
        }

        if (!subLocationSearchInput.disabled && selectedSubLocationId.value === '') {
            toggleInputValidity(subLocationSearchInput, false);
            return;
        }

        const data = {
            assetId: selectedAssetId.value,
            assetName: assetName.value,
            assetType: selectedTypeId.value,
            assetLocation: selectedLocationId.value,
            assetSubLocation: selectedSubLocationId.value
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
                showMess('Error', errorData.message);
            } else {
                const data = await response.json();
                showMess('Info', data.message);
            }

            closeEditAssetsModal();

        } catch (error) {
            showMess('Error', `Network error: ${error.message}`);
        }
    };

    document.getElementById('form2').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        if (assetEps.value === '' || !assetEps.checkValidity()) {
            toggleInputValidity(assetEps, false);
            return;
        }

        if (assetCodeSearch.value === '' || !assetCodeSearch.checkValidity()) {
            toggleInputValidity(assetCodeSearch, false);
            return;
        }

        if (assetAddName.value === '' || !assetAddName.checkValidity()) {
            toggleInputValidity(assetAddName, false);
            return;
        }

        if (selectedAddTypeId.value === '') {
            toggleInputValidity(typeAddSearchInput, false);
            return;
        }

        if (selectedAddLocationId.value === '') {
            toggleInputValidity(addLocationSearchInput, false);
            return;
        }

        if (!addSubLocationSearchInput.disabled && selectedAddSubLocationId.value === '') {
            toggleInputValidity(addSubLocationSearchInput, false);
            return;
        }

        const data = {
            assetEps: assetEps.value,
            assetCodeSearch: assetCodeSearch.value,
            assetAddName: assetAddName.value,
            selectedAddTypeId: selectedAddTypeId.value,
            selectedAddLocationId: selectedAddLocationId.value,
            selectedAddSubLocationId: selectedAddSubLocationId.value
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
                showMess('Error', errorData.message);
            } else {
                const data = await response.json();
                showMess('Info', data.message);
            }

            closeAddAssetsModal();

        } catch (error) {
            showMess('Error', `Network error: ${error.message}`);
        }
    };
});