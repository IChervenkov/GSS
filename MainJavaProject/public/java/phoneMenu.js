document.addEventListener('DOMContentLoaded', function () {

    // JavaScript to toggle the menu on small screens
    document.querySelector('.menu-toggle').addEventListener('click', function () {
        const navLinks = document.getElementById('nav-links');
        navLinks.classList.toggle('active');
    });

    document.querySelector('.menu-toggle-left').addEventListener('click', function() {
        const leftNav = document.querySelector('.left-nav');
        const arrow = document.getElementById('arrow');
        
        leftNav.classList.toggle('active');
        document.body.classList.toggle('no-scroll');
        
        // Check if the menu is active to change the arrow
        if (leftNav.classList.contains('active')) {
            arrow.innerHTML = '&#9661;';  // Change to down arrow
        } else {
            arrow.innerHTML = '&#9651;';  // Change to right arrow
        }
    });

});
