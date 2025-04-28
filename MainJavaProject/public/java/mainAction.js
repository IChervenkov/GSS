document.addEventListener('DOMContentLoaded', function () {

    const addCampModal = document.getElementById("addCampModal");
    const addCampModalContent = addCampModal.querySelector('.modal-content');

    const modalMess = document.getElementById("myMessage");
    const modalMessContent = modalMess.querySelector('.modal-content-mess');

    const addCampInput = document.getElementById('addCamp');
    const loadingIndicator = document.getElementById('loadingIndicator');

    const toastElement = document.getElementById('liveToast');
    const toastMessage = document.getElementById('toast-message');
    const closeToastButton = document.getElementById('close-toast');

    const csrfToken = document.getElementsByName('_csrf')[0].value;

    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

    // Function to show toast with animation
    function showToast(message) {
        toastMessage.textContent = message;

        toastElement.classList.remove('hide');
        toastElement.style.display = 'block';

        setTimeout(() => {
            toastElement.classList.add('show');
        }, 10); // Small delay for transition effect

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
    if (document.getElementById('isFirstLogin').value === 'true')
        showToast('By default, the information in the system refers to the first camp created.');

    function showMess(type, message) {

        const icon = document.getElementById('mess-icon');

        switch (type) {
            case 'Error':
                icon.src = "/icon/error.png";
                document.getElementById('mess-text').textContent = message;
                isInfo = false;
                break;

            case 'Warning':
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

            if (isInfo)
                window.location.reload();

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAddCampModal() {

        // Add the slide-in effect by adding the necessary classes
        addCampModal.classList.add('show');
        addCampModalContent.classList.add('show');
        addCampModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        addCampModalContent.classList.remove('slide-out');
    }

    function closeAddCampModal() {
        // Add the slide-out effect
        addCampModalContent.classList.add('slide-out');
        addCampModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            addCampInput.classList.remove('is-invalid');
            addCampInput.classList.remove('is-valid');
            addCampInput.value = '';

            addCampModal.classList.remove('show');
            addCampModalContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    document.getElementById('addCampButton').onclick = openAddCampModal;
    document.querySelectorAll('.left-nav ul li button').forEach(button => {
        button.addEventListener('click', async (event) => {
            const campId = event.target.id;
            const campName = event.target.textContent;
    
            document.querySelectorAll('.left-nav ul li button').forEach(btn => btn.classList.remove('pinClass'));
            event.target.classList.add('pinClass');

            try {
                const response = await fetch('/setCampValue', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ campId: campId })
                });
    
                const data = await response.json(); // Parse JSON response
    
                if (!response.ok) {
                    showMess('Error', data.message || 'Something went wrong');
                    return;
                }
    
                showToast(`Camp selected: ${campName}. The system will display information only for this camp.`);
                
            } catch (error) {
                showMess('Error', 'Network error or server is unavailable.');
                console.error('Fetch error:', error);
            }
        });
    });    

    document.getElementById('form1').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form1').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: addCampInput, condition: !/^[a-zA-Z0-9\s]+$/.test(addCampInput.value) }
        ];

        let isValid = true;

        inputsToCheck.forEach(({ input, condition }) => {
            if (condition) {
                toggleInputValidity(input, false);
                isValid = false;
            } else {
                toggleInputValidity(input, true);
            }
        });

        if (!isValid) {
            return;
        }

        const data = {
            campName: addCampInput.value
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            loadingIndicator.style.display = 'flex';

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    hasError = true;
                }

                responseData = await response.json();

                closeMessModal();

            } catch (error) {
                hasError = true;
            } finally {
                loadingIndicator.style.display = 'none';
            }
        });

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (isSubmit && !hasError) {
                    closeAddCampModal();
                    showMess('Info', 'Camp added successfully');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while adding the camp');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warning', 'Are you sure you want to add this camp?');
    };

    addCampInput.addEventListener('input', () => {
        toggleInputValidity(addCampInput, /^[a-zA-Z0-9\s]+$/.test(addCampInput.value));
    })

    document.getElementsByClassName('close-btn')[0].onclick = closeAddCampModal;
    document.getElementsByClassName('close-btn')[1].onclick = closeMessModal;

    window.onclick = function (event) {
        switch (event.target) {

            case addCampModal:
                closeAddCampModal();
                break;

            case modalMess:
                closeMessModal();
                break;
        }
    }

});