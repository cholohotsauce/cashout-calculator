// Utility function to get formatted date and time
function getFormattedDateTime() {
    const dateElem = document.getElementById("dateField");
    const timeElem = document.getElementById("timeField");
    const dateValue = dateElem ? dateElem.value : "";
    const timeValue = timeElem ? timeElem.value : "";

    if (dateValue && timeValue) {
        return new Date(dateValue + 'T' + timeValue).toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    } else {
        return new Date().toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }
}

// Get selected staff from FOH section
function getSelectedStaff() {
    const fohCheckboxes = document.querySelectorAll('#fohStaffContainer input[type="checkbox"]:checked');
    let staff = [];

    fohCheckboxes.forEach(input => {
        if (input.id === "staff-extra") {
            const customName = document.getElementById("customExtraPersonName")?.value.trim();
            staff.push(customName || "Extra Person 👤");
        } else {
            staff.push(input.value);
        }
    });

    return staff.sort();
}

// Show/hide the Extra Person name input (and clear on uncheck)
const extraCheckbox = document.getElementById('staff-extra');
const extraNameWrapper = document.getElementById('extraPersonNameInput'); // existing DIV in HTML
const extraNameInput = document.getElementById('customExtraPersonName');

function toggleExtraPersonUI() {
  if (!extraCheckbox || !extraNameWrapper) return;
  if (extraCheckbox.checked) {
    extraNameWrapper.style.display = 'block';
    setTimeout(() => extraNameInput?.focus({ preventScroll: true }), 0);
  } else {
    extraNameWrapper.style.display = 'none';
    if (extraNameInput) extraNameInput.value = '';
  }
}

extraCheckbox?.addEventListener('change', () => {
  toggleExtraPersonUI();
  renderStaffHours(); // keep hours labels in sync
});

extraNameInput?.addEventListener('input', () => {
  // Update hours labels live when typing a name
  if (extraCheckbox?.checked) renderStaffHours();
});

// Initialize on load
toggleExtraPersonUI();
// Create safe IDs from staff names (no spaces/emoji) and keep a lookup
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}


// Dynamically add input fields for selected staff hours
function renderStaffHours() {
  const selectedStaff = getSelectedStaff();
  const container = document.getElementById('staffHoursContainer');
  container.innerHTML = ''; // Clear existing

  selectedStaff.forEach(staff => {
    const id = `hours-${slugify(staff)}`;
    const div = document.createElement('div');
    div.classList.add('staff-hours-entry');
    div.innerHTML = `
      <label for="${id}">${staff} Hours Worked:</label>
      <input type="number" id="${id}" class="staff-hours-input" placeholder="Hours for ${staff}" min="0" step="0.1" inputmode="decimal">
    `;
    container.appendChild(div);
  });
}

// Re-render hours when any FOH checkbox toggles
document.querySelectorAll('#fohStaffContainer input[type="checkbox"]').forEach(checkbox => {
  checkbox.addEventListener('change', renderStaffHours);
});


// Main calculation logic
document.getElementById("calculate").addEventListener("click", () => {
    const cashTips = parseFloat(document.getElementById("cashTips").value) || 0;
    const cardTips = parseFloat(document.getElementById("cardTips").value) || 0;
    const selectedStaff = getSelectedStaff();

    if (selectedStaff.length === 0) {
        alert("Please select at least one FOH staff member.");
        return;
    }

    let staffHours = {};
    let totalFOHHours = 0;
    let valid = true;

    selectedStaff.forEach(staff => {
        const input = document.getElementById(`hours-${slugify(staff)}`);
        const hours = parseFloat(input.value);
        if (isNaN(hours) || hours <= 0) {
            alert(`Enter valid hours for ${staff}.`);
            valid = false;
        } else {
            staffHours[staff] = hours;
            totalFOHHours += hours;
        }
    });

    if (!valid) return;

    const totalTips = cashTips + cardTips;
    const bohTips = totalTips * 0.30;
    const fohTips = totalTips * 0.70;
    const perHourRate = fohTips / totalFOHHours;
    const formattedDateTime = getFormattedDateTime();

    let resultText = `<h3>Results for ${formattedDateTime}</h3>
                      <table class="tip-table">
                          <tr><th>Category</th><th>Amount</th></tr>
                          <tr><td>Total Tips</td><td>$${totalTips.toFixed(2)}</td></tr>
                          <tr><td>BOH (Kitchen) Tips</td><td>$${bohTips.toFixed(2)}</td></tr>
                          <tr><td>FOH Tip Rate</td><td>$${perHourRate.toFixed(2)} per hour</td></tr>`;
    selectedStaff.forEach(staff => {
        const tipAmount = staffHours[staff] * perHourRate;

        let displayName = staff;
        if (staff === "Chef 👨‍🍳") {
            const customChefName = document.getElementById("customChefName").value.trim();
            if (customChefName) {
                displayName = `Chef (${customChefName})`;
            }
        }
        if (staff === "Shift Ninja 🥷") {
            const customNinjaName = document.getElementById("customNinjaName").value.trim();
            if (customNinjaName) {
                displayName = `Shift Ninja (${customNinjaName})`;
            }
        }
        // Extra Person: if a custom name was typed, it already replaced the label via getSelectedStaff()
        if (staff === 'Extra Person 👤') {
            const typed = document.getElementById('customExtraPersonName')?.value.trim();
            if (typed) {
                displayName = typed; // Replace label with the typed name
            }
        }
        resultText += `<tr><td>${displayName}</td><td>$${tipAmount.toFixed(2)}</td></tr>`;
    });
    resultText += `</table>`;

    document.getElementById("results").innerHTML = resultText;
    document.getElementById("results").style.opacity = 1;
    document.getElementById("copyResults").style.display = "block";
    document.getElementById("savePDF").disabled = false;
    document.getElementById("shareWhatsApp").disabled = false;
});

// Copy to Clipboard
document.getElementById("copyResults").addEventListener("click", () => {
    const resultsText = document.getElementById("results").innerText;
    navigator.clipboard.writeText(resultsText).then(() => {
        alert("Results copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy: ", err);
    });
});

// WhatsApp Share
document.getElementById("shareWhatsApp").addEventListener("click", () => {
    const resultsText = document.getElementById("results").innerText;
    const encodedText = encodeURIComponent(resultsText);
    const whatsappURL = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappURL, "_blank");
});

// Save PDF
document.getElementById("savePDF").addEventListener("click", () => {
    if (!window.jspdf) {
        alert("PDF Library not loaded.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("The Ace - Cash-Out Report", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "italic");
    doc.text(`Generated on: ${getFormattedDateTime()}`, 15, 30);

    doc.setDrawColor(166, 124, 82);
    doc.setLineWidth(0.5);
    doc.line(15, 33, 195, 33);

    const resultsElement = document.getElementById("results");
    if (!resultsElement.innerText.trim()) {
        alert("No results to save.");
        return;
    }
    const lines = resultsElement.innerText.split("\n");
    let y = 40;
    lines.forEach((line) => {
        doc.text(line, 15, y);
        y += 7;
    });
    const localDate = new Date();
    const months = ["January", "February", "March", "April", "May", "June", "July",
                    "August", "September", "October", "November", "December"];
    const year = localDate.getFullYear();
    const monthName = months[localDate.getMonth()];
    const day = localDate.getDate();
    let hours = localDate.getHours();
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const fileName = `${monthName} ${day} ${year} ${hours}-${minutes} ${ampm}.pdf`;
    doc.save(fileName);
});

// Count how many times the logo is clicked
let logoClickCount = 0;
const logo = document.querySelector(".logo");

logo.addEventListener("click", () => {
    logoClickCount++;
    if (logoClickCount === 5) {
        alert("Marico el que lo lea :)");
        logoClickCount = 0;
    }
});
