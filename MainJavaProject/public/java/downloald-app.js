document.addEventListener('DOMContentLoaded', function () {
    const modalMess = document.getElementById('myMessage');
    const modalContentMess = modalMess.querySelector('.modal-content-mess');
    const loadingIndicator = document.getElementById('loadingIndicator');

    const checkForGlobalError = (response, responseBody) => {
        if (response.headers.get('X-Global-Error') === 'true')
            window.location.href = `/web/error?statusCode=${responseBody.statusCode}&message=${responseBody.message}&details=${responseBody.details}`;
    };

    function startLoading() {
        loadingIndicator.style.display = 'flex';
    }

    function stopLoading() {
        loadingIndicator.style.display = 'none';
    }

    function showMessError(message = 'The file is not correct. Please contact support!') {
        const icon = document.getElementById('mess-icon');
        icon.src = "/icon/error.png";
        const btnYes = document.getElementById('btnYes');
        if (btnYes) {
            btnYes.style.display = 'none';
        }
        document.getElementById('mess-text').textContent = message;
        modalMess.classList.add('show');
        modalContentMess.classList.add('show', 'slide-in');
        modalContentMess.classList.remove('slide-out');
    }

    function downloadFile(buttonId) {
        const downloadApp = document.getElementById(buttonId);
        if (downloadApp) {
            downloadApp.addEventListener('click', function () {
                if (downloadApp.disabled) return; // Prevent multiple clicks
                downloadApp.disabled = true;

                startLoading();

                let url, appName;
                switch (buttonId) {
                    case 'downloadBtn':
                        url = '/web/download-apk-bike';
                        appName = 'NFCReader-1.4.1-release.apk';
                        break;
                    case 'downloadRFIDAppBtn':
                        url = '/web/download-apk-laundry';
                        appName = 'RFIDLaundryReader-1.4.2-release.apk';
                        break;
                    case 'downloadRFIDAppBtnAsset':
                        url = '/web/download-apk-asset';
                        appName = 'RFIDLaundryAsset-1.4.1-release.apk';
                        break;
                    case 'downloadTabletAppBtn':
                        url = '/web/download-apk-gym';
                        appName = 'RateFitnesCleaning-1.0-release.apk';
                        break;
                }

                fetch(url, {
                    method: 'GET'
                })
                    .then(async response => {
                        if (!response.ok) {
                            const errorData = await response.json();
                            checkForGlobalError(response, errorData);
                            showMessError(data.message);
                            return;
                        }

                        return response.blob();
                    })
                    .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = appName;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                    })
                    .catch(err => {
                        showMessError(err.message);
                    })
                    .finally(() => {
                        stopLoading();
                        downloadApp.disabled = false; // Re-enable the button
                    });
            });
        }
    }

    downloadFile('downloadBtn');
    downloadFile('downloadRFIDAppBtn');
    downloadFile('downloadRFIDAppBtnAsset');
    downloadFile('downloadTabletAppBtn');
});
