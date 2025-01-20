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

    const modalRemoveBike = document.getElementById('removeBikeModal');
    const modalRemoveBikeContent = modalRemoveBike.querySelector('.modal-content');

    const modalAddMultiBike = document.getElementById('addMultiBikeModal');
    const modalAddMultiBikeContent = modalAddMultiBike.querySelector('.modal-content');

    const modalEditBike = document.getElementById('bikeEditModal');
    const modalEditBikeContent = modalEditBike.querySelector('.modal-content');

    const selectedStatus = document.getElementById('statusSelect');
    const selectedBike = document.getElementById('editBikeSearch');
    const editDateFrom = document.getElementById('editDateFrom');
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
    var spanAddBike = document.getElementsByClassName("close")[11];
    var spanRemoveBike = document.getElementsByClassName("close")[12];
    var spanAddMultiBike = document.getElementsByClassName("close")[13];
    document.getElementsByClassName("close")[14].onclick = closeEditModal;
    var spanMessRep = document.getElementsByClassName("close")[15];

    const bikeSearchInput = document.getElementById('bikeSearch');
    const bikeSearchDropdown = document.getElementById('bikeDropdown');
    const selectedBikeId = document.getElementById('selectedBikeId');

    const editSoldierSearchInput = document.getElementById('editSoldierSearch');
    const editSoldierSearchDropdown = document.getElementById('editSoldierDropdown');
    const selectedEditSoldierId = document.getElementById('selectedEditSoldierId');

    const removeBikeSearchInput = document.getElementById('removeBikeSearch');
    const removeBikeDropdown = document.getElementById('removeBikeDropdown');
    const selectedRemoveBikeId = document.getElementById('selectedRemoveBikeId');

    let bikes = [];

    const clientSearchInput = document.getElementById('clientSearch');
    const clientSearchDropdown = document.getElementById('clientDropdown');
    const selectedClientId = document.getElementById('selectedClientId');

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

    document.querySelectorAll('tr.data-bike').forEach(row => {
        row.addEventListener('click', function () {
            const bikeName = this.querySelector('td:nth-child(1)').textContent.trim();
            const status = this.querySelector('td:nth-child(2)').getAttribute('data-status');
            const hiredBy = this.querySelector('td:nth-child(3)').textContent.trim();
            const dateFrom = this.querySelector('td:nth-child(4)').textContent.trim();

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
                openEditModal(bikeName, status, hiredBy, dateFrom);
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

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modal.classList.remove('show');
            modalContent.classList.remove('show');

            const icon = document.getElementById("mess-icon-rep");

            if (modal === modalMessRep && icon.src.includes('information')) {
                // Refresh the page after the modal is closed
                window.location.reload();
            }
        }, 400); // Match the duration of the animation (0.4s)
    }

    function openEditModal(bikeName, status, hiredBy, dateFrom) {

        editSoldierSearchInput.value = hiredBy === 'None' ? '' : hiredBy;
        const foundClient = clients.find(client => client.name && client.name === hiredBy);
        selectedEditSoldierId.value = foundClient ? foundClient.id : '';

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
        } else {
            editSoldierSearchInput.classList.add('disabled-select');
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

        document.querySelectorAll('#statusSelect, #editSoldierSearch, #editDateFrom').forEach((input) => {

            input.classList.remove('is-valid');
            input.classList.remove('is-invalid');

        });

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalEditBike.classList.remove('show');
            modalEditBikeContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    // Function to fetch bikes from the server
    async function fetchItem() {

        loadingIndicator.style.disable = 'flex';

        try {
            const responseBike = await fetch(`/bikes`);
            if (!responseBike.ok) {
                throw new Error('Network response was not ok');
            }
            bikes = await responseBike.json(); // Store fetched bikes in the global variable

            const responseClient = await fetch(`/clients`);
            if (!responseClient.ok) {
                throw new Error('Network response was not ok');
            }
            clients = await responseClient.json(); // Store fetched bikes in the global variable

        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);

        } finally {
            loadingIndicator.style.disable = 'none';
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
        const filteredSoldiers = clients.filter(client => (client.id === '4' || (client.date_accommodation !== '' && client.date_free === '')) && client.name.toLowerCase().includes(query.toLowerCase()));

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
        const filteredClients = clients.filter(client => (client.id === '4' || (client.date_accommodation !== '' && client.date_free === '')) && client.name.toLowerCase().includes(query.toLowerCase()));

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

    // Handle input change
    clientSearchInput.addEventListener('input', function () {
        const query = clientSearchInput.value;
        if (query.length > 0) {
            filterClient(query);
        } else {
            clientSearchDropdown.style.display = 'none';
        }
    });

    // Handle input change
    bikeSearchInput.addEventListener('input', function () {
        const query = bikeSearchInput.value;
        if (query.length > 0) {
            filterBikes(query);
        } else {
            bikeSearchDropdown.style.display = 'none';
        }
    });

    // Handle input change
    editSoldierSearchInput.addEventListener('input', function () {
        const query = editSoldierSearchInput.value;
        if (query.length > 0) {
            filterEditSoldiers(query);
        } else {
            editSoldierSearchDropdown.style.display = 'none';
            selectedEditSoldierId.value = ''
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

            loadingIndicator.style.disable = 'flex';

            try {
                // Fetch bike status
                const response = await fetch(`/checkBike`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ bikeId: selectedBikeId.value })
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
                loadingIndicator.style.disable = 'none';
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
    spanCloseModal(spanMessRep, modalMessRep, modalMessRepContent);
    spanCloseModal(spanAddBike, modalAddBike, modalAddBikeContent);
    spanCloseModal(spanRemoveBike, modalRemoveBike, modalRemoveBikeContent);
    spanCloseModal(spanAddMultiBike, modalAddMultiBike, modalAddMultiBikeContent);

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

            case modalEditBike:
                closeEditModal();
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

    document.getElementById('removeBike').addEventListener("click", function () {
        openModal(modalRemoveBike, modalRemoveBikeContent);
    });

    document.getElementById('confirmAddMultiBikeBtn').onclick = function () {
        openModal(modalAddMultiBike, modalAddMultiBikeContent);
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

            loadingIndicator.style.disable = 'flex';

            // Fetch bike data from server
            fetch(`/searchBikes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: bikeId })
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
                    loadingIndicator.style.disable = 'none';
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

            loadingIndicator.style.disable = 'flex';

            // Fetch bike data from server
            fetch(`/searchClient`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: clientId })
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
                    loadingIndicator.style.disable = 'none';
                });
        }
    });

    async function fetchReport() {

        loadingIndicator.style.disable = 'flex';

        try {

            const selectedDate1 = document.getElementById('selectedDate1').value;
            const selectedDate2 = document.getElementById('selectedDate2').value;

            const response = await fetch(`/bicycles/viewReport`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ selectedDate1: selectedDate1, selectedDate2: selectedDate2 })
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

        } catch (error) {
            console.error('Error fetching the report:', error);
            
        } finally {
            loadingIndicator.style.disable = 'none';
        }
    }

    document.getElementById('form1').addEventListener('submit', async function (event) {

        event.preventDefault(); // Prevent default form submission

        if (document.getElementById("longTermCheckbox").checked)
            document.getElementById("longTermCheckbox").value = true;

        const data = {
            bikeId: selectedBikeId.value,
            clientId: selectedClientId.value,
            actionId: document.getElementById("action").value,
            dateId: document.getElementById('date').value,
            hourSelectId: hourSelect.value,
            minuteSelect: minuteSelect.value,
            ltstatus: document.getElementById("longTermCheckbox").value
        };

        const icon = document.getElementById('mess-icon-rep');
        const message = document.getElementById('mess-text-rep');
        const btnYes = document.getElementById('btnMess');

        loadingIndicator.style.disable = 'flex';

        try {
            const response = await fetch(this.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json(); // Parse JSON response

            // Display success or error messages
            if (response.ok) {
                message.textContent = result.message;
            } else {
                icon.src = "/icon/error.png";
                message.textContent = result.error || 'An unexpected error occurred.';
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
            loadingIndicator.style.disable = 'none';
        }
    });

    document.getElementById('form3').addEventListener('submit', async function (event) {

        event.preventDefault(); // Prevent default form submission

        const bikeAddId = document.getElementById('bike-number');
        const bikeName = document.getElementById('bike-name');

        if (bikeAddId.value === '') {
            toggleInputValidity(bikeAddId, false);
            return;
        }

        if (bikeName.value === '') {
            toggleInputValidity(bikeName, false);
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

            loadingIndicator.style.disable = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
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
                loadingIndicator.style.disable = 'none';
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

        if (selectedStatus.value === 'Select Status') {
            toggleInputValidity(selectedStatus, false);
            return;
        }

        if (selectedEditSoldierId.value === '') {
            toggleInputValidity(editSoldierSearchInput, false);
            return;
        }

        if (!isValidDate) {
            toggleInputValidity(editDateFrom, false);
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

            loadingIndicator.style.disable = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
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
                loadingIndicator.style.disable = 'none';
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


    document.querySelectorAll('#bike-number, #bike-name').forEach((input) => {
        input.addEventListener('input', function () {
            if (input.checkValidity() && input.value !== '') {
                input.classList.add('is-valid');
                input.classList.remove('is-invalid');
            } else {
                input.classList.add('is-invalid');
                input.classList.remove('is-valid');
            }
        });
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

            loadingIndicator.style.disable = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
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
                loadingIndicator.style.disable = 'none';
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

});
