document.addEventListener('DOMContentLoaded', function () {

    const selectedDate1Input = document.getElementById('selectedDate1');
    const selectedDate2Input = document.getElementById('selectedDate2');

    const total_percent_sad = document.getElementById('percentSad');
    const total_percent_neutral = document.getElementById('percentNeutral');
    const total_percent_very_happy = document.getElementById('percentVeryHappy');

    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    async function filterTableByDate() {
        const selectedDate1 = selectedDate1Input.value;
        const selectedDate2 = selectedDate2Input.value;

        // Parse selected dates
        const date1 = selectedDate1 ? new Date(`${selectedDate1} 00:00`) : null;
        const date2 = selectedDate2 ? new Date(`${selectedDate2} 23:59`) : null;
        const now = new Date();

        // Format dates in "YYYY-MM-DD HH:MM"
        const formattedDate1 = date1 ? formatDate(date1) : formatDate(now);
        const formattedDate2 = date2 ? formatDate(date2) : formatDate(now);

        // Fetch data from the backend
        const response = await fetch(`/getAllEmoji`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ date1: formattedDate1, date2: formattedDate2 })
        });

        const fullData = await response.json();

        if ((date1 && !date2) || (date1 && date2)) {
            // Get the table body element
            const tableBody = document.querySelector('#mainTable tbody');
            tableBody.innerHTML = ''; // Clear existing rows

            const { percent_sad = 0, percent_neutral = 0, percent_very_happy = 0 } = fullData.total_data || {};

            total_percent_sad.textContent = `Total Sad (😞): ${percent_sad}`;
            total_percent_neutral.textContent = `Total Neutral (😐): ${percent_neutral}`;
            total_percent_very_happy.textContent = `Total Very Happy (😁): ${percent_very_happy}`;

        } else {
            return;
        }

        // Iterate over the data and filter based on the date
        fullData.data.forEach(row => {
            const rowDate = new Date(row.created_date);
            let showRow = true;

            // Check conditions for filtering

            if (date1 && !date2) {
                // Show rows with Date between selected date 1 and now
                showRow = rowDate >= date1 && rowDate <= now;
            } else if (date1 && date2) {
                // Show rows with Date between selected date 1 and selected date 2
                showRow = rowDate >= date1 && rowDate <= date2;
            }

            // Add the row to the table if it matches the filter
            if (showRow) {
                const tableRow = document.createElement('tr');
                tableRow.innerHTML = `
                    <td>${new Date(row.created_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })}</td>
                    <td>${row.average_emoji}</td>
                    <td>${row.soldier_count}</td>`;
                tableBody.appendChild(tableRow);
            }
        });
    }

    document.getElementById('btnFiltering').addEventListener('click', () => {
        filterTableByDate();
    });

    // Download the report document when the Reports button is clicked
    document.getElementById("btnReport").addEventListener("click", async () => {

        try {

            // Get the table element
            const table = document.getElementById("mainTable");
            const rows = Array.from(table.querySelectorAll("tbody tr"));

            const data = [];

            // Extract data from each row
            rows.forEach((row) => {
                const cells = row.querySelectorAll("td");
                const date = cells[0].innerText;
                const averageRating = cells[1].innerText;
                const numberOfVisits = cells[2].innerText;

                data.push([date, averageRating, numberOfVisits]);
            });

            const response = await fetch(`/fitness/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: data })
            });

            // Check if the response is OK
            if (!response.ok) {
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
            console.error('Error downloading report:', error);
            alert('Failed to download report.');
        }
    });
});
