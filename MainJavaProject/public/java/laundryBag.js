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

    document.getElementsByClassName('close-btn')[0].onclick = closeDropOffModal;
    document.getElementsByClassName('close-btn')[1].onclick = closeTransportationToLaundryFacilityModal;
    document.getElementsByClassName('close-btn')[2].onclick = closeLaundryFacilityModal;
    document.getElementsByClassName('close-btn')[3].onclick = closeTransportationToDropOffModal;
    document.getElementsByClassName('close-btn')[4].onclick = closeReadyToPickUpModal;

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

                const data = await result.json();

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
                                    ? '../icon/timeout.png' // Warning image path
                                    : '../icon/available.png'; // OK image path
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
});