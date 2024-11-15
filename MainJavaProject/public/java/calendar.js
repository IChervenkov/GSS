const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

class Calendar {
  constructor(calendarId, selectedDateDivId) {
    this.calendarEl = document.querySelector(`#${calendarId}`);
    this.header = this.calendarEl.querySelector("h3");
    this.dates = this.calendarEl.querySelector(".dates");
    this.navs = this.calendarEl.querySelectorAll("#prev, #next");
    this.selectedDateDiv = document.querySelector(`#${selectedDateDivId}`);

    this.date = new Date();
    this.month = this.date.getMonth();
    this.year = this.date.getFullYear();
    this.selectedDate = null;

    this.renderCalendar();
    this.attachEventListeners();
  }

  renderCalendar() {
    const start = new Date(this.year, this.month, 1).getDay();
    const endDate = new Date(this.year, this.month + 1, 0).getDate();
    const end = new Date(this.year, this.month, endDate).getDay();
    const endDatePrev = new Date(this.year, this.month, 0).getDate();

    let datesHtml = "";

    // Inactive dates of the previous month
    for (let i = start; i > 0; i--) {
      datesHtml += `<li class="inactive">${endDatePrev - i + 1}</li>`;
    }

    // Active dates of the current month
    for (let i = 1; i <= endDate; i++) {
      let className = "";
      if (
        i === this.date.getDate() &&
        this.month === new Date().getMonth() &&
        this.year === new Date().getFullYear()
      ) {
        className = "today";
      }
      if (i === this.selectedDate) {
        className += " selected";
      }
      datesHtml += `<li class="${className}" data-date="${i}">${i}</li>`;
    }

    // Inactive dates of the next month
    for (let i = end; i < 6; i++) {
      datesHtml += `<li class="inactive">${i - end + 1}</li>`;
    }

    this.dates.innerHTML = datesHtml;
    this.header.textContent = `${months[this.month]} ${this.year}`;
    
    // Update selectedDateDiv if there is a selected date
    if (this.selectedDate) {
      this.selectedDateDiv.value = `${this.year}-${String(this.month + 1).padStart(2, '0')}-${String(this.selectedDate).padStart(2, '0')}`;
    }
  }

  handleDateClick(e) {
    if (e.target.tagName === "LI" && !e.target.classList.contains("inactive")) {
      const day = e.target.getAttribute("data-date");
      this.selectedDate = parseInt(day, 10);
      this.renderCalendar();
      this.selectedDateDiv.value = `${this.year}-${String(this.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  attachEventListeners() {
    this.navs.forEach((nav) => {
      nav.addEventListener("click", (e) => {
        const btnId = e.target.id;

        if (btnId === "prev" && this.month === 0) {
          this.year--;
          this.month = 11;
        } else if (btnId === "next" && this.month === 11) {
          this.year++;
          this.month = 0;
        } else {
          this.month = btnId === "next" ? this.month + 1 : this.month - 1;
        }

        this.renderCalendar();
      });
    });

    this.dates.addEventListener("click", (e) => this.handleDateClick(e));
  }
}

// Function to create a calendar instance if the element exists
function createCalendar(calendarId, selectedDateDivId) {
  const calendarEl = document.querySelector(`#${calendarId}`);
  const selectedDateEl = document.querySelector(`#${selectedDateDivId}`);

  // Check if both the calendar element and selected date element exist
  if (calendarEl && selectedDateEl)
    return new Calendar(calendarId, selectedDateDivId);
}

// Create multiple calendars only if they exist
const calendarMain = createCalendar("calendarMain", "selectedDateMail");
const calendar1 = createCalendar("calendar1", "selectedDate1");
const calendar2 = createCalendar("calendar2", "selectedDate2");