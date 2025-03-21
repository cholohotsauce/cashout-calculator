// Get selected staff
function getSelectedStaff() {
    return Array.from(document.querySelectorAll('#fohStaffContainer input[type="checkbox"]:checked'))
        .map(input => input.value)
        .sort();
}

// Dynamically add input fields for selected staff hours
document.querySelectorAll('#fohStaffContainer input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener("change", () => {
        const selectedStaff = getSelectedStaff();
        const container = document.getElementById("staffHoursContainer");
        container.innerHTML = ""; // Clear existing

        selectedStaff.forEach(staff => {
            const div = document.createElement("div");
            div.classList.add("staff-hours-entry");
            div.innerHTML = `
                <label for="hours-${staff}">${staff} Hours Worked:</label>
                <input type="number" id="hours-${staff}" class="staff-hours-input" placeholder="Hours for ${staff}" min="0" step="0.1">
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

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    let resultText = `<h3>Results for ${formattedDate}</h3>
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
    doc.text("Cash-Out Report", 105, 20, { align: "center" });

    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: 'long', day: 'numeric'
    });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${today}`, 15, 30);

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
