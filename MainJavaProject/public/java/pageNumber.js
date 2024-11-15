document.addEventListener('DOMContentLoaded', function () {

    const rowsPerPage = 50;
    let currentPage = 1;
    let rows = document.querySelectorAll("#tableBody tr");

    function displayTable(page) {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;

        rows.forEach((row, index) => {
            row.style.display = index >= start && index < end ? "" : "none";
        });
    }

    function setupPagination() {
        const pageCount = Math.ceil(rows.length / rowsPerPage);
        const pagination = document.getElementById("pagination");
        pagination.innerHTML = "";

        function createPageItem(page, isActive = false) {
            const pageItem = document.createElement("li");
            pageItem.classList.add("page-item");
            if (isActive) pageItem.classList.add("active");

            const pageLink = document.createElement("a");
            pageLink.classList.add("page-link");
            pageLink.innerText = page;
            pageLink.href = "#";
            pageLink.addEventListener("click", function (e) {
                e.preventDefault();
                currentPage = page;
                updatePagination();
            });

            pageItem.appendChild(pageLink);
            return pageItem;
        }

        const prevButton = document.createElement("li");
        prevButton.classList.add("page-item");
        prevButton.innerHTML = `<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>`;
        prevButton.addEventListener("click", function () {
            if (currentPage > 1) {
                currentPage--;
                updatePagination();
            }
        });
        pagination.appendChild(prevButton);

        const maxVisiblePages = 5;
        const halfVisible = Math.floor(maxVisiblePages / 2);

        let startPage = Math.max(1, currentPage - halfVisible);
        let endPage = Math.min(pageCount, currentPage + halfVisible);

        if (currentPage <= halfVisible) {
            endPage = Math.min(pageCount, maxVisiblePages);
        } else if (currentPage > pageCount - halfVisible) {
            startPage = Math.max(1, pageCount - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            pagination.appendChild(createPageItem(1, currentPage === 1));
            if (startPage > 2) {
                const ellipsis = document.createElement("li");
                ellipsis.classList.add("page-item", "disabled");
                ellipsis.innerHTML = `<span class="page-link">...</span>`;
                pagination.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            pagination.appendChild(createPageItem(i, i === currentPage));
        }

        if (endPage < pageCount) {
            if (endPage < pageCount - 1) {
                const ellipsis = document.createElement("li");
                ellipsis.classList.add("page-item", "disabled");
                ellipsis.innerHTML = `<span class="page-link">...</span>`;
                pagination.appendChild(ellipsis);
            }
            pagination.appendChild(createPageItem(pageCount, currentPage === pageCount));
        }

        const nextButton = document.createElement("li");
        nextButton.classList.add("page-item");
        nextButton.innerHTML = `<a class="page-link" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>`;
        nextButton.addEventListener("click", function () {
            if (currentPage < pageCount) {
                currentPage++;
                updatePagination();
            }
        });
        pagination.appendChild(nextButton);
    }

    function updatePagination() {
        displayTable(currentPage);
        setupPagination();
    }

    function refreshTableAndPagination() {
        rows = document.querySelectorAll("#tableBody tr");
        currentPage = 1;
        updatePagination();
    }

    // MutationObserver to detect changes in the table body
    const tableBody = document.getElementById("tableBody");
    const observer = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                refreshTableAndPagination();
                break;
            }
        }
    });

    // Start observing the table body for changes
    observer.observe(tableBody, { childList: true, subtree: false });

    // Initial setup
    displayTable(currentPage);
    setupPagination();
});
