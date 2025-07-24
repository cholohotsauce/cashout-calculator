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

// Get selected staff from both FOH and additional staff sections
function getSelectedStaff() {
    const fohCheckboxes = document.querySelectorAll('#fohStaffContainer input[type="checkbox"]:checked');
    const additionalCheckboxes = document.querySelectorAll('#additionalStaffContainer input[type="checkbox"]:checked');
    let staff = Array.from(fohCheckboxes).map(input => input.value)
        .concat(Array.from(additionalCheckboxes).map(input => input.value));
    return staff.sort();
}

// Dynamically add input fields for selected staff hours
document.querySelectorAll('#fohStaffContainer input[type="checkbox"], #additionalStaffContainer input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener("change", () => {
        const selectedStaff = getSelectedStaff();
        const container = document.getElementById("staffHoursContainer");
        container.innerHTML = ""; // Clear existing

        selectedStaff.forEach(staff => {
            const div = document.createElement("div");
            div.classList.add("staff-hours-entry");
            // Added inputmode="decimal" for mobile devices to show a numeric keyboard with a decimal point.
            div.innerHTML = `
                <label for="hours-${staff}">${staff} Hours Worked:</label>
                <input type="number" id="hours-${staff}" class="staff-hours-input" placeholder="Hours for ${staff}" min="0" step="0.1" inputmode="decimal">
            `;
            container.appendChild(div);
        });
    });
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
        const input = document.getElementById(`hours-${staff}`);
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
        resultText += `<tr><td>${staff}</td><td>$${tipAmount.toFixed(2)}</td></tr>`;
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

    doc.setDrawColor(166, 124, 82); // warm brown tone
    doc.setLineWidth(0.5);
    doc.line(15, 33, 195, 33); // horizontal line under date

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
    doc.save(`CashOutReport_${new Date().toISOString().slice(0, 10)}.pdf`);
});

// Count how many times the logo is clicked
let logoClickCount = 0;
const logo = document.querySelector(".logo");

logo.addEventListener("click", () => {
    logoClickCount++;
    // When clicked 5 times, show a secret message
    if (logoClickCount === 5) {
        alert("Marico el que lo lea :)");
        logoClickCount = 0; // reset count so it can be triggered again
    }
});
