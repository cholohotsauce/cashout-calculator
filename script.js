// Function to get selected FOH staff in alphabetical order
function getSelectedStaff() {
    return Array.from(document.querySelectorAll('#fohStaffContainer input[type="checkbox"]:checked'))
        .map(input => input.value)
        .sort(); // Sort alphabetically
}

// Event listener for the Calculate button
document.getElementById("calculate").addEventListener("click", function() {
    const cashTips = parseFloat(document.getElementById("cashTips").value) || 0;
    const cardTips = parseFloat(document.getElementById("cardTips").value) || 0;
    const selectedStaff = getSelectedStaff();
    const onCallHours = parseFloat(document.getElementById("onCallHours").value) || 0;

    // Error handling
    if (cashTips === 0 && cardTips === 0) {
        alert("⚠️ Please enter cash or card tips before calculating!");
        return;
    }

    if (selectedStaff.length === 0) {
        alert("⚠️ Please select at least one FOH staff member.");
        return;
    }

    // Calculate total tips
    const totalTips = cashTips + cardTips;
    const bohTips = totalTips * 0.30;
    let fohTips = totalTips * 0.70;

    // Get today's date
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Start creating the table
    let resultText = `<h3>Results for ${formattedDate}</h3>
                      <table class="tip-table">
                          <tr><th>Category</th><th>Amount</th></tr>
                          <tr><td>Total Tips</td><td>$${totalTips.toFixed(2)}</td></tr>
                          <tr><td>BOH (Kitchen) Tips</td><td>$${bohTips.toFixed(2)}</td></tr>`;

    if (onCallHours > 0) {
        const fullShiftHours = 6;
        const totalHoursWorked = (selectedStaff.length - 1) * fullShiftHours + onCallHours;
        const perHourRate = fohTips / totalHoursWorked;

        const onCallStaffShare = perHourRate * onCallHours;
        fohTips -= onCallStaffShare;

        resultText += `<tr><td>On-Call Staff Tips</td><td>$${onCallStaffShare.toFixed(2)}</td></tr>`;
    }

    // Divide remaining FOH tips among full-shift staff
    const fohPerStaff = fohTips / (selectedStaff.length - (onCallHours > 0 ? 1 : 0));

    selectedStaff.forEach(staff => {
        resultText += `<tr><td>${staff}</td><td>$${fohPerStaff.toFixed(2)}</td></tr>`;
    });

    resultText += `</table>`; // Close table

    // Display results with animation
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = resultText;
    resultsDiv.style.display = "block";
    resultsDiv.style.opacity = "1";
    resultsDiv.style.transform = "translateY(0)";

    // Enable action buttons
    document.getElementById("copyResults").style.display = "block";
    document.getElementById("savePDF").disabled = false;
    document.getElementById("shareWhatsApp").disabled = false;

    console.log("✅ Calculation complete!");
});

// Copy results to clipboard
document.getElementById("copyResults").addEventListener("click", function() {
    const resultsText = document.getElementById("results").innerText;
    navigator.clipboard.writeText(resultsText).then(() => {
        alert("✅ Results copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy: ", err);
    });
});

// Share results via WhatsApp
document.getElementById("shareWhatsApp").addEventListener("click", function() {
    const resultsText = document.getElementById("results").innerText;
    if (!resultsText.trim()) {
        alert("⚠️ No results to share! Please calculate first.");
        return;
    }

    const formattedText = `🔥 *Cash-Out Report* 🔥\n\n${resultsText}`;
    const encodedText = encodeURIComponent(formattedText);
    const whatsappURL = `https://api.whatsapp.com/send?text=${encodedText}`;

    window.open(whatsappURL, "_blank");
});

// Save results as a PDF
document.getElementById("savePDF").addEventListener("click", function () {
    if (!window.jspdf) {
        alert("⚠️ PDF Library (jsPDF) is not loaded. Please check your internet connection.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    // Set Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Cash-Out Report", 105, 20, { align: "center" });

    // Get today's date
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: 'numeric'
    });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${today}`, 15, 30);

    // Fetch results data
    const resultsElement = document.getElementById("results");
    if (!resultsElement.innerText.trim()) {
        alert("⚠️ No results to save. Please calculate first!");
        return;
    }

    let resultsText = resultsElement.innerText.split("\n");
    let y = 40; // Y position for text placement

    doc.setFontSize(12);
    resultsText.forEach((line) => {
        doc.text(line, 15, y);
        y += 7;
    });

    // Save the PDF file
    doc.save(`CashOutReport_${new Date().toISOString().slice(0, 10)}.pdf`);
});