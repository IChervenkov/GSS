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
    let allBags = [];
    let allCheckedRow = [];

    // Helper function to toggle input validity
    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

    document.querySelectorAll('#epc-bag, #code-bag, #type-bag, #max-count-wash-bag').forEach((input) => {
        input.addEventListener('input', function () {
            toggleInputValidity(input, input.value !== "" && input.checkValidity())
        });
    });

    // Function to fetch bags from the server
    async function fetchAllBags() {

        loadingIndicator.style.display = 'flex';

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
        } finally {
            loadingIndicator.style.display = 'none';
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
                toggleInputValidity(inputElement, hiddenInputElement === '')
            }
        });

        // Handle dropdown click
        dropdownElement.addEventListener('click', function (event) {
            handleDropdownClick(event, inputElement, hiddenInputElement, dropdownElement);
        });
    }

    initializeAllBagSearch(editBagSearchInput, editBagSearchDropdown, selectedEditBagId);

    // Function to fetch bags from the server
    async function fetchBags(status = 'None') {

        loadingIndicator.style.display = 'flex';

        try {

            if (bags.length > 0)
                bags = [];

            const response = await fetch(`/getBagsByStatus?status=${status}`, {
                method: 'GET'
            });

            if (!response.ok) {
                const errorData = await response.json();
                openMess('Error', errorData.message);
            }

            bags = await response.json(); // Store fetched bags in the global variable

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);
        } finally {
            loadingIndicator.style.display = 'none';
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

            const tbody = document.getElementById(`dropOffTableBody`);
            tbody.innerHTML = ''; // Clear existing rows

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

            readyToPickUpModal.classList.remove('show');
            readyToPickUpModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
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

    function openListBagModal() {
        listBagModal.classList.add('show');
        listBagModalContent.classList.add('show');
        listBagModalContent.classList.add('slide-in');
        listBagModalContent.classList.remove('slide-out');

        const tbody = document.getElementById('bagsTable').getElementsByTagName('tbody')[0];
        tbody.innerHTML = ''; // Clear existing rows

        allCheckedRow = []; // Reset the global array

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
                    if (isChecked && !allCheckedRow.find(row => row.code === rowId)) {
                        allCheckedRow.push({ code: rowId });
                    } else if (!isChecked) {
                        allCheckedRow = allCheckedRow.filter(row => row.code !== rowId);
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
        allBags.forEach((item) => {
            const row = document.createElement('tr');

            const checkboxCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input';
            checkbox.dataset.etc = item.id;
            checkbox.style.border = '1px solid black';

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    checkbox.style.backgroundColor = 'green';
                    if (!allCheckedRow.find(row => row.code === item.id)) {
                        allCheckedRow.push({ code: item.id });
                    }
                } else {
                    checkbox.style.backgroundColor = '';
                    allCheckedRow = allCheckedRow.filter(row => row.code !== item.id);
                }
            });

            checkboxCell.appendChild(checkbox);
            row.appendChild(checkboxCell);

            row.insertCell().textContent = item.name;
            row.insertCell().textContent = item.type;
            row.insertCell().textContent = item.maxcountlandry;

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

        setupTableNavigation("bagsTable", "prevBtnSecond", "nextBtnSecond", "pageNumberSecond");
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
    document.getElementsByClassName('close-btn')[14].onclick = closeMessModal;

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
    };

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

    function openModalWhenClick(clickStatus, nextDestination, clickButtonId, tableContent) {
        document.getElementById(`${clickButtonId}`).addEventListener('click', async () => {

            loadingIndicator.style.display = 'flex';

            try {
                const result = await fetch(`/getBagsByStatus?status=${clickStatus}`, {
                    method: 'GET'
                });

                if (!result.ok) {
                    throw new Error('Failed to fetch data');
                }

                const result_from_response = await result.json();

                const tbody = document.getElementById(`${tableContent}`);
                tbody.innerHTML = ''; // Clear existing rows

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
                            allCheckedRow.push({ code: checkbox.dataset.etc, destination: nextDestination, prev_destination: clickStatus });
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

                result_from_response.forEach((item) => {
                    const row = document.createElement('tr');

                    // Add the checkbox cell
                    const checkboxCell = document.createElement('td');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'form-check-input';
                    checkbox.dataset.etc = item.id;
                    checkbox.style.border = '1px solid black'; // Make the border more bold

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

                            row.appendChild(cell);
                        }
                    }

                    tbody.appendChild(row);
                });

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

                    case 'Transportation to drop off':
                        openTransportationToDropOffModal();
                        break;

                    default:
                        openReadyToPickUpModal();
                        break;
                }

            } catch (error) {
                console.error('Error fetching or processing data:', error);

            } finally {
                loadingIndicator.style.display = 'none';
            }
        });
    }

    openModalWhenClick('Drop off', 'Transportation to laundry facility', 'drop-off', 'dropOffTableBody');
    openModalWhenClick('Transportation to laundry facility', 'Laundry facility', 'transportation-to-laundry-facility', 'transportationToLaundryFacilityTableBody');
    openModalWhenClick('Laundry facility', 'Transportation to drop off', 'laundry-facility', 'laundryFacilityTableBody');
    openModalWhenClick('Transportation to drop off', 'Ready to pick up', 'transportation-to-drop-off', 'transportationToDropOffTableBody');
    openModalWhenClick('Ready to pick up', 'None', 'ready-to-pick-up', 'readyToPickUpTableBody');

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

        if (allCheckedRow.length === 0) {
            openMess('Error', 'You have not selected any bags');
            return;
        }

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');
        submitButton.addEventListener('click', async () => {

            loadingIndicator.style.display = 'flex';

            for (const data of allCheckedRow) {

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

                if (!response.ok) {
                    isError = true;
                }

                result = await response.json();
            }

            loadingIndicator.style.display = 'none';
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

                loadingIndicator.style.display = 'flex';

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
                        hasError = true;
                    }
                }

                loadingIndicator.style.display = 'none';
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

                loadingIndicator.style.display = 'flex';

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
                        isError = true;
                    }
                }

                loadingIndicator.style.display = 'none';
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

    async function fetchReport(selectDate1, selectDate2) {

        loadingIndicator.style.display = 'flex';

        try {

            const response = await fetch(`/laundry/viewReport?selectedDate1=${selectDate1}&selectedDate2=${selectDate2}`, {
                method: 'GET'
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
                newRow.insertCell().textContent = row.date_drop_off === row.date_ready_to_pick_up ? 'In the soldier' : row.status;
                const formattedDropOffDate = row.date_drop_off
                    ? new Date(row.date_drop_off).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    })
                    : 'Not accommodated';
                newRow.insertCell().textContent = formattedDropOffDate;

                const formattedReadyToPickUpDate = row.date_ready_to_pick_up === 'Remove by user'
                    ? 'Remove by user' : row.date_ready_to_pick_up
                        ? new Date(row.date_ready_to_pick_up).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        })
                        : 'No departure date';
                newRow.insertCell().textContent = formattedReadyToPickUpDate;
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

            setupTableNavigation("bagsWashedTable", "prevBtn", "nextBtn", "pageNumber");
            setupTableNavigation("bagsWashedNationalityTable", "prevBtnDate", "nextBtnDate", "pageNumberDate");

        } catch (error) {
            console.error('Error fetching the report:', error);

        } finally {
            loadingIndicator.style.display = 'none';
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

    async function handleFormSubmit(event, formId, modalCloseFn, bagId, destination = null, prevDestination = null, input) {

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

            loadingIndicator.style.display = 'flex';

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
                    hasError = true;
                }

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    openMess('Info', formId !== 'form5' ? 'Laundry bag has been updated successfully.' : 'Line exchange bag has been applied successfully.');
                    modalCloseFn();
                } else if (isSubmit) {
                    openMess('Error', responseData.message || formId !== 'form5' ? 'Failed to update the laundry bag' : 'Failed to apply the Line Exchange bag');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        openMess('Warning', formId !== 'form5' ? 'Are you sure you want to update this laundry bag?' : 'Are you sure you want to apply this Line Exchange bag?');
    }

    // Attach the handler to each form
    document.getElementById('form2').onsubmit = (event) =>
        handleFormSubmit(event, 'form2', closeAddBagModal, selectedAddBagId, prevDestinationByBtn, null, addBagSearchInput);

    document.getElementById('form3').onsubmit = (event) =>
        handleFormSubmit(event, 'form3', closeMoveBagModal, selectedMoveBagId, destinationByBtn, prevDestinationByBtn, moveBagSearchInput);

    document.getElementById('form4').onsubmit = (event) =>
        handleFormSubmit(event, 'form4', closeRemoveBagModal, selectedRemoveBagId, null, destinationByBtn, removeBagSearchInput);

    document.getElementById('form5').onsubmit = (event) =>
        handleFormSubmit(event, 'form5', closeLinenExchangeBagModal, selectedLinenExchangeBagId, null, null, linenExchangeBagSearchInput);

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

            loadingIndicator.style.display = 'flex';

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
                    hasError = true;
                }
            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    openMess('Info', 'Laundry bag has been added successfully');
                    closeInsertBagModal();
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

            loadingIndicator.style.display = 'flex';

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
                    hasError = true;
                }

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    openMess('Info', 'Laundry bag has been updated successfully');
                    closeEditBagModal();
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

        loadingIndicator.style.display = 'flex';

        try {
            const table1 = document.getElementById("bagsWashedTable");
            const rows1 = Array.from(table1.querySelectorAll("tbody tr"));

            const table2 = document.getElementById("bagsWashedNationalityTable");
            const rows2 = Array.from(table2.querySelectorAll("tbody tr"));

            const data = rows1
                .map((row) => {
                    const cells = row.querySelectorAll("td");
                    return {
                        bagNumber: cells[0]?.innerText.trim(),
                        soldierName: cells[1]?.innerText.trim(),
                        nationality: cells[2]?.innerText.trim(),
                        bagType: cells[3]?.innerText.trim(),
                        statusBag: cells[4]?.innerText.trim(),
                        dateIn: cells[5]?.innerText.trim(),
                        dateOut: cells[6]?.innerText.trim(),
                    };
                }).filter(row => row.bagNumber); // Exclude empty rows

            // Collect filter values if the search inputs are visible
            const filtersBags = {};
            document.querySelectorAll('.search-input-view-laundry').forEach(input => {
                filtersBags[input.name || input.id] = input.value.trim();
            });

            // Collect filter values if the search inputs are visible
            const filtersNationalBags = {};
            document.querySelectorAll('.search-input-view-laundry-second').forEach(input => {
                filtersNationalBags[input.name || input.id] = input.value.trim();
            });

            const data_1 = rows2
                .map((row) => {
                    const cells = row.querySelectorAll("td");
                    return {
                        nationality: cells[0]?.innerText.trim(),
                        bagCount: cells[1]?.innerText.trim(),
                    };
                }).filter(row => row.nationality); // Exclude empty rows

            const response = await fetch(document.getElementById('form1').action, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ result: data, result_nationality: data_1, filtersBags: filtersBags, filtersNationalBags: filtersNationalBags })
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

        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

});