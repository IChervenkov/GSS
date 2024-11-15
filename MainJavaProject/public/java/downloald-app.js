document.addEventListener('DOMContentLoaded', function () {

    const modalMess = document.getElementById('myMessage');
    const modalContentMess = modalMess.querySelector('.modal-content-mess');
    
    function showMessError() {

        const icon = document.getElementById('mess-icon');

        icon.src = "../icon/error.png";
        document.getElementById('btnYes').style.display = 'none';
        document.getElementById('mess-text').textContent = 'The file is not correct. Please contact support!';

        // Add the slide-in effect by adding the necessary classes
        modalMess.classList.add('show');
        modalContentMess.classList.add('show');
        modalContentMess.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalContentMess.classList.remove('slide-out');
    }

    function downloaldFile(buttonId) {

        const downloaldApp = document.getElementById(buttonId);

        if (downloaldApp) {

            downloaldApp.addEventListener('click', function () {
                fetch('/download-apk-bike', {
                    method: 'GET',
                })
                    .then(response => {
                        if (!response.ok) {
                            return response.json().then(data => {
                                throw new Error(data.message || 'Failed to download file');
                            });
                        }
                        return response.blob();
                    })
                    .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = 'app-nfc-bike-global-rts.apk'; 
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                    })
                    .catch(err => {
                        console.error('Error downloading file:', err);
                        showMessError();
                    });
            });

        }
    }

    downloaldFile('downloadBtn');
});