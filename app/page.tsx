"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";

const DEFAULT_STAFF = [
  "Archie",
  "Asa",
  "Chloe",
  "Daniel",
  "Devon",
  "Karyn",
  "Liam",
  "Nat",
  "Wes",
  "Extra Person"
];

// Utility functions
function getFormattedDateTime() {
  return new Date().toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const Background = () => (
  <div className="fixed inset-0 z-0">
    <div 
      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/cashout-calculator/acewallpapercomp.jpeg')" }}
    />
    <div className="absolute inset-0 bg-black/65" />
  </div>
);

export default function Home() {
  const [cashTips, setCashTips] = useState<string>("");
  const [cardTips, setCardTips] = useState<string>("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [staffHours, setStaffHours] = useState<Record<string, string>>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [logoClickCount, setLogoClickCount] = useState(0);

  const [results, setResults] = useState<{
    dateTime: string;
    totalTips: number;
    bohTips: number;
    fohRate: number;
    staffTips: { name: string; amount: number }[];
    resultText: string;
  } | null>(null);

  const handleLogoClick = () => {
    const newCount = logoClickCount + 1;
    if (newCount === 5) {
      alert("Marico el que lo lea :)");
      setLogoClickCount(0);
    } else {
      setLogoClickCount(newCount);
    }
  };

  const toggleStaff = (staff: string) => {
    if (selectedStaff.includes(staff)) {
      setSelectedStaff(selectedStaff.filter((s) => s !== staff));
    } else {
      setSelectedStaff([...selectedStaff, staff].sort());
    }
  };

  const calculate = () => {
    const cash = parseFloat(cashTips) || 0;
    const card = parseFloat(cardTips) || 0;

    if (selectedStaff.length === 0) {
      alert("Please select at least one FOH staff member.");
      return;
    }

    let totalFOHHours = 0;
    const hoursNum: Record<string, number> = {};

    for (const staff of selectedStaff) {
      const hours = parseFloat(staffHours[staff]);
      if (isNaN(hours) || hours <= 0) {
        alert(`Enter valid hours for ${staff}.`);
        return;
      }
      hoursNum[staff] = hours;
      totalFOHHours += hours;
    }

    const totalTips = cash + card;
    const bohTips = totalTips * 0.30;
    const fohTips = totalTips * 0.70;
    const perHourRate = fohTips / totalFOHHours;
    const dateTime = getFormattedDateTime();

    const staffTips = selectedStaff.map((staff) => {
      let displayName = staff;
      if (staff === "Extra Person" && customNames["Extra"]) {
        displayName = customNames["Extra"];
      }

      return {
        name: displayName,
        amount: hoursNum[staff] * perHourRate,
      };
    });

    let text = `Results for ${dateTime}\n\n`;
    text += `Category | Amount\n`;
    text += `--------------------------\n`;
    text += `Total Tips: $${totalTips.toFixed(2)}\n`;
    text += `BOH (Kitchen) Tips: $${bohTips.toFixed(2)}\n`;
    text += `FOH Tip Rate: $${perHourRate.toFixed(2)} per hour\n`;
    text += `--------------------------\n`;
    staffTips.forEach((st) => {
      text += `${st.name}: $${st.amount.toFixed(2)}\n`;
    });

    setResults({
      dateTime,
      totalTips,
      bohTips,
      fohRate: perHourRate,
      staffTips,
      resultText: text,
    });
  };

  const copyToClipboard = () => {
    if (!results) return;
    navigator.clipboard
      .writeText(results.resultText)
      .then(() => {
        alert("Results copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  const shareWhatsApp = () => {
    if (!results) return;
    const encodedText = encodeURIComponent(results.resultText);
    const whatsappURL = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappURL, "_blank");
  };

  const handleSavePDF = () => {
    if (!results) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("The Ace - Cash-Out Report", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "italic");
    doc.text(`Generated on: ${results.dateTime}`, 15, 30);

    doc.setDrawColor(166, 124, 82);
    doc.setLineWidth(0.5);
    doc.line(15, 33, 195, 33);

    const lines = results.resultText.split("\n");
    let y = 40;
    lines.forEach((line) => {
      doc.text(line, 15, y);
      y += 7;
    });

    const localDate = new Date();
    const months = [
      "January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December",
    ];
    const year = localDate.getFullYear();
    const monthName = months[localDate.getMonth()];
    const day = localDate.getDate();
    let hours = localDate.getHours();
    const minutes = String(localDate.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const fileName = `${monthName} ${day} ${year} ${hours}-${minutes} ${ampm}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="min-h-screen bg-black relative font-sans selection:bg-white/30 pb-32">
      <Background />

      <div className="relative z-10 w-full max-w-2xl mx-auto p-4 sm:p-8">
        <div className="flex flex-col items-center mb-8 mt-4 cursor-pointer" onClick={handleLogoClick}>
          <img 
            src="/cashout-calculator/TheAce_BlackLogo.png" 
            alt="The Ace Logo" 
            className="h-12 object-contain invert opacity-70"
          />
        </div>

        {/* Tips Island */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="bg-white/[0.04] backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 mb-6 shadow-xl"
        >
          <h2 className="text-xl font-semibold tracking-tight text-white/90 mb-4">Collected Tips</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/50 text-sm font-medium mb-2">Cash Tips ($)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                placeholder="0.00"
                value={cashTips}
                onChange={(e) => setCashTips(e.target.value)}
                className="w-full h-14 bg-black/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] border border-white/5 focus:border-white/20 focus:bg-black/30 text-white font-medium tracking-tight rounded-xl px-4 text-lg placeholder-gray-400 focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-white/50 text-sm font-medium mb-2">Card Tips ($)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                placeholder="0.00"
                value={cardTips}
                onChange={(e) => setCardTips(e.target.value)}
                className="w-full h-14 bg-black/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] border border-white/5 focus:border-white/20 focus:bg-black/30 text-white font-medium tracking-tight rounded-xl px-4 text-lg placeholder-gray-400 focus:outline-none transition-all"
              />
            </div>
          </div>
        </motion.div>

        {/* Staff Selection Island */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="bg-white/[0.04] backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 mb-6 shadow-xl"
        >
          <h2 className="text-xl font-semibold tracking-tight text-white/90 mb-4">Select FOH Staff</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DEFAULT_STAFF.map((staff) => {
              const isSelected = selectedStaff.includes(staff);
              return (
                <button
                  key={staff}
                  onClick={() => toggleStaff(staff)}
                  className={`h-14 rounded-full border transition-all text-sm font-medium backdrop-blur-sm ${
                    isSelected
                      ? "bg-white/90 text-black shadow-[0_0_15px_rgba(255,255,255,0.15)] font-semibold border-white"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {staff}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {selectedStaff.includes("Extra Person") && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div>
                  <label className="block text-white/50 text-sm font-medium mb-2">
                    Extra Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter name..."
                    value={customNames["Extra"] || ""}
                    onChange={(e) =>
                      setCustomNames((prev) => ({ ...prev, Extra: e.target.value }))
                    }
                    className="w-full h-14 bg-black/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] border border-white/5 focus:border-white/20 focus:bg-black/30 text-white font-medium tracking-tight rounded-xl px-4 text-lg placeholder-gray-400 focus:outline-none transition-all"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Hours Worked Island */}
        <AnimatePresence>
          {selectedStaff.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white/[0.04] backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 shadow-xl">
                <h2 className="text-xl font-semibold tracking-tight text-white/90 mb-4">Hours Worked</h2>
                <div className="space-y-4">
                  {selectedStaff.map((staff) => {
                    const displayName = staff === "Extra Person" && customNames["Extra"] ? customNames["Extra"] : staff;
                    return (
                      <div key={staff} className="flex items-center gap-4">
                        <span className="w-1/3 text-base font-medium text-white/90 truncate">{displayName}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*"
                          placeholder={`Hours for ${displayName}`}
                          value={staffHours[staff] || ""}
                          onChange={(e) =>
                            setStaffHours((prev) => ({ ...prev, [staff]: e.target.value }))
                          }
                          className="flex-1 h-14 bg-black/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] border border-white/5 focus:border-white/20 focus:bg-black/30 text-white font-medium tracking-tight rounded-xl px-4 text-lg placeholder-gray-400 focus:outline-none transition-all"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Island */}
        <AnimatePresence>
          {results && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/[0.04] backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 mb-6 shadow-xl"
            >
              <h2 className="text-xl font-semibold tracking-tight text-white/90 mb-1">Cash-Out Results</h2>
              <p className="text-xs text-white/50 mb-6">{results.dateTime}</p>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-white/80">Total Tips</span>
                  <span className="text-xl font-semibold text-white">
                    ${results.totalTips.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-white/80">BOH (Kitchen) Tips (30%)</span>
                  <span className="text-lg font-medium text-white">
                    ${results.bohTips.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-white/80">FOH Tip Rate</span>
                  <span className="text-white font-medium">
                    ${results.fohRate.toFixed(2)} / hr
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                <h4 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wider">
                  Staff Breakdown
                </h4>
                {results.staffTips.map((st, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-white/5 rounded-xl p-4 border border-white/5"
                  >
                    <span className="text-white/90 font-medium">{st.name}</span>
                    <span className="text-white font-semibold">${st.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 h-12 text-sm font-medium text-white rounded-xl transition-colors border border-white/10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
                <button
                  onClick={shareWhatsApp}
                  className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 h-12 text-sm font-medium text-white rounded-xl transition-colors border border-white/10"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  WhatsApp
                </button>
                <button
                  onClick={handleSavePDF}
                  className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 h-12 text-sm font-medium text-white rounded-xl transition-colors border border-white/10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Save PDF
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full flex flex-col items-center pb-8 pt-4 px-4 backdrop-blur-xl bg-black/40 border-t border-white/10 z-50">
        <div className="w-full max-w-2xl flex gap-4">
          <button
            onClick={calculate}
            className="flex-1 h-14 bg-white/90 text-black font-semibold rounded-[20px] shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none text-lg"
          >
            Calculate Cash-Out
          </button>
          
          <button
            onClick={() => alert("Save to Drive integration pending.")}
            className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-white/10 border border-white/20 text-white rounded-[20px] shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none"
            title="Save to Drive"
          >
            <img src="/cashout-calculator/google-drive-icon.svg" alt="Google Drive" className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
