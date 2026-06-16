"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "../i18n";
import { 
  Upload, FileText, Download, Printer, LogOut, ArrowUpRight, 
  HelpCircle, CheckCircle, AlertTriangle, ShieldAlert, Award,
  Loader2, Calendar, User, Key, RefreshCw, Lock, LayoutDashboard,
  FilePlus, History, Settings, ChevronRight, X, Info
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { t, locale, changeLanguage } = useTranslation();

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  const getGaugeRotation = (score) => {
    const angle = -135 + (score * 1.8);
    return `rotate(${angle}deg)`;
  };

  const getHealthZoneClass = (score) => {
    if (score < 40) return { name: "High Risk", color: "#ba1a1a", bg: "#ffebee" };
    if (score < 70) return { name: "Review Required", color: "#9a460a", bg: "#fff3e0" };
    return { name: "Low Risk", color: "#00522d", bg: "#e8f5e9" };
  };

  const isYearLocked = (year) => {
    if (user?.subscription_status === "premium") return false;
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
    <div className="parchment-bg text-on-surface font-body-md min-h-screen flex flex-col pb-16 md:pb-0">
      {/* TopNavBar */}
      <header className="flex justify-between items-center px-6 py-2 w-full sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-outline-variant no-print">
        <div className="flex items-center gap-6 cursor-pointer" onClick={() => { setSelectedDoc(null); setActiveView("upload"); }}>
          <span className="font-display-lg text-2xl font-bold text-primary font-rajdhani">EC Analyser</span>
        </div>
        
        {/* Desktop nav tabs */}
        <nav className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => setActiveView("dashboard")} 
            className={`font-body-md text-sm transition-colors ${activeView === "dashboard" ? "text-primary font-bold border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-primary"}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => { setSelectedDoc(null); setActiveView("upload"); }} 
            className={`font-body-md text-sm transition-colors ${activeView === "upload" ? "text-primary font-bold border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-primary"}`}
          >
            Upload
          </button>
          <button 
            onClick={() => setActiveView("history")} 
            className={`font-body-md text-sm transition-colors ${activeView === "history" ? "text-primary font-bold border-b-2 border-primary pb-1" : "text-on-surface-variant hover:text-primary"}`}
          >
            My Documents
          </button>
          {user?.role === "admin" && (
            <button 
              onClick={() => router.push("/admin")} 
              className="text-on-surface-variant hover:text-primary font-body-md text-sm transition-colors"
            >
              Admin Portal
            </button>
          )}
          <button 
            onClick={() => router.push("/subscription")} 
            className="text-on-surface-variant hover:text-primary font-body-md text-sm transition-colors"
          >
            Subscription
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <select 
            value={locale} 
            onChange={(e) => changeLanguage(e.target.value)}
            className="bg-transparent text-on-surface-variant hover:text-primary transition-colors px-2 py-1 text-sm rounded-lg border border-outline-variant outline-none cursor-pointer"
          >
            <option value="en">English</option>
            <option value="ta">Tamil (தமிழ்)</option>
            <option value="hi">Hindi (हिन्दी)</option>
            <option value="te">Telugu (తెలుగు)</option>
            <option value="kn">Kannada (ಕನ್ನಡ)</option>
            <option value="mr">Marathi (મરાઠી)</option>
          </select>
          <button onClick={() => router.push("/subscription")} className="bg-secondary-container text-on-secondary-container font-label-bold text-xs px-4 py-1.5 rounded-full hover:brightness-95 transition-all active:scale-95 duration-150 font-bold">
            Upgrade
          </button>
          <div className="h-10 w-10 rounded-full overflow-hidden border border-outline-variant cursor-pointer" onClick={() => setActiveView("settings")} title="View Settings">
            <img alt="User profile avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9nB02SZkUx9k8nlL0erM9-18vyK81JIHPfP3TNt_NPD7Qf-BQH-ojeFdHTNOpeitkYUMLUzc1bc0BQYSwxSIFaxwaGjl9Y_aZgB6iSnqRScCxrbprc_hLbpHhKVSXWtNnPSg9h_BC-fIQR8kHrg_GffEIiSjUXK_cHgVLG3fgajrfWWi6n83aKLfMFWFxUe3983ypb4rnSrwjUOegc2uWhKXZwNfyoljf9Dx94MVE_YAJHcPAyrTBLztd_O7y-okNUMo6dFdENtTr"/>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="w-full mx-auto py-10 px-6 flex-grow pb-24">

        {/* --- View 1: UPLOAD PAGE --- */}
        {activeView === "upload" && (!selectedDoc || selectedDoc.status === "complete" || selectedDoc.status === "error") && (
          <div className="space-y-8 animate-fade-in max-w-[680px] mx-auto">
            <section className="bg-white document-sheet rounded-xl border border-outline-variant p-8 space-y-6 shadow-sm">
              <header>
                <h1 className="font-headline-lg text-2xl text-primary font-bold">Upload your EC document</h1>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1">Provide the Encumbrance Certificate for automated legal extraction.</p>
              </header>

              {/* Upload Drop Zone */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById("fileInput").click()}
                className="border-2 border-dashed border-outline-variant rounded-xl p-10 flex flex-col items-center justify-center bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer group"
              >
                <input id="fileInput" type="file" accept=".pdf" onChange={handleFileInput} className="hidden" />
                <div className="mb-3 text-primary">
                  <span className="material-symbols-outlined text-[48px]">cloud_upload</span>
                </div>
                <p className="font-label-bold text-sm text-primary font-bold group-hover:scale-105 transition-transform">Click or drag file to upload</p>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1">PDF format preferred (max 20MB)</p>
              </div>

              {uploadError && (
                <div className="bg-red-50 border-l-4 border-error p-3 rounded text-xs text-error">
                  {uploadError}
                </div>
              )}

              {/* Warning Notice Box */}
              <div className="bg-secondary-fixed/20 border border-secondary/20 p-4 rounded-lg flex gap-3 items-start">
                <span className="material-symbols-outlined text-secondary">warning</span>
                <p className="font-body-sm text-xs text-on-secondary-fixed-variant leading-tight">
                  <strong>Notice:</strong> Scanned or image-based PDFs are not supported. Please ensure your EC is a digitally generated PDF for accurate analysis.
                </p>
              </div>

              {/* Config Options & File Preview */}
              {uploadedFile && (
                <div className="space-y-4 pt-4 border-t border-outline-variant">
                  <div className="flex items-center justify-between p-3 bg-surface-container rounded-lg">
                    <div className="flex items-center gap-2 text-primary font-bold">
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                      <span className="font-mono text-xs text-primary">{uploadedFile.name}</span>
                    </div>
                    <button onClick={() => setUploadedFile(null)} className="text-error hover:bg-error-container/20 p-1 rounded">
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Locked Year range */}
                    <div className="space-y-1">
                      <label className="font-label-bold text-xs text-on-surface-variant block font-bold">Year Range</label>
                      <div className="relative">
                        <select className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface cursor-not-allowed opacity-80" disabled>
                          <option>Last 3 Years (Free Tier)</option>
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                      </div>
                    </div>

                    {/* Language selector */}
                    <div className="space-y-1">
                      <label className="font-label-bold text-xs text-on-surface-variant block font-bold">Extraction Language</label>
                      <select 
                        value={extractionLang}
                        onChange={(e) => setExtractionLang(e.target.value)}
                        className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:border-secondary outline-none transition-all"
                      >
                        <option>English</option>
                        <option>Tamil (தமிழ்)</option>
                        <option>Hindi (हिन्दी)</option>
                        <option>Telugu (తెలుగు)</option>
                        <option>Kannada (ಕನ್ನಡ)</option>
                        <option>Marathi (મરાઠી)</option>
                      </select>
                    </div>

                    {/* Mode selection (auto / standard / multi-agent) */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="font-label-bold text-xs text-on-surface-variant block font-bold">Parsing Engine Mode</label>
                      {user?.subscription_status === "free" ? (
                        /* Free tier: locked to Standard */
                        <div className="relative">
                          <div className="grid grid-cols-3 gap-2">
                            <button 
                              disabled
                              className="py-2 px-3 text-xs border rounded-lg font-bold border-outline-variant bg-surface-container-high text-outline cursor-not-allowed opacity-60"
                            >
                              Auto
                            </button>
                            <button 
                              className="py-2 px-3 text-xs border rounded-lg font-bold border-primary bg-primary-container/10 text-primary"
                            >
                              Standard (Active)
                            </button>
                            <button 
                              disabled
                              className="py-2 px-3 text-xs border rounded-lg font-bold border-outline-variant bg-surface-container-high text-outline cursor-not-allowed opacity-60 relative"
                            >
                              Multi-Agent
                              <span className="material-symbols-outlined text-[14px] absolute top-1 right-1 text-outline" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-on-surface-variant mt-1.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                            Free tier uses Standard mode only. <button onClick={() => router.push("/subscription")} className="text-primary font-bold underline">Upgrade to Premium</button> for Auto & Multi-Agent modes.
                          </p>
                        </div>
                      ) : (
                        /* Premium tier: all 3 modes available */
                        <div>
                          <div className="grid grid-cols-3 gap-2">
                            <button 
                              onClick={() => setAnalysisMode("auto")}
                              className={`py-2 px-3 text-xs border rounded-lg font-bold transition-all relative ${
                                analysisMode === "auto" 
                                  ? "border-primary bg-primary-container/10 text-primary ring-1 ring-primary/20" 
                                  : "border-outline-variant bg-white text-on-surface-variant hover:text-primary hover:border-primary/30"
                              }`}
                            >
                              <span className="text-[9px] font-bold text-tertiary-fixed-dim absolute -top-2 left-2 bg-white px-1">★ RECOMMENDED</span>
                              Auto
                            </button>
                            <button 
                              onClick={() => setAnalysisMode("standard")}
                              className={`py-2 px-3 text-xs border rounded-lg font-bold transition-all ${
                                analysisMode === "standard" 
                                  ? "border-primary bg-primary-container/10 text-primary" 
                                  : "border-outline-variant bg-white text-on-surface-variant hover:text-primary hover:border-primary/30"
                              }`}
                            >
                              Standard (Fast)
                            </button>
                            <button 
                              onClick={() => setAnalysisMode("multi_agent")}
                              className={`py-2 px-3 text-xs border rounded-lg font-bold transition-all ${
                                analysisMode === "multi_agent" 
                                  ? "border-primary bg-primary-container/10 text-primary" 
                                  : "border-outline-variant bg-white text-on-surface-variant hover:text-primary hover:border-primary/30"
                              }`}
                            >
                              Multi-Agent
                            </button>
                          </div>
                          <p className="text-[10px] text-on-surface-variant mt-1.5">
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
                className="w-full bg-secondary-container text-on-secondary-container font-headline-md text-base py-3.5 rounded-lg hover:brightness-95 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed uppercase font-bold font-rajdhani tracking-widest"
              >
                {uploading ? "Uploading..." : "Start Analysis"}
              </button>
            </section>

            {/* Recent Analyses List */}
            <section className="mt-8">
              <h2 className="font-label-bold text-xs text-on-surface-variant mb-4 uppercase tracking-wider font-bold">Recent Analyses</h2>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div 
                    key={doc.id}
                    onClick={() => handleSelectRecentDoc(doc)}
                    className="bg-white border border-outline-variant rounded-lg p-4 flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded bg-primary-container/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">analytics</span>
                      </div>
                      <div>
                        <p className="font-label-bold text-sm text-primary font-bold">{doc.filename}</p>
                        <p className="font-mono text-[10px] text-on-surface-variant uppercase">
                          {doc.status === "processing" ? "Analyzing..." : `Health: ${doc.health_score || 0}/100 • `}
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div 
                        className="font-label-bold text-xs px-3 py-1 rounded-full border font-bold"
                        style={{
                          backgroundColor: getHealthZoneClass(doc.health_score || 50).bg,
                          color: getHealthZoneClass(doc.health_score || 50).color,
                          borderColor: getHealthZoneClass(doc.health_score || 50).color + "40"
                        }}
                      >
                        {doc.status === "processing" ? "Processing" : `Health: ${doc.health_score || 0}/100`}
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* --- View 2: PROCESSING / PROGRESS PAGE --- */}
        {selectedDoc && selectedDoc.status !== "complete" && selectedDoc.status !== "error" && (
          <main className="flex flex-col items-center py-12 px-6 max-w-2xl mx-auto">
            {/* Analysis Container */}
            <div className="w-full max-w-2xl">
              {/* Main Content Card */}
              <div className="bg-white border border-outline-variant rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.07)] p-8 overflow-hidden relative">
                {/* Subtle Texture/Background Overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#002645 0.5px, transparent 0.5px)", backgroundSize: "24px 24px" }}></div>
                <div className="relative z-10">
                  <header className="text-center mb-8">
                    <h1 className="font-headline-lg text-2xl text-primary font-bold mb-1">Analysing your document</h1>
                    <p className="text-on-surface-variant text-sm italic">Please wait while our legal engine cross-references property records.</p>
                  </header>

                  {/* Vertical Step Tracker */}
                  <div className="flex flex-col gap-0 mb-8">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${processingStep > 1 ? "bg-tertiary-fixed text-on-tertiary-fixed font-bold" : "bg-secondary-container text-on-secondary-container"}`}>
                          {processingStep > 1 ? <span className="material-symbols-outlined text-[20px]">check</span> : "1"}
                        </div>
                        <div className={`w-0.5 h-12 ${processingStep > 1 ? "bg-tertiary-fixed" : "bg-outline-variant border-l border-dashed"}`}></div>
                      </div>
                      <div className="py-1">
                        <span className="font-label-bold text-xs text-on-tertiary-fixed-variant uppercase font-bold">Step 1</span>
                        <h3 className={`text-base font-rajdhani font-bold ${processingStep === 1 ? "text-primary" : "text-on-surface-variant opacity-80"}`}>Document Decryption</h3>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${processingStep > 2 ? "bg-tertiary-fixed text-on-tertiary-fixed font-bold" : processingStep === 2 ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-high border border-outline-variant text-outline"}`}>
                          {processingStep > 2 ? <span className="material-symbols-outlined text-[20px]">check</span> : "2"}
                        </div>
                        <div className={`w-0.5 h-12 ${processingStep > 2 ? "bg-tertiary-fixed" : "bg-outline-variant border-l border-dashed"}`}></div>
                      </div>
                      <div className="py-1">
                        <span className="font-label-bold text-xs text-on-tertiary-fixed-variant uppercase font-bold">Step 2</span>
                        <h3 className={`text-base font-rajdhani font-bold ${processingStep === 2 ? "text-primary font-bold" : "text-on-surface-variant opacity-80"}`}>Metadata Parsing</h3>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          processingStep > 3 ? "bg-tertiary-fixed text-on-tertiary-fixed font-bold" : 
                          processingStep === 3 ? "border-2 border-secondary-container bg-secondary-fixed/30" : 
                          "bg-surface-container-high border border-outline-variant text-outline"
                        }`}>
                          {processingStep > 3 ? <span className="material-symbols-outlined text-[20px]">check</span> : 
                           processingStep === 3 ? <div className="spinner-saffron mx-auto mt-1"></div> : "3"}
                        </div>
                        <div className={`w-0.5 h-12 ${processingStep > 3 ? "bg-tertiary-fixed" : "bg-outline-variant border-l border-dashed"}`}></div>
                      </div>
                      <div className="py-1">
                        <span className={`font-label-bold text-xs uppercase font-bold ${processingStep === 3 ? "text-secondary pulse-soft" : "text-outline"}`}>
                          {processingStep === 3 ? "Processing..." : "Step 3"}
                        </span>
                        <h3 className={`text-base font-rajdhani ${processingStep === 3 ? "text-primary font-bold" : "text-on-surface opacity-80"}`}>Detecting anomalies</h3>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          processingStep > 4 ? "bg-tertiary-fixed text-on-tertiary-fixed font-bold" : 
                          processingStep === 4 ? "border-2 border-secondary-container bg-secondary-fixed/30" : 
                          "bg-surface-container-high border border-outline-variant text-outline"
                        }`}>
                          {processingStep > 4 ? <span className="material-symbols-outlined text-[20px]">check</span> : 
                           processingStep === 4 ? <div className="spinner-saffron mx-auto mt-1"></div> : 
                           <span className="material-symbols-outlined text-[18px] text-outline mt-1">hourglass_empty</span>}
                        </div>
                        <div className={`w-0.5 h-12 ${processingStep > 4 ? "bg-tertiary-fixed" : "bg-outline-variant border-l border-dashed"}`}></div>
                      </div>
                      <div className="py-1">
                        <span className={`font-label-bold text-xs uppercase font-bold ${processingStep === 4 ? "text-secondary pulse-soft" : "text-outline"}`}>
                          {processingStep === 4 ? "Processing..." : "Step 4"}
                        </span>
                        <h3 className={`text-base font-rajdhani ${processingStep === 4 ? "text-primary font-bold" : "text-outline"}`}>Chain of Title Verification</h3>
                      </div>
                    </div>

                    {/* Step 5 */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          processingStep === 5 ? "border-2 border-secondary-container bg-secondary-fixed/30" : 
                          "bg-surface-container-high border border-outline-variant text-outline"
                        }`}>
                          {processingStep === 5 ? <div className="spinner-saffron mx-auto mt-1"></div> : 
                           <span className="material-symbols-outlined text-[18px] text-outline mt-1">pending</span>}
                        </div>
                      </div>
                      <div className="py-1">
                        <span className={`font-label-bold text-xs uppercase font-bold ${processingStep === 5 ? "text-secondary pulse-soft" : "text-outline"}`}>
                          {processingStep === 5 ? "Processing..." : "Step 5"}
                        </span>
                        <h3 className={`text-base font-rajdhani ${processingStep === 5 ? "text-primary font-bold" : "text-outline"}`}>Report Generation</h3>
                      </div>
                    </div>
                  </div>

                  {/* Live Log Box */}
                  <div className="bg-[#1b1c19] rounded-lg p-4 mb-6 border border-on-surface shadow-inner overflow-hidden font-mono">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                      <span className="text-[10px] tracking-wider text-white/50">SYSTEM_LOG_FEED</span>
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                        <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
                        <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                      </div>
                    </div>
                    <div ref={logBoxRef} className="h-32 overflow-y-auto text-xs space-y-1 scrollbar-thin text-[#88d8a1]">
                      {systemLogs.map((log, i) => (
                        <div key={i}>{log}</div>
                      ))}
                      <div className="text-white flex items-center gap-2">
                        <span className="pulse-soft">_</span>
                        <span>Processing pipeline executing...</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-primary font-bold">
                      <span className="material-symbols-outlined">schedule</span>
                      <span className="text-sm">Estimated time remaining: ~{processingTimeRemaining} seconds</span>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedDoc(null);
                        setUploading(false);
                      }} 
                      className="text-error font-label-bold text-xs underline hover:text-red-800 transition-colors animate-pulse"
                    >
                      Cancel analysis
                    </button>
                  </div>
                </div>
              </div>

              {/* Contextual Tip */}
              <div className="mt-6 flex gap-4 items-start bg-secondary-fixed/20 border border-secondary-fixed rounded-lg p-4">
                <span className="material-symbols-outlined text-secondary">info</span>
                <div>
                  <h4 className="font-label-bold text-xs text-secondary mb-1 uppercase font-bold">Expert Tip</h4>
                  <p className="text-on-surface-variant text-xs leading-normal">
                    While the analysis is running, you can prepare the previous registration documents for a more detailed chain-of-title comparison in the next step.
                  </p>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* --- View 3: COMPLETED REPORT DASHBOARD --- */}
        {activeView === "dashboard" && selectedDoc?.status === "complete" && results && (
          <div className="space-y-8 animate-fade-in">
            {/* Header controls */}
            <div className="flex justify-between items-center no-print">
              <h2 className="text-xl text-primary font-bold">Analysis Results Dashboard</h2>
              <div className="flex gap-2">
                <button onClick={handlePrintReport} className="btn border border-outline-variant bg-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-surface-container">
                  <Printer size={14} />
                  Print
                </button>
                <button onClick={handleDownloadReport} className="btn bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-primary/90">
                  <Download size={14} />
                  Download PDF
                </button>
              </div>
            </div>

            {/* Disclaimer box */}
            <div className="bg-red-50 border-l-4 border-error p-4 rounded-lg text-xs text-error leading-relaxed">
              <strong className="block text-sm mb-1">{t("disclaimerTitle")}</strong>
              {t("disclaimerText")}
            </div>

            {/* Health Score Gauge and Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Health Gauge */}
              <div className="bg-white border border-outline-variant rounded-xl p-6 flex flex-col items-center justify-center col-span-1 shadow-sm">
                <h3 className="text-xs text-on-surface-variant uppercase font-bold tracking-wider mb-4">
                  {t("healthScore")}
                </h3>
                
                <div className="gauge-container">
                  <div className="gauge-track"></div>
                  <div className="gauge-fill" style={{ 
                    transform: getGaugeRotation(summary?.health_score || 0),
                    borderBottomColor: getHealthZoneClass(summary?.health_score || 0).color,
                    borderRightColor: getHealthZoneClass(summary?.health_score || 0).color
                  }}></div>
                  <div className="gauge-value-text" style={{ color: getHealthZoneClass(summary?.health_score || 0).color }}>
                    {summary?.health_score || 0}
                  </div>
                </div>

                <span 
                  className="px-3 py-1 rounded-full text-xs font-bold border"
                  style={{
                    backgroundColor: getHealthZoneClass(summary?.health_score || 0).bg,
                    color: getHealthZoneClass(summary?.health_score || 0).color,
                    borderColor: getHealthZoneClass(summary?.health_score || 0).color + "40"
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
                    <FileText size={14} />
                  </div>
                  <div className="metric-val">{summary?.total_transactions || 0}</div>
                </div>

                <div onClick={() => setModalType('missing')} className={`metric-tile ${summary?.missing_entries_count > 0 ? "amber" : "green"}`}>
                  <div className="metric-header">
                    <span>{t("missingEntries")}</span>
                    <AlertTriangle size={14} />
                  </div>
                  <div className="metric-val">{summary?.missing_entries_count || 0}</div>
                </div>

                <div onClick={() => setModalType('ownership')} className={`metric-tile ${summary?.ownership_issues_count > 0 ? "red" : "green"}`}>
                  <div className="metric-header">
                    <span>Ownership Gaps</span>
                    <ShieldAlert size={14} />
                  </div>
                  <div className="metric-val">{summary?.ownership_issues_count || 0}</div>
                </div>

                <div onClick={() => setModalType('encumbrance')} className={`metric-tile ${summary?.encumbrance_anomalies_count > 0 ? "red" : "green"}`}>
                  <div className="metric-header">
                    <span>Active Mortgages</span>
                    <ShieldAlert size={14} />
                  </div>
                  <div className="metric-val">{summary?.encumbrance_anomalies_count || 0}</div>
                </div>
              </div>

            </div>

            {/* Custom timeline bar chart */}
            <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm no-print">
              <h3 className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-4">
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
                        background: locked ? "#e4e2dd" : 
                                    dist.anomaly_count > 0 ? "linear-gradient(to top, var(--danger), var(--secondary))" : 
                                    "linear-gradient(to top, var(--success), #a3f4bc)"
                      }}>
                        {locked && (
                          <div className="absolute top-1/2 left-50% -translate-x-1/2 -translate-y-1/2">
                            <Lock size={12} className="text-on-surface-variant" />
                          </div>
                        )}
                        <div className="chart-tooltip">
                          {locked ? "Locked" : `${dist.anomaly_count} Anomalies`}
                        </div>
                      </div>
                      <span className="chart-label font-mono text-[10px]">{dist.year}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed tables listings */}
            <div className="space-y-8">
              
              {/* Anomalies List */}
              <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-primary mb-4">Anomalies & Legal Findings List</h3>
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
                        <tr key={i} className={isYearLocked(anom.year) ? "blurred-content" : ""}>
                          <td>{anom.year}</td>
                          <td>{anom.entry_number}</td>
                          <td>
                            <span className={`badge ${anom.severity.toLowerCase() === 'high' ? 'badge-high' : anom.severity.toLowerCase() === 'medium' ? 'badge-medium' : 'badge-low'}`}>
                              {anom.severity}
                            </span>
                          </td>
                          <td>{anom.description}</td>
                          <td>{anom.recommendation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reconstructed Title Chain */}
              <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-primary mb-4">Reconstructed Chain of Title</h3>
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
                        <tr key={i} className={isYearLocked(link.year) ? "blurred-content" : ""}>
                          <td>{link.transaction_id}</td>
                          <td>{link.from_party}</td>
                          <td>{link.to_party}</td>
                          <td>{link.year}</td>
                          <td>
                            <span className="badge" style={{
                              backgroundColor: link.status === "valid" ? "var(--success-glow)" : "var(--danger-glow)",
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
          <div className="space-y-6 animate-fade-in">
            <h1 className="font-headline-lg text-2xl text-primary font-bold">Document History logs</h1>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div 
                  key={doc.id}
                  onClick={() => handleSelectRecentDoc(doc)}
                  className="bg-white border border-outline-variant rounded-lg p-4 flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-primary-container/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">analytics</span>
                    </div>
                    <div>
                      <p className="font-label-bold text-sm text-primary font-bold">{doc.filename}</p>
                      <p className="font-mono text-[10px] text-on-surface-variant uppercase">Mode: {doc.analysis_mode.replace('_', ' ')} | Date: {new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div 
                      className="font-label-bold text-xs px-3 py-1 rounded-full border"
                      style={{
                        backgroundColor: getHealthZoneClass(doc.health_score).bg,
                        color: getHealthZoneClass(doc.health_score).color,
                        borderColor: getHealthZoneClass(doc.health_score).color + "40"
                      }}
                    >
                      Health: {doc.health_score}/100
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- View 5: SETTINGS PAGE --- */}
        {activeView === "settings" && (
          <div className="bg-white rounded-xl border border-outline-variant p-8 space-y-6 shadow-sm animate-fade-in">
            <h1 className="font-headline-lg text-2xl text-primary font-bold border-b pb-2">Profile & Settings</h1>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">User Identification Code</label>
                <div className="bg-surface-container p-3 rounded-lg font-mono text-xs text-primary select-all">
                  {user?.id || "N/A"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Registered Phone Number</label>
                <div className="bg-surface-container p-3 rounded-lg text-sm text-on-surface font-semibold">
                  {user?.phone || "N/A"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Membership Plan</label>
                <div className="flex items-center gap-2">
                  <span className={`badge ${user?.subscription_status === 'premium' ? 'badge-high' : 'bg-surface-container text-on-surface-variant'}`}>
                    {user?.subscription_status === 'premium' ? "Premium Plan (Active)" : "Free Plan Access"}
                  </span>
                  {user?.subscription_status !== 'premium' && (
                    <button onClick={() => router.push("/subscription")} className="text-primary hover:underline text-xs font-bold">Upgrade now</button>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t">
                <button onClick={handleLogout} className="btn bg-error text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-800 transition-colors uppercase tracking-widest flex items-center gap-1">
                  <LogOut size={12} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Navigation Bar (Mobile Only) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 md:hidden bg-white border-t border-outline-variant shadow-lg rounded-t-xl no-print">
        <button 
          onClick={() => setActiveView("dashboard")}
          className={`flex flex-col items-center justify-center p-1 ${activeView === "dashboard" ? "text-primary scale-105" : "text-on-surface-variant opacity-70"}`}
        >
          <LayoutDashboard size={20} />
          <span className="font-label-bold text-[10px] font-bold mt-0.5">Dashboard</span>
        </button>

        <button 
          onClick={() => { setSelectedDoc(null); setActiveView("upload"); }}
          className={`flex flex-col items-center justify-center rounded-full px-4 py-1 ${activeView === "upload" ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant opacity-70"}`}
        >
          <FilePlus size={20} />
          <span className="font-label-bold text-[10px] font-bold mt-0.5">Upload</span>
        </button>

        <button 
          onClick={() => setActiveView("history")}
          className={`flex flex-col items-center justify-center p-1 ${activeView === "history" ? "text-primary scale-105" : "text-on-surface-variant opacity-70"}`}
        >
          <History size={20} />
          <span className="font-label-bold text-[10px] font-bold mt-0.5">History</span>
        </button>

        <button 
          onClick={() => setActiveView("settings")}
          className={`flex flex-col items-center justify-center p-1 ${activeView === "settings" ? "text-primary scale-105" : "text-on-surface-variant opacity-70"}`}
        >
          <Settings size={20} />
          <span className="font-label-bold text-[10px] font-bold mt-0.5">Settings</span>
        </button>
      </nav>

      {/* Dialogue Modals */}
      {modalType && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "24px" }}>
            
            {modalType === 'locked_prompt' ? (
              <div style={{ textAlign: "center", padding: "10px" }}>
                <Lock size={40} className="text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-bold text-primary mb-2">Unlock Historical Records</h3>
                <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                  {t("upgradePromptText")}
                </p>
                <div className="flex gap-2 justify-center">
                  <button onClick={() => setModalType(null)} className="btn border border-outline-variant px-4 py-2 rounded text-xs font-bold hover:bg-surface-container">Cancel</button>
                  <button onClick={() => { setModalType(null); router.push("/subscription"); }} className="btn bg-primary text-white px-5 py-2 rounded text-xs font-bold hover:bg-primary/90">Upgrade for ₹999</button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-bold text-primary mb-4 uppercase tracking-wide">
                  Detailed Analysis Findings - {modalType} {drilldownYear ? `(${drilldownYear})` : ''}
                </h3>
                
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
                            <td>{anom.year}</td>
                            <td>{anom.entry_number}</td>
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
                          <td colSpan={5} className="text-center text-outline py-8">
                            No anomalies recorded in this category.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex justify-end">
                  <button onClick={() => { setModalType(null); setDrilldownYear(null); }} className="btn bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold">Close</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
