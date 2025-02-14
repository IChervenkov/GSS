document.addEventListener('DOMContentLoaded', () => {
    const notificationSound = new Audio('/audio/notification.wav'); // Path to your .wav file
    const toastElement = document.getElementById('liveToast');
    const toastMessage = document.getElementById('toast-message');
    const closeToastButton = document.getElementById('close-toast');

    // Function to show toast with animation
    function showToast(message) {
        toastMessage.textContent = message;

        toastElement.classList.remove('hide');
        toastElement.style.display = 'block';

        setTimeout(() => {
            toastElement.classList.add('show');
        }, 10); // Small delay for transition effect

        // Play sound
        notificationSound.play().catch(error => console.error('Error playing sound:', error));

        // Auto-hide after 6 seconds
        setTimeout(hideToast, 6000);
    }

    // Function to hide toast with animation
    function hideToast() {
        toastElement.classList.remove('show');
        toastElement.classList.add('hide');

        setTimeout(() => {
            toastElement.style.display = 'none';
        }, 500); // Wait for transition to finish
    }

    // Event listener for close button
    closeToastButton.addEventListener('click', hideToast);

    // Fetch late bags data after 2 seconds
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
});
