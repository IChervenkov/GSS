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

    var modalMess = document.getElementById("myMessage");
    var modalMessContent = modalMess.querySelector('.modal-content-mess');

    var modalMessRep = document.getElementById("myMessageReport");
    var modalMessRepContent = modalMessRep.querySelector('.modal-content-mess');

    var modalRep = document.getElementById("reportModal");
    var modalRepContent = modalRep.querySelector(".modal-content-multi-calendar");

    var modalViewRep = document.getElementById("reportViewModal");
    var modalViewRepContent = modalViewRep.querySelector(".modal-content-view");

    var modalTotalBike = document.getElementById("totalRentBikeModal");
    var modalTotalBikeContent = modalTotalBike.querySelector(".modal-content-total-info");

    var modalTotalAvailableBike = document.getElementById("totalAvailableBikeModal");
    var modalTotalAvailableBikeContent = modalTotalAvailableBike.querySelector(".modal-content-total-info");

    var modalTotalrepireBike = document.getElementById("totalRepireBikeModal");
    var modalTotalrepireBikeContent = modalTotalrepireBike.querySelector(".modal-content-total-info");

    var modalTotallateBike = document.getElementById("totalLateBikeModal");
    var modalTotallateBikeContent = modalTotallateBike.querySelector(".modal-content-total-info");

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
    var saveButton = document.getElementById("checkBtn");

    // Get the <span> element that closes the modal
    var span = document.getElementsByClassName("close")[0];
    var spanMess = document.getElementsByClassName("close")[1];
    var spanRep = document.getElementsByClassName("close")[2];
    var spanViewRep = document.getElementsByClassName("close")[3];
    var spanTotalBike = document.getElementsByClassName("close")[4];
    var spanTotalAvailBike = document.getElementsByClassName("close")[5];
    var spanTotalRepireBike = document.getElementsByClassName("close")[6];
    var spanTotalLateBike = document.getElementsByClassName("close")[7];
    var spanTotalLongTermBike = document.getElementsByClassName("close")[8];
    var spanSearchBike = document.getElementsByClassName("close")[9];
    var spanSearchClient = document.getElementsByClassName("close")[10];
    var spanSearchHelmet = document.getElementsByClassName("close")[11];
    var spanAddBike = document.getElementsByClassName("close")[12];
    var spanRemoveBike = document.getElementsByClassName("close")[13];
    var spanAddMultiBike = document.getElementsByClassName("close")[14];
    document.getElementsByClassName("close")[15].onclick = closeEditModal;
    document.getElementsByClassName("close")[16].onclick = closeListHelmetsModal;
    var spanAddHelmet = document.getElementsByClassName("close")[17];
    var spanAddMultiHelmet = document.getElementsByClassName("close")[18];
    var spanMessRep = document.getElementsByClassName("close")[19];

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

    const clientSearchInput = document.getElementById('clientSearch');
    const clientSearchDropdown = document.getElementById('clientDropdown');
    const selectedClientId = document.getElementById('selectedClientId');

    const helmetSearchInput = document.getElementById('helmetSearch');
    const helmetSearchDropdown = document.getElementById('helmetDropdown');
    const selectedHelmetId = document.getElementById('selectedHelmetId');

    const loadingIndicator = document.getElementById('loadingIndicator');

    let clients = [];

    // Helper function to toggle input validity
    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

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
                const icon = document.getElementById("mess-icon-rep");
                const message = document.getElementById("mess-text-rep");
                const btnYes = document.getElementById("btnMess");

                icon.src = "/icon/error.png";
                message.textContent = 'Data can only be edited for bike that are not available';
                btnYes.style.display = "none";
                openModal(modalMessRep, modalMessRepContent);
            } else {
                // Call the modal opening function with extracted data
                openEditModal(bikeName, status, hiredBy, dateFrom, helmet);
            }
        });
    });

    document.getElementById('confirmReportBtn').onclick = function () {

        const date1 = new Date(document.getElementById("selectedDate1").value);
        const date2 = new Date(document.getElementById("selectedDate2").value);

        const icon = document.getElementById("mess-icon-rep");
        const message = document.getElementById("mess-text-rep");
        const btnYes = document.getElementById("btnMess");

        if (date1 <= date2) {
            openModal(modalViewRep, modalViewRepContent);
            fetchReport();
            closeModal(modalRep, modalRepContent);

        } else {

            icon.src = "/icon/error.png";
            message.textContent = "Invalid time period";
            btnYes.style.display = "none";

            openModal(modalMessRep, modalMessRepContent);
            closeModal(modalRep, modalRepContent);
        }
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

    function openModal(modal, modalContent) {

        // Add the slide-in effect by adding the necessary classes
        modal.classList.add('show');
        modalContent.classList.add('show');
        modalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalContent.classList.remove('slide-out');
    }

    function closeModal(modal, modalContent) {
        // Add the slide-out effect
        modalContent.classList.add('slide-out');
        modalContent.classList.remove('slide-in');

        if (modal === modalRep) {
            const listItems = document.querySelectorAll('.dates li');
            listItems.forEach(li => li.classList.remove('selected'));
        }

        if (modal === modalViewRep) {

            document.querySelectorAll('.search-input-view-bike, .search-input-view-total-bike').forEach((input) => {
                input.value = '';
            });
        }

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modal.classList.remove('show');
            modalContent.classList.remove('show');

            const icon = document.getElementById("mess-icon-rep");

            if ((modal === modalMessRep && icon.src.includes('information'))) {
                // Refresh the page after the modal is closed
                window.location.reload();
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

        loadingIndicator.style.display = 'flex';

        fetch(`/helmets`, {
            method: 'GET'
        })
            .then(response => response.json())
            .then(data => {
                // Parse the JSON string into an array of objects
                var helmetListData = data;

                const tbody = document.getElementById('tableBodyModal');
                const helmetTableBody = document.getElementById('helmetTable').getElementsByTagName('tbody')[0];
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

                helmetListData.forEach(item => {
                    const row = document.createElement("tr");
                    row.classList.add('data-helmet');

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

                    // Append row to the table body
                    tbody.appendChild(row);
                });

                const rowsTable = helmetTableBody.getElementsByTagName("tr");
                firstUpdateTable(rowsTable, 0, 10, 'pageNumberSecond');

                setupTableNavigation("helmetTable", "prevBtnSecond", "nextBtnSecond", "pageNumberSecond");
            })
            .catch(error => console.error("Error fetching keys:", error))
            .finally(() => {
                loadingIndicator.style.display = 'none';
            })

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

            modalListHelmets.classList.remove('show');
            modalListHelmetsContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    // Function to fetch bikes from the server
    async function fetchItem() {

        loadingIndicator.style.display = 'flex';

        try {
            const responseBike = await fetch(`/bikes`, {
                method: 'GET'
            });

            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }
            bikes = await responseBike.json(); // Store fetched bikes in the global variable

            const responseHelmets = await fetch(`/helmets`, {
                method: 'GET'
            });

            if (!responseHelmets.ok) {
                throw new Error('Network response was not ok');
            }
            helmets = await responseHelmets.json(); // Store fetched bikes in the global variable

            const responseClient = await fetch(`/clients`);
            if (!responseClient.ok) {
                throw new Error('Network response was not ok');
            }
            clients = await responseClient.json(); // Store fetched bikes in the global variable

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);

        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    async function fetchHelmetBike(bikeId) {

        loadingIndicator.style.display = 'flex';

        try {
            const responseBike = await fetch(`/getHelmetByBike?bikeId=${bikeId}`, {
                method: 'GET'
            });

            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }
            const result = await responseBike.json();
            document.getElementById('modalHelmetLabel').textContent = result.code ? result.code : 'None';
            document.getElementById('selectedByBikeHelmetId').value = result.helmetId ? result.helmetId : '';

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);

        } finally {
            loadingIndicator.style.display = 'none';
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
        const filteredSoldiers = clients.filter(client => (client.id === '4' || (client.date_accommodation !== '' && client.date_free === '')) && (
            client.name.toLowerCase().includes(query.toLowerCase()) ||
            client.namekey.toLowerCase().includes(query.toLowerCase())
        ));

        if (filteredSoldiers.length > 0) {
            editSoldierSearchDropdown.style.display = 'block';
            filteredSoldiers.forEach(soldier => {
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
        const filteredClients = clients.filter(client => (client.id === '4' || (client.date_accommodation !== '' && client.date_free === '')) && (
            client.name.toLowerCase().includes(query.toLowerCase()) ||
            client.namekey.toLowerCase().includes(query.toLowerCase())
        ));

        if (filteredClients.length > 0) {
            clientSearchDropdown.style.display = 'block';
            filteredClients.forEach(client => {
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
            openModal(modal, modalContent);
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
            openModal(modal, modalContent);
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

    if (saveButton) {

        saveButton.onclick = async function () {
            const icon = document.getElementById("mess-icon");
            const message = document.getElementById("mess-text");
            const btnYes = document.getElementById("btnYes");

            const setDate = document.getElementById('date').value;
            const selectHour = document.getElementById('hourSelect').value;
            const selectMinute = document.getElementById('minuteSelect').value;
            const action = document.getElementById("action").value;

            loadingIndicator.style.display = 'flex';

            try {
                // Fetch bike status
                const response = await fetch(`/checkBike?bikeId=${selectedBikeId.value}`, {
                    method: 'GET'
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('Error fetching the report:', error.details || 'Network response was not ok');
                    return;
                }

                const data = await response.json();
                const dateFrom = new Date(data.datefrom);
                const dateTo = new Date(`${setDate} ${selectHour}:${selectMinute}`);
                const dateNow = new Date();

                // Validate input fields

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
                    icon.src = "/icon/error.png";
                    message.textContent = "Please select all fields";
                    btnYes.style.display = "none";
                } else if (action === "Rent" && data.status !== 'Available') {
                    icon.src = "/icon/error.png";
                    message.textContent = "The bike is already rented!";
                    btnYes.style.display = "none";
                } else if (action === "Return" && data.status === 'Available') {
                    icon.src = "/icon/error.png";
                    message.textContent = "This bike is not rented!";
                    btnYes.style.display = "none";
                } else if (action === "Return" && dateFrom > dateTo) {
                    icon.src = "/icon/error.png";
                    message.textContent = "Invalid return date!";
                    btnYes.style.display = "none";
                } else if (dateTo > dateNow) {
                    icon.src = "/icon/error.png";
                    message.textContent = "Invalid rent date!";
                    btnYes.style.display = "none";
                } else {
                    icon.src = "/icon/information.png";
                    message.textContent = "Are you sure you want to proceed?";
                    btnYes.style.display = "block";
                }

                openModal(modalMess, modalMessContent);

            } catch (error) {
                console.error("Unexpected error:", error);
                icon.src = "/icon/error.png";
                message.textContent = "An error occurred while checking the bike status.";
                btnYes.style.display = "none";
                openModal(modalMess, modalMessContent);

            } finally {
                loadingIndicator.style.display = 'none';
            }
        };
    }

    // When the user clicks on <span> (x), close the modal
    function spanCloseModal(span, modal, modalContent, checkBox = null) {
        span.onclick = function () {

            switch (modal) {
                case modalAddBike:
                    document.querySelectorAll('#bike-number, #bike-name').forEach((input) => {

                        input.classList.remove('is-valid');
                        input.classList.remove('is-invalid');

                        input.value = '';
                    });
                    break;

                case modalAddHelmet:
                    document.querySelectorAll('#helmet-number, #helmet-name').forEach((input) => {

                        input.classList.remove('is-valid');
                        input.classList.remove('is-invalid');

                        input.value = '';
                    });
                    break;

                case modalRemoveBike:
                    document.querySelectorAll('#removeBikeSearch, #selectedRemoveBikeId').forEach((input) => {

                        input.classList.remove('is-valid');
                        input.classList.remove('is-invalid');

                        input.value = '';
                    });
                    break;

                case modalAddMultiBike:
                    document.getElementById('fileInputBike').value = '';
                    document.getElementById("progress-multi-bike").style.width = 0 + "%";
                    break;
            }

            if (checkBox)
                checkBox.checked = false;

            closeModal(modal, modalContent);
        }
    }

    spanCloseModal(span, modal, modalContent, modalCheckBox);
    spanCloseModal(spanMess, modalMess, modalMessContent);
    spanCloseModal(spanRep, modalRep, modalRepContent);
    spanCloseModal(spanViewRep, modalViewRep, modalViewRepContent);
    spanCloseModal(spanTotalBike, modalTotalBike, modalTotalBikeContent);
    spanCloseModal(spanTotalAvailBike, modalTotalAvailableBike, modalTotalAvailableBikeContent);
    spanCloseModal(spanTotalRepireBike, modalTotalrepireBike, modalTotalrepireBikeContent);
    spanCloseModal(spanTotalLateBike, modalTotallateBike, modalTotallateBikeContent);
    spanCloseModal(spanTotalLongTermBike, modalTotalLongTermBike, modalTotalLongTermBikeContent);
    spanCloseModal(spanSearchBike, modalSearchBike, modalSearchBikeContent);
    spanCloseModal(spanSearchClient, modalSearchClient, modalSearchClientContent);
    spanCloseModal(spanSearchHelmet, modalSearchHelmet, modalSearchHelmetContent);
    spanCloseModal(spanMessRep, modalMessRep, modalMessRepContent);
    spanCloseModal(spanAddBike, modalAddBike, modalAddBikeContent);
    spanCloseModal(spanAddHelmet, modalAddHelmet, modalAddHelmetContent);
    spanCloseModal(spanRemoveBike, modalRemoveBike, modalRemoveBikeContent);
    spanCloseModal(spanAddMultiBike, modalAddMultiBike, modalAddMultiBikeContent);
    spanCloseModal(spanAddMultiHelmet, modalAddMultiHelmet, modalAddMultiHelmetContent);

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function (event) {

        switch (event.target) {
            case modal:
                modalCheckBox.checked = false;
                closeModal(modal, modalContent);
                break;

            case modalMess:
                closeModal(modalMess, modalMessContent);
                break;

            case modalRep:
                closeModal(modalRep, modalRepContent);
                break;

            case modalViewRep:
                closeModal(modalViewRep, modalViewRepContent);
                break;

            case modalTotalBike:
                closeModal(modalTotalBike, modalTotalBikeContent);
                break;

            case modalTotalAvailableBike:
                closeModal(modalTotalAvailableBike, modalTotalAvailableBikeContent);
                break;

            case modalTotalrepireBike:
                closeModal(modalTotalrepireBike, modalTotalrepireBikeContent);
                break;

            case modalTotallateBike:
                closeModal(modalTotallateBike, modalTotallateBikeContent);
                break;

            case modalTotalLongTermBike:
                closeModal(modalTotalLongTermBike, modalTotalLongTermBikeContent);
                break;

            case modalSearchBike:
                closeModal(modalSearchBike, modalSearchBikeContent);
                break;

            case modalSearchClient:
                closeModal(modalSearchClient, modalSearchClientContent);
                break;

            case modalSearchHelmet:
                closeModal(modalSearchHelmet, modalSearchHelmetContent);
                break;

            case modalMessRep:
                closeModal(modalMessRep, modalMessRepContent);
                break;

            case modalAddBike:
                closeModal(modalAddBike, modalAddBikeContent);
                document.querySelectorAll('#bike-number, #bike-name').forEach((input) => {

                    input.classList.remove('is-valid');
                    input.classList.remove('is-invalid');

                    input.value = '';
                });
                break;

            case modalAddHelmet:
                closeModal(modalAddHelmet, modalAddHelmetContent);
                document.querySelectorAll('#helmet-number, #helmet-name').forEach((input) => {

                    input.classList.remove('is-valid');
                    input.classList.remove('is-invalid');

                    input.value = '';
                });
                break;

            case modalRemoveBike:
                closeModal(modalRemoveBike, modalRemoveBikeContent);
                document.querySelectorAll('#removeBikeSearch, #selectedRemoveBikeId').forEach((input) => {

                    input.classList.remove('is-valid');
                    input.classList.remove('is-invalid');

                    input.value = '';
                });
                break;

            case modalAddMultiBike:
                closeModal(modalAddMultiBike, modalAddMultiBikeContent);
                document.getElementById("progress-multi-bike").style.width = 0 + "%";
                document.getElementById('fileInputBike').value = '';
                break;

            case modalAddMultiHelmet:
                closeModal(modalAddMultiHelmet, modalAddMultiHelmetContent);
                document.getElementById("progress-multi-helmet").style.width = 0 + "%";
                document.getElementById('fileInputHelmet').value = '';
                break;

            case modalEditBike:
                closeEditModal();
                break;

            case modalListHelmets:
                closeListHelmetsModal();
                break;
        }
    }

    // Add event listener to the checkbox
    modalCheckBox.addEventListener('change', function () {
        toggleTimeSelection(this.checked);
    });

    // Open the report modal when the Reports button is clicked
    document.getElementById("btnReport").addEventListener("click", function () {
        openModal(modalRep, modalRepContent);
    });

    // Open the report modal when the Reports button is clicked on phone
    document.getElementById("btnReportPhone").addEventListener("click", function () {
        openModal(modalRep, modalRepContent);
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
        openModal(modalTotalBike, modalTotalBikeContent);
    });

    document.getElementById("availableBike").addEventListener("click", function () {
        openModal(modalTotalAvailableBike, modalTotalAvailableBikeContent);
    });

    document.getElementById("repairBike").addEventListener("click", function () {
        openModal(modalTotalrepireBike, modalTotalrepireBikeContent);
    });

    document.getElementById("lateBike").addEventListener("click", function () {
        openModal(modalTotallateBike, modalTotallateBikeContent);
    });

    document.getElementById("longTermBike").addEventListener("click", function () {
        openModal(modalTotalLongTermBike, modalTotalLongTermBikeContent);
    });

    document.getElementById('addBike').addEventListener("click", function () {
        openModal(modalAddBike, modalAddBikeContent);
    });

    document.getElementById('addHelmet').addEventListener("click", function () {
        openModal(modalAddHelmet, modalAddHelmetContent);
    });

    document.getElementById('removeBike').addEventListener("click", function () {
        openModal(modalRemoveBike, modalRemoveBikeContent);
    });

    document.getElementById('confirmAddMultiBikeBtn').onclick = function () {
        openModal(modalAddMultiBike, modalAddMultiBikeContent);
    }

    document.getElementById('confirmAddMultiHelmetBtn').onclick = function () {
        openModal(modalAddMultiHelmet, modalAddMultiHelmetContent);
    }

    document.getElementById("searchButtonBike").addEventListener("click", function () {
        openModal(modalSearchBike, modalSearchBikeContent);

        // Clear existing rows from the table
        const existingTableBody = document.querySelector("#searchBikeModal table tbody");
        if (existingTableBody) {
            existingTableBody.remove();
        }

        const bikeId = selectedBikeId.value;
        const bikeContent = bikeSearchInput.value;

        if (bikeContent.length != 0) {

            loadingIndicator.style.display = 'flex';

            // Fetch bike data from server
            fetch(`/searchBikes?id=${bikeId}`, {
                method: 'GET'
            })
                .then(response => response.json())
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
                        row.appendChild(nameCell);

                        const dateFromCell = document.createElement("td");
                        dateFromCell.textContent = bike.datefrom ? bike.datefrom : "None";
                        row.appendChild(dateFromCell);

                        const dateToCell = document.createElement("td");
                        dateToCell.textContent = bike.dateto ? bike.dateto : "None";
                        row.appendChild(dateToCell);

                        newTableBody.appendChild(row);
                    });

                    // Append new table body to table
                    document.querySelector("#searchBikeModal table").appendChild(newTableBody);
                })
                .catch(error => {
                    console.error('Error fetching bike data:', error);
                })
                .finally(() => {
                    loadingIndicator.style.display = 'none';
                });
        }
    });

    document.getElementById("searchButtonClient").addEventListener("click", function () {
        openModal(modalSearchClient, modalSearchClientContent);

        // Clear existing rows from the table
        const existingTableBody = document.querySelector("#searchClientModal table tbody");
        if (existingTableBody) {
            existingTableBody.remove();
        }

        const clientId = selectedClientId.value;
        const clientContent = clientSearchInput.value;

        if (clientContent.length != 0) {

            loadingIndicator.style.display = 'flex';

            // Fetch bike data from server
            fetch(`/searchClient?id=${clientId}`, {
                method: 'GET'
            })
                .then(response => response.json())
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
                        row.appendChild(nameCell);

                        const dateFromCell = document.createElement("td");
                        dateFromCell.textContent = client.datefrom ? client.datefrom : "None";
                        row.appendChild(dateFromCell);

                        const dateToCell = document.createElement("td");
                        dateToCell.textContent = client.dateto ? client.dateto : "None";
                        row.appendChild(dateToCell);

                        newTableBody.appendChild(row);
                    });

                    // Append new table body to table
                    document.querySelector("#searchClientModal table").appendChild(newTableBody);
                })
                .catch(error => {
                    console.error('Error fetching bike data:', error);
                })
                .finally(() => {
                    loadingIndicator.style.display = 'none';
                });
        }
    });

    document.getElementById("searchButtonHelmet").addEventListener("click", function () {
        openModal(modalSearchHelmet, modalSearchHelmetContent);

        // Clear existing rows from the table
        const existingTableBody = document.querySelector("#searchHelmetModal table tbody");
        if (existingTableBody) {
            existingTableBody.remove();
        }

        const helmetId = selectedHelmetId.value;
        const helmetContent = helmetSearchInput.value;

        if (helmetContent.length != 0) {

            loadingIndicator.style.display = 'flex';

            // Fetch bike data from server
            fetch(`/searchHelmet?id=${helmetId}`, {
                method: 'GET'
            })
                .then(response => response.json())
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
                        row.appendChild(nameCell);

                        const dateFromCell = document.createElement("td");
                        dateFromCell.textContent = bike.datefrom ? bike.datefrom : "None";
                        row.appendChild(dateFromCell);

                        const dateToCell = document.createElement("td");
                        dateToCell.textContent = bike.dateto ? bike.dateto : "None";
                        row.appendChild(dateToCell);

                        newTableBody.appendChild(row);
                    });

                    // Append new table body to table
                    document.querySelector("#searchHelmetModal table").appendChild(newTableBody);
                })
                .catch(error => {
                    console.error('Error fetching bike data:', error);
                })
                .finally(() => {
                    loadingIndicator.style.display = 'none';
                });
        }
    });

    document.getElementById("removeHelmet").addEventListener("click", function () {

        const submitButton = document.createElement('button');
        var isRemove = false;
        var isError = false;
        var result = {};
        
        const icon = document.getElementById('mess-icon-rep');
        const message = document.getElementById('mess-text-rep');
        const btnYes = document.getElementById('btnMess');
        btnYes.style.display = "none";

        if (allCheckedRow.length === 0) {
            icon.src = "/icon/error.png";
            message.textContent = 'You have not selected any helmets to remove';
            openModal(modalMessRep, modalMessRepContent);
            return;
        }

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');
        submitButton.addEventListener('click', async () => {

            loadingIndicator.style.display = 'flex';

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

                if (!response.ok) {
                    isError = true;
                }

                result = await response.json();
            }

            loadingIndicator.style.display = 'none';
            closeModal(modalMessRep, modalMessRepContent);
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
                    icon.src = "/icon/information.png";
                    message.textContent = result.message;
                    openModal(modalMessRep, modalMessRepContent);
                } else if (isError) {
                    icon.src = "/icon/error.png";
                    message.textContent = result.message || 'An error occurred while adding the bike';
                    openModal(modalMessRep, modalMessRepContent);
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        icon.src = "/icon/timeout.png";
        message.textContent = 'Are you sure you want to remove the selected helmets?';
        openModal(modalMessRep, modalMessRepContent);
    });

    function firstUpdateTable(rows, currentIndex, rowsPerPage, pageNumberId) {
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display = i >= currentIndex && i < currentIndex + rowsPerPage ? "table-row" : "none";
        }

        let totalPages = Math.ceil(rows.length / rowsPerPage) || 1; // Recalculate total pages (avoid division by zero)
        let currentPage = Math.floor(currentIndex / rowsPerPage) + 1;
        document.getElementById(pageNumberId).textContent = `${currentPage}/${totalPages}`;
    }

    async function fetchReport() {

        loadingIndicator.style.display = 'flex';

        try {

            const selectedDate1 = document.getElementById('selectedDate1').value;
            const selectedDate2 = document.getElementById('selectedDate2').value;

            const response = await fetch(`/bicycles/viewReport?selectedDate1=${selectedDate1}&selectedDate2=${selectedDate2}`, {
                method: 'GET'
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Error fetching the report:', error.details || 'Network response was not ok');
            }

            const { data, dateTotals } = await response.json();

            // Clear existing rows from bike usage details table
            const bikeUsageTableBody = document.getElementById('bikeUsageTable').getElementsByTagName('tbody')[0];
            bikeUsageTableBody.innerHTML = ''; // Clear all existing rows

            data.forEach(row => {
                const newRow = bikeUsageTableBody.insertRow();
                newRow.insertCell().textContent = row.namebike;
                newRow.insertCell().textContent = row.namesoldier;
                newRow.insertCell().textContent = row.country;
                newRow.insertCell().textContent = row.helmet_code || 'N/A';
                newRow.insertCell().textContent = row.date_from;
                newRow.insertCell().textContent = row.date_to;
                newRow.insertCell().textContent = row.duration;
            });

            // Populate total bike usage per day table
            const bikeTotalsTableBody = document.getElementById('bikeTotalsTable').getElementsByTagName('tbody')[0];
            bikeTotalsTableBody.innerHTML = '';

            dateTotals.forEach(row => {
                const newRow = bikeTotalsTableBody.insertRow();
                newRow.insertCell().textContent = row.date;
                newRow.insertCell().textContent = row.total_bikes;
            });

            const rowsTable = bikeUsageTableBody.getElementsByTagName("tr");
            const rowsTableDate = bikeTotalsTableBody.getElementsByTagName("tr");

            firstUpdateTable(rowsTable, 0, 10, 'pageNumber');
            firstUpdateTable(rowsTableDate, 0, 10, 'pageNumberDate');

            setupTableNavigation("bikeUsageTable", "prevBtn", "nextBtn", "pageNumber");
            setupTableNavigation("bikeTotalsTable", "prevBtnDate", "nextBtnDate", "pageNumberDate");

        } catch (error) {
            console.error('Error fetching the report:', error);

        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    document.getElementById('form1').addEventListener('submit', async function (event) {

        event.preventDefault(); // Prevent default form submission

        const submitButton = event.submitter;
        submitButton.disabled = true; // Disable the submit button

        if (document.getElementById("longTermCheckbox").checked)
            document.getElementById("longTermCheckbox").value = true;

        const data = {
            bikeId: selectedBikeId.value,
            clientId: selectedClientId.value,
            actionId: document.getElementById("action").value,
            dateId: document.getElementById('date').value,
            hourSelectId: hourSelect.value,
            minuteSelect: minuteSelect.value,
            ltstatus: document.getElementById("longTermCheckbox").value,
            helmetId: selectedHelmetId.value ? selectedHelmetId.value : ''
        };

        const icon = document.getElementById('mess-icon-rep');
        const message = document.getElementById('mess-text-rep');
        const btnYes = document.getElementById('btnMess');

        loadingIndicator.style.display = 'flex';

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

            // Display success or error messages
            if (response.ok) {
                const result = await response.json(); // Parse JSON response
                message.textContent = result.message;
            } else {
                const result = await response.json(); // Parse JSON response
                icon.src = "/icon/error.png";
                message.textContent = result.message || 'An unexpected error occurred.';
            }

            btnYes.style.display = "none";
            openModal(modalMessRep, modalMessRepContent);
            this.reset();

        } catch (error) {
            icon.src = "/icon/error.png";
            message.textContent = 'An error occurred while processing your request.';
            btnYes.style.display = "none";
            openModal(modalMessRep, modalMessRepContent);
            this.reset();

        } finally {
            loadingIndicator.style.display = 'none';
            submitButton.disabled = false; // Re-enable the submit button
        }
    });

    document.getElementById('form2').addEventListener('submit', async function (event) {

        event.preventDefault(); // Prevent default form submission

        const selectDate1 = document.getElementById('selectedDate1').value;
        const selectDate2 = document.getElementById('selectedDate2').value;

        loadingIndicator.style.display = 'flex';

        try {
            // Collect filter values if the search inputs are visible
            const filtersBike = {};
            document.querySelectorAll('.search-input-view-bike').forEach(input => {
                filtersBike[input.name || input.id] = input.value.trim();
            });

            // Collect filter values if the search inputs are visible
            const filtersBikeDate = {};
            document.querySelectorAll('.search-input-view-total-bike').forEach(input => {
                filtersBikeDate[input.name || input.id] = input.value.trim();
            });

            const response = await fetch(document.getElementById('form2').action, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ selectedDate1: selectDate1, selectedDate2: selectDate2, filtersBike: filtersBike, filtersBikeDate: filtersBikeDate })
            });

            if (!response.ok) throw new Error(await response.text());

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
            console.error('Error:', error);
            alert(error.message || 'Failed to download the report.');

        } finally {
            loadingIndicator.style.display = 'none';
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

        const icon = document.getElementById('mess-icon-rep');
        const message = document.getElementById('mess-text-rep');
        const btnYes = document.getElementById('btnMess');

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        btnYes.style.display = "none";
        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            loadingIndicator.style.display = 'flex';

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
                    hasError = true;
                }

                closeModal(modalMessRep, modalMessRepContent);

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    icon.src = "/icon/information.png";
                    message.textContent = responseData.message;
                    openModal(modalMessRep, modalMessRepContent);
                } else if (isSubmit) {
                    icon.src = "/icon/error.png";
                    message.textContent = responseData.message || 'An error occurred while adding the bike';
                    openModal(modalMessRep, modalMessRepContent);
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        icon.src = "/icon/timeout.png";
        message.textContent = 'Are you sure you want to add this bike?';
        openModal(modalMessRep, modalMessRepContent);
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

        const icon = document.getElementById('mess-icon-rep');
        const message = document.getElementById('mess-text-rep');
        const btnYes = document.getElementById('btnMess');

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        btnYes.style.display = "none";
        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            loadingIndicator.style.display = 'flex';

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
                    hasError = true;
                }

                closeModal(modalMessRep, modalMessRepContent);

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    icon.src = "/icon/information.png";
                    message.textContent = responseData.message;
                    openModal(modalMessRep, modalMessRepContent);
                } else if (isSubmit) {
                    icon.src = "/icon/error.png";
                    message.textContent = responseData.message || 'An error occurred while editing the bike';
                    openModal(modalMessRep, modalMessRepContent);
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        icon.src = "/icon/timeout.png";
        message.textContent = 'Are you sure you want to edit this bike?';
        openModal(modalMessRep, modalMessRepContent);
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

        const icon = document.getElementById('mess-icon-rep');
        const message = document.getElementById('mess-text-rep');
        const btnYes = document.getElementById('btnMess');

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        btnYes.style.display = "none";
        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            loadingIndicator.style.display = 'flex';

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
                    hasError = true;
                }

                closeModal(modalMessRep, modalMessRepContent);

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    icon.src = "/icon/information.png";
                    message.textContent = responseData.message;
                    openModal(modalMessRep, modalMessRepContent);
                } else if (isSubmit) {
                    icon.src = "/icon/error.png";
                    message.textContent = responseData.message || 'An error occurred while adding the bike';
                    openModal(modalMessRep, modalMessRepContent);
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        icon.src = "/icon/timeout.png";
        message.textContent = 'Are you sure you want to add this helmet?';
        openModal(modalMessRep, modalMessRepContent);
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

        const icon = document.getElementById('mess-icon-rep');
        const message = document.getElementById('mess-text-rep');
        const btnYes = document.getElementById('btnMess');

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        btnYes.style.display = "none";
        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            loadingIndicator.style.display = 'flex';

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
                    hasError = true;
                }

                closeModal(modalMessRep, modalMessRepContent);

            } catch (error) {
                hasError = true;

            } finally {
                loadingIndicator.style.display = 'none';
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
                    icon.src = "/icon/information.png";
                    message.textContent = responseData.message;
                    openModal(modalMessRep, modalMessRepContent);
                } else if (isSubmit) {
                    icon.src = "/icon/error.png";
                    message.textContent = responseData.message || 'An error occurred while removing the bike';
                    openModal(modalMessRep, modalMessRepContent);
                }
            }
        });

        closeWarningObserver.observe(modalMessRep, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        icon.src = "/icon/timeout.png";
        message.textContent = 'Are you sure you want to remove this bike?';
        openModal(modalMessRep, modalMessRepContent);
    });

    document.getElementById('upload-multi-bike-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInputBike");
        const file = fileInput.files[0];

        const icon = document.getElementById("mess-icon-rep");
        const message = document.getElementById("mess-text-rep");
        const btnYes = document.getElementById("btnMess");

        icon.src = '/icon/error.png';
        btnYes.style.display = 'none';

        if (!file) {
            message.textContent = 'You have not selected a file to upload';
            openModal(modalMessRep, modalMessRepContent);
            return;
        }

        const url = "/bicycles/uploadMultiBike";
        const progressBar = document.getElementById("progress-multi-bike");

        const updateProgressBar = (percentage) => {
            progressBar.style.width = percentage + "%";
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
                    document.getElementById("progress-multi-bike").style.width = 0 + "%";
                    document.getElementById('fileInputBike').value = '';
                    closeModal(modalAddMultiBike, modalAddMultiBikeContent);
                    icon.src = '/icon/information.png';
                    message.textContent = 'File uploaded successfully!';
                    openModal(modalMessRep, modalMessRepContent);
                }, 1000);

            } else {

                const data = JSON.parse(xhr.responseText);

                if (data.errors) {

                    data.errors.forEach(error => {

                        switch (error.type) {
                            case 'Validation':
                                icon.src = '/icon/error.png';
                                message.textContent = 'Check the syntax of all rows in the table';
                                openModal(modalMessRep, modalMessRepContent);
                                break;

                            default:
                                icon.src = '/icon/error.png';
                                message.textContent = error.message;
                                openModal(modalMessRep, modalMessRepContent);
                                break;
                        }
                    });

                } else {
                    icon.src = '/icon/error.png';
                    message.textContent = data.error || "File upload failed.";
                    openModal(modalMessRep, modalMessRepContent);
                }

                document.getElementById("progress-multi-bike").style.width = 0 + "%";
                document.getElementById('fileInputBike').value = '';
                closeModal(modalAddMultiBike, modalAddMultiBikeContent);
            }
        };

        xhr.onerror = function () {
            console.error('Error:', xhr.statusText);
            document.getElementById("progress-multi-bike").style.width = 0 + "%";
            document.getElementById('fileInputBike').value = '';
            closeModal(modalAddMultiBike, modalAddMultiBikeContent);

            icon.src = '/icon/error.png';
            message.textContent = "An unexpected error occurred.";
            openModal(modalMessRep, modalMessRepContent);
        };

        xhr.send(formData);
    });

    document.getElementById('upload-multi-helmet-btn').addEventListener("click", function () {

        const fileInput = document.getElementById("fileInputHelmet");
        const file = fileInput.files[0];

        const icon = document.getElementById("mess-icon-rep");
        const message = document.getElementById("mess-text-rep");
        const btnYes = document.getElementById("btnMess");

        icon.src = '/icon/error.png';
        btnYes.style.display = 'none';

        if (!file) {
            message.textContent = 'You have not selected a file to upload';
            openModal(modalMessRep, modalMessRepContent);
            return;
        }

        const url = "/bicycles/uploadMultiHelmet";
        const progressBar = document.getElementById("progress-multi-helmet");

        const updateProgressBar = (percentage) => {
            progressBar.style.width = percentage + "%";
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
                    document.getElementById("progress-multi-helmet").style.width = 0 + "%";
                    document.getElementById('fileInputHelmet').value = '';
                    closeModal(modalAddMultiHelmet, modalAddMultiHelmetContent);
                    icon.src = '/icon/information.png';
                    message.textContent = 'File uploaded successfully!';
                    openModal(modalMessRep, modalMessRepContent);
                }, 1000);

            } else {

                const data = JSON.parse(xhr.responseText);

                if (data.errors) {

                    data.errors.forEach(error => {

                        switch (error.type) {
                            case 'Validation':
                                icon.src = '/icon/error.png';
                                message.textContent = 'Check the syntax of all rows in the table';
                                openModal(modalMessRep, modalMessRepContent);
                                break;

                            default:
                                icon.src = '/icon/error.png';
                                message.textContent = error.message;
                                openModal(modalMessRep, modalMessRepContent);
                                break;
                        }
                    });

                } else {
                    icon.src = '/icon/error.png';
                    message.textContent = data.error || "File upload failed.";
                    openModal(modalMessRep, modalMessRepContent);
                }

                document.getElementById("progress-multi-helmet").style.width = 0 + "%";
                document.getElementById('fileInputHelmet').value = '';
                closeModal(modalAddMultiHelmet, modalAddMultiHelmetContent);
            }
        };

        xhr.onerror = function () {
            console.error('Error:', xhr.statusText);
            document.getElementById("progress-multi-helemet").style.width = 0 + "%";
            document.getElementById('fileInputHelmet').value = '';
            closeModal(modalAddMultiHelmet, modalAddMultiHelmetContent);

            icon.src = '/icon/error.png';
            message.textContent = "An unexpected error occurred.";
            openModal(modalMessRep, modalMessRepContent);
        };

        xhr.send(formData);
    });

});
