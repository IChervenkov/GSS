document.addEventListener("DOMContentLoaded", function () {
    const sections = document.querySelectorAll(".scrollspy-example h4");
    const navLinks = document.querySelectorAll(".nav-link");
    const scrollableDiv = document.getElementById("scrollableDiv");

    function updateActiveNav() {
        let maxVisibleHeight = 0;
        let currentSection = "";

        sections.forEach((section) => {
            const rect = section.getBoundingClientRect();
            const containerRect = scrollableDiv.getBoundingClientRect();

            // Get the visible portion of the section
            const visibleHeight = Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top);

            if (visibleHeight > maxVisibleHeight) {
                maxVisibleHeight = visibleHeight;
                currentSection = section.getAttribute("id");
            }
        });

        if (currentSection) {
            navLinks.forEach((link) => {
                link.classList.remove("active");
                if (link.getAttribute("href").substring(1) === currentSection) {
                    link.classList.add("active");
                }
            });
        }
    }

    scrollableDiv.addEventListener("scroll", updateActiveNav);
    updateActiveNav();

    // Smooth scrolling when clicking navbar links
    navLinks.forEach((link) => {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            const targetId = this.getAttribute("href").substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
});
