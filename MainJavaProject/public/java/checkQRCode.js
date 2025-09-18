const inputs = document.querySelectorAll(".code-box");
const hiddenCode = document.getElementById("code");
const form = document.getElementById("checkForm");
const errorMessage = document.getElementById("errorMessage");

const loadingIndicator = document.getElementById('loadingIndicator');

function startLoading() {
    loadingIndicator.style.display = 'flex';
}

function stopLoading() {
    loadingIndicator.style.display = 'none';
}

function collectCode() {
    let codeValue = "";
    inputs.forEach(box => codeValue += box.value);
    hiddenCode.value = codeValue;
    return codeValue;
}

inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
        if (input.value.length > 0 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }

        const codeValue = collectCode();

        if (codeValue.length === inputs.length) {
            submitCode(codeValue);
        }
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && input.value === "" && index > 0) {
            inputs[index - 1].focus();
        }
    });
});

async function submitCode(code) {

    startLoading();

    try {
        const res = await fetch(form.action, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "CSRF-Token": form.querySelector("[name=_csrf]").value
            },
            body: JSON.stringify({ code })
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.errorMessage || "Verification failed");
            clearInputs();
            return;
        }

        // Redirect on success
        if (data.redirectTo) {
            window.location.href = data.redirectTo;
        }
    } catch (err) {
        showError("Something went wrong. Try again.");
    } finally {
        stopLoading();
    }
}

function showError(message) {
    errorMessage.textContent = message;
    inputs.forEach(input => {
        input.classList.add("is-invalid-color");
    });

    // Shake animation
    form.classList.add("shake");
    setTimeout(() => form.classList.remove("shake"), 500);
}

function clearInputs() {
    inputs.forEach(input => input.value = "");
    inputs[0].focus();
    hiddenCode.value = "";
}