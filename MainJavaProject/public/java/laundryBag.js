document.addEventListener('DOMContentLoaded', () => {

    const dropOffModal = document.getElementById('dropOffModal');
    const dropOffModalContent = dropOffModal.querySelector('.modal-content');

    const transportationToLaundryFacilityModal = document.getElementById('transportationToLaundryFacilityModal');
    const transportationToLaundryFacilityModalContent = transportationToLaundryFacilityModal.querySelector('.modal-content');

    const laundryFacilityModal = document.getElementById('laundryFacilityModal');
    const laundryFacilityModalContent = laundryFacilityModal.querySelector('.modal-content');

    const transportationToDropOffModal = document.getElementById('transportationToDropOffModal');
    const transportationToDropOffModalContent = transportationToDropOffModal.querySelector('.modal-content');

    const readyToPickUpModal = document.getElementById('readyToPickUpModal');
    const readyToPickUpModalContent = readyToPickUpModal.querySelector('.modal-content');

    const reportViewModal = document.getElementById('reportViewModal');
    const reportViewModalContent = reportViewModal.querySelector('.modal-content-report');

    const reportModal = document.getElementById('reportModal');
    const reportModalContent = reportModal.querySelector('.modal-content-multi-calendar');

    const addBagModal = document.getElementById('addBagModal');
    const addBagModalContent = addBagModal.querySelector('.modal-content');

    const moveBagModal = document.getElementById('moveBagModal');
    const moveBagModalContent = moveBagModal.querySelector('.modal-content');

    const removeBagModal = document.getElementById('removeBagModal');
    const removeBagModalContent = removeBagModal.querySelector('.modal-content');

    const linenExchangeBagModal = document.getElementById('linenExchangeBagModal');
    const linenExchangeBagModalContent = linenExchangeBagModal.querySelector('.modal-content');

    const insertBagModal = document.getElementById('insertBagModal');
    const insertBagModalContent = insertBagModal.querySelector('.modal-content');

    const editBagModal = document.getElementById('editBagModal');
    const editBagModalContent = editBagModal.querySelector('.modal-content');

    const listBagModal = document.getElementById('bagsModal');
    const listBagModalContent = listBagModal.querySelector('.modal-content');

    const editBagSearchInput = document.getElementById('bagEditSearch');
    const editBagSearchDropdown = document.getElementById('editBagDropdown');
    const selectedEditBagId = document.getElementById('selectedEditBagId');

    const editTypeSearchInput = document.getElementById('typeEditSearch');
    const editWashSearchInput = document.getElementById('washEditSearch');

    const addBagSearchInput = document.getElementById('search-add-input-bags');
    const addBagSearchDropdown = document.getElementById('addBagDropDown');
    const selectedAddBagId = document.getElementById('addBagSelectId');

    const moveBagSearchInput = document.getElementById('search-move-input-bags');
    const moveBagSearchDropdown = document.getElementById('moveBagDropDown');
    const selectedMoveBagId = document.getElementById('moveBagSelectId');

    const removeBagSearchInput = document.getElementById('search-remove-input-bags');
    const removeBagSearchDropdown = document.getElementById('removeBagDropDown');
    const selectedRemoveBagId = document.getElementById('removeBagSelectId');

    const linenExchangeBagSearchInput = document.getElementById('search-exchange-input-bags');
    const linenExchangeBagSearchDropdown = document.getElementById('exchangeBagDropDown');
    const selectedLinenExchangeBagId = document.getElementById('exchangeBagSelectId');

    const modalMess = document.getElementById("myMessage");
    const modalMessContent = modalMess.querySelector('.modal-content-mess');

    const destinationByBtn = document.getElementById('destination');
    const prevDestinationByBtn = document.getElementById('prev_destination');

    // Show loading indicator
    const loadingIndicator = document.getElementById('loadingIndicator');

    const csrfToken = document.getElementsByName('_csrf')[0].value;

    let bags = [];
    let allDataBags = [];
    let allCheckedRow = [];
    let allCheckedListBagsRow = [];

    let globalSelectDate1 = "";
    let globalSelectDate2 = "";
    let globalSearchFilters = [];
    let globalSearchFiltersNational = [];

    let globalAction = '';

    let globalClickStatus;
    let globalNextDestination;
    let globalTableContent;
    let globalNavigationPart

    let currentPage = 1;
    let secondCurrentPage = 1;

    let currentDropOffPage = 1;
    let currentTransportationToLaundryFacilityPage = 1;
    let currentLaundryFacilityPage = 1;
    let currentTransportationToDropOffPage = 1;
    let currentReadyToPickUpPage = 1;

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

    document.querySelectorAll('#epc-bag, #code-bag, #type-bag, #max-count-wash-bag').forEach((input) => {
        input.addEventListener('input', function () {
            toggleInputValidity(input, input.value !== "" && input.checkValidity())
        });
    });

    // Function to filter and display dropdown options
    function filterAllBag(inputElement, dropdownElement) {
        const query = inputElement.value.toLowerCase();
        dropdownElement.innerHTML = '';
        const filteredBags = allDataBags.filter(bag => bag.name.toLowerCase().includes(query));

        if (filteredBags.length > 0) {
            dropdownElement.style.display = 'block';
            filteredBags.forEach(bag => {
                const li = document.createElement('li');
                li.textContent = bag.name;
                li.setAttribute('data-id', bag.id);
                dropdownElement.appendChild(li);
            });
        } else {
            dropdownElement.style.display = 'none';
        }
    }

    // Function to initialize bag search behavior
    function initializeAllBagSearch(inputElement, dropdownElement, hiddenInputElement) {
        // Handle input change
        inputElement.addEventListener('input', function () {

            if (inputElement.value.length > 0) {
                filterAllBag(inputElement, dropdownElement);
            } else {
                dropdownElement.style.display = 'none';
                hiddenInputElement.value = '';
                toggleInputValidity(inputElement, hiddenInputElement === '')
            }
        });

        // Handle dropdown click
        dropdownElement.addEventListener('click', function (event) {
            handleDropdownClick(event, inputElement, hiddenInputElement, dropdownElement);

            editTypeSearchInput.value = allDataBags.find(bag => bag.id === hiddenInputElement.value)?.type || '';
            editWashSearchInput.value = allDataBags.find(bag => bag.id === hiddenInputElement.value)?.maxcountlandry || '';

            toggleInputValidity(editTypeSearchInput, editTypeSearchInput !== '');
            toggleInputValidity(editWashSearchInput, editWashSearchInput !== '');
        });
    }

    // Function to fetch bags from the server
    async function fetchBags(status = 'None') {

        startLoading();

        try {

            if (bags.length > 0)
                bags = [];

            const response = await fetch(`/getBagsByStatus?status=${status}`, {
                method: 'GET',
                headers: {
                    'X-Is-Search': 'true',
                    'X-Is-Fetch': 'true'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                checkForGlobalError(response, errorData);
                openMess('Error', errorData.message);
                return;
            }

            const { fullData } = await response.json();
            bags = fullData;

        } catch (error) {
            openMess('Error', 'There was a problem with the fetch operation');

        } finally {
            stopLoading();
        }
    }

    // Function to filter and display dropdown options
    function filterBag(inputElement, dropdownElement) {
        const query = inputElement.value.toLowerCase();
        dropdownElement.innerHTML = '';
        const filteredBags = bags.filter(bag => bag.code.toLowerCase().includes(query));

        if (filteredBags.length > 0) {
            dropdownElement.style.display = 'block';
            filteredBags.forEach(bag => {
                const li = document.createElement('li');
                li.textContent = bag.code;
                li.setAttribute('data-id', bag.id);
                dropdownElement.appendChild(li);
            });
        } else {
            dropdownElement.style.display = 'none';
        }
    }

    // Function to handle dropdown click and select a bag
    function handleDropdownClick(event, inputElement, hiddenInputElement, dropdownElement) {
        const selectedBag = event.target;
        if (selectedBag && selectedBag.dataset.id) {
            toggleInputValidity(inputElement, true);
            inputElement.value = selectedBag.textContent;
            hiddenInputElement.value = selectedBag.getAttribute('data-id');
            dropdownElement.style.display = 'none';
        }
    }

    // Function to initialize bag search behavior
    function initializeBagSearch(inputElement, dropdownElement, hiddenInputElement) {
        // Handle input change
        inputElement.addEventListener('input', function () {

            if (inputElement.value.length > 0) {
                filterBag(inputElement, dropdownElement);
            } else {
                dropdownElement.style.display = 'none';
                hiddenInputElement.value = '';
            }
        });

        // Handle dropdown click
        dropdownElement.addEventListener('click', function (event) {
            handleDropdownClick(event, inputElement, hiddenInputElement, dropdownElement);
        });
    }

    // Initialize for Add Bag search
    initializeBagSearch(addBagSearchInput, addBagSearchDropdown, selectedAddBagId);

    // Initialize for Move Bag search
    initializeBagSearch(moveBagSearchInput, moveBagSearchDropdown, selectedMoveBagId);

    // Initialize for Remove Bag search
    initializeBagSearch(removeBagSearchInput, removeBagSearchDropdown, selectedRemoveBagId);

    // Initialize for Remove Bag search
    initializeBagSearch(linenExchangeBagSearchInput, linenExchangeBagSearchDropdown, selectedLinenExchangeBagId);


    function openMess(type, message) {

        const icon = document.getElementById('mess-icon');

        switch (type) {

            case 'Warning':
                icon.src = "/icon/timeout.png";
                document.getElementById('mess-text').textContent = message;
                isWarning = true;
                break;

            case 'Error':
                icon.src = "/icon/error.png";
                document.getElementById('mess-text').textContent = message;
                isWarning = true;
                break;

            default:
                icon.src = "/icon/information.png";
                document.getElementById('mess-text').textContent = message;
                isWarning = false;
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

        async function updateMainView(span_id, list_status_id, status) {
            const spanElement = document.getElementById(span_id);
            const listStatusElement = document.getElementById(list_status_id);

            spanElement.innerHTML = '';
            listStatusElement.innerHTML = '';

            startLoading();

            try {

                const response = await fetch(`/laundry?isFirstTime=false`, {
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

                let { totalCounts, bagData } = await response.json();

                if (spanElement && listStatusElement) {
                    spanElement.textContent = totalCounts[status] || 0;

                    if (bagData[status] && bagData[status].length > 0)
                        bagData[status].forEach(bag => {
                            const p = document.createElement('p');
                            p.textContent = `${bag.type}: ${bag.count}`;
                            listStatusElement.appendChild(p);
                        })
                    else {
                        const p = document.createElement('p');
                        p.textContent = `There are no bags in this section`;
                        listStatusElement.appendChild(p);
                    }

                }
            } catch (error) {
                showMess('Error', 'An error occurred while fetching bags. Please try again later.');

            } finally {
                stopLoading();
            };
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

            if (!isWarning) {
                // Refresh the page after the modal is closed
                switch (action) {
                    case 'addBag':

                        destinationByBtn.value = document.getElementById('addBag').getAttribute('data-destination');
                        prevDestinationByBtn.value = document.getElementById('addBag').getAttribute('data-preview');

                        clearInput(addBagModalContent);
                        fetchBags();

                        updateMainView('bags-drop-off', 'all-type-drop-off', 'drop off');
                        updateMainView('bags-transportation-to-laundry-facility',
                            'all-type-transportation-to-laundry-facility', 'transportation to laundry facility');
                        updateMainView('bags-laundry-facility', 'all-type-laundry-facility', 'laundry facility');
                        updateMainView('bags-transportation-to-drop-off', 'all-type-transportation-to-drop-off',
                            'transportation to pick up');
                        updateMainView('bags-ready-to-pick-up', 'all-type-ready-to-pick-up', 'ready to pick up');

                        switch (globalClickStatus) {
                            case 'Drop off':
                                clearInput(dropOffModalContent);
                                break;

                            case 'Transportation to laundry facility':
                                clearInput(transportationToLaundryFacilityModalContent);
                                break;

                            case 'Laundry facility':
                                clearInput(laundryFacilityModalContent);
                                break;

                            case 'Transportation to pick up':
                                clearInput(transportationToDropOffModalContent);
                                break;

                            default:
                                clearInput(readyToPickUpModalContent);
                                break;
                        }

                        fetchBagStatus(globalClickStatus, globalNextDestination, globalTableContent, globalNavigationPart);
                        break;

                    case 'removeBag':
                    case 'moveBag':

                        allCheckedRow = [];

                        updateMainView('bags-drop-off', 'all-type-drop-off', 'drop off');
                        updateMainView('bags-transportation-to-laundry-facility',
                            'all-type-transportation-to-laundry-facility', 'transportation to laundry facility');
                        updateMainView('bags-laundry-facility', 'all-type-laundry-facility', 'laundry facility');
                        updateMainView('bags-transportation-to-drop-off', 'all-type-transportation-to-drop-off',
                            'transportation to pick up');
                        updateMainView('bags-ready-to-pick-up', 'all-type-ready-to-pick-up', 'ready to pick up');

                        switch (globalClickStatus) {
                            case 'Drop off':
                                clearInput(dropOffModalContent);
                                break;

                            case 'Transportation to laundry facility':
                                clearInput(transportationToLaundryFacilityModalContent);
                                break;

                            case 'Laundry facility':
                                clearInput(laundryFacilityModalContent);
                                break;

                            case 'Transportation to pick up':
                                clearInput(transportationToDropOffModalContent);
                                break;

                            default:
                                clearInput(readyToPickUpModalContent);
                                break;
                        }

                        fetchBagStatus(globalClickStatus, globalNextDestination, globalTableContent, globalNavigationPart);
                        break;

                    case 'linenExchangeBag':

                        destinationByBtn.value = document.getElementById('addBag').getAttribute('data-destination');
                        prevDestinationByBtn.value = document.getElementById('addBag').getAttribute('data-preview');

                        clearInput(linenExchangeBagModalContent);
                        fetchBags('');

                        switch (globalClickStatus) {
                            case 'Drop off':
                                clearInput(dropOffModalContent);
                                break;

                            case 'Transportation to laundry facility':
                                clearInput(transportationToLaundryFacilityModalContent);
                                break;

                            case 'Laundry facility':
                                clearInput(laundryFacilityModalContent);
                                break;

                            case 'Transportation to pick up':
                                clearInput(transportationToDropOffModalContent);
                                break;

                            default:
                                clearInput(readyToPickUpModalContent);
                                break;
                        }

                        fetchBagStatus(globalClickStatus, globalNextDestination, globalTableContent, globalNavigationPart);
                        break;

                    case 'insertBag':
                        clearInput(insertBagModalContent);
                        clearInput(listBagModalContent);
                        fetchListBags();
                        break;

                    case 'editBag':
                        clearInput(editBagModalContent);
                        clearInput(listBagModalContent);
                        fetchListBags();
                        break;

                    case 'deleteBag':
                        allCheckedListBagsRow = [];
                        clearInput(listBagModalContent);
                        fetchListBags();
                        break;
                }
            }

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openDropOffModal() {

        // Add the slide-in effect by adding the necessary classes
        dropOffModal.classList.add('show');
        dropOffModalContent.classList.add('show');
        dropOffModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        dropOffModalContent.classList.remove('slide-out');
    }

    function closeDropOffModal() {
        // Add the slide-out effect
        dropOffModalContent.classList.add('slide-out');
        dropOffModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            const tbody = document.getElementById(`dropOffTableBody`);
            tbody.innerHTML = ''; // Clear existing rows

            allCheckedRow = [];

            // Clear all input values inside the modal content
            dropOffModalContent.querySelectorAll('input').forEach(input => {
                input.value = '';
            });

            dropOffModal.classList.remove('show');
            dropOffModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openTransportationToLaundryFacilityModal() {

        // Add the slide-in effect by adding the necessary classes
        transportationToLaundryFacilityModal.classList.add('show');
        transportationToLaundryFacilityModalContent.classList.add('show');
        transportationToLaundryFacilityModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        transportationToLaundryFacilityModalContent.classList.remove('slide-out');
    }

    function closeTransportationToLaundryFacilityModal() {
        // Add the slide-out effect
        transportationToLaundryFacilityModalContent.classList.add('slide-out');
        transportationToLaundryFacilityModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            const tbody = document.getElementById(`transportationToLaundryFacilityTableBody`);
            tbody.innerHTML = ''; // Clear existing rows

            allCheckedRow = [];

            transportationToLaundryFacilityModalContent.querySelectorAll('input').forEach(input => {
                input.value = '';
            });

            transportationToLaundryFacilityModal.classList.remove('show');
            transportationToLaundryFacilityModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openLaundryFacilityModal() {

        // Add the slide-in effect by adding the necessary classes
        laundryFacilityModal.classList.add('show');
        laundryFacilityModalContent.classList.add('show');
        laundryFacilityModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        laundryFacilityModalContent.classList.remove('slide-out');
    }

    function closeLaundryFacilityModal() {
        // Add the slide-out effect
        laundryFacilityModalContent.classList.add('slide-out');
        laundryFacilityModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            const tbody = document.getElementById(`laundryFacilityTableBody`);
            tbody.innerHTML = ''; // Clear existing rows

            allCheckedRow = [];

            laundryFacilityModal.querySelectorAll('input').forEach(input => {
                input.value = '';
            });

            laundryFacilityModal.classList.remove('show');
            laundryFacilityModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openTransportationToDropOffModal() {

        // Add the slide-in effect by adding the necessary classes
        transportationToDropOffModal.classList.add('show');
        transportationToDropOffModalContent.classList.add('show');
        transportationToDropOffModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        transportationToDropOffModalContent.classList.remove('slide-out');
    }

    function closeTransportationToDropOffModal() {
        // Add the slide-out effect
        transportationToDropOffModalContent.classList.add('slide-out');
        transportationToDropOffModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            const tbody = document.getElementById(`transportationToDropOffTableBody`);
            tbody.innerHTML = ''; // Clear existing rows

            allCheckedRow = [];

            transportationToDropOffModal.querySelectorAll('input').forEach(input => {
                input.value = '';
            });

            transportationToDropOffModal.classList.remove('show');
            transportationToDropOffModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openReadyToPickUpModal() {

        // Add the slide-in effect by adding the necessary classes
        readyToPickUpModal.classList.add('show');
        readyToPickUpModalContent.classList.add('show');
        readyToPickUpModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        readyToPickUpModalContent.classList.remove('slide-out');
    }

    function closeReadyToPickUpModal() {
        // Add the slide-out effect
        readyToPickUpModalContent.classList.add('slide-out');
        readyToPickUpModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            const tbody = document.getElementById(`readyToPickUpTableBody`);
            tbody.innerHTML = ''; // Clear existing rows

            allCheckedRow = [];

            readyToPickUpModal.querySelectorAll('input').forEach(input => {
                input.value = '';
            });

            readyToPickUpModal.classList.remove('show');
            readyToPickUpModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function setupTableNavigation(tableId, prevBtnId, nextBtnId, pageNumberId, rowsPerPage = 10, totalPages, page, selectDate1 = "", selectDate2 = "", searchFilters = [], searchFiltersNational = [], clickStatus = "", nextDestination = "", navigationPart = "") {

        document.getElementById(`${pageNumberId}`).textContent = `${page}/${totalPages}`;

        switch (tableId) {
            case 'bagsTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchListBags(currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchListBags(currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'dropOffTableBody':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentDropOffPage > 1) {
                        currentDropOffPage--;
                        fetchBagStatus(clickStatus, nextDestination, tableId, navigationPart, currentDropOffPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentDropOffPage < totalPages) {
                        currentDropOffPage++;
                        fetchBagStatus(clickStatus, nextDestination, tableId, navigationPart, currentDropOffPage, rowsPerPage, searchFilters);
                    }
                };
                break;
            case 'transportationToLaundryFacilityTableBody':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentTransportationToLaundryFacilityPage > 1) {
                        currentTransportationToLaundryFacilityPage--;
                        fetchBagStatus(clickStatus, nextDestination, tableId, navigationPart, currentTransportationToLaundryFacilityPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentTransportationToLaundryFacilityPage < totalPages) {
                        currentTransportationToLaundryFacilityPage++;
                        fetchBagStatus(clickStatus, nextDestination, tableId, navigationPart, currentTransportationToLaundryFacilityPage, rowsPerPage, searchFilters);
                    }
                };
                break;
            case 'laundryFacilityTableBody':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentLaundryFacilityPage > 1) {
                        currentLaundryFacilityPage--;
                        fetchBagStatus(clickStatus, nextDestination, tableId, navigationPart, currentLaundryFacilityPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentLaundryFacilityPage < totalPages) {
                        currentLaundryFacilityPage++;
                        fetchBagStatus(clickStatus, nextDestination, tableId, navigationPart, currentLaundryFacilityPage, rowsPerPage, searchFilters);
                    }
                };
                break;
            case 'transportationToDropOffTableBody':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentTransportationToDropOffPage > 1) {
                        currentTransportationToDropOffPage--;
                        fetchBagStatus(clickStatus, nextDestination, tableId, navigationPart, currentTransportationToDropOffPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentTransportationToDropOffPage < totalPages) {
                        currentTransportationToDropOffPage++;
                        fetchBagStatus(clickStatus, nextDestination, tableId, navigationPart, currentTransportationToDropOffPage, rowsPerPage, searchFilters);
                    }
                };
                break;
            case 'readyToPickUpTableBody':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentReadyToPickUpPage > 1) {
                        currentReadyToPickUpPage--;
                        fetchBagStatus(clickStatus, nextDestination, tableId, navigationPart, currentReadyToPickUpPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentReadyToPickUpPage < totalPages) {
                        currentReadyToPickUpPage++;
                        fetchBagStatus(clickStatus, nextDestination, tableId, navigationPart, currentReadyToPickUpPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'bagsWashedTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersNational);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersNational);
                    }
                };
                break;

            case 'bagsWashedNationalityTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (secondCurrentPage > 1) {
                        secondCurrentPage--;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersNational);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (secondCurrentPage < totalPages) {
                        secondCurrentPage++;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, rowsPerPage, searchFilters, searchFiltersNational);
                    }
                };
                break;
        };

    }

    function rewriteTableSearch(className, tableName, headerMap, clickStatus = "", nextDestination = "", tableContent = "", navigationPart = "", selectDate1, selectDate2) {

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
                    case 'bagsTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchListBags(currentPage, 10, searchFilters);
                        break;

                    case 'dropOffTable':
                        currentDropOffPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchBagStatus(clickStatus, nextDestination, tableContent, navigationPart, currentDropOffPage, 10, searchFilters);
                        break;

                    case 'transportationToLaundryFacilityTable':
                        currentTransportationToLaundryFacilityPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchBagStatus(clickStatus, nextDestination, tableContent, navigationPart, currentTransportationToLaundryFacilityPage, 10, searchFilters);
                        break;

                    case 'laundryFacilityTable':
                        currentLaundryFacilityPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchBagStatus(clickStatus, nextDestination, tableContent, navigationPart, currentLaundryFacilityPage, 10, searchFilters);
                        break;

                    case 'transportationToDropOffTable':
                        currentTransportationToDropOffPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchBagStatus(clickStatus, nextDestination, tableContent, navigationPart, currentTransportationToDropOffPage, 10, searchFilters);
                        break;

                    case 'readyToPickUpTable':
                        currentReadyToPickUpPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchBagStatus(clickStatus, nextDestination, tableContent, navigationPart, currentReadyToPickUpPage, 10, searchFilters);
                        break;

                    case 'bagsWashedTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        globalSearchFilters = searchFilters;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, 10, searchFilters, globalSearchFiltersNational);
                        break;

                    case 'bagsWashedNationalityTable':
                        secondCurrentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !/^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        globalSearchFiltersNational = searchFilters;
                        fetchReport(selectDate1, selectDate2, currentPage, secondCurrentPage, 10, globalSearchFilters, searchFilters);
                        break;
                }
            }, 400));
        });
    }

    function openReportModal() {

        // Add the slide-in effect by adding the necessary classes
        reportViewModal.classList.add('show');
        reportViewModalContent.classList.add('show');
        reportViewModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        reportViewModalContent.classList.remove('slide-out');
    }

    function closeReportModal() {
        // Add the slide-out effect
        reportViewModalContent.classList.add('slide-out');
        reportViewModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.search-input-view-laundry').forEach((input) => {
                input.value = '';
            });

            document.querySelectorAll('.search-input-view-laundry-second').forEach((input) => {
                input.value = '';
            });

            reportViewModal.classList.remove('show');
            reportViewModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openViewReportModal() {

        // Add the slide-in effect by adding the necessary classes
        reportModal.classList.add('show');
        reportModalContent.classList.add('show');
        reportModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        reportModalContent.classList.remove('slide-out');
    }

    function closeViewReportModal() {
        // Add the slide-out effect
        reportModalContent.classList.add('slide-out');
        reportModalContent.classList.remove('slide-in');

        const listItems = document.querySelectorAll('.dates li');
        listItems.forEach(li => li.classList.remove('selected'));

        document.getElementById('selectedDate1').value = '';
        document.getElementById('selectedDate2').value = '';

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            reportModal.classList.remove('show');
            reportModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAddBagModal() {

        // Add the slide-in effect by adding the necessary classes
        addBagModal.classList.add('show');
        addBagModalContent.classList.add('show');
        addBagModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        addBagModalContent.classList.remove('slide-out');
    }

    function closeAddBagModal() {
        // Add the slide-out effect
        addBagModalContent.classList.add('slide-out');
        addBagModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            addBagSearchDropdown.style.display = 'none';
            addBagSearchInput.value = '';

            addBagSearchInput.classList.remove("is-invalid");
            addBagSearchInput.classList.remove("is-valid");

            addBagModal.classList.remove('show');
            addBagModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openInsertBagModal() {

        // Add the slide-in effect by adding the necessary classes
        insertBagModal.classList.add('show');
        insertBagModalContent.classList.add('show');
        insertBagModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        insertBagModalContent.classList.remove('slide-out');
    }

    function closeInsertBagModal() {
        // Add the slide-out effect
        insertBagModalContent.classList.add('slide-out');
        insertBagModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#epc-bag, #code-bag, #type-bag, #max-count-wash-bag').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';

            });

            insertBagModal.classList.remove('show');
            insertBagModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openEditBagModal() {

        // Add the slide-in effect by adding the necessary classes
        editBagModal.classList.add('show');
        editBagModalContent.classList.add('show');
        editBagModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        editBagModalContent.classList.remove('slide-out');
    }

    function closeEditBagModal() {
        // Add the slide-out effect
        editBagModalContent.classList.add('slide-out');
        editBagModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#bagEditSearch, #selectedEditBagId, #typeEditSearch, #washEditSearch').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';

            });

            editBagSearchDropdown.style.display = 'none';

            editBagModal.classList.remove('show');
            editBagModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    async function fetchListBags(page = 1, limit = 10, searchFilters = []) {

        const tbody = document.getElementById('bagsTable').getElementsByTagName('tbody')[0];
        tbody.innerHTML = ''; // Clear existing rows

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

            const response = await fetch(`/bags?${searchParams.toString()}`, {
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

            let { allBags, filterData, totalPages } = await response.json();

            allDataBags = allBags.filter(bag => bag.status === 'None');
            initializeAllBagSearch(editBagSearchInput, editBagSearchDropdown, selectedEditBagId);

            const headerCheckbox = document.createElement('input');
            headerCheckbox.type = 'checkbox';
            headerCheckbox.className = 'form-check-input header-checkbox';
            headerCheckbox.style.border = '1px solid black';

            // Attach the event listener to the header checkbox
            headerCheckbox.addEventListener('change', (event) => {
                headerCheckbox.style.backgroundColor = event.target.checked ? 'green' : '';
                const isChecked = event.target.checked;
                const visibleRows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.style.display !== 'none');

                visibleRows.forEach(row => {
                    const checkbox = row.querySelector('.form-check-input:not(.header-checkbox)');
                    if (checkbox) {
                        checkbox.checked = isChecked;
                        checkbox.style.backgroundColor = isChecked ? 'green' : '';

                        const rowId = checkbox.dataset.etc;
                        if (isChecked && !allCheckedListBagsRow.find(row => row.code === rowId)) {
                            allCheckedListBagsRow.push({ code: rowId });
                        } else if (!isChecked) {
                            allCheckedListBagsRow = allCheckedListBagsRow.filter(row => row.code !== rowId);
                        }
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

            // Dynamically populate rows
            filterData.forEach((item) => {
                const row = document.createElement('tr');

                const checkboxCell = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input';
                checkbox.dataset.etc = item.id;
                checkbox.style.border = '1px solid black';

                if (allCheckedListBagsRow.some(i => i.code === item.id)) {
                    checkbox.style.backgroundColor = 'green';
                    checkbox.checked = true;
                }

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        checkbox.style.backgroundColor = 'green';
                        if (!allCheckedListBagsRow.find(row => row.code === item.id)) {
                            allCheckedListBagsRow.push({ code: item.id });
                        }
                    } else {
                        checkbox.style.backgroundColor = '';
                        allCheckedListBagsRow = allCheckedListBagsRow.filter(row => row.code !== item.id);
                    }
                });

                checkboxCell.appendChild(checkbox);
                row.appendChild(checkboxCell);

                let nameCell = row.insertCell();
                nameCell.textContent = item.name;
                nameCell.className = "text-wrap";
                nameCell.style.maxWidth = "200px";

                let typeCell = row.insertCell();
                typeCell.textContent = item.type;
                typeCell.className = "text-wrap";
                typeCell.style.maxWidth = "200px";

                let maxWashCell = row.insertCell();
                maxWashCell.textContent = item.maxcountlandry;
                maxWashCell.className = "text-wrap";
                maxWashCell.style.maxWidth = "200px";

                row.addEventListener('click', (event) => {
                    if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0) {
                        selectedEditBagId.value = item.id;
                        editBagSearchInput.value = item.name;
                        editTypeSearchInput.value = item.type;
                        editWashSearchInput.value = item.maxcountlandry;
                        openEditBagModal();
                    }
                });

                tbody.appendChild(row);
            });

            const rowsTable = tbody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumberSecond');

            setupTableNavigation("bagsTable", "prevBtnSecond", "nextBtnSecond", "pageNumberSecond", limit, totalPages, page, "", "", searchFilters);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'An error occurred while fetching bags. Please try again later.');

        } finally {
            stopLoading();
        };

    }

    function openListBagModal() {
        listBagModal.classList.add('show');
        listBagModalContent.classList.add('show');
        listBagModalContent.classList.add('slide-in');
        listBagModalContent.classList.remove('slide-out');

        currentPage = 1;

        const headerDate = {
            'Bag code': 'code',
            'Bag type': 'type',
            'Maximum number of washes': 'maxcountlandry'
        };

        rewriteTableSearch('.laundry-search-input', 'bagsTable', headerDate);

        fetchListBags();
    }

    function closeListBagModal() {
        // Add the slide-out effect
        listBagModalContent.classList.add('slide-out');
        listBagModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.laundry-search-input').forEach((input) => {
                input.value = '';
            });

            allCheckedListBagsRow = []; // Reset the global array

            listBagModal.classList.remove('show');
            listBagModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openMoveBagModal() {

        // Add the slide-in effect by adding the necessary classes
        moveBagModal.classList.add('show');
        moveBagModalContent.classList.add('show');
        moveBagModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        moveBagModalContent.classList.remove('slide-out');
    }

    function closeMoveBagModal() {
        // Add the slide-out effect
        moveBagModalContent.classList.add('slide-out');
        moveBagModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            moveBagSearchDropdown.style.display = 'none';
            moveBagSearchInput.value = '';

            moveBagSearchInput.classList.remove("is-invalid");
            moveBagSearchInput.classList.remove("is-valid");

            moveBagModal.classList.remove('show');
            moveBagModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openRemoveBagModal() {

        // Add the slide-in effect by adding the necessary classes
        removeBagModal.classList.add('show');
        removeBagModalContent.classList.add('show');
        removeBagModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        removeBagModalContent.classList.remove('slide-out');
    }

    function closeRemoveBagModal() {
        // Add the slide-out effect
        removeBagModalContent.classList.add('slide-out');
        removeBagModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            removeBagSearchDropdown.style.display = 'none';
            removeBagSearchInput.value = '';

            removeBagSearchInput.classList.remove("is-invalid");
            removeBagSearchInput.classList.remove("is-valid");

            removeBagModal.classList.remove('show');
            removeBagModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openLinenExchangeBagModal() {

        // Add the slide-in effect by adding the necessary classes
        linenExchangeBagModal.classList.add('show');
        linenExchangeBagModalContent.classList.add('show');
        linenExchangeBagModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        linenExchangeBagModalContent.classList.remove('slide-out');
    }

    function closeLinenExchangeBagModal() {
        // Add the slide-out effect
        linenExchangeBagModalContent.classList.add('slide-out');
        linenExchangeBagModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            linenExchangeBagSearchDropdown.style.display = 'none';
            linenExchangeBagSearchInput.value = '';

            linenExchangeBagSearchInput.classList.remove("is-invalid");
            linenExchangeBagSearchInput.classList.remove("is-valid");

            linenExchangeBagModal.classList.remove('show');
            linenExchangeBagModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    document.getElementsByClassName('close-btn')[0].onclick = closeDropOffModal;
    document.getElementsByClassName('close-btn')[1].onclick = closeTransportationToLaundryFacilityModal;
    document.getElementsByClassName('close-btn')[2].onclick = closeLaundryFacilityModal;
    document.getElementsByClassName('close-btn')[3].onclick = closeTransportationToDropOffModal;
    document.getElementsByClassName('close-btn')[4].onclick = closeReadyToPickUpModal;
    document.getElementsByClassName('close-btn')[5].onclick = closeReportModal;
    document.getElementsByClassName('close-btn')[6].onclick = closeAddBagModal;
    document.getElementsByClassName('close-btn')[7].onclick = closeMoveBagModal;
    document.getElementsByClassName('close-btn')[8].onclick = closeRemoveBagModal;
    document.getElementsByClassName('close-btn')[9].onclick = closeLinenExchangeBagModal;
    document.getElementsByClassName('close-btn')[10].onclick = closeListBagModal;
    document.getElementsByClassName('close-btn')[11].onclick = closeInsertBagModal;
    document.getElementsByClassName('close-btn')[12].onclick = closeEditBagModal;
    document.getElementsByClassName('close-btn')[13].onclick = closeViewReportModal;
    document.getElementsByClassName('close-btn')[14].onclick = function () {
        closeMessModal(globalAction);
    };

    window.addEventListener("click", function (event) {

        switch (event.target) {
            case dropOffModal:
                closeDropOffModal();
                break;

            case transportationToLaundryFacilityModal:
                closeTransportationToLaundryFacilityModal();
                break;

            case laundryFacilityModal:
                closeLaundryFacilityModal();
                break;

            case transportationToDropOffModal:
                closeTransportationToDropOffModal();
                break;

            case readyToPickUpModal:
                closeReadyToPickUpModal();
                break;

            case reportViewModal:
                closeReportModal();
                break;

            case addBagModal:
                closeAddBagModal();
                break;

            case moveBagModal:
                closeMoveBagModal();
                break;

            case modalMess:
                closeMessModal(globalAction);
                break;

            case removeBagModal:
                closeRemoveBagModal();
                break;

            case linenExchangeBagModal:
                closeLinenExchangeBagModal();
                break;

            case insertBagModal:
                closeInsertBagModal();
                break;

            case editBagModal:
                closeEditBagModal();
                break;

            case listBagModal:
                closeListBagModal();
                break;
            case reportModal:
                closeViewReportModal();
                break;
        }
    });

    // Hide dropdown if clicked outside
    window.addEventListener('click', function (event) {

        if (!editBagSearchDropdown.contains(event.target) && event.target !== editBagSearchDropdown) {
            editBagSearchDropdown.style.display = 'none';
        }

        if (!addBagSearchDropdown.contains(event.target) && event.target !== addBagSearchDropdown) {
            addBagSearchDropdown.style.display = 'none';
        }

        if (!moveBagSearchDropdown.contains(event.target) && event.target !== moveBagSearchDropdown) {
            moveBagSearchDropdown.style.display = 'none';
        }

        if (!removeBagSearchDropdown.contains(event.target) && event.target !== removeBagSearchDropdown) {
            removeBagSearchDropdown.style.display = 'none';
        }

        if (!linenExchangeBagSearchDropdown.contains(event.target) && event.target !== linenExchangeBagSearchDropdown) {
            linenExchangeBagSearchDropdown.style.display = 'none';
        }
    });

    async function fetchBagStatus(clickStatus, nextDestination, tableContent, navigationPart, page = 1, limit = 10, searchFilters = []) {

        const tbody = document.getElementById(`${tableContent}`);
        tbody.innerHTML = '';

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();
        const { signal } = currentFetchController;

        startLoading();

        try {

            const searchParams = new URLSearchParams({
                status: clickStatus,
                page,
                limit
            });

            searchFilters.forEach(filter => {
                searchParams.append('searchColumn', filter.column);
                searchParams.append('searchValue', filter.value);
            });

            const response = await fetch(`/getBagsByStatus?${searchParams.toString()}`, {
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

            // Dynamically create the header checkbox
            const headerCheckbox = document.createElement('input');
            headerCheckbox.type = 'checkbox';
            headerCheckbox.className = 'form-check-input header-checkbox';
            headerCheckbox.style.border = '1px solid black'; // Make the border more bold
            headerCheckbox.style.backgroundColor = ''; // Clear any previous color

            headerCheckbox.addEventListener('change', (event) => {
                headerCheckbox.style.backgroundColor = event.target.checked ? 'green' : '';
                const isChecked = event.target.checked;
                const visibleRows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.style.display !== 'none');

                visibleRows.forEach(row => {
                    const checkbox = row.querySelector('.form-check-input:not(.header-checkbox)');
                    if (checkbox) {
                        checkbox.checked = isChecked;
                        if (isChecked) {
                            checkbox.style.backgroundColor = 'green';
                            allCheckedRow.push({ code: checkbox.dataset.etc, destination: nextDestination, prev_destination: clickStatus });
                        } else {
                            checkbox.style.backgroundColor = '';
                            allCheckedRow = allCheckedRow.filter(row => row.code !== checkbox.dataset.etc);
                        }
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

            data.forEach((item) => {
                const row = document.createElement('tr');

                // Add the checkbox cell
                const checkboxCell = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input';
                checkbox.dataset.etc = item.id;
                checkbox.style.border = '1px solid black'; // Make the border more bold

                if (allCheckedRow.some(i => i.code === item.id)) {
                    checkbox.style.backgroundColor = 'green';
                    checkbox.checked = true;
                }

                // Add change event to the checkbox
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        checkbox.style.backgroundColor = 'green';
                        allCheckedRow.push({ code: item.id, destination: nextDestination, prev_destination: clickStatus });
                    } else {
                        checkbox.style.backgroundColor = '';
                        allCheckedRow = allCheckedRow.filter(row => row.code !== item.id);
                    }
                });

                checkboxCell.appendChild(checkbox);
                row.appendChild(checkboxCell);

                // Dynamically create table cells for each key
                for (const key in item) {
                    if (item.hasOwnProperty(key) && key !== 'id') {
                        const cell = document.createElement('td');

                        if (key === 'islate') {
                            // Add an image depending on the value of `islate`
                            const img = document.createElement('img');
                            img.src = item[key]
                                ? '/icon/timeout.png' // Warning image path
                                : '/icon/available.png'; // OK image path
                            img.alt = item[key] ? 'Warning' : 'OK';
                            img.style.width = '24px'; // Adjust image size
                            img.style.height = '24px';
                            cell.appendChild(img);
                        } else {
                            // For other fields, add plain text
                            cell.textContent = item[key];
                        }

                        cell.classList.add("text-wrap");
                        cell.style = "max-width: 200px;";
                        row.appendChild(cell);
                    }
                }

                tbody.appendChild(row);
            });

            const rowsTable = tbody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, `pageNumber${navigationPart}`);

            switch (clickStatus) {
                case 'Drop off':
                    setupTableNavigation(
                        tableContent, `prevBtn${navigationPart}`, `nextBtn${navigationPart}`, `pageNumber${navigationPart}`,
                        limit, totalPages, page, "", "", searchFilters, "", clickStatus, nextDestination, navigationPart);
                    break;

                case 'Transportation to laundry facility':
                    setupTableNavigation(
                        tableContent, `prevBtn${navigationPart}`, `nextBtn${navigationPart}`, `pageNumber${navigationPart}`,
                        limit, totalPages, page, "", "", searchFilters, "", clickStatus, nextDestination, navigationPart);
                    break;

                case 'Laundry facility':
                    setupTableNavigation(
                        tableContent, `prevBtn${navigationPart}`, `nextBtn${navigationPart}`, `pageNumber${navigationPart}`,
                        limit, totalPages, page, "", "", searchFilters, "", clickStatus, nextDestination, navigationPart);
                    break;

                case 'Transportation to pick up':
                    setupTableNavigation(
                        tableContent, `prevBtn${navigationPart}`, `nextBtn${navigationPart}`, `pageNumber${navigationPart}`,
                        limit, totalPages, page, "", "", searchFilters, "", clickStatus, nextDestination, navigationPart);
                    break;

                default:
                    setupTableNavigation(
                        tableContent, `prevBtn${navigationPart}`, `nextBtn${navigationPart}`, `pageNumber${navigationPart}`,
                        limit, totalPages, page, "", "", searchFilters, "", clickStatus, nextDestination, navigationPart);
                    break;
            }

        } catch (error) {
            if (error.name === 'AbortError') return;
            checkForGlobalError(response, error);
            openMess('Error', 'Error fetching or processing data');

        } finally {
            stopLoading();
        }
    }

    function openModalWhenClick(clickStatus, nextDestination, clickButtonId, tableContent, tableId, navigationPart) {
        document.getElementById(`${clickButtonId}`).addEventListener('click', async () => {

            currentDropOffPage = 1;
            currentTransportationToLaundryFacilityPage = 1;
            currentLaundryFacilityPage = 1;
            currentTransportationToDropOffPage = 1;
            currentReadyToPickUpPage = 1;

            const headerDate = {
                'Bag code': 'code',
                'Date of entry': 'timein',
                'Soldier': 'namesoldier',
                'Status': 'islate'
            };

            rewriteTableSearch(`.${navigationPart}-search-input`, tableId, headerDate, clickStatus, nextDestination, tableContent, navigationPart);

            globalClickStatus = clickStatus;
            globalNextDestination = nextDestination;
            globalTableContent = tableContent;
            globalNavigationPart = navigationPart;

            fetchBagStatus(clickStatus, nextDestination, tableContent, navigationPart);

            // Open the appropriate modal
            switch (clickStatus) {
                case 'Drop off':
                    openDropOffModal();
                    break;

                case 'Transportation to laundry facility':
                    openTransportationToLaundryFacilityModal();
                    break;

                case 'Laundry facility':
                    openLaundryFacilityModal();
                    break;

                case 'Transportation to pick up':
                    openTransportationToDropOffModal();
                    break;

                default:
                    openReadyToPickUpModal();
                    break;
            }

        });
    }

    openModalWhenClick('Drop off', 'Transportation to laundry facility', 'drop-off', 'dropOffTableBody', 'dropOffTable', 'dropOff');
    openModalWhenClick('Transportation to laundry facility', 'Laundry facility', 'transportation-to-laundry-facility', 'transportationToLaundryFacilityTableBody', 'transportationToLaundryFacilityTable', 'transportationToLaundryFacility');
    openModalWhenClick('Laundry facility', 'Transportation to pick up', 'laundry-facility', 'laundryFacilityTableBody', 'laundryFacilityTable', 'laundryFacility');
    openModalWhenClick('Transportation to pick up', 'Ready to pick up', 'transportation-to-drop-off', 'transportationToDropOffTableBody', 'transportationToDropOffTable', 'transportationToDropOff');
    openModalWhenClick('Ready to pick up', 'None', 'ready-to-pick-up', 'readyToPickUpTableBody', 'readyToPickUpTable', 'readyToPickUp');

    document.getElementById('reportButton').addEventListener('click', () => {
        openViewReportModal();
    });

    document.getElementById('confirmReportBtn').addEventListener('click', () => {

        const selectDate1 = document.getElementById('selectedDate1').value;
        const selectDate2 = document.getElementById('selectedDate2').value;

        if (!selectDate1 || !selectDate2) {
            openMess('Error', 'Both dates must be selected!');
            return;
        }

        if (new Date(selectDate1) > new Date(selectDate2)) {
            openMess('Error', 'Invalid time slot!');
            return;
        }

        closeViewReportModal();

        currentPage = 1;
        secondCurrentPage = 1;

        const headerMap = {
            'Bag number': 'code',
            'Soldier name': 'namesoldier',
            'Nationality': 'country',
            'Bag type': 'type',
            'Location': 'status',
            'Date of issue': 'date_drop_off',
            'Collection date': 'date_ready_to_pick_up'
        };

        const headerDateMap = {
            'Nationality': 'country',
            'Number of bags washed': 'total_count_bags'
        };

        rewriteTableSearch('.search-input-view-laundry', 'bagsWashedTable', headerMap, "", "", "", "", selectDate1, selectDate2);
        rewriteTableSearch('.search-input-view-laundry-second', 'bagsWashedNationalityTable', headerDateMap, "", "", "", "", selectDate1, selectDate2);

        globalSelectDate1 = selectDate1;
        globalSelectDate2 = selectDate2;

        fetchReport(selectDate1, selectDate2);
        openReportModal();
    });

    document.getElementById('addButton').addEventListener('click', () => {
        openInsertBagModal();
    });

    document.getElementById('removeButton').addEventListener('click', () => {
        const submitButton = document.createElement('button');
        var isRemove = false;
        var isError = false;
        var result = {};

        if (allCheckedListBagsRow.length === 0) {
            openMess('Error', 'You have not selected any bags');
            return;
        }

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');
        submitButton.addEventListener('click', async () => {

            startLoading();

            for (const data of allCheckedListBagsRow) {

                isRemove = true;

                const response = await fetch('/laundry/deleteBag', {
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
            closeMessModal();
        });

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isRemove && modalMessContent.contains(submitButton)) {
                modalMessContent.removeChild(submitButton);
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show the info modal
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isRemove) {
                closeWarningObserver.disconnect();
                if (isRemove && !isError) {
                    globalAction = 'deleteBag';
                    openMess('Info', 'Bags have been removed successfully');
                } else if (isError) {
                    openMess('Error', result.message);
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        openMess('Warning', 'When you remove bag you remove all data for this bag. Are you sure you want to remove the selected bags?');
    });

    document.getElementById('listOfBagsButton').addEventListener('click', () => {
        openListBagModal();
    });


    document.querySelectorAll('#moveBag').forEach((button) => {
        button.addEventListener('click', async () => {

            const submitButton = document.createElement('button');
            var isMoved = false;
            let hasError = false;
            var result = {};

            if (allCheckedRow.length === 0) {
                openMess('Error', 'You have not selected laundry bags');
                return;
            }

            submitButton.textContent = 'Yes';
            submitButton.classList.add('btn', 'btn-success');
            submitButton.addEventListener('click', async () => {

                isMoved = true;

                startLoading();

                for (const data of allCheckedRow) {

                    const response = await fetch('/changeStatusConsole', {
                        method: 'POST',
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
                        hasError = true;
                    }
                }

                stopLoading();
                closeMessModal();
            });

            modalMessContent.appendChild(submitButton);

            // Wait for the modal to close, then check if the submit button was clicked
            const observer = new MutationObserver(() => {
                if (!modalMess.classList.contains('show') && isMoved && modalMessContent.contains(submitButton)) {
                    modalMessContent.removeChild(submitButton);
                }
            });

            observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

            // Close the warning modal and show the info modal
            const closeWarningObserver = new MutationObserver(() => {
                if (!modalMess.classList.contains('show') && isMoved) {
                    closeWarningObserver.disconnect();
                    if (isMoved && !hasError) {
                        globalAction = 'moveBag';
                        openMess('Info', 'Laundry bags have been moved successfully');
                    } else if (hasError) {
                        showMess('Error', result.message);
                    }
                }
            });

            closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

            openMess('Warning', 'Are you sure you want to move the selected laundry bags?');
        })
    });

    document.querySelectorAll('#removeBag').forEach((button) => {
        button.addEventListener('click', async () => {

            const submitButton = document.createElement('button');
            var isRemove = false;
            var isError = false;
            var result = {};

            if (allCheckedRow.length === 0) {
                openMess('Error', 'You have not selected any laundry bags');
                return;
            }

            submitButton.textContent = 'Yes';
            submitButton.classList.add('btn', 'btn-success');
            submitButton.addEventListener('click', async () => {

                startLoading();

                for (const data of allCheckedRow) {

                    isRemove = true;
                    data.destination = 'None';

                    const response = await fetch('/changeStatusConsole', {
                        method: 'POST',
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
                closeMessModal();
            });

            modalMessContent.appendChild(submitButton);

            // Wait for the modal to close, then check if the submit button was clicked
            const observer = new MutationObserver(() => {
                if (!modalMess.classList.contains('show') && isRemove && modalMessContent.contains(submitButton)) {
                    modalMessContent.removeChild(submitButton);
                }
            });

            observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

            // Close the warning modal and show the info modal
            const closeWarningObserver = new MutationObserver(() => {
                if (!modalMess.classList.contains('show') && isRemove) {
                    closeWarningObserver.disconnect();
                    if (isRemove && !isError) {
                        globalAction = 'removeBag';
                        openMess('Info', 'Laundry bags have been removed successfully');
                    } else if (isError) {
                        openMess('Error', result.message);
                    }
                }
            });

            closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

            openMess('Warning', 'Are you sure you want to remove the selected laundry bags?');
        })
    });

    document.querySelectorAll('#addBag, #linenExchange').forEach((button) => {
        button.addEventListener('click', (event) => {
            const button = event.target;

            const button_type = button.getAttribute('id');
            const destination = button.getAttribute('data-destination');
            const prev_destination = button.getAttribute('data-preview');

            destinationByBtn.value = destination;
            prevDestinationByBtn.value = prev_destination;

            switch (button_type) {
                case 'addBag':
                    fetchBags();
                    openAddBagModal();
                    break;

                // case 'moveBag':
                //     fetchBags(prev_destination);
                //     openMoveBagModal();
                //     break;

                // case 'removeBag':
                //     fetchBags(prev_destination);
                //     openRemoveBagModal();
                //     break;

                case 'linenExchange':
                    fetchBags('');
                    openLinenExchangeBagModal();
                    break;
            }
        });
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

            const response = await fetch(`/laundry/viewReport?${searchParams.toString()}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                },
                signal
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                openMess('Error', error.message);
                return;
            }

            const { data, data_nationality, totalPages, totalPagesNational } = await response.json();

            // Clear existing rows from bike usage details table
            const bagsWashedTableBody = document.getElementById('bagsWashedTable').getElementsByTagName('tbody')[0];
            const bagsWashedNationalityTableBody = document.getElementById('bagsWashedNationalityTable').getElementsByTagName('tbody')[0];

            bagsWashedTableBody.innerHTML = '';
            bagsWashedNationalityTableBody.innerHTML = '';

            data.forEach(row => {
                const newRow = bagsWashedTableBody.insertRow();
                let cell;

                cell = newRow.insertCell();
                cell.textContent = row.code;
                cell.className = "text-wrap";
                cell.style.maxWidth = "200px";

                cell = newRow.insertCell();
                cell.textContent = row.namesoldier;
                cell.className = "text-wrap";
                cell.style.maxWidth = "200px";

                cell = newRow.insertCell();
                cell.textContent = row.country;
                cell.className = "text-wrap";
                cell.style.maxWidth = "200px";

                cell = newRow.insertCell();
                cell.textContent = row.type;
                cell.className = "text-wrap";
                cell.style.maxWidth = "200px";

                cell = newRow.insertCell();
                cell.textContent = row.date_drop_off === row.date_ready_to_pick_up ? 'Picked up' : row.status;
                cell.className = "text-wrap";
                cell.style.maxWidth = "200px";

                const formattedDropOffDate = row.date_drop_off
                    ? (() => {
                        const d = new Date(row.date_drop_off);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        let hours = d.getHours();
                        const minutes = String(d.getMinutes()).padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours ? hours : 12;
                        return `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
                    })()
                    : 'Not accommodated';
                cell = newRow.insertCell();
                cell.textContent = formattedDropOffDate;
                cell.className = "text-wrap";
                cell.style.maxWidth = "200px";

                const formattedReadyToPickUpDate = row.date_ready_to_pick_up === 'Remove by user'
                    ? 'Remove by user'
                    : row.date_ready_to_pick_up
                        ? (() => {
                            const d = new Date(row.date_ready_to_pick_up);
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            let hours = d.getHours();
                            const minutes = String(d.getMinutes()).padStart(2, '0');
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            hours = hours % 12;
                            hours = hours ? hours : 12;
                            return `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
                        })()
                        : 'No departure date';
                cell = newRow.insertCell();
                cell.textContent = formattedReadyToPickUpDate;
                cell.className = "text-wrap";
                cell.style.maxWidth = "200px";
            });

            data_nationality.forEach(row => {
                const newRow = bagsWashedNationalityTableBody.insertRow();
                newRow.insertCell().textContent = row.country;
                newRow.insertCell().textContent = row.total_count_bags;
            });

            const rowsTable = bagsWashedTableBody.getElementsByTagName("tr");
            const rowsTableNational = bagsWashedNationalityTableBody.getElementsByTagName("tr");

            firstUpdateTable(rowsTable, 0, 10, 'pageNumber');
            firstUpdateTable(rowsTableNational, 0, 10, 'pageNumberDate');

            setupTableNavigation("bagsWashedTable", "prevBtn", "nextBtn", "pageNumber", limit, totalPages, page, selectDate1, selectDate2, searchFilters, searchFiltersDate);
            setupTableNavigation("bagsWashedNationalityTable", "prevBtnDate", "nextBtnDate", "pageNumberDate", limit, totalPagesNational, pageDate, selectDate1, selectDate2, searchFilters, searchFiltersDate);

        } catch (error) {
            if (error.name === 'AbortError') return;
            openMess('Error', 'Error fetching the report');

        } finally {
            stopLoading();
        }
    }

    function stopEnter(formId) {
        document.getElementById(formId).addEventListener('keypress', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
        });
    }

    stopEnter('form1');
    stopEnter('form2');
    stopEnter('form3');
    stopEnter('form4');
    stopEnter('form5');
    stopEnter('form6');
    stopEnter('form7');

    async function handleFormSubmit(event, formId, bagId, destination = null, prevDestination = null, input) {

        event.preventDefault();

        if (bagId.value === "") {
            toggleInputValidity(input, false);
            return;
        }

        const data = {
            code: bagId.value,
            destination: destination ? destination.value : 'None',
            prev_destination: prevDestination ? prevDestination.value : 'None'
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false; // Track if an error occurs
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(document.getElementById(formId).action, {
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

            closeMessModal();
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
                    globalAction = formId !== 'form5' ? 'addBag' : 'linenExchangeBag';
                    openMess('Info', formId !== 'form5' ? 'Laundry bag has been updated successfully.' : 'Line exchange bag has been applied successfully.');
                } else if (isSubmit) {
                    openMess('Error', responseData.message || (formId !== 'form5' ? 'Failed to update the laundry bag' : 'Failed to apply the Line Exchange bag'));
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        openMess('Warning', formId !== 'form5' ? 'Are you sure you want to update this laundry bag?' : 'Are you sure you want to apply this Line Exchange bag?');
    }

    // Attach the handler to each form
    document.getElementById('form2').onsubmit = (event) =>
        handleFormSubmit(event, 'form2', selectedAddBagId, prevDestinationByBtn, null, addBagSearchInput);

    document.getElementById('form3').onsubmit = (event) =>
        handleFormSubmit(event, 'form3', selectedMoveBagId, destinationByBtn, prevDestinationByBtn, moveBagSearchInput);

    document.getElementById('form4').onsubmit = (event) =>
        handleFormSubmit(event, 'form4', selectedRemoveBagId, null, destinationByBtn, removeBagSearchInput);

    document.getElementById('form5').onsubmit = (event) =>
        handleFormSubmit(event, 'form5', selectedLinenExchangeBagId, null, null, linenExchangeBagSearchInput);

    document.getElementById('form6').onsubmit = async (event) => {

        event.preventDefault();

        const epc = document.getElementById('epc-bag');
        const code = document.getElementById('code-bag');
        const type = document.getElementById('type-bag');
        const maxcount = document.getElementById('max-count-wash-bag');

        if (epc.value === '') {
            toggleInputValidity(epc, false);
            return;
        }

        if (code.value === '') {
            toggleInputValidity(code, false);
            return;
        }

        if (type.value === '') {
            toggleInputValidity(type, false);
            return;
        }

        if (maxcount.value === '') {
            toggleInputValidity(maxcount, false);
            return;
        }

        const data = {
            epc: epc.value,
            code: code.value,
            type: type.value,
            maxcount: maxcount.value
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false; // Track if an error occurs
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(document.getElementById('form6').action, {
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

            closeMessModal();
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
                    globalAction = 'insertBag';
                    openMess('Info', 'Laundry bag has been added successfully');
                } else if (isSubmit) {
                    openMess('Error', responseData.message || 'Failed to add the laundry bag');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        openMess('Warning', 'Are you sure you want to add this laundry bag?');
    }

    document.getElementById('form7').onsubmit = async (event) => {

        event.preventDefault();

        if (selectedEditBagId.value === '') {
            toggleInputValidity(editBagSearchInput, false);
            return;
        }

        if (editTypeSearchInput.value === '') {
            toggleInputValidity(editTypeSearchInput, false);
            return;
        }

        if (editWashSearchInput.value === '') {
            toggleInputValidity(editWashSearchInput, false);
            return;
        }

        const data = {
            bagId: selectedEditBagId.value,
            bagType: editTypeSearchInput.value,
            maxWash: editWashSearchInput.value
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');
        submitButton.addEventListener('click', async () => {

            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(document.getElementById('form7').action, {
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

            closeMessModal();
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
                    globalAction = 'editBag';
                    openMess('Info', 'Laundry bag has been updated successfully');
                } else if (isSubmit) {
                    openMess('Error', responseData.message || 'Failed to update the laundry bag');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        openMess('Warning', 'Are you sure you want to update this laundry bag?');
    }

    editTypeSearchInput.addEventListener('input', () => {
        if (editTypeSearchInput.value === '')
            toggleInputValidity(editTypeSearchInput, false);
        else
            toggleInputValidity(editTypeSearchInput, true);
    });

    editWashSearchInput.addEventListener('input', () => {
        const isNumber = /^\d+$/.test(editWashSearchInput.value);
        if (editWashSearchInput.value === '' || !isNumber) {
            toggleInputValidity(editWashSearchInput, false);
        } else {
            toggleInputValidity(editWashSearchInput, true);
        }
    });

    document.getElementById('form1').onsubmit = async (event) => {

        event.preventDefault();

        startLoading();

        try {

            const response = await fetch(document.getElementById('form1').action, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    selectedDate1: globalSelectDate1,
                    selectedDate2: globalSelectDate2,
                    filtersBags: globalSearchFilters,
                    filtersNationalBags: globalSearchFiltersNational
                })
            });

            if (!response.ok) {
                const error = await response.json()
                checkForGlobalError(response, error);
                throw new Error(error.message);
            }

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
            openMess('Error', error.message || 'Failed to download the report.');

        } finally {
            stopLoading();
        }
    }

});