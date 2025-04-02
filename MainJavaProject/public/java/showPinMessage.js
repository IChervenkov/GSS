document.addEventListener('DOMContentLoaded', () => {
    const notificationSound = new Audio('/audio/notification.wav'); // Path to your .wav file
    const toastElement = document.getElementById('liveToast');
    const toastMessage = document.getElementById('toast-message');
    const closeToastButton = document.getElementById('close-toast');

    let toastQueue = [];
    let isToastVisible = false;

    // Function to show toast with animation
    function showToast(message) {
        if (isToastVisible) {
            // If a toast is already visible, add the message to the queue
            toastQueue.push(message);
        } else {
            // Display the toast message
            toastMessage.textContent = message;

            toastElement.classList.remove('hide');
            toastElement.style.display = 'block';
            isToastVisible = true;

            setTimeout(() => {
                toastElement.classList.add('show');
            }, 10); // Small delay for transition effect

            // Play sound
            notificationSound.play().catch(error => console.error('Error playing sound:', error));

            // Auto-hide after 6 seconds
            setTimeout(() => {
                hideToast();
            }, 6000);
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
                const nextMessage = toastQueue.shift();
                showToast(nextMessage);
            }
        }, 500); // Wait for transition to finish
    }

    // Event listener for close button
    closeToastButton.addEventListener('click', hideToast);

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
                showToast("Accommodation and release dates are coming up soon.");
            } else if (data.isAccommodation) {
                showToast("Accommodation date is coming up soon.");
            } else if (data.isRelease) {
                showToast("Release date is coming up soon.");
            }
        } catch (error) {
            console.error('Error fetching date:', error);
        }
    }, 3000);
});