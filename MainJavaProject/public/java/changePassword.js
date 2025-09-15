document.addEventListener('DOMContentLoaded', function () {

    const username = document.getElementById('username');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmNewPassword = document.getElementById('confirmNewPassword');
    const errorMess = document.getElementById('errorMessage');

    const csrfToken = document.getElementsByName('_csrf')[0].value;

    const loadingIndicator = document.getElementById('loadingIndicator');

    const stringPattern = /^[a-zA-Z0-9\s]+$/;
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%&]{8,}$/;

    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

    const checkForGlobalError = (response, responseBody) => {
        if (response.headers.get('X-Global-Error') === 'true') {
            window.location.href = `/error?statusCode=${responseBody.statusCode}&message=${responseBody.message}&details=${responseBody.details}`;
        }
    };

    document.getElementById('changePassword').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: username, condition: !stringPattern.test(username.value) },
            { input: currentPassword, condition: !stringPattern.test(currentPassword.value) },
            { input: newPassword, condition: !passwordPattern.test(newPassword.value) || currentPassword.value === newPassword.value },
            { input: confirmNewPassword, condition: !confirmNewPassword.value || confirmNewPassword.value !== newPassword.value }
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
            username: username.value,
            currentPassword: currentPassword.value,
            newPassword: newPassword.value
        };

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

            const responseData = await response.json();

            if (!response.ok) {

                // Check if the response header X-Global-Error is true
                checkForGlobalError(response, responseData);

                username.classList.remove('is-valid', 'is-invalid');
                username.value = '';

                currentPassword.classList.remove('is-valid', 'is-invalid');
                currentPassword.value = '';

                newPassword.classList.remove('is-valid', 'is-invalid');
                newPassword.value = '';

                confirmNewPassword.classList.remove('is-valid', 'is-invalid');
                confirmNewPassword.value = '';

                errorMess.textContent = responseData.errorMessage || 'An error occurred. Please try again.';
                return;
            }

            window.location.href = responseData.redirectTo;

        } catch (error) {
            errorMess.textContent = 'There was a problem changing your password. Please contact support!';

        } finally {
            loadingIndicator.style.display = 'none';
        }
    }
});