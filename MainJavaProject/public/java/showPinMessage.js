document.addEventListener('DOMContentLoaded', () => {
    const notificationSound = new Audio('../audio/notification.wav'); // Path to your .wav file

    // Function to show the pinned message with animation
    function showPinnedMessage(message) {
        const pinnedMessage = document.getElementById('pinned-message');
        if (pinnedMessage.style.display === 'block') return;

        const pinnedMessageText = document.getElementById('pinned-message-text');
        pinnedMessageText.textContent = message;

        pinnedMessage.classList.remove('hide');
        pinnedMessage.classList.add('show');
        pinnedMessage.style.display = 'block';

        // Play sound
        notificationSound.play().catch((error) => {
            console.error('Error playing sound:', error);
        });

        setTimeout(hidePinnedMessage, 6000);
    }

    // Function to hide the pinned message with animation
    function hidePinnedMessage() {
        const pinnedMessage = document.getElementById('pinned-message');
        pinnedMessage.classList.remove('show');
        pinnedMessage.classList.add('hide');

        setTimeout(() => {
            pinnedMessage.style.display = 'none';
        }, 500);
    }

    // Event listener for the close button
    document.getElementById('close-pinned-message').addEventListener('click', hidePinnedMessage);

    // Fetch late bags data after 2 seconds
    setTimeout(async () => {
        try {
            const response = await fetch('/checkLateBags', { method: 'GET' });
            if (!response.ok) {
                showPinnedMessage('Bags that have passed the collection time have been detected.');
            }
        } catch (error) {
            console.error('Error fetching late bags:', error);
        }
    }, 1000);
});
