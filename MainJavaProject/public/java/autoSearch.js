document.addEventListener('DOMContentLoaded', function () {
    
    document.querySelectorAll('.search-input').forEach(function (input, index) {
        input.addEventListener('input', function () {
            applyFilters();
        });
    });

    document.querySelectorAll('.search-input-view').forEach(function (input, index) {
        input.addEventListener('input', function () {
            applyViewFilters();
        });
    });

    function applyViewFilters() {
        const table = document.getElementById('soldierUsageTable');
        const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
        const filters = document.querySelectorAll('.search-input-view');
        
        // Show all rows initially to reset the state before applying filters
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display = '';
        }

        // Apply each filter one by one
        filters.forEach(function (input, columnIndex) {
            const searchTerm = input.value.toLowerCase();

            if (searchTerm) {
                for (let i = 0; i < rows.length; i++) {
                    const cell = rows[i].getElementsByTagName('td')[columnIndex];
                    const cellText = cell.textContent.toLowerCase();

                    if (!cellText.includes(searchTerm)) {
                        rows[i].style.display = 'none';  // Hide row if it doesn't match
                    }
                }
            }
        });
    }

    function applyFilters() {
        const table = document.getElementById('data-table');
        const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
        const filters = document.querySelectorAll('.search-input');
        
        // Show all rows initially to reset the state before applying filters
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display = '';
        }

        // Apply each filter one by one
        filters.forEach(function (input, columnIndex) {
            const searchTerm = input.value.toLowerCase();

            if (searchTerm) {
                for (let i = 0; i < rows.length; i++) {
                    const cell = rows[i].getElementsByTagName('td')[columnIndex];
                    const cellText = cell.textContent.toLowerCase();

                    if (!cellText.includes(searchTerm)) {
                        rows[i].style.display = 'none';  // Hide row if it doesn't match
                    }
                }
            }
        });
    }
});
