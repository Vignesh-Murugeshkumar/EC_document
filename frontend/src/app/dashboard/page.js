"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "../i18n";
import { 
  Upload, FileText, Download, Printer, LogOut, ArrowUpRight, 
  HelpCircle, CheckCircle, AlertTriangle, ShieldAlert, Award,
  Loader2, Calendar, User, Key, RefreshCw, Lock, LayoutDashboard,
  FilePlus, History, Settings, ChevronRight, X, Info, Eye
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { t, locale, changeLanguage } = useTranslation();

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "";

  // User session
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Navigation tab for mobile bottom nav / desktop view
  const [activeView, setActiveView] = useState("upload"); // 'dashboard', 'upload', 'history', 'settings'

  // Documents listing
  const [documents, setDocuments] = useState([
    { id: "mock-doc-1", filename: "Survey #1234 - Tambaram", status: "complete", health_score: 92, created_at: new Date(Date.now() - 7200000).toISOString(), analysis_mode: "standard", analysis_results: {
      transactions: [
        { entry_number: "1", date: "10-02-2022", year: 2022, transaction_type: "Sale Deed", parties: [{ name: "Ramesh Rao", role: "Seller" }, { name: "Anand Sen", role: "Buyer" }], survey_number: "1234", property_description: "Tambaram Plot 12", amount: "₹45,00,000" }
      ],
      ownership_chain: [{ transaction_id: "1", from_party: "Ramesh Rao", to_party: "Anand Sen", year: 2022, status: "valid" }],
      anomalies: [],
      summary: { total_transactions: 1, missing_entries_count: 0, duplicate_entries_count: 0, ownership_issues_count: 0, encumbrance_anomalies_count: 0, health_score: 92, year_wise_distribution: [{ year: 2022, anomaly_count: 0 }] }
    }},
    { id: "mock-doc-2", filename: "Flat 4B - Sky Heights", status: "complete", health_score: 68, created_at: new Date(Date.now() - 86400000).toISOString(), analysis_mode: "multi_agent", analysis_results: {
      transactions: [
        { entry_number: "1", date: "14-06-2021", year: 2021, transaction_type: "Sale Deed", parties: [{ name: "Karan Johar", role: "Seller" }, { name: "Aditya Chopra", role: "Buyer" }], survey_number: "Flat 4B", property_description: "Sky Heights Apartment", amount: "₹1,20,00,000" },
        { entry_number: "2", date: "15-08-2023", year: 2023, transaction_type: "Mortgage", parties: [{ name: "Aditya Chopra", role: "Mortgagor" }, { name: "ICICI Bank", role: "Mortgagee" }], survey_number: "Flat 4B", property_description: "ICICI Home Loan", amount: "₹80,00,000" }
      ],
      ownership_chain: [{ transaction_id: "1", from_party: "Karan Johar", to_party: "Aditya Chopra", year: 2021, status: "valid" }],
      anomalies: [{ type: "encumbrance_anomaly", severity: "medium", year: 2023, entry_number: "2", description: "Active ICICI mortgage loan recorded with no release deed.", recommendation: "Request NOC and register discharge deed." }],
      summary: { total_transactions: 2, missing_entries_count: 0, duplicate_entries_count: 0, ownership_issues_count: 0, encumbrance_anomalies_count: 1, health_score: 68, year_wise_distribution: [{ year: 2021, anomaly_count: 0 }, { year: 2023, anomaly_count: 1 }] }
    }},
    { id: "mock-doc-3", filename: "Plot 12A - Velachery", status: "complete", health_score: 41, created_at: new Date(Date.now() - 259200000).toISOString(), analysis_mode: "standard", analysis_results: {
      transactions: [
        { entry_number: "1", date: "20-03-2022", year: 2022, transaction_type: "Sale Deed", parties: [{ name: "Vijay Sethupathi", role: "Seller" }, { name: "Dhanush K", role: "Buyer" }], survey_number: "12A", property_description: "Velachery Land Plot", amount: "₹75,00,000" },
        { entry_number: "2", date: "12-11-2025", year: 2025, transaction_type: "Sale Deed", parties: [{ name: "Sivakarthikeyan", role: "Seller" }, { name: "Anirudh R", role: "Buyer" }], survey_number: "12A", property_description: "Velachery Land Plot", amount: "₹90,00,000" }
      ],
      ownership_chain: [
        { transaction_id: "1", from_party: "Vijay Sethupathi", to_party: "Dhanush K", year: 2022, status: "valid" },
        { transaction_id: "2", from_party: "Sivakarthikeyan", to_party: "Anirudh R", year: 2025, status: "gap_detected" }
      ],
      anomalies: [
        { type: "incorrect_ownership_transfer", severity: "high", year: 2025, entry_number: "2", description: "Sivakarthikeyan sold the plot, but Dhanush was the last registered owner.", recommendation: "Perform manual deed trace for missing links between Dhanush and Sivakarthikeyan." }
      ],
      summary: { total_transactions: 2, missing_entries_count: 1, duplicate_entries_count: 0, ownership_issues_count: 1, encumbrance_anomalies_count: 0, health_score: 41, year_wise_distribution: [{ year: 2022, anomaly_count: 0 }, { year: 2025, anomaly_count: 1 }] }
    }}
  ]);

  // Selected active document
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  // File details for upload
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Extraction options
  const [extractionLang, setExtractionLang] = useState("English");
  const [analysisMode, setAnalysisMode] = useState("auto");

  // Processing details
  const [processingTimeRemaining, setProcessingTimeRemaining] = useState(45);
  const [processingStep, setProcessingStep] = useState(1); // 1 to 5
  const [systemLogs, setSystemLogs] = useState([]);
  
  // Modal details
  const [modalType, setModalType] = useState(null);
  const [drilldownYear, setDrilldownYear] = useState(null);

  const logBoxRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [systemLogs]);

  // Auth initialization & fetch documents list
  useEffect(() => {
    const storedToken = localStorage.getItem("ec_token");
    const storedUser = localStorage.getItem("ec_user");
    
    if (!storedToken || !storedUser) {
      router.push("/");
      return;
    }
    
    const tokenVal = storedToken;
    setToken(tokenVal);
    setUser(JSON.parse(storedUser));

    // Fetch documents list from backend if online
    const fetchDocs = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/documents`, {
          headers: { "Authorization": `Bearer ${tokenVal}` }
        });
        if (response.ok) {
          const data = await response.json();
          setDocuments((prev) => {
            const realIds = new Set(data.map(d => d.id));
            const filteredPrev = prev.filter(d => !realIds.has(d.id) && !d.id.startsWith("doc-"));
            return [...data, ...filteredPrev];
          });
        }
      } catch (err) {
        console.warn("Backend offline, using local mock documents preview:", err);
      }
    };
    fetchDocs();
  }, [router]);

  // Process timing countdown (simulation fallback for offline mode)
  useEffect(() => {
    if (!selectedDoc || selectedDoc.status !== "processing") return;

    // Countdown remaining seconds
    const countdown = setInterval(() => {
      setProcessingTimeRemaining((prev) => {
        if (prev <= 1) return 1;
        return prev - 1;
      });
    }, 1000);

    // Simulated Steps and Log feeds
    const logInterval = setInterval(() => {
      const nowStr = new Date().toLocaleTimeString();
      setSystemLogs((prev) => {
        const step = Math.min(Math.floor((45 - processingTimeRemaining) / 9) + 1, 5);
        setProcessingStep(step);

        let newLog = `[${nowStr}] Scanning system nodes...`;
        if (step === 1) {
          newLog = `[${nowStr}] Decrypting secure PDF text layer...`;
        } else if (step === 2) {
          newLog = `[${nowStr}] Metadata Parsing: Page count and layout analyzed.`;
        } else if (step === 3) {
          newLog = `[${nowStr}] Anomaly Detector: Scanning entries for mortgage/discharge links...`;
        } else if (step === 4) {
          newLog = `[${nowStr}] Ownership Chain: Cross-referencing title transfer sequences.`;
        } else if (step === 5) {
          newLog = `[${nowStr}] Report Generator: Constructing PDF analysis report summary.`;
        }
        
        return [...prev, newLog];
      });
    }, 4000);

    return () => {
      clearInterval(countdown);
      clearInterval(logInterval);
    };
  }, [selectedDoc, processingTimeRemaining]);

  // Handle Log Out
  const handleLogout = () => {
    localStorage.removeItem("ec_token");
    localStorage.removeItem("ec_user");
    document.cookie = "ec_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/");
  };

  // Handle Print Report
  const handlePrintReport = () => {
    window.print();
  };

  // Handle Download Report
  const handleDownloadReport = () => {
    if (!selectedDoc) return;
    // Open report PDF endpoint passing token as query param
    window.open(`${backendUrl}/api/reports/${selectedDoc.id}/pdf?token=${token}`);
  };

  // Drag and drop events
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelection(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) handleFileSelection(file);
  };

  const handleFileSelection = (file) => {
    setUploadError("");
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF documents are supported.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("File size exceeds the 20 MB limit.");
      return;
    }
    setUploadedFile(file);
  };

  // Start analysis trigger
  const handleStartAnalysis = async () => {
    if (!uploadedFile) return;

    setUploading(true);
    setSystemLogs([
      `[${new Date().toLocaleTimeString()}] Initializing PDF parse task...`,
      `[${new Date().toLocaleTimeString()}] Document verified: ${uploadedFile.name}`,
    ]);
    setProcessingTimeRemaining(45);
    setProcessingStep(1);

    const formData = new FormData();
    formData.append("file", uploadedFile);
    // Free-tier users are locked to standard mode (backend also enforces this)
    const effectiveMode = user?.subscription_status === "free" ? "standard" : analysisMode;
    formData.append("mode", effectiveMode);
    formData.append("language", extractionLang === "English" ? "en" : extractionLang.split(" ")[0].toLowerCase());

    try {
      const response = await fetch(`${backendUrl}/api/documents/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to upload document");
      }

      const data = await response.json();
      const docId = data.document_id;

      // Initialize the selected doc state
      const initialDoc = {
        id: docId,
        filename: uploadedFile.name,
        status: "queued",
        created_at: new Date().toISOString(),
        analysis_mode: analysisMode,
        analysis_results: null
      };
      setSelectedDoc(initialDoc);

      // Start Polling the backend for status updates
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const docResp = await fetch(`${backendUrl}/api/documents/${docId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (docResp.ok) {
            const currentDoc = await docResp.json();
            setSelectedDoc(currentDoc);

            // Update step based on status
            const statusToStep = {
              "queued": 1,
              "extracting": 1,
              "analysing": 2,
              "summarising": 3,
              "generating_report": 4,
              "complete": 5,
              "error": 5
            };
            const step = statusToStep[currentDoc.status] || 1;
            setProcessingStep(step);

            // Add logs dynamically
            const nowStr = new Date().toLocaleTimeString();
            if (currentDoc.status === "extracting") {
              setSystemLogs(prev => {
                if (!prev.includes(`[${nowStr}] Decrypting secure PDF text layer...`)) {
                  return [...prev, `[${nowStr}] Decrypting secure PDF text layer...`];
                }
                return prev;
              });
            } else if (currentDoc.status === "analysing") {
              setSystemLogs(prev => {
                if (!prev.includes(`[${nowStr}] Scanning for encumbrance inconsistencies...`)) {
                  return [...prev, `[${nowStr}] Scanning for encumbrance inconsistencies...`];
                }
                return prev;
              });
            } else if (currentDoc.status === "summarising") {
              setSystemLogs(prev => {
                if (!prev.includes(`[${nowStr}] Cataloging survey numbers (104/A, 104/B)...`)) {
                  return [...prev, `[${nowStr}] Cataloging survey numbers (104/A, 104/B)...`];
                }
                return prev;
              });
            } else if (currentDoc.status === "generating_report") {
              setSystemLogs(prev => {
                if (!prev.includes(`[${nowStr}] Constructing PDF analysis report summary...`)) {
                  return [...prev, `[${nowStr}] Constructing PDF analysis report summary...`];
                }
                return prev;
              });
            }

            if (currentDoc.status === "complete") {
              clearInterval(pollInterval);
              // Fetch latest document list to refresh history
              const listResp = await fetch(`${backendUrl}/api/documents`, {
                headers: { "Authorization": `Bearer ${token}` }
              });
              if (listResp.ok) {
                const listData = await listResp.json();
                setDocuments(listData);
              } else {
                setDocuments(prev => [currentDoc, ...prev.filter(d => d.id !== docId)]);
              }
              setUploading(false);
              setActiveView("dashboard");
            } else if (currentDoc.status === "error") {
              clearInterval(pollInterval);
              setUploading(false);
              alert(`Analysis Failed: ${currentDoc.error_message || "Unknown error occurred"}`);
              setSelectedDoc(null);
            }
          }
        } catch (pollErr) {
          console.warn("Polling error:", pollErr);
        }

        // Safeguard timeout (100 seconds)
        if (pollCount > 50) {
          clearInterval(pollInterval);
          setUploading(false);
          alert("Analysis timed out. Please check recent history or retry.");
          setSelectedDoc(null);
        }
      }, 2000);

    } catch (err) {
      console.warn("Backend upload failed, starting simulated offline pipeline:", err);
      // Fallback to offline simulation
      const mockDoc = {
        id: "doc-mock-" + Math.random().toString(36).substr(2, 9),
        filename: uploadedFile.name,
        status: "processing",
        created_at: new Date().toISOString(),
        analysis_mode: analysisMode,
        analysis_results: null
      };
      setSelectedDoc(mockDoc);

      setTimeout(() => {
        const mockResults = {
          transactions: [
            { entry_number: "1", date: "12-05-2021", year: 2021, transaction_type: "Sale Deed", parties: [{ name: "Rajesh Rao", role: "Seller" }, { name: "Anand Sen", role: "Buyer" }], survey_number: "101/4", property_description: "Residential Plot 15, Area 1500 sqft", amount: "₹30,00,000" },
            { entry_number: "2", date: "19-10-2023", year: 2023, transaction_type: "Mortgage", parties: [{ name: "Anand Sen", role: "Mortgagor" }, { name: "SBI Bank", role: "Mortgagee" }], survey_number: "101/4", property_description: "SBI Mortgage loan", amount: "₹20,00,000" },
            { entry_number: "3", date: "15-02-2025", year: 2025, transaction_type: "Sale Deed", parties: [{ name: "Vikram Shah", role: "Seller" }, { name: "Priya Nair", role: "Buyer" }], survey_number: "101/4", property_description: "Residential Plot 15, Area 1500 sqft", amount: "₹55,00,000" }
          ],
          ownership_chain: [
            { transaction_id: "1", from_party: "Rajesh Rao", to_party: "Anand Sen", year: 2021, status: "valid" },
            { transaction_id: "3", from_party: "Vikram Shah", to_party: "Priya Nair", year: 2025, status: "gap_detected" }
          ],
          anomalies: [
            { type: "encumbrance_anomaly", severity: "high", year: 2023, entry_number: "2", description: "SBI home loan mortgage remains active. No Release Deed found in records.", recommendation: "Verify with seller if loan is closed and register a Discharge Deed." },
            { type: "incorrect_ownership_transfer", severity: "high", year: 2025, entry_number: "3", description: "Vikram Shah sold the property to Priya Nair, but the last recorded buyer was Anand Sen. Vikram's source of title is missing.", recommendation: "Check if there is an unrecorded deed between Anand Sen and Vikram Shah." }
          ],
          summary: {
            total_transactions: 3,
            missing_entries_count: 1,
            duplicate_entries_count: 0,
            ownership_issues_count: 1,
            encumbrance_anomalies_count: 1,
            health_score: 50,
            year_wise_distribution: [
              { year: 2021, anomaly_count: 0 },
              { year: 2023, anomaly_count: 1 },
              { year: 2025, anomaly_count: 1 }
            ]
          }
        };

        // Translate if regional language
        if (extractionLang !== "English") {
          mockResults.anomalies.forEach(a => {
            a.description = `[Translated to ${extractionLang}] ` + a.description;
            a.recommendation = `[Translated to ${extractionLang}] ` + a.recommendation;
          });
        }

        mockDoc.status = "complete";
        mockDoc.health_score = 50;
        mockDoc.analysis_results = mockResults;

        setSelectedDoc({ ...mockDoc });
        setDocuments(prev => [mockDoc, ...prev]);
        setUploading(false);
        setActiveView("dashboard");
      }, 12000);
    }
  };

  const handleSelectRecentDoc = async (doc) => {
    if (doc.analysis_results) {
      setSelectedDoc(doc);
      setActiveView("dashboard");
    } else {
      // Fetch full details from backend
      try {
        const response = await fetch(`${backendUrl}/api/documents/${doc.id}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
          const fullDoc = await response.json();
          setSelectedDoc(fullDoc);
          setActiveView("dashboard");
        } else {
          throw new Error("Failed to fetch document details");
        }
      } catch (err) {
        console.error(err);
        setSelectedDoc(doc);
        setActiveView("dashboard");
      }
    }
  };

  const getHealthZoneClass = (score) => {
    if (score < 40) return { name: "High Risk", color: "#dc2626", bg: "rgba(220, 38, 38, 0.06)", border: "rgba(220, 38, 38, 0.15)" };
    if (score < 70) return { name: "Review Required", color: "#d97706", bg: "rgba(217, 119, 6, 0.06)", border: "rgba(217, 119, 6, 0.15)" };
    return { name: "Low Risk", color: "#059669", bg: "rgba(5, 150, 105, 0.06)", border: "rgba(5, 150, 105, 0.15)" };
  };

  const isYearLocked = (year) => {
    if (user?.subscription_status === "premium" || user?.role === "admin") return false;
    return (2026 - year) > 2; // Lock > 3 years
  };

  const getModalAnomalies = () => {
    if (!selectedDoc?.analysis_results?.anomalies) return [];
    const anomalies = selectedDoc.analysis_results.anomalies;
    
    if (modalType === 'missing') return anomalies.filter(a => a.type.includes('missing') || a.type.includes('incorrect_ownership_transfer'));
    if (modalType === 'duplicate') return anomalies.filter(a => a.type.includes('duplicate'));
    if (modalType === 'ownership') return anomalies.filter(a => a.type.includes('ownership') || a.type.includes('incorrect_ownership_transfer'));
    if (modalType === 'encumbrance') return anomalies.filter(a => a.type.includes('encumbrance'));
    if (modalType === 'year_drilldown' && drilldownYear) return anomalies.filter(a => a.year === drilldownYear);
    return [];
  };

  const results = selectedDoc?.analysis_results || null;
  const summary = results?.summary || null;

  return (
    <div className="bg-[#f4f6f9] text-slate-900 font-sans min-h-screen flex flex-col pb-16 md:pb-0">
      {/* TopNavBar */}
      <header className="flex justify-between items-center px-6 py-2.5 w-full sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 no-print shadow-sm">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-orange-500 text-2xl font-bold animate-spin-slow">gavel</span>
          <span className="font-display text-lg font-bold text-slate-900 font-rajdhani tracking-wider uppercase">EC Analyser</span>
        </div>
        
        {/* Desktop nav tabs */}
        <nav className="hidden md:flex items-center gap-7">
          <button 
            onClick={() => setActiveView("dashboard")} 
            className={`font-semibold text-xs uppercase tracking-wider transition-all duration-150 pb-1 border-b-2 ${activeView === "dashboard" ? "text-slate-900 border-orange-500" : "text-slate-400 border-transparent hover:text-slate-700"}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => { setSelectedDoc(null); setActiveView("upload"); }} 
            className={`font-semibold text-xs uppercase tracking-wider transition-all duration-150 pb-1 border-b-2 ${activeView === "upload" ? "text-slate-900 border-orange-500" : "text-slate-400 border-transparent hover:text-slate-700"}`}
          >
            Upload
          </button>
          <button 
            onClick={() => setActiveView("history")} 
            className={`font-semibold text-xs uppercase tracking-wider transition-all duration-150 pb-1 border-b-2 ${activeView === "history" ? "text-slate-900 border-orange-500" : "text-slate-400 border-transparent hover:text-slate-700"}`}
          >
            My Documents
          </button>
          {user?.role === "admin" && (
            <button 
              onClick={() => router.push("/admin")} 
              className="text-slate-400 hover:text-slate-700 font-semibold text-xs uppercase tracking-wider transition-all duration-150 pb-1 border-b-2 border-transparent"
            >
              Admin Portal
            </button>
          )}
          <button 
            onClick={() => router.push("/subscription")} 
            className="text-slate-400 hover:text-slate-700 font-semibold text-xs uppercase tracking-wider transition-all duration-150 pb-1 border-b-2 border-transparent"
          >
            Subscription
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <select 
            value={locale} 
            onChange={(e) => changeLanguage(e.target.value)}
            className="bg-white text-slate-600 hover:text-slate-900 transition-colors px-2.5 py-1 text-xs rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="en">🇺🇸 EN</option>
            <option value="ta">🇮🇳 தமிழ்</option>
            <option value="hi">🇮🇳 हिन्दी</option>
            <option value="te">🇮🇳 తెలుగు</option>
            <option value="kn">🇮🇳 ಕನ್ನಡ</option>
            <option value="mr">🇮🇳 मराठी</option>
          </select>
          <button onClick={() => router.push("/subscription")} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-label-bold text-[10px] uppercase tracking-wider px-4 py-1.5 rounded-full hover:shadow-md transition-all active:scale-95 duration-150 font-bold">
            Upgrade
          </button>
          <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-200 cursor-pointer hover:border-orange-500 transition-colors shadow-sm" onClick={() => setActiveView("settings")} title="View Settings">
            <img alt="User profile avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9nB02SZkUx9k8nlL0erM9-18vyK81JIHPfP3TNt_NPD7Qf-BQH-ojeFdHTNOpeitkYUMLUzc1bc0BQYSwxSIFaxwaGjl9Y_aZgB6iSnqRScCxrbprc_hLbpHhKVSXWtNnPSg9h_BC-fIQR8kHrg_GffEIiSjUXK_cHgVLG3fgajrfWWi6n83aKLfMFWFxUe3983ypb4rnSrwjUOegc2uWhKXZwNfyoljf9Dx94MVE_YAJHcPAyrTBLztd_O7y-okNUMo6dFdENtTr"/>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="w-full mx-auto py-8 px-6 flex-grow pb-24 max-w-7xl animate-fade-in">

        {/* --- View 1: UPLOAD PAGE --- */}
        {activeView === "upload" && (!selectedDoc || selectedDoc.status === "complete" || selectedDoc.status === "error") && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <section className="glass-card p-8 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-orange-500 to-amber-500"></div>
              
              <header className="text-center md:text-left">
                <h1 className="font-display text-2xl text-slate-900 font-extrabold font-rajdhani uppercase tracking-wide">Upload your EC document</h1>
                <p className="font-body-sm text-xs text-slate-500 mt-1">Provide the Encumbrance Certificate for automated legal extraction.</p>
              </header>

              {/* Upload Drop Zone */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById("fileInput").click()}
                className="dropzone border-2 border-dashed border-slate-300 rounded-2xl p-10 flex flex-col items-center justify-center bg-slate-50 hover:bg-white hover:border-orange-500 transition-all cursor-pointer group shadow-inner"
              >
                <input id="fileInput" type="file" accept=".pdf" onChange={handleFileInput} className="hidden" />
                <div className="mb-3 text-orange-500 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[48px]">cloud_upload</span>
                </div>
                <p className="font-label-bold text-sm text-slate-800 font-bold">Click or drag file to upload</p>
                <p className="font-body-sm text-xs text-slate-400 mt-1">PDF format preferred (max 20MB)</p>
              </div>

              {uploadError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3.5 rounded-xl text-xs text-red-700 font-medium animate-fade-in">
                  {uploadError}
                </div>
              )}

              {/* Warning Notice Box */}
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex gap-3 items-start animate-pulse-soft">
                <span className="material-symbols-outlined text-orange-600 text-lg">warning</span>
                <p className="font-body-sm text-xs text-orange-800 leading-tight">
                  <strong>Notice:</strong> Scanned or image-based PDFs are not supported. Please ensure your EC is a digitally generated PDF for accurate analysis.
                </p>
              </div>

              {/* Config Options & File Preview */}
              {uploadedFile && (
                <div className="space-y-5 pt-5 border-t border-slate-100 animate-fade-in">
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                    <div className="flex items-center gap-2.5 text-slate-800">
                      <span className="material-symbols-outlined text-slate-500 text-[20px]">description</span>
                      <span className="font-mono text-xs font-semibold max-w-[280px] truncate">{uploadedFile.name}</span>
                    </div>
                    <button onClick={() => setUploadedFile(null)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Locked Year range */}
                    <div className="space-y-1">
                      <label className="font-label-bold text-xs text-slate-600 block font-bold">Year Range</label>
                      <div className="relative">
                        <select className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 cursor-not-allowed opacity-80 outline-none" disabled>
                          <option>Last 3 Years (Free Tier)</option>
                        </select>
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-sm">lock</span>
                      </div>
                    </div>

                    {/* Language selector */}
                    <div className="space-y-1">
                      <label className="font-label-bold text-xs text-slate-600 block font-bold">Extraction Language</label>
                      <select 
                        value={extractionLang}
                        onChange={(e) => setExtractionLang(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all cursor-pointer"
                      >
                        <option>English</option>
                        <option>Tamil (தமிழ்)</option>
                        <option>Hindi (हिन्दी)</option>
                        <option>Telugu (తెలుగు)</option>
                        <option>Kannada (ಕನ್ನಡ)</option>
                        <option>Marathi (મરાठी)</option>
                      </select>
                    </div>

                    {/* Mode selection (auto / standard / multi-agent) */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="font-label-bold text-xs text-slate-600 block font-bold">Parsing Engine Mode</label>
                      {user?.subscription_status === "free" ? (
                        /* Free tier: locked to Standard */
                        <div className="relative">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="py-2 px-3 text-xs text-center border rounded-xl font-bold border-slate-200 bg-slate-100 text-slate-400 opacity-60 flex items-center justify-center gap-1">
                              Auto
                              <span className="material-symbols-outlined text-[12px]">lock</span>
                            </div>
                            <div className="py-2 px-3 text-xs text-center border rounded-xl font-bold border-orange-500 bg-orange-50/20 text-orange-700 flex items-center justify-center">
                              Standard
                            </div>
                            <div className="py-2 px-3 text-xs text-center border rounded-xl font-bold border-slate-200 bg-slate-100 text-slate-400 opacity-60 flex items-center justify-center gap-1">
                              Multi-Agent
                              <span className="material-symbols-outlined text-[12px]">lock</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-orange-500">info</span>
                            Free tier uses Standard mode only. <button onClick={() => router.push("/subscription")} className="text-orange-500 font-bold hover:underline">Upgrade to Premium</button> for Auto & Multi-Agent modes.
                          </p>
                        </div>
                      ) : (
                        /* Premium tier: all 3 modes available */
                        <div>
                          <div className="grid grid-cols-3 gap-2.5">
                            <button 
                              onClick={() => setAnalysisMode("auto")}
                              className={`py-2 px-3 text-xs border rounded-xl font-bold transition-all relative ${
                                analysisMode === "auto" 
                                  ? "border-orange-500 bg-orange-50/30 text-orange-700 ring-2 ring-orange-100" 
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              <span className="text-[8px] font-bold text-orange-600 absolute -top-2 left-2 bg-white px-1 border border-orange-200 rounded-md">★ AUTO</span>
                              Auto
                            </button>
                            <button 
                              onClick={() => setAnalysisMode("standard")}
                              className={`py-2 px-3 text-xs border rounded-xl font-bold transition-all ${
                                analysisMode === "standard" 
                                  ? "border-orange-500 bg-orange-50/30 text-orange-700 ring-2 ring-orange-100" 
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              Standard
                            </button>
                            <button 
                              onClick={() => setAnalysisMode("multi_agent")}
                              className={`py-2 px-3 text-xs border rounded-xl font-bold transition-all ${
                                analysisMode === "multi_agent" 
                                  ? "border-orange-500 bg-orange-50/30 text-orange-700 ring-2 ring-orange-100" 
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              Multi-Agent
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2 font-medium">
                            {analysisMode === "auto" && "Auto mode picks the best engine based on your document's complexity."}
                            {analysisMode === "standard" && "Single-pass AI analysis. Fast and cost-effective for simple ECs."}
                            {analysisMode === "multi_agent" && "Multi-step pipeline with specialized agents. Thorough analysis for complex documents."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Start CTA */}
              <button 
                onClick={handleStartAnalysis}
                disabled={!uploadedFile || uploading}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-headline-md text-sm py-3.5 rounded-xl hover:shadow-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed uppercase font-bold font-rajdhani tracking-wider"
              >
                {uploading ? "Uploading..." : "Start Analysis"}
              </button>
            </section>

            {/* Recent Analyses List */}
            <section className="mt-8">
              <h2 className="font-label-bold text-xs text-slate-400 mb-3.5 uppercase tracking-wider font-bold">Recent Analyses</h2>
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div 
                    key={doc.id}
                    onClick={() => handleSelectRecentDoc(doc)}
                    className="bg-white border border-slate-200/60 rounded-xl p-4 flex items-center justify-between hover:border-orange-300 shadow-sm transition-all hover:translate-x-1 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600 group-hover:text-orange-500 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">analytics</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">{doc.filename}</p>
                        <p className="font-mono text-[10px] text-slate-400 uppercase mt-0.5">
                          {doc.status === "processing" ? "Analyzing..." : `Health: ${doc.health_score || 0}/100 • `}
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div 
                        className="font-label-bold text-[10px] px-3 py-1 rounded-lg border font-bold"
                        style={{
                          backgroundColor: getHealthZoneClass(doc.health_score || 50).bg,
                          color: getHealthZoneClass(doc.health_score || 50).color,
                          borderColor: getHealthZoneClass(doc.health_score || 50).border
                        }}
                      >
                        {doc.status === "processing" ? "Processing" : `Health: ${doc.health_score || 0}/100`}
                      </div>
                      <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 transition-transform">chevron_right</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* --- View 2: PROCESSING / PROGRESS PAGE --- */}
        {selectedDoc && selectedDoc.status !== "complete" && selectedDoc.status !== "error" && (
          <div className="flex flex-col items-center py-6 px-6 max-w-xl mx-auto">
            <div className="w-full">
              {/* Main Content Card */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-xl p-8 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-orange-500 to-amber-500"></div>
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(#0f172a 0.5px, transparent 0.5px)", backgroundSize: "20px 20px" }}></div>
                
                <div className="relative z-10">
                  <header className="text-center mb-8">
                    <h1 className="font-display text-2xl text-slate-900 font-extrabold font-rajdhani uppercase tracking-wide mb-1">Analysing document</h1>
                    <p className="text-slate-400 text-xs italic">Please wait while our legal engine checks property indexes.</p>
                  </header>

                  {/* Vertical Step Tracker */}
                  <div className="flex flex-col gap-0 mb-8 max-w-sm mx-auto">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${processingStep > 1 ? "bg-emerald-500 text-white shadow-sm" : "bg-orange-500 text-white shadow-md animate-pulse"}`}>
                          {processingStep > 1 ? <span className="material-symbols-outlined text-[16px] font-bold">check</span> : "1"}
                        </div>
                        <div className={`w-0.5 h-10 ${processingStep > 1 ? "bg-emerald-500" : "bg-slate-200 border-l border-dashed"}`}></div>
                      </div>
                      <div className="py-1">
                        <span className="font-label-bold text-[9px] text-slate-400 uppercase font-bold tracking-wider">Step 1</span>
                        <h3 className={`text-sm font-semibold ${processingStep === 1 ? "text-slate-800" : "text-slate-400"}`}>Document Decryption</h3>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${processingStep > 2 ? "bg-emerald-500 text-white shadow-sm" : processingStep === 2 ? "bg-orange-500 text-white shadow-md animate-pulse" : "bg-slate-100 text-slate-400 border border-slate-200"}`}>
                          {processingStep > 2 ? <span className="material-symbols-outlined text-[16px] font-bold">check</span> : "2"}
                        </div>
                        <div className={`w-0.5 h-10 ${processingStep > 2 ? "bg-emerald-500" : "bg-slate-200 border-l border-dashed"}`}></div>
                      </div>
                      <div className="py-1">
                        <span className="font-label-bold text-[9px] text-slate-400 uppercase font-bold tracking-wider">Step 2</span>
                        <h3 className={`text-sm font-semibold ${processingStep === 2 ? "text-slate-800" : "text-slate-400"}`}>Metadata Parsing</h3>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                          processingStep > 3 ? "bg-emerald-500 text-white" : 
                          processingStep === 3 ? "bg-orange-500 text-white animate-pulse" : 
                          "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}>
                          {processingStep > 3 ? <span className="material-symbols-outlined text-[16px] font-bold">check</span> : "3"}
                        </div>
                        <div className={`w-0.5 h-10 ${processingStep > 3 ? "bg-emerald-500" : "bg-slate-200 border-l border-dashed"}`}></div>
                      </div>
                      <div className="py-1">
                        <span className="font-label-bold text-[9px] text-slate-400 uppercase font-bold tracking-wider">Step 3</span>
                        <h3 className={`text-sm font-semibold ${processingStep === 3 ? "text-slate-800" : "text-slate-400"}`}>Detecting anomalies</h3>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                          processingStep > 4 ? "bg-emerald-500 text-white" : 
                          processingStep === 4 ? "bg-orange-500 text-white animate-pulse" : 
                          "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}>
                          {processingStep > 4 ? <span className="material-symbols-outlined text-[16px] font-bold">check</span> : "4"}
                        </div>
                        <div className={`w-0.5 h-10 ${processingStep > 4 ? "bg-emerald-500" : "bg-slate-200 border-l border-dashed"}`}></div>
                      </div>
                      <div className="py-1">
                        <span className="font-label-bold text-[9px] text-slate-400 uppercase font-bold tracking-wider">Step 4</span>
                        <h3 className={`text-sm font-semibold ${processingStep === 4 ? "text-slate-800" : "text-slate-400"}`}>Chain of Title Verification</h3>
                      </div>
                    </div>

                    {/* Step 5 */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                          processingStep === 5 ? "bg-orange-500 text-white animate-pulse" : 
                          "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}>
                          {processingStep === 5 ? <span className="spinner-saffron border-white border-t-white w-4 h-4 mt-0.5"></span> : "5"}
                        </div>
                      </div>
                      <div className="py-1">
                        <span className="font-label-bold text-[9px] text-slate-400 uppercase font-bold tracking-wider">Step 5</span>
                        <h3 className={`text-sm font-semibold ${processingStep === 5 ? "text-slate-800" : "text-slate-400"}`}>Report Generation</h3>
                      </div>
                    </div>
                  </div>

                  {/* Live Log Box */}
                  <div className="bg-[#0f172a] rounded-xl p-4.5 mb-6 border border-slate-800 shadow-inner overflow-hidden font-mono text-[11px] text-[#34d399] leading-relaxed">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                      <span className="text-[9px] tracking-wider text-slate-500 font-bold uppercase">SYSTEM_PIPELINE_FEED</span>
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/30"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/30"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/30"></div>
                      </div>
                    </div>
                    <div ref={logBoxRef} className="h-32 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
                      {systemLogs.map((log, i) => (
                        <div key={i} className="opacity-90">{log}</div>
                      ))}
                      <div className="text-white flex items-center gap-2">
                        <span className="animate-pulse">_</span>
                        <span className="text-slate-400 italic">Processing pipeline executing...</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="flex flex-col items-center gap-3.5">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 text-xs">
                      <span className="material-symbols-outlined text-orange-500 text-base">schedule</span>
                      <span>Estimated time remaining: ~{processingTimeRemaining} seconds</span>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedDoc(null);
                        setUploading(false);
                      }} 
                      className="text-red-500 hover:text-red-700 font-label-bold text-xs font-bold underline transition-colors uppercase tracking-wider"
                    >
                      Cancel analysis
                    </button>
                  </div>
                </div>
              </div>

              {/* Contextual Tip */}
              <div className="mt-6 flex gap-3.5 items-start bg-orange-50 border border-orange-100 rounded-xl p-4">
                <span className="material-symbols-outlined text-orange-600 mt-0.5">info</span>
                <div>
                  <h4 className="font-label-bold text-xs text-orange-800 mb-1 uppercase font-bold tracking-wide">Expert Tip</h4>
                  <p className="text-orange-950 text-xs leading-normal">
                    While the analysis is running, you can prepare the previous registration documents for a more detailed chain-of-title comparison in the next step.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Empty State for Dashboard when no document is loaded --- */}
        {activeView === "dashboard" && (!selectedDoc || selectedDoc.status !== "complete") && (
          <div className="max-w-md mx-auto text-center py-12 px-6">
            <div className="glass-card p-8 flex flex-col items-center">
              <div className="h-16 w-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center mb-6 animate-pulse-soft">
                <span className="material-symbols-outlined text-[32px] text-orange-500">layout_dashboard</span>
              </div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 font-rajdhani uppercase tracking-wider mb-2">
                {t("noDocSelected")}
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                {t("noDocSelectedDesc")}
              </p>
              <div className="flex gap-3.5 w-full">
                <button 
                  onClick={() => setActiveView("upload")} 
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition-all shadow-md active:scale-[0.98] duration-150 font-rajdhani"
                >
                  {t("goToUpload")}
                </button>
                <button 
                  onClick={() => setActiveView("history")} 
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition-all shadow-sm active:scale-[0.98] duration-150 font-rajdhani"
                >
                  {t("viewHistory")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- View 3: COMPLETED REPORT DASHBOARD --- */}
        {activeView === "dashboard" && selectedDoc?.status === "complete" && results && (
          <div className="space-y-6">
            {/* Header controls */}
            <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center no-print">
              <div>
                <h2 className="text-xl text-slate-900 font-extrabold uppercase font-rajdhani tracking-wide">Analysis Results Dashboard</h2>
                <p className="text-xs text-slate-500 mt-0.5">Document File: <span className="font-mono text-slate-800">{selectedDoc.filename}</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={handlePrintReport} className="btn border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5">
                  <Printer size={14} className="text-slate-500" />
                  Print Report
                </button>
                <button onClick={handleDownloadReport} className="btn bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all hover:-translate-y-0.5 active:scale-95 duration-100">
                  <Download size={14} />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Disclaimer box */}
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-xs text-red-800 leading-relaxed shadow-sm">
              <strong className="block text-sm mb-1.5 font-bold text-red-900">{t("disclaimerTitle")}</strong>
              {t("disclaimerText")}
            </div>

            {/* Health Score Gauge and Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* SVG Health Gauge */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center col-span-1 shadow-md">
                <h3 className="text-xs text-slate-400 uppercase font-extrabold tracking-wider mb-5">
                  {t("healthScore")}
                </h3>
                
                {/* SVG Semi-Circular Gauge Component */}
                <div className="relative flex items-center justify-center h-28 w-44 mx-auto mb-4 overflow-hidden">
                  <svg className="w-full h-full transform -rotate-180" viewBox="0 0 100 50">
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="9" strokeLinecap="round" />
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" 
                      stroke={getHealthZoneClass(summary?.health_score || 0).color} 
                      strokeWidth="9" 
                      strokeLinecap="round"
                      strokeDasharray={`${Math.PI * 40}`}
                      strokeDashoffset={`${Math.PI * 40 * (1 - (summary?.health_score || 0) / 100)}`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute bottom-0 text-center flex flex-col items-center justify-center">
                    <span className="text-4xl font-extrabold font-display leading-none tracking-tight" style={{ color: getHealthZoneClass(summary?.health_score || 0).color }}>
                      {summary?.health_score || 0}
                    </span>
                  </div>
                </div>

                <span 
                  className="px-3.5 py-1 rounded-lg text-xs font-bold border"
                  style={{
                    backgroundColor: getHealthZoneClass(summary?.health_score || 0).bg,
                    color: getHealthZoneClass(summary?.health_score || 0).color,
                    borderColor: getHealthZoneClass(summary?.health_score || 0).border
                  }}
                >
                  {getHealthZoneClass(summary?.health_score || 0).name}
                </span>
              </div>

              {/* Summary Cards tiles */}
              <div className="grid grid-cols-2 gap-4 col-span-2">
                <div className="metric-tile blue">
                  <div className="metric-header">
                    <span>Transactions</span>
                    <FileText size={15} className="text-blue-500" />
                  </div>
                  <div className="metric-val">{summary?.total_transactions || 0}</div>
                </div>

                <div onClick={() => setModalType('missing')} className={`metric-tile ${summary?.missing_entries_count > 0 ? "amber animate-pulse-soft" : "green"}`}>
                  <div className="metric-header">
                    <span>{t("missingEntries")}</span>
                    <AlertTriangle size={15} className={summary?.missing_entries_count > 0 ? "text-orange-500" : "text-emerald-500"} />
                  </div>
                  <div className="metric-val">{summary?.missing_entries_count || 0}</div>
                </div>

                <div onClick={() => setModalType('ownership')} className={`metric-tile ${summary?.ownership_issues_count > 0 ? "red animate-pulse-soft" : "green"}`}>
                  <div className="metric-header">
                    <span>Ownership Gaps</span>
                    <ShieldAlert size={15} className={summary?.ownership_issues_count > 0 ? "text-red-500" : "text-emerald-500"} />
                  </div>
                  <div className="metric-val">{summary?.ownership_issues_count || 0}</div>
                </div>

                <div onClick={() => setModalType('encumbrance')} className={`metric-tile ${summary?.encumbrance_anomalies_count > 0 ? "red animate-pulse-soft" : "green"}`}>
                  <div className="metric-header">
                    <span>Active Mortgages</span>
                    <ShieldAlert size={15} className={summary?.encumbrance_anomalies_count > 0 ? "text-red-500" : "text-emerald-500"} />
                  </div>
                  <div className="metric-val">{summary?.encumbrance_anomalies_count || 0}</div>
                </div>
              </div>

            </div>

            {/* Custom timeline bar chart */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-md no-print">
              <h3 className="text-xs text-slate-400 font-extrabold uppercase tracking-wider mb-4">
                {t("anomaliesTimeline")}
              </h3>

              <div className="chart-container">
                {summary?.year_wise_distribution?.map((dist) => {
                  const locked = isYearLocked(dist.year);
                  const maxAnoms = Math.max(...summary.year_wise_distribution.map(d => d.anomaly_count), 1);
                  const heightPct = `${(dist.anomaly_count / maxAnoms) * 80 + 5}%`;

                  return (
                    <div 
                      key={dist.year} 
                      className="chart-bar-wrapper" 
                      onClick={() => {
                        if (locked) {
                          setModalType('locked_prompt');
                        } else {
                          setDrilldownYear(dist.year);
                          setModalType('year_drilldown');
                        }
                      }}
                    >
                      <div className="chart-bar" style={{ 
                        height: heightPct,
                        background: locked ? "#cbd5e1" : 
                                    dist.anomaly_count > 0 ? "linear-gradient(to top, #dc2626, #f97316)" : 
                                    "linear-gradient(to top, #059669, #34d399)"
                      }}>
                        {locked && (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            <Lock size={12} className="text-slate-600" />
                          </div>
                        )}
                        <div className="chart-tooltip">
                          {locked ? "Locked" : `${dist.anomaly_count} Anomalies`}
                        </div>
                      </div>
                      <span className="chart-label font-mono">{dist.year}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed tables listings */}
            <div className="space-y-6">
              
              {/* Anomalies List */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-md">
                <h3 className="text-sm font-extrabold text-slate-900 font-rajdhani uppercase tracking-wide mb-4">Anomalies & Legal Findings</h3>
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: "10%" }}>Year</th>
                        <th style={{ width: "10%" }}>Entry</th>
                        <th style={{ width: "15%" }}>Severity</th>
                        <th style={{ width: "40%" }}>Description</th>
                        <th style={{ width: "25%" }}>Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.anomalies?.map((anom, i) => (
                        <tr key={i}>
                          <td className="font-mono text-xs font-semibold">{anom.year}</td>
                          <td className="font-mono text-xs font-semibold">#{anom.entry_number}</td>
                          <td>
                            <span className={`badge ${anom.severity.toLowerCase() === 'high' ? 'badge-high' : anom.severity.toLowerCase() === 'medium' ? 'badge-medium' : 'badge-low'}`}>
                              {anom.severity}
                            </span>
                          </td>
                          <td>
                            {isYearLocked(anom.year) ? (
                              <div className="flex items-center justify-between gap-2.5">
                                <span className="blurred-content select-none">{anom.description}</span>
                                <button 
                                  onClick={() => setModalType('locked_prompt')} 
                                  className="text-orange-500 hover:text-orange-600 p-1.5 rounded-lg hover:bg-slate-50 transition-all no-print"
                                  title="Unlock history"
                                >
                                  <Eye size={14} />
                                </button>
                              </div>
                            ) : (
                              anom.description
                            )}
                          </td>
                          <td>
                            {isYearLocked(anom.year) ? (
                              <div className="flex items-center justify-between gap-2.5">
                                <span className="blurred-content select-none">{anom.recommendation}</span>
                                <button 
                                  onClick={() => setModalType('locked_prompt')} 
                                  className="text-orange-500 hover:text-orange-600 p-1.5 rounded-lg hover:bg-slate-50 transition-all no-print"
                                  title="Unlock history"
                                >
                                  <Eye size={14} />
                                </button>
                              </div>
                            ) : (
                              anom.recommendation
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reconstructed Title Chain */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-md">
                <h3 className="text-sm font-extrabold text-slate-900 font-rajdhani uppercase tracking-wide mb-4">Reconstructed Chain of Title</h3>
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Entry ID</th>
                        <th>From (Seller / Transferor)</th>
                        <th>To (Buyer / Transferee)</th>
                        <th>Year</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.ownership_chain?.map((link, i) => (
                        <tr key={i}>
                          <td className="font-mono text-xs font-semibold">#{link.transaction_id}</td>
                          <td>
                            {isYearLocked(link.year) ? (
                              <div className="flex items-center justify-between gap-2.5">
                                <span className="blurred-content select-none">{link.from_party}</span>
                                <button 
                                  onClick={() => setModalType('locked_prompt')} 
                                  className="text-orange-500 hover:text-orange-600 p-1.5 rounded-lg hover:bg-slate-50 transition-all no-print"
                                  title="Unlock history"
                                >
                                  <Eye size={14} />
                                </button>
                              </div>
                            ) : (
                              link.from_party
                            )}
                          </td>
                          <td>
                            {isYearLocked(link.year) ? (
                              <div className="flex items-center justify-between gap-2.5">
                                <span className="blurred-content select-none">{link.to_party}</span>
                                <button 
                                  onClick={() => setModalType('locked_prompt')} 
                                  className="text-orange-500 hover:text-orange-600 p-1.5 rounded-lg hover:bg-slate-50 transition-all no-print"
                                  title="Unlock history"
                                >
                                  <Eye size={14} />
                                </button>
                              </div>
                            ) : (
                              link.to_party
                            )}
                          </td>
                          <td className="font-mono text-xs font-semibold">{link.year}</td>
                          <td>
                            <span className="badge" style={{
                              backgroundColor: link.status === "valid" ? "rgba(5, 150, 105, 0.08)" : "rgba(220, 38, 38, 0.08)",
                              color: link.status === "valid" ? "var(--success)" : "var(--danger)"
                            }}>
                              {link.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* --- View 4: HISTORY LIST PAGE --- */}
        {activeView === "history" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div>
              <h1 className="font-display text-2xl text-slate-900 font-extrabold uppercase font-rajdhani tracking-wide">Document History Logs</h1>
              <p className="text-xs text-slate-500 mt-1">Review your past uploaded documents and title verification reports.</p>
            </div>
            
            <div className="space-y-3">
              {documents.map((doc) => (
                <div 
                  key={doc.id}
                  onClick={() => handleSelectRecentDoc(doc)}
                  className="bg-white border border-slate-200/60 rounded-xl p-4 flex items-center justify-between hover:border-orange-300 shadow-sm transition-all hover:translate-x-1 cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600 group-hover:text-orange-500 transition-colors">
                      <span className="material-symbols-outlined text-[20px]">analytics</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">{doc.filename}</p>
                      <p className="font-mono text-[10px] text-slate-400 uppercase mt-0.5">Mode: {doc.analysis_mode.replace('_', ' ')} | Date: {new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3.5">
                    <div 
                      className="font-label-bold text-[10px] px-3 py-1 rounded-lg border font-bold"
                      style={{
                        backgroundColor: getHealthZoneClass(doc.health_score).bg,
                        color: getHealthZoneClass(doc.health_score).color,
                        borderColor: getHealthZoneClass(doc.health_score).border
                      }}
                    >
                      Health: {doc.health_score}/100
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- View 5: SETTINGS PAGE --- */}
        {activeView === "settings" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 space-y-6 shadow-xl max-w-2xl mx-auto relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-orange-500 to-amber-500"></div>

            <h1 className="font-display text-2xl text-slate-900 font-extrabold uppercase font-rajdhani tracking-wide border-b border-slate-100 pb-3">Profile & Settings</h1>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">User Identification Code</label>
                <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl font-mono text-xs text-slate-700 select-all">
                  {user?.id || "N/A"}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Registered Phone Number</label>
                <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl text-xs text-slate-800 font-semibold font-mono">
                  {user?.phone || "N/A"}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Membership Plan</label>
                <div className="flex items-center gap-3">
                  <span className={`badge ${user?.subscription_status === 'premium' ? 'badge-medium bg-orange-50 text-orange-600 border border-orange-200' : 'bg-slate-100 text-slate-500'}`}>
                    {user?.subscription_status === 'premium' ? "Premium Plan (Active)" : "Free Plan Access"}
                  </span>
                  {user?.subscription_status !== 'premium' && (
                    <button onClick={() => router.push("/subscription")} className="text-orange-500 hover:text-orange-600 hover:underline text-xs font-bold transition-colors">Upgrade Now</button>
                  )}
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100">
                <button onClick={handleLogout} className="btn bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                  <LogOut size={12} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Navigation Bar (Mobile Only) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 md:hidden bg-white border-t border-slate-200/60 shadow-lg rounded-t-2xl no-print">
        <button 
          onClick={() => setActiveView("dashboard")}
          className={`flex flex-col items-center justify-center p-1.5 transition-all ${activeView === "dashboard" ? "text-orange-500 scale-105" : "text-slate-400"}`}
        >
          <LayoutDashboard size={20} />
          <span className="font-semibold text-[9px] mt-0.5 uppercase tracking-wider">Dashboard</span>
        </button>

        <button 
          onClick={() => { setSelectedDoc(null); setActiveView("upload"); }}
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 transition-all ${activeView === "upload" ? "bg-orange-500 text-white shadow-md" : "text-slate-400"}`}
        >
          <FilePlus size={20} />
          <span className="font-semibold text-[9px] mt-0.5 uppercase tracking-wider">Upload</span>
        </button>

        <button 
          onClick={() => setActiveView("history")}
          className={`flex flex-col items-center justify-center p-1.5 transition-all ${activeView === "history" ? "text-orange-500 scale-105" : "text-slate-400"}`}
        >
          <History size={20} />
          <span className="font-semibold text-[9px] mt-0.5 uppercase tracking-wider">History</span>
        </button>

        <button 
          onClick={() => setActiveView("settings")}
          className={`flex flex-col items-center justify-center p-1.5 transition-all ${activeView === "settings" ? "text-orange-500 scale-105" : "text-slate-400"}`}
        >
          <Settings size={20} />
          <span className="font-semibold text-[9px] mt-0.5 uppercase tracking-wider">Settings</span>
        </button>
      </nav>

      {/* Dialogue Modals */}
      {modalType && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal-content relative overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ padding: "28px" }}>
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-orange-500 to-amber-500"></div>
            
            {modalType === 'locked_prompt' ? (
              <div className="text-center py-4">
                <div className="h-14 w-14 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <Lock size={24} className="text-orange-500" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 font-rajdhani uppercase tracking-wide mb-2">Unlock Historical Records</h3>
                <p className="text-slate-500 text-xs mb-6 leading-relaxed max-w-sm mx-auto">
                  {t("upgradePromptText")}
                </p>
                <div className="flex gap-2.5 justify-center">
                  <button onClick={() => setModalType(null)} className="btn border border-slate-200 hover:bg-slate-50 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 transition-colors">Cancel</button>
                  <button onClick={() => { setModalType(null); router.push("/subscription"); }} className="btn bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-colors active:scale-95">Upgrade for ₹999</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-extrabold text-slate-900 font-rajdhani uppercase tracking-wide">
                    Detailed Findings - {modalType} {drilldownYear ? `(${drilldownYear})` : ''}
                  </h3>
                  <button onClick={() => { setModalType(null); setDrilldownYear(null); }} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                
                <div className="data-table-wrapper" style={{ maxHeight: "350px" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th>Entry</th>
                        <th>Severity</th>
                        <th>Description</th>
                        <th>Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getModalAnomalies().length > 0 ? (
                        getModalAnomalies().map((anom, i) => (
                          <tr key={i}>
                            <td className="font-mono text-xs font-semibold">{anom.year}</td>
                            <td className="font-mono text-xs font-semibold">#{anom.entry_number}</td>
                            <td>
                              <span className={`badge ${anom.severity.toLowerCase() === 'high' ? 'badge-high' : anom.severity.toLowerCase() === 'medium' ? 'badge-medium' : 'badge-low'}`}>
                                {anom.severity}
                              </span>
                            </td>
                            <td>{anom.description}</td>
                            <td>{anom.recommendation}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center text-slate-400 py-8 font-medium">
                            No anomalies recorded in this category.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex justify-end">
                  <button onClick={() => { setModalType(null); setDrilldownYear(null); }} className="btn bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-colors">Close</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
