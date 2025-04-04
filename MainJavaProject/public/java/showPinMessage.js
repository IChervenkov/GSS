document.addEventListener('DOMContentLoaded', () => {
    const notificationSound = new Audio('/audio/notification.wav'); // Path to your .wav file
    const toastElement = document.getElementById('liveToast');
    const toastMessage = document.getElementById('toast-message');
    const closeToastButton = document.getElementById('close-toast');

    let toastQueue = [];
    let isToastVisible = false;

    const myToastMessage = document.getElementById("toastMessage");
    const myToastMessageContent = myToastMessage.querySelector('.modal-content-mess');

    let currentToastType = null;
    let currentToastNames = [];

    function showToastMess(message) {

        document.getElementById('mess-toast-text').textContent = message;

        // Add the slide-in effect by adding the necessary classes
        myToastMessage.classList.add('show');
        myToastMessageContent.classList.add('show');
        myToastMessageContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        myToastMessageContent.classList.remove('slide-out');
    }

    function closeToastMessModal() {
        // Add the slide-out effect
        myToastMessageContent.classList.add('slide-out');
        myToastMessageContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            myToastMessage.classList.remove('show');
            myToastMessageContent.classList.remove('show');

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

            setTimeout(() => toastElement.classList.add('show'), 10);
            notificationSound.play().catch(error => console.error('Error playing sound:', error));

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

    toastElement.addEventListener('click', () => {
        if (currentToastType === 'accommodation' && currentToastNames.length > 0) {
            showToastMess("Soldiers with upcoming accommodation or release:\n" + currentToastNames.join(", "));
        } else if (currentToastType === 'release' && currentToastNames.length > 0) {
            showToastMess("Soldiers with upcoming release:\n" + currentToastNames.join(", "));
        }
    });

    // Example: Fetch late bags data after 2 seconds
    setTimeout(async () => {
        try {
            const response = await fetch('/checkLateBags', { method: 'GET' });
            if (!response.ok) {
                showToast('Bags that have passed the collection time have been detected.');
            }
        } catch (error) {
            console.error('Error fetching late bags:', error);
        }
    }, 1000);

    // Example: Add another message
    setTimeout(async () => {
        try {
            const response = await fetch('/checkUpcomingDate', { method: 'GET' });
            const data = await response.json();

            if (data.isAccommodation && data.isRelease) {
                showToast("Accommodation and release dates are coming up soon.", 'accommodation', data.accommodationList);
                showToast("Release date is coming up soon.", 'release', data.releaseList);
            } else if (data.isAccommodation) {
                showToast("Accommodation date is coming up soon.", 'accommodation', data.accommodationList);
            } else if (data.isRelease) {
                showToast("Release date is coming up soon.", 'release', data.releaseList);
            }
        } catch (error) {
            console.error('Error fetching date:', error);
        }
    }, 3000);
});