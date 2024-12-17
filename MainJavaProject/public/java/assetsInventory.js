document.addEventListener('DOMContentLoaded', function () {

    const assetsModal = document.getElementById('assetsModal');
    const assetsModalContent = assetsModal.querySelector('.modal-content');

    const modalMess = document.getElementById("myMessage");
    const modalMessContent = modalMess.querySelector('.modal-content-mess');

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

    var allCheckedRow = [];

    var numBuild = document.getElementById('numBuild').value;

    fetch(`/assets/getSortedRoom?numBuild=${numBuild}`, {
        method: 'POST'
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

            // Attach click event for each row
            row.addEventListener('click', (event) => {
                // Check if the clicked element is not the first td in the row
                if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0) {
                    console.log('hi');
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
            location: document.getElementById('asset-location-header')
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

    function closeMessModal() {
        // Add the slide-out effect
        modalMessContent.classList.add('slide-out');
        modalMessContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalMess.classList.remove('show');
            modalMessContent.classList.remove('show');
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

                    // Attach click event for each row
                    row.addEventListener('click', (event) => {
                        // Check if the clicked element is not the first td in the row
                        if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0) {
                            console.log('hi');
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
            assetsModal.classList.remove('show');
            assetsModalContent.classList.remove('show');
        }, 400); // Match the duration of the animation (0.4s)
    }

    document.getElementsByClassName('close-btn')[0].onclick = closeAssetsModal;
    document.getElementsByClassName('close-btn')[1].onclick = closeMessModal;

    // Close the modal if the user clicks outside of it
    window.onclick = function (event) {

        switch (event.target) {
            case assetsModal:
                closeAssetsModal();
                break;

            case modalMess:
                closeMessModal();
                break;
        }
    };

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

    document.querySelectorAll('.data-room').forEach((element) => {
        element.addEventListener('click', (event) => {
            const rowId = event.currentTarget.id;
            openAssetsModal(rowId);
        });
    });

    document.getElementById('removeAsset').addEventListener('click', () => {
        console.log(allCheckedRow);
    });

});