document.addEventListener('DOMContentLoaded', () => {
    const toastElement = document.getElementById('liveToast');
    const toastMessage = document.getElementById('toast-message');
    const closeToastButton = document.getElementById('close-toast');

    let toastQueue = [];
    let isToastVisible = false;

    const toastModal = document.getElementById("toastModal");
    const toastModalContent = toastModal.querySelector('.modal-content');

    let currentToastType = null;
    let currentToastNames = [];

    const checkForGlobalError = (response, responseBody) => {
        if (response.headers.get('X-Global-Error') === 'true')
            window.location.href = `/error?statusCode=${responseBody.statusCode}&message=${responseBody.message}&details=${responseBody.details}`;
    };

    function showToastModal(title, soldierList) {

        // Add the slide-in effect by adding the necessary classes
        toastModal.classList.add('show');
        toastModalContent.classList.add('show');
        toastModalContent.classList.add('slide-in');

        toastModalContent.getElementsByTagName('h2')[0].textContent = title;

        const tableBody = document.getElementById('toastUpcommingTableBody');
        tableBody.innerHTML = ''; // Clear previous rows

        soldierList.forEach(soldier => {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.textContent = soldier;
            row.appendChild(cell);
            tableBody.appendChild(row);
        });

        // Ensure that any 'slide-out' class is removed if it was previously added
        toastModalContent.classList.remove('slide-out');
    }

    function closeToastMessModal() {
        // Add the slide-out effect
        toastModalContent.classList.add('slide-out');
        toastModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            toastModal.classList.remove('show');
            toastModalContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    const closeButtons = document.getElementsByClassName('close-btn');
    if (closeButtons.length > 0) {
        closeButtons[closeButtons.length - 1].onclick = closeToastMessModal;
    }

    // Function to show toast with animation
    function showToast(message, type = null, names = []) {
        if (isToastVisible) {
            toastQueue.push({ message, type, names });
        } else {
            toastMessage.textContent = message;

            currentToastType = type;
            currentToastNames = names;

            toastElement.classList.remove('hide');
            toastElement.style.display = 'block';
            isToastVisible = true;

            if (type === 'accommodation' || type === 'release') {
                toastElement.style.cursor = 'pointer';
            } else {
                toastElement.style.cursor = 'default';
            }

            setTimeout(() => toastElement.classList.add('show'), 10);

            setTimeout(() => hideToast(), 6000);
        }
    }

    // Function to hide toast with animation
    function hideToast() {
        toastElement.classList.remove('show');
        toastElement.classList.add('hide');

        setTimeout(() => {
            toastElement.style.display = 'none';
            isToastVisible = false;

            // Show the next message in the queue, if any
            if (toastQueue.length > 0) {
                const next = toastQueue.shift();
                showToast(next.message, next.type, next.names);
            }
        }, 500); // Wait for transition to finish
    }

    // Event listener for close button
    closeToastButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent toast click from firing
        hideToast();
    });

    window.addEventListener("click", function (event) {

        switch (event.target) {
            case toastModal:
                closeToastMessModal();
                break;
        }
    });

    toastElement.addEventListener('click', () => {
        if (currentToastType === 'accommodation' && currentToastNames.length > 0) {
            hideToast();
            showToastModal("Soldiers with upcoming accommodation or release", currentToastNames);
        } else if (currentToastType === 'release' && currentToastNames.length > 0) {
            hideToast();
            showToastModal("Soldiers with upcoming release", currentToastNames);
        }
    });

    setTimeout(async () => {
        try {
            const response = await fetch('/checkLateBags', {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showToast('Bags that have passed the collection time have been detected.');
            }
        } catch (error) {
            showToast('Error fetching late bags');
        }
    }, 1000);

    setTimeout(async () => {
        try {
            const response = await fetch('/checkUpcomingDate', {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            });

            const data = await response.json();

            if (!response.ok)
                checkForGlobalError(response, data);

            if (data.isAccommodation && data.isRelease) {
                showToast("Accommodation and release dates are coming up soon.", 'accommodation', data.accommodationList);
                showToast("Release date is coming up soon.", 'release', data.releaseList);
            } else if (data.isAccommodation) {
                showToast("Accommodation date is coming up soon.", 'accommodation', data.accommodationList);
            } else if (data.isRelease) {
                showToast("Release date is coming up soon.", 'release', data.releaseList);
            }
        } catch (error) {
            showToast('Error check upcoming date');
        }
    }, 3000);
});