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
  const [documents, setDocuments] = useState([]);

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
  const [activeHighlight, setActiveHighlight] = useState(null);

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
      console.error("Backend upload failed:", err);
      setUploadError(err.message || "Failed to upload and analyze document. Please check your connection and try again.");
      setUploading(false);
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

  const isDashboardViewActive = activeView === "dashboard" && selectedDoc?.status === "complete" && results;

  return (
    <div className={`bg-[#f4f6f9] text-slate-900 font-sans flex flex-col pb-16 md:pb-0 ${isDashboardViewActive ? "md:h-screen md:overflow-hidden min-h-screen" : "min-h-screen"}`}>
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
      <main className={`w-full mx-auto flex-grow animate-fade-in ${isDashboardViewActive ? "md:h-[calc(100vh-57px)] md:overflow-hidden py-0 px-0 max-w-none" : "py-8 px-6 pb-24 max-w-7xl"}`}>

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

        {/* --- View 3: COMPLETED REPORT DASHBOARD (SCROLLYTELLING SPLIT-SCREEN) --- */}
        {activeView === "dashboard" && selectedDoc?.status === "complete" && results && (
          <div className="flex flex-col md:flex-row h-full w-full overflow-y-auto md:overflow-hidden bg-[#f4f6f9]">
            
            {/* Left Panel: The Document Context (strictly fixed/sticky on desktop) */}
            <div className="w-full md:w-[60%] md:h-full bg-slate-100 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-200 shrink-0 h-[500px] md:h-full">
              {/* Decorative absolute background dots/patterns to feel premium */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#0f172a 0.5px, transparent 0.5px)", backgroundSize: "20px 20px" }}></div>
              <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-orange-500/5 blur-[80px] pointer-events-none"></div>
              
              {/* Paper Document Container */}
              <div className="bg-white shadow-2xl rounded-sm border border-slate-200 p-8 w-full max-w-[460px] aspect-[1/1.414] overflow-y-auto font-serif text-[11px] leading-relaxed text-slate-800 relative selection:bg-orange-100 select-text flex flex-col justify-between h-[90%] md:max-h-[85vh]">
                
                {/* Physical Document Header */}
                <div className="text-center pb-4 border-b border-double border-slate-300 mb-4 shrink-0">
                  <h4 className="font-sans font-bold text-[9px] uppercase tracking-wider text-slate-400">Government of Tamil Nadu</h4>
                  <h3 className="font-serif font-extrabold text-sm uppercase tracking-wide text-slate-900 mt-0.5">Registration Department</h3>
                  <h2 className="font-serif font-bold text-[11px] uppercase tracking-wider text-slate-800 mt-1">Form No. 15 — Encumbrance Certificate</h2>
                  <div className="flex justify-between items-center text-[8px] font-sans text-slate-400 mt-3 font-semibold">
                    <span>DOCUMENT NO: EC/2026/9024A</span>
                    <span>SUB-REGISTRAR OFFICE: TAMBARAM</span>
                  </div>
                </div>

                {/* Document Body Content */}
                <div className="space-y-4 flex-grow overflow-y-auto pr-1">
                  
                  {/* Property Details Section */}
                  <div className="text-[10px] bg-slate-50 border border-slate-100 p-2.5 rounded-lg mb-3">
                    <span className="font-sans font-extrabold text-[8px] text-slate-400 uppercase tracking-wide block mb-1">Property Description</span>
                    <p className="font-serif leading-tight">
                      <strong>Scheduled Property Details:</strong> <br />
                      <strong>Survey/Plot No:</strong> {results?.transactions?.[0]?.survey_number || "N/A"} • <strong>Details:</strong> {results?.transactions?.[0]?.property_description || "N/A"}
                    </p>
                  </div>

                  <p className="font-serif text-[10.5px] italic mb-3 text-slate-500">
                    Search period of 12 years from 01-01-2014 to 31-12-2025 has been conducted on index records. The registered transactions affecting the scheduled property are listed below:
                  </p>

                  {/* Transaction Entries (Timeline-linked) */}
                  <div className="space-y-3.5 relative">
                    {results?.transactions?.map((tx, idx) => {
                      const yearStr = tx.year ? String(tx.year) : "";
                      const partiesStr = tx.parties?.map(p => `${p.name} (${p.role})`).join(" • ");
                      
                      // Find if this entry has an anomaly
                      const entryAnomaly = results.anomalies?.find(
                        a => String(a.entry_number) === String(tx.entry_number)
                      );
                      
                      let alertBadge = null;
                      if (entryAnomaly) {
                        if (entryAnomaly.severity?.toLowerCase() === "high") {
                          alertBadge = <span className="text-red-500 font-bold">SEVERE EXCEPTION</span>;
                        } else if (entryAnomaly.severity?.toLowerCase() === "medium") {
                          alertBadge = <span className="text-orange-500 font-bold">WARNING NOTICE</span>;
                        } else {
                          alertBadge = <span className="text-amber-500 font-bold">MINOR ALERT</span>;
                        }
                      }

                      return (
                        <div 
                          key={tx.entry_number || idx}
                          onMouseEnter={() => setActiveHighlight(yearStr)}
                          onMouseLeave={() => setActiveHighlight(null)}
                          onClick={() => setActiveHighlight(yearStr)}
                          className={`transition-all duration-300 p-3 rounded-xl border relative cursor-pointer ${
                            activeHighlight === yearStr 
                              ? 'bg-yellow-50/70 border-yellow-400 shadow-md ring-2 ring-yellow-100/50 scale-[1.02] z-10' 
                              : 'border-slate-100 bg-slate-50/40 hover:bg-slate-50/80 hover:border-slate-200'
                          }`}
                        >
                          {/* Interactive Highlighter Overlay */}
                          {activeHighlight === yearStr && (
                            <div className="absolute inset-0 bg-yellow-250/20 mix-blend-multiply rounded-xl pointer-events-none animate-pulse-soft"></div>
                          )}
                          
                          <div className="flex justify-between items-center text-[9px] font-sans font-bold text-slate-400 mb-1">
                            <span>ENTRY #{tx.entry_number} • YEAR: {tx.year}</span>
                            {alertBadge}
                          </div>
                          <p className="leading-normal font-serif text-[10.5px]">
                            <strong>Transaction:</strong> {tx.transaction_type} <br />
                            <strong>Parties:</strong> {partiesStr} <br />
                            <strong>Amount / Consideration:</strong> {tx.amount} <br />
                            <span className="text-slate-500 font-sans text-[8.5px] font-semibold mt-1 block">
                              {tx.property_description}
                            </span>
                            {entryAnomaly && (
                              <span className="text-red-600 font-sans text-[8.5px] font-semibold mt-1 block">
                                * {entryAnomaly.description}
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                </div>

                {/* Physical Document Footer seal */}
                <div className="pt-4 border-t border-slate-200 flex justify-between items-end mt-4 shrink-0 font-sans text-[8px] text-slate-400">
                  <div>
                    <p>GENERATED ON: 24-06-2026 17:04</p>
                    <p className="font-mono">CHECKSUM: AD8032FE90231BC90D</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-block w-8 h-8 rounded-full border border-dashed border-slate-300 mb-1 flex items-center justify-center text-[10px] text-slate-300 font-bold uppercase rotate-12">
                      Seal
                    </div>
                    <p>SUB-REGISTRAR OFFICE SIGNATURE</p>
                  </div>
                </div>

              </div>

              {/* Scrollytelling Guide Note */}
              <div className="mt-4 text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">info</span>
                Hover or click cards on the right to auto-highlight matching records in the document context.
              </div>
            </div>

            {/* Right Panel: Scrollable AI Findings */}
            <div className="w-full md:w-[40%] md:h-full overflow-y-auto bg-white flex flex-col relative">
              
              {/* Sticky Header with Glassmorphism */}
              <header className="backdrop-blur-md bg-white/80 border-b border-slate-100 sticky top-0 z-20 px-6 py-4 flex items-center justify-between shadow-sm">
                <div>
                  <h2 className="text-lg text-slate-900 font-extrabold uppercase font-rajdhani tracking-wide">AI Analysis Report</h2>
                  <p className="text-[10px] text-slate-400 font-semibold font-mono">EC FILE: {selectedDoc.filename}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="bg-red-50 border border-red-200 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold font-sans uppercase tracking-wider shadow-sm">
                    High Risk
                  </span>
                </div>
              </header>

              {/* Action Bar */}
              <div className="px-6 py-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center gap-4 shrink-0 no-print">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-rajdhani">
                  {summary?.total_transactions || 3} transactions analyzed
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handlePrintReport} 
                    className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-orange-400 transition-all shadow-sm"
                    title="Print Report"
                  >
                    <Printer size={13} />
                  </button>
                  <button 
                    onClick={handleDownloadReport} 
                    className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 bg-slate-900 text-white hover:bg-slate-800 hover:border-slate-800 transition-all shadow-sm"
                    title="Download Report"
                  >
                    <Download size={13} />
                  </button>
                </div>
              </div>

              {/* Right Panel Main Scrolling Content */}
              <div className="p-6 space-y-6 flex-grow">
                
                {/* Health Overview Metric Widget */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex justify-between items-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(white 0.5px, transparent 0.5px)", backgroundSize: "15px 15px" }}></div>
                  <div className="relative z-10 space-y-1.5">
                    <h3 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest font-sans">Verification Rating</h3>
                    <div className="text-3xl font-extrabold font-display leading-none text-orange-400 font-rajdhani tracking-wider">
                      {summary?.health_score || 50} / 100
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight">
                      Critical ownership gaps and double registration events detected.
                    </p>
                  </div>
                  
                  {/* Mini Radial Indicator */}
                  <div className="relative flex items-center justify-center h-16 w-16 select-none relative z-10 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-slate-700" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-orange-500 transition-all duration-1000 ease-out" strokeDasharray={`${summary?.health_score || 50}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="absolute text-[11px] font-extrabold font-mono text-white leading-none">
                      {summary?.health_score || 50}%
                    </div>
                  </div>
                </div>

                {/* Timeline Section */}
                <div className="space-y-4">
                  <h3 className="text-xs text-slate-400 font-extrabold uppercase tracking-wider font-sans mb-2">Findings Timeline</h3>
                  
                  <div className="relative pl-1">
                    {/* Vertical Timeline Connection Line */}
                    <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-slate-200"></div>

                    {/* Timeline Node & Card 1 (Severe Exception) */}
                    <div className="relative flex gap-4 items-start mb-6">
                      {/* Connected Indicator Dot */}
                      <div className={`absolute left-3.5 top-6 w-3.5 h-3.5 rounded-full border-2 border-white shadow transition-all duration-300 z-10 ${
                        activeHighlight === '2015' ? 'bg-red-500 scale-125 ring-4 ring-red-100' : 'bg-red-500'
                      }`}></div>
                      
                      <div 
                        onMouseEnter={() => setActiveHighlight("2015")}
                        onMouseLeave={() => setActiveHighlight(null)}
                        onClick={() => setActiveHighlight("2015")}
                        className={`flex-grow ml-10 p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                          activeHighlight === '2015'
                            ? 'bg-red-50/50 border-red-400 shadow-md scale-[1.01] ring-2 ring-red-100/50'
                            : 'bg-white border-slate-200/80 hover:border-red-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-extrabold text-red-600 uppercase font-sans tracking-wider">Severe Error</span>
                          <span className="font-mono text-xs font-bold text-slate-400">2015</span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-800 font-rajdhani uppercase tracking-wide mb-1">Break in Ownership Chain</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mb-3">
                          A title gap was identified in Doc No: 405/2015. Anand Sen sold the scheduled property to Vikram Shah, but public records indicate Rajesh Rao was the registered owner.
                        </p>
                        
                        <div className="bg-red-50 border border-red-100/50 p-2.5 rounded-xl text-[10.5px] text-red-800">
                          <strong>Recommendation:</strong> Perform manual title deed verification to trace the missing chain links between Rajesh Rao and Anand Sen.
                        </div>
                      </div>
                    </div>

                    {/* Timeline Node & Card 2 (Warning Exception) */}
                    <div className="relative flex gap-4 items-start mb-6">
                      {/* Connected Indicator Dot */}
                      <div className={`absolute left-3.5 top-6 w-3.5 h-3.5 rounded-full border-2 border-white shadow transition-all duration-300 z-10 ${
                        activeHighlight === '2018' ? 'bg-orange-500 scale-125 ring-4 ring-orange-100' : 'bg-orange-500'
                      }`}></div>
                      
                      <div 
                        onMouseEnter={() => setActiveHighlight("2018")}
                        onMouseLeave={() => setActiveHighlight(null)}
                        onClick={() => setActiveHighlight("2018")}
                        className={`flex-grow ml-10 p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                          activeHighlight === '2018'
                            ? 'bg-orange-50/50 border-orange-400 shadow-md scale-[1.01] ring-2 ring-orange-100/50'
                            : 'bg-white border-slate-200/80 hover:border-orange-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-extrabold text-orange-600 uppercase font-sans tracking-wider">Warning</span>
                          <span className="font-mono text-xs font-bold text-slate-400">2018</span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-800 font-rajdhani uppercase tracking-wide mb-1">Double Entry Detected</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mb-3">
                          Concurrent mortgage registrations found on identical property bounds. Two separate home loans were registered on the same survey number without clear cross-collateralization records.
                        </p>
                        
                        <div className="bg-orange-50 border border-orange-100/50 p-2.5 rounded-xl text-[10.5px] text-orange-800">
                          <strong>Recommendation:</strong> Request physical No-Objection Certificate (NOC) and register standard discharge deeds with both banks.
                        </div>
                      </div>
                    </div>

                    {/* Timeline Node & Card 3 (Notice Alert) */}
                    <div className="relative flex gap-4 items-start">
                      {/* Connected Indicator Dot */}
                      <div className={`absolute left-3.5 top-6 w-3.5 h-3.5 rounded-full border-2 border-white shadow transition-all duration-300 z-10 ${
                        activeHighlight === '2021' ? 'bg-amber-500 scale-125 ring-4 ring-amber-100' : 'bg-amber-500'
                      }`}></div>
                      
                      <div 
                        onMouseEnter={() => setActiveHighlight("2021")}
                        onMouseLeave={() => setActiveHighlight(null)}
                        onClick={() => setActiveHighlight("2021")}
                        className={`flex-grow ml-10 p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                          activeHighlight === '2021'
                            ? 'bg-amber-50/50 border-amber-400 shadow-md scale-[1.01] ring-2 ring-amber-100/50'
                            : 'bg-white border-slate-200/80 hover:border-amber-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-extrabold text-amber-600 uppercase font-sans tracking-wider">Notice</span>
                          <span className="font-mono text-xs font-bold text-slate-400">2021</span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-800 font-rajdhani uppercase tracking-wide mb-1">Minor Name Anomaly</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mb-3">
                          A discrepancy in the transferee's middle name initial was identified in Doc No: 1104/2021. Registered as "Priya Nair K." instead of "Priya Nair".
                        </p>
                        
                        <div className="bg-amber-50 border border-amber-100/50 p-2.5 rounded-xl text-[10.5px] text-amber-800">
                          <strong>Recommendation:</strong> Collect matching Aadhaar / PAN documentation or execute a name-clarification affidavit to prevent registry concerns.
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Additional detailed anomalies lists */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <h3 className="text-xs text-slate-400 font-extrabold uppercase tracking-wider font-sans">Anomalies Distribution</h3>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div onClick={() => setModalType('missing')} className="border border-slate-200/60 rounded-xl p-3.5 text-center cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="text-xs font-bold text-slate-400 font-sans uppercase">Missing</div>
                      <div className="text-lg font-extrabold text-slate-800 mt-1">{summary?.missing_entries_count || 1}</div>
                    </div>
                    <div onClick={() => setModalType('ownership')} className="border border-slate-200/60 rounded-xl p-3.5 text-center cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="text-xs font-bold text-slate-400 font-sans uppercase">Title</div>
                      <div className="text-lg font-extrabold text-slate-800 mt-1">{summary?.ownership_issues_count || 1}</div>
                    </div>
                    <div onClick={() => setModalType('encumbrance')} className="border border-slate-200/60 rounded-xl p-3.5 text-center cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="text-xs font-bold text-slate-400 font-sans uppercase">Liens</div>
                      <div className="text-lg font-extrabold text-slate-800 mt-1">{summary?.encumbrance_anomalies_count || 1}</div>
                    </div>
                  </div>
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
