document.addEventListener('DOMContentLoaded', function () {

    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const errorMess = document.getElementById('errorMessage');

    const csrfToken = document.getElementsByName('_csrf')[0].value;

    const loadingIndicator = document.getElementById('loadingIndicator');

    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

    const checkForGlobalError = (response, responseBody) => {
        if (response.headers.get('X-Global-Error') === 'true') {
            window.location.href = `/error?statusCode=${responseBody.statusCode}&message=${responseBody.message}&details=${responseBody.details}`;
        }
    };

    document.getElementById('loginForm').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: username, condition: !/^[\w.@+-]+$/.test(username.value) },
            { input: password, condition: !password.value }
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
            password: password.value
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

                username.classList.remove('is-valid');
                username.classList.remove('is-invalid');
                username.value = '';

                password.classList.remove('is-valid');
                password.classList.remove('is-invalid');
                password.value = '';

                errorMess.textContent = responseData.errorMessage || 'An error occurred. Please try again.';
            }
            else
                window.location.href = responseData.redirectTo;

        } catch (error) {
            errorMess.textContent = 'There is a problem signing you in. Please contact support!';

        } finally {
            loadingIndicator.style.display = 'none';
        }
    }
});