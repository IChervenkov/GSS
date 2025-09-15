document.addEventListener('DOMContentLoaded', function () {

    const modalMess = document.getElementById("myMessage");
    const modalMessContent = modalMess.querySelector('.modal-content-mess');

    const selectedDate1Input = document.getElementById('selectedDate1');
    const selectedDate2Input = document.getElementById('selectedDate2');

    const total_percent_sad = document.getElementById('percentSad');
    const total_percent_neutral = document.getElementById('percentNeutral');
    const total_percent_very_happy = document.getElementById('percentVeryHappy');

    const loadingIndicator = document.getElementById('loadingIndicator');
    const csrfToken = document.getElementsByName('_csrf')[0].value;

    const mainRowsPerPage = 50;
    let mainCurrentPage = 1;
    let mainTotalRows = parseInt(document.getElementById("totalCount").value);
    let filters = [];

    const tableBody = document.getElementById("tableBody");
    const pagination = document.getElementById("pagination");
    const isFirstTime = document.getElementsByName("isFirstTime")[0];
    const headerCells = document.querySelectorAll(`#mainTable thead th`);

    const mainHeaderMap = {
        'Date': 'created_date',
        'Average rating': 'average_emoji',
        'Number of visits': 'soldier_count'
    };

    const formateDate = isoString => {
        const date = new Date(isoString);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    const checkForGlobalError = (response, responseBody) => {
        if (response.headers.get('X-Global-Error') === 'true')
            window.location.href = `/error?statusCode=${responseBody.statusCode}&message=${responseBody.message}&details=${responseBody.details}`;
    };

    function buildQueryParams(page, date1 = "", date2 = "") {
        const offset = (page - 1) * mainRowsPerPage;
        const params = new URLSearchParams({
            formattedDate1: date1,
            formattedDate2: date2,
            isFirstTime: isFirstTime.value,
            limit: mainRowsPerPage,
            offset: offset
        });

        filters.forEach(filter => {
            params.append('searchColumn', filter.column);
            params.append('searchValue', filter.value);
        });

        return params.toString();
    }

    async function fetchTableData(page) {

        const selectedDate1 = selectedDate1Input.value;
        const selectedDate2 = selectedDate2Input.value;

        // Parse selected dates
        const date1 = selectedDate1 ? new Date(`${selectedDate1} 00:00`) : null;
        const date2 = selectedDate2 ? new Date(`${selectedDate2} 23:59`) : null;
        const now = new Date();

        // Format dates in "YYYY-MM-DD HH:MM"
        const formattedDate1 = date1 ? formatDate(date1) : '';
        const formattedDate2 = date2 ? formatDate(date2) : '';

        const query = buildQueryParams(page, formattedDate1, formattedDate2);
        try {
            const res = await fetch(`/fitness?${query}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            });
            
            if (!res.ok) {
                const error = await res.json();
                checkForGlobalError(res, error);
                throw new Error('Failed to fetch data');
            }
            const { data, total_data, totalCount } = await res.json();

            mainTotalRows = parseInt(totalCount);
            mainCurrentPage = page;

            if ((date1 && !date2) || (date1 && date2))
                renderTotalData(total_data);

            renderTable(data);
            renderPagination();
        } catch (error) {
            showMess('Error', error.message);
        }
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        data.forEach(item => {

            const tableRow = document.createElement('tr');
            tableRow.innerHTML = `
                    <td>${formateDate(item.created_date)}</td>
                    <td>${item.average_emoji}</td>
                    <td>${item.soldier_count}</td>`;

            tableBody.appendChild(tableRow);
        });
    }

    function renderTotalData(total_data) {
        const { percent_sad = 0, percent_neutral = 0, percent_very_happy = 0 } = total_data || {};

        total_percent_sad.textContent = `Total Sad (😞): ${percent_sad}`;
        total_percent_neutral.textContent = `Total Neutral (😐): ${percent_neutral}`;
        total_percent_very_happy.textContent = `Total Very Happy (😁): ${percent_very_happy}`;
    }

    function renderPagination() {
        const pageCount = Math.ceil(mainTotalRows / mainRowsPerPage) || 1;
        pagination.innerHTML = "";

        function createPageItem(page, isActive = false) {
            const pageItem = document.createElement("li");
            pageItem.classList.add("page-item");
            if (isActive) pageItem.classList.add("active");

            const pageLink = document.createElement("a");
            pageLink.classList.add("page-link");
            pageLink.href = "#";
            pageLink.innerText = page;
            pageLink.addEventListener("click", function (e) {
                e.preventDefault();
                fetchTableData(page);
            });

            pageItem.appendChild(pageLink);
            return pageItem;
        }

        const maxVisiblePages = 5;
        const halfVisible = Math.floor(maxVisiblePages / 2);
        let startPage = Math.max(1, mainCurrentPage - halfVisible);
        let endPage = Math.min(pageCount, mainCurrentPage + halfVisible);

        if (mainCurrentPage <= halfVisible) {
            endPage = Math.min(pageCount, maxVisiblePages);
        } else if (mainCurrentPage > pageCount - halfVisible) {
            startPage = Math.max(1, pageCount - maxVisiblePages + 1);
        }

        const prevBtn = document.createElement("li");
        prevBtn.classList.add("page-item");
        prevBtn.innerHTML = `<a class="page-link" href="#" aria-label="Previous">&laquo;</a>`;
        prevBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (mainCurrentPage > 1) fetchTableData(mainCurrentPage - 1);
        });
        pagination.appendChild(prevBtn);

        if (startPage > 1) {
            pagination.appendChild(createPageItem(1));
            if (startPage > 2) {
                pagination.appendChild(createEllipsis());
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            pagination.appendChild(createPageItem(i, i === mainCurrentPage));
        }

        if (endPage < pageCount) {
            if (endPage < pageCount - 1) {
                pagination.appendChild(createEllipsis());
            }
            pagination.appendChild(createPageItem(pageCount));
        }

        const nextBtn = document.createElement("li");
        nextBtn.classList.add("page-item");
        nextBtn.innerHTML = `<a class="page-link" href="#" aria-label="Next">&raquo;</a>`;
        nextBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (mainCurrentPage < pageCount) fetchTableData(mainCurrentPage + 1);
        });
        pagination.appendChild(nextBtn);
    }

    function createEllipsis() {
        const ellipsis = document.createElement("li");
        ellipsis.classList.add("page-item", "disabled");
        ellipsis.innerHTML = `<span class="page-link">...</span>`;
        return ellipsis;
    }

    renderPagination();

    // Attach filter input events
    document.querySelectorAll('.search-input').forEach((input, index) => {
        const headerLabel = headerCells[index]?.innerText.trim();
        const columnName = mainHeaderMap[headerLabel];

        input.addEventListener('input', () => {
            const searchTerm = input.value.trim().toLowerCase();

            filters = filters.filter(f => f.column !== columnName);

            if (columnName && searchTerm) {
                filters.push({ column: columnName, value: searchTerm });
            }

            fetchTableData(1);
        });
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

    document.getElementsByClassName('close')[0].onclick = closeMessModal;

    window.addEventListener("click", function (event) {
        switch (event.target) {
            case modalMess:
                closeMessModal();
                break;
        }
    });

    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    document.getElementById('btnFiltering').addEventListener('click', () => {
        fetchTableData(1)
    });

    // Download the report document when the Reports button is clicked
    document.getElementById("btnReport").addEventListener("click", async () => {

        loadingIndicator.style.display = 'flex';

        try {

            const selectedDate1 = selectedDate1Input.value;
            const selectedDate2 = selectedDate2Input.value;

            const date1 = selectedDate1 ? new Date(`${selectedDate1} 00:00`) : null;
            const date2 = selectedDate2 ? new Date(`${selectedDate2} 23:59`) : null;

            // Format dates in "YYYY-MM-DD HH:MM"
            const formattedDate1 = date1 ? formatDate(date1) : '';
            const formattedDate2 = date2 ? formatDate(date2) : '';

            const response = await fetch(`/fitness/report`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ 
                    selectedDate1: formattedDate1,
                    selectedDate2: formattedDate2,
                    filtersFitness: filters})
            });

            // Check if the response is OK
            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                throw new Error('Failed to generate the report.');
            }

            // Convert the response to a Blob
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob); // Renamed to downloadUrl

            // Create a link element to trigger download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'report_gym.xlsx';
            document.body.appendChild(a);
            a.click();

            // Clean up
            a.remove();
            window.URL.revokeObjectURL(downloadUrl); // Updated to use downloadUrl


        } catch (error) {
            showMess('Error', error.message);

        } finally {
            loadingIndicator.style.display = 'none';
        }
    });
});
