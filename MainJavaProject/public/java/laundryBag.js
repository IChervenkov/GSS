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

    const insertBagModal = document.getElementById('insertBagModal');
    const insertBagModalContent = insertBagModal.querySelector('.modal-content');

    const deleteBagModal = document.getElementById('deleteBagModal');
    const deleteBagModalContent = deleteBagModal.querySelector('.modal-content');

    const deleteBagSearchInput = document.getElementById('bagRemoveSearch');
    const deleteBagSearchDropdown = document.getElementById('deleteBagDropdown');
    const selectedDeleteBagId = document.getElementById('selectedRemoveBagId');

    const addBagSearchInput = document.getElementById('search-add-input-bags');
    const addBagSearchDropdown = document.getElementById('addBagDropDown');
    const selectedAddBagId = document.getElementById('addBagSelectId');

    const moveBagSearchInput = document.getElementById('search-move-input-bags');
    const moveBagSearchDropdown = document.getElementById('moveBagDropDown');
    const selectedMoveBagId = document.getElementById('moveBagSelectId');

    const removeBagSearchInput = document.getElementById('search-remove-input-bags');
    const removeBagSearchDropdown = document.getElementById('removeBagDropDown');
    const selectedRemoveBagId = document.getElementById('removeBagSelectId');

    const modalMess = document.getElementById("myMessage");
    const modalMessContent = modalMess.querySelector('.modal-content-mess');

    const destinationByBtn = document.getElementById('destination');
    const prevDestinationByBtn = document.getElementById('prev_destination');

    let bags = [];
    let allBags = [];

    document.querySelectorAll('#epc-bag, #code-bag, #type-bag, #max-count-wash-bag').forEach((input) => {
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

    // Function to fetch bags from the server
    async function fetchAllBags() {
        try {

            const response = await fetch(`/bags`, {
                method: 'GET'
            });

            if (!response.ok) {
                const errorData = await response.json();
                openMess('Error', errorData.message);
            }

            const request = await response.json(); // Store fetched bags in the global variable
            allBags = request.allBags.filter(bag => bag.status === 'None');

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);
        }
    }

    fetchAllBags();

    // Function to filter and display dropdown options
    function filterAllBag(inputElement, dropdownElement) {
        const query = inputElement.value.toLowerCase();
        dropdownElement.innerHTML = '';
        const filteredBags = allBags.filter(bag => bag.name.toLowerCase().includes(query));

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
            }
        });

        // Handle dropdown click
        dropdownElement.addEventListener('click', function (event) {
            handleDropdownClick(event, inputElement, hiddenInputElement, dropdownElement);
        });
    }

    initializeAllBagSearch(deleteBagSearchInput, deleteBagSearchDropdown, selectedDeleteBagId);

    // Function to fetch bags from the server
    async function fetchBags(status = 'None') {
        try {

            if (bags.length > 0)
                bags = [];

            const response = await fetch(`/getBagsByStatus`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: status })
            });

            if (!response.ok) {
                const errorData = await response.json();
                openMess('Error', errorData.message);
            }

            bags = await response.json(); // Store fetched bags in the global variable

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);
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
            inputElement.classList.remove("is-invalid");
            inputElement.classList.add("is-valid");
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


    function openMess(type, message) {

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

            if (!isWarning) {
                // Refresh the page after the modal is closed
                window.location.reload();
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
            readyToPickUpModal.classList.remove('show');
            readyToPickUpModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
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

    function openDeleteBagModal() {

        // Add the slide-in effect by adding the necessary classes
        deleteBagModal.classList.add('show');
        deleteBagModalContent.classList.add('show');
        deleteBagModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        deleteBagModalContent.classList.remove('slide-out');
    }

    function closeDeleteBagModal() {
        // Add the slide-out effect
        deleteBagModalContent.classList.add('slide-out');
        deleteBagModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#bagRemoveSearch, #selectedRemoveBagId').forEach((input) => {

                input.classList.remove('is-valid');
                input.classList.remove('is-invalid');

                input.value = '';

            });

            deleteBagModal.classList.remove('show');
            deleteBagModalContent.classList.remove('show');
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

    document.getElementsByClassName('close-btn')[0].onclick = closeDropOffModal;
    document.getElementsByClassName('close-btn')[1].onclick = closeTransportationToLaundryFacilityModal;
    document.getElementsByClassName('close-btn')[2].onclick = closeLaundryFacilityModal;
    document.getElementsByClassName('close-btn')[3].onclick = closeTransportationToDropOffModal;
    document.getElementsByClassName('close-btn')[4].onclick = closeReadyToPickUpModal;
    document.getElementsByClassName('close-btn')[5].onclick = closeReportModal;
    document.getElementsByClassName('close-btn')[6].onclick = closeAddBagModal;
    document.getElementsByClassName('close-btn')[7].onclick = closeMoveBagModal;
    document.getElementsByClassName('close-btn')[8].onclick = closeRemoveBagModal;
    document.getElementsByClassName('close-btn')[9].onclick = closeInsertBagModal;
    document.getElementsByClassName('close-btn')[10].onclick = closeDeleteBagModal;
    document.getElementsByClassName('close-btn')[11].onclick = closeViewReportModal;
    document.getElementsByClassName('close-btn')[12].onclick = closeMessModal;

    window.onclick = function (event) {

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
                closeMessModal();
                break;

            case removeBagModal:
                closeRemoveBagModal();
                break;

            case insertBagModal:
                closeInsertBagModal();
                break;

            case deleteBagModal:
                closeDeleteBagModal();
                break;
            case reportModal:
                closeViewReportModal();
                break;
        }
    };

    function openModalWhenClick(clickStatus, clickButtonId, tableContent) {
        document.getElementById(`${clickButtonId}`).addEventListener('click', async () => {
            try {
                const result = await fetch('/getBagsByStatus', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: clickStatus }),
                });

                if (!result.ok) {
                    throw new Error('Failed to fetch data');
                }

                const result_from_response = await result.json();
                const data = result_from_response.map(({ id, ...rest }) => rest);

                const tbody = document.getElementById(`${tableContent}`);
                tbody.innerHTML = ''; // Clear existing rows

                data.forEach((item) => {
                    const row = document.createElement('tr');

                    // Dynamically create table cells for each key
                    for (const key in item) {
                        if (item.hasOwnProperty(key)) {
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

                            row.appendChild(cell);
                        }
                    }

                    tbody.appendChild(row);
                });

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

                    case 'Transportation to drop off':
                        openTransportationToDropOffModal();
                        break;

                    default:
                        openReadyToPickUpModal();
                        break;
                }

            } catch (error) {
                console.error('Error fetching or processing data:', error);
            }
        });
    }

    openModalWhenClick('Drop off', 'drop-off', 'dropOffTableBody');
    openModalWhenClick('Transportation to laundry facility', 'transportation-to-laundry-facility', 'transportationToLaundryFacilityTableBody');
    openModalWhenClick('Laundry facility', 'laundry-facility', 'laundryFacilityTableBody');
    openModalWhenClick('Transportation to drop off', 'transportation-to-drop-off', 'transportationToDropOffTableBody');
    openModalWhenClick('Ready to pick up', 'ready-to-pick-up', 'readyToPickUpTableBody');

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

        if(new Date(selectDate1) > new Date(selectDate2)) {
            openMess('Error', 'Invalid time slot!');
            return;
        }

        closeViewReportModal();

        fetchReport(selectDate1, selectDate2);
        openReportModal();
    });

    document.getElementById('addButton').addEventListener('click', () => {
        openInsertBagModal();
    });

    document.getElementById('removeButton').addEventListener('click', () => {
        openDeleteBagModal();
    });

    document.querySelectorAll('#addBag, #moveBag, #removeBag').forEach((button) => {
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

                case 'moveBag':
                    fetchBags(prev_destination);
                    openMoveBagModal();
                    break;

                case 'removeBag':
                    fetchBags(prev_destination);
                    openRemoveBagModal();
                    break;
            }
        });
    });


    async function fetchReport(selectDate1, selectDate2) {
        try {

            const response = await fetch(`/laundry/viewReport`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ selectedDate1: selectDate1, selectedDate2: selectDate2 }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Error fetching the report:', error.details || 'Network response was not ok');
                openMess('Error', error.message);
                return;
            }

            const { data, data_nationality } = await response.json();

            // Clear existing rows from bike usage details table
            const bagsWashedTableBody = document.getElementById('bagsWashedTable').getElementsByTagName('tbody')[0];
            const bagsWashedNationalityTableBody = document.getElementById('bagsWashedNationalityTable').getElementsByTagName('tbody')[0];

            bagsWashedTableBody.innerHTML = '';
            bagsWashedNationalityTableBody.innerHTML = '';

            data.forEach(row => {
                const newRow = bagsWashedTableBody.insertRow();
                newRow.insertCell().textContent = row.code;
                newRow.insertCell().textContent = row.namesoldier;
                newRow.insertCell().textContent = row.country;
                newRow.insertCell().textContent = row.type;
                newRow.insertCell().textContent = row.date_drop_off ? row.date_drop_off : 'Not accommodated';
                newRow.insertCell().textContent = row.date_ready_to_pick_up ? row.date_ready_to_pick_up : 'No departure date';
            });

            data_nationality.forEach(row => {
                const newRow = bagsWashedNationalityTableBody.insertRow();
                newRow.insertCell().textContent = row.country;
                newRow.insertCell().textContent = row.total_count_bags;
            });

        } catch (error) {
            console.error('Error fetching the report:', error);
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

    async function handleFormSubmit(event, formId, modalCloseFn, bagId, destination = null, prevDestination = null, input) {

        event.preventDefault();

        if (bagId.value === "") {
            input.classList.add("is-invalid");
            input.classList.remove("is-valid");
            return;
        }

        const data = {
            code: bagId.value,
            destination: destination ? destination.value : 'None',
            prev_destination: prevDestination ? prevDestination.value : 'None'
        };

        try {
            const response = await fetch(document.getElementById(formId).action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const responseData = await response.json();
            if (!response.ok) {
                openMess('Error', responseData.message);
            } else {
                openMess('Info', responseData.message);
            }

            modalCloseFn();

        } catch (error) {
            openMess('Error', `Network error: ${error.message}`);
        }
    }

    // Attach the handler to each form
    document.getElementById('form2').onsubmit = (event) =>
        handleFormSubmit(event, 'form2', closeAddBagModal, selectedAddBagId, prevDestinationByBtn, null, addBagSearchInput);

    document.getElementById('form3').onsubmit = (event) =>
        handleFormSubmit(event, 'form3', closeMoveBagModal, selectedMoveBagId, destinationByBtn, prevDestinationByBtn, moveBagSearchInput);

    document.getElementById('form4').onsubmit = (event) =>
        handleFormSubmit(event, 'form4', closeRemoveBagModal, selectedRemoveBagId, null, destinationByBtn, removeBagSearchInput);

    document.getElementById('form5').onsubmit = async (event) => {

        event.preventDefault();

        const epc = document.getElementById('epc-bag');
        const code = document.getElementById('code-bag');
        const type = document.getElementById('type-bag');
        const maxcount = document.getElementById('max-count-wash-bag');

        if (epc.value === '') {
            epc.classList.remove('is-valid');
            epc.classList.add('is-invalid');
            return;
        }

        if (code.value === '') {
            code.classList.remove('is-valid');
            code.classList.add('is-invalid');
            return;
        }

        if (type.value === '') {
            type.classList.remove('is-valid');
            type.classList.add('is-invalid');
            return;
        }

        if (maxcount.value === '') {
            maxcount.classList.remove('is-valid');
            maxcount.classList.add('is-invalid');
            return;
        }

        const data = {
            epc: epc.value,
            code: code.value,
            type: type.value,
            maxcount: maxcount.value
        };

        try {
            const response = await fetch(document.getElementById('form5').action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const responseData = await response.json();

            if (!response.ok) {
                openMess('Error', responseData.message);
            } else {
                openMess('Info', responseData.message);
            }

            closeInsertBagModal();

        } catch (error) {
            openMess('Error', `Network error: ${error.message}`);
        }
    }

    document.getElementById('form6').onsubmit = async (event) => {

        event.preventDefault();

        if (selectedDeleteBagId.value === '') {
            deleteBagSearchInput.classList.remove('is-valid');
            deleteBagSearchInput.classList.add('is-invalid');
            return;
        }

        const data = {
            bagId: selectedDeleteBagId.value,
        };

        try {
            const response = await fetch(document.getElementById('form6').action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const responseData = await response.json();

            if (!response.ok) {
                openMess('Error', responseData.message);
            } else {
                openMess('Info', responseData.message);
            }

            closeDeleteBagModal();

        } catch (error) {
            openMess('Error', `Network error: ${error.message}`);
        }
    }

    document.getElementById('form1').onsubmit = async (event) => {

        event.preventDefault();

        try {
            const table1 = document.getElementById("bagsWashedTable");
            const rows1 = Array.from(table1.querySelectorAll("tbody tr"));

            const table2 = document.getElementById("bagsWashedNationalityTable");
            const rows2 = Array.from(table2.querySelectorAll("tbody tr"));

            const data = rows1
                .filter(row => row.style.display !== 'none')
                .map((row) => {
                    const cells = row.querySelectorAll("td");
                    return {
                        bagNumber: cells[0]?.innerText.trim(),
                        soldierName: cells[1]?.innerText.trim(),
                        nationality: cells[2]?.innerText.trim(),
                        bagType: cells[3]?.innerText.trim(),
                        dateIn: cells[4]?.innerText.trim(),
                        dateOut: cells[5]?.innerText.trim(),
                    };
                }).filter(row => row.bagNumber); // Exclude empty rows

            const data_1 = rows2
                .filter(row => row.style.display !== 'none')
                .map((row) => {
                    const cells = row.querySelectorAll("td");
                    return {
                        nationality: cells[0]?.innerText.trim(),
                        bagCount: cells[1]?.innerText.trim(),
                    };
                }).filter(row => row.nationality); // Exclude empty rows

            const response = await fetch(document.getElementById('form1').action, {
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

});