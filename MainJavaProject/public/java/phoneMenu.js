document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.querySelector('.menu-toggle');
    const menuToggleLeft = document.querySelector('.menu-toggle-left');
    const navLinks = document.getElementById('nav-links');
    const leftNav = document.querySelector('.left-nav');
    const arrow = document.getElementById('arrow');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', function () {
            navLinks.classList.toggle('active');
        });
    }

    if (menuToggleLeft && leftNav && arrow) {
        menuToggleLeft.addEventListener('click', function () {
            leftNav.classList.toggle('active');
            document.body.classList.toggle('no-scroll');

            // Check if the menu is active to change the arrow
            if (leftNav.classList.contains('active')) {
                arrow.innerHTML = '&#9661;'; // Change to down arrow
            } else {
                arrow.innerHTML = '&#9651;'; // Change to right arrow
            }
        });
    }
});
