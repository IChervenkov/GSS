document.addEventListener('DOMContentLoaded', function () {
    const modalMess = document.getElementById('myMessage');
    const modalContentMess = modalMess.querySelector('.modal-content-mess');
    const loadingIndicator = document.getElementById('loadingIndicator');

    function showLoading() {
        loadingIndicator.style.display = 'flex';
    }

    function hideLoading() {
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

                showLoading();

                let url, appName;
                switch (buttonId) {
                    case 'downloadBtn':
                        url = '/download-apk-bike';
                        appName = 'NFCReader-1.0-release.apk';
                        break;
                    case 'downloadRFIDAppBtn':
                        url = '/download-apk-laundry';
                        appName = 'RFIDLaundryReader-1.0-release.apk';
                        break;
                }

                fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            return response.text().then(text => {
                                try {
                                    const data = JSON.parse(text);
                                    throw new Error(data.message || 'Failed to download file');
                                } catch {
                                    throw new Error(text || 'Failed to download file');
                                }
                            });
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
                        hideLoading();
                        downloadApp.disabled = false; // Re-enable the button
                    });
            });
        }
    }

    downloadFile('downloadBtn');
    downloadFile('downloadRFIDAppBtn');
});
