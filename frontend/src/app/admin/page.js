"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "../i18n";
import { 
  Users, Shield, Activity, ListFilter, RotateCcw, Search, 
  Trash2, UserMinus, UserPlus, CheckCircle, AlertTriangle, 
  Server, Database, CloudLightning, ArrowLeft, LogOut
} from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [adminUser, setAdminUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authorized, setAuthorized] = useState(false);

  // States
  const [stats, setStats] = useState({
    users: { total: 3, premium: 1, free: 2 },
    analyses: { total: 12, completed: 10, failed: 2, average_health_score: 64 }
  });
  
  const [usersList, setUsersList] = useState([
    { id: "00000000-0000-0000-0000-000000000001", name: "Free Tester", phone: "+919000000001", role: "user", subscription_status: "free", is_test_account: true, created_at: "2025-01-15T10:00:00Z" },
    { id: "00000000-0000-0000-0000-000000000002", name: "Premium Tester", phone: "+919000000002", role: "user", subscription_status: "premium", is_test_account: true, created_at: "2025-01-16T12:30:00Z" },
    { id: "00000000-0000-0000-0000-000000000003", name: "Admin User", phone: "+919000000003", role: "admin", subscription_status: "free", is_test_account: true, created_at: "2025-01-14T09:00:00Z" }
  ]);

  const [failedAnalyses, setFailedAnalyses] = useState([
    { id: "fail-doc-101", filename: "EC_Chittoor_Property_Error.pdf", owner_id: "00000000-0000-0000-0000-000000000001", error_code: "unsupported_pdf_type", error_message: "This PDF appears to be a scanned document. Scanned PDFs are not supported.", created_at: "2025-02-10T14:40:00Z" }
  ]);

  const [auditLogs, setAuditLogs] = useState([
    { id: 1, user_id: "00000000-0000-0000-0000-000000000002", action: "report_download", document_id: "doc-12345", ip_address: "192.168.1.50", created_at: "2025-02-14T15:30:22Z", metadata: { format: "pdf" } },
    { id: 2, user_id: "00000000-0000-0000-0000-000000000001", action: "upload", document_id: "fail-doc-101", ip_address: "192.168.1.11", created_at: "2025-02-10T14:38:05Z", metadata: { filename: "EC_Chittoor_Property_Error.pdf" } },
    { id: 3, user_id: "00000000-0000-0000-0000-000000000002", action: "subscription_created", document_id: null, ip_address: "192.168.1.50", created_at: "2025-01-16T12:45:00Z", metadata: { plan: "yearly_premium" } }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "";

  // Check Admin Session
  useEffect(() => {
    const storedToken = localStorage.getItem("ec_token");
    const storedUser = localStorage.getItem("ec_user");
    
    if (!storedToken || !storedUser) {
      router.push("/");
      return;
    }
    
    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role !== "admin") {
        router.push("/dashboard");
        return;
      }
      
      setToken(storedToken);
      setAdminUser(parsedUser);
      setAuthorized(true);
      
      // Fetch live data from backend if online
      fetchAdminData(storedToken);
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  const fetchAdminData = async (activeToken) => {
    try {
      const h = { "Authorization": `Bearer ${activeToken}` };
      
      // Fetch stats
      const statsResp = await fetch(`${backendUrl}/api/admin/stats`, { headers: h });
      if (statsResp.ok) setStats(await statsResp.json());

      // Fetch users
      const usersResp = await fetch(`${backendUrl}/api/admin/users`, { headers: h });
      if (usersResp.ok) setUsersList(await usersResp.json());

      // Fetch failed analyses
      const failedResp = await fetch(`${backendUrl}/api/admin/failed-analyses`, { headers: h });
      if (failedResp.ok) setFailedAnalyses(await failedResp.json());

      // Fetch audit logs
      const auditResp = await fetch(`${backendUrl}/api/admin/audit-logs`, { headers: h });
      if (auditResp.ok) setAuditLogs(await auditResp.json());

    } catch (err) {
      console.warn("Backend admin endpoints offline, using loaded mock metrics for preview:", err);
    }
  };

  // Toggle user subscription level
  const handleToggleUserTier = async (userId, currentStatus) => {
    setErrorMsg("");
    setSuccessMsg("");
    
    const nextStatus = currentStatus === "premium" ? "free" : "premium";
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/users/${userId}/tier`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ subscription_status: nextStatus })
      });

      if (!response.ok) {
        throw new Error("Failed to change user subscription level");
      }

      setSuccessMsg("User subscription tier updated successfully!");
      fetchAdminData(token);
    } catch (err) {
      console.warn("Offline state modification triggered for user:", userId);
      // Fallback offline UI toggle
      const updated = usersList.map(u => {
        if (u.id === userId) {
          return { ...u, subscription_status: nextStatus };
        }
        return u;
      });
      setUsersList(updated);
      setSuccessMsg(`[Offline Mode] User tier toggled to ${nextStatus}.`);
    }
  };

  // Trigger Retry analysis
  const handleRetryAnalysis = async (docId) => {
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await fetch(`${backendUrl}/api/admin/failed-analyses/${docId}/retry`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Failed to schedule analysis retry.");
      }

      setSuccessMsg("Analysis retry scheduled! Document state is reset to queued.");
      fetchAdminData(token);
    } catch (err) {
      console.warn("Offline scheduler simulation for doc:", docId);
      // Simulate removal from error list
      setFailedAnalyses(failedAnalyses.filter(d => d.id !== docId));
      setSuccessMsg("[Offline Mode] Simulated worker analysis retry initiated.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("ec_token");
    localStorage.removeItem("ec_user");
    document.cookie = "ec_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/");
  };

  // Filter users by search query
  const filteredUsers = usersList.filter(u => 
    u.phone.includes(searchQuery) || 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    u.id.includes(searchQuery)
  );

  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f6f9] px-6 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-orange-500/5 blur-[100px] pointer-events-none animate-pulse-soft"></div>
        <div className="absolute -bottom-40 -right-20 w-[450px] h-[450px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none"></div>

        <div className="glass-card p-8 max-w-sm w-full text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-orange-500 to-amber-500"></div>
          <div className="spinner-saffron w-8 h-8 mx-auto mb-4"></div>
          <h3 className="font-display text-lg font-bold text-slate-850 font-rajdhani uppercase tracking-wider mb-2">Verifying Credentials</h3>
          <p className="text-slate-400 text-xs leading-normal">Securing connection to the Administrator Panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f4f6f9] text-slate-900 font-sans min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-orange-500/5 blur-[100px] pointer-events-none animate-pulse-soft"></div>
      <div className="absolute -bottom-40 -right-20 w-[450px] h-[450px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none"></div>

      {/* Admin Control Bar */}
      <header className="flex justify-between items-center px-6 py-3.5 border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm no-print relative z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push("/dashboard")} 
            className="flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm transition-all active:scale-95 duration-100"
            title="Go Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="font-display text-lg font-bold text-slate-900 font-rajdhani tracking-wider uppercase">EC Analyser</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block font-rajdhani">
            Administrator Panel
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 duration-150">
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="flex-grow py-8 px-6 max-w-7xl w-full mx-auto space-y-6 animate-fade-in relative z-10">
        
        {/* Alerts messages banner */}
        {(successMsg || errorMsg) && (
          <div 
            className={`border-l-4 p-4 rounded-xl text-xs font-semibold shadow-sm animate-fade-in ${
              successMsg 
                ? "bg-emerald-50 border-emerald-500 text-emerald-800" 
                : "bg-red-50 border-red-500 text-red-800"
            }`}
          >
            {successMsg || errorMsg}
          </div>
        )}

        {/* System Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 font-rajdhani">
              <span>Total Customers</span>
              <Users size={16} className="text-slate-500" />
            </div>
            <div className="text-3xl font-extrabold font-display text-slate-900 leading-none">{stats.users.total}</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-2">
              {stats.users.premium} premium, {stats.users.free} free accounts
            </div>
          </div>

          <div className="glass-card flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500"></div>
            <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 font-rajdhani">
              <span>Analyses Completed</span>
              <CheckCircle size={16} className="text-emerald-500" />
            </div>
            <div className="text-3xl font-extrabold font-display text-slate-900 leading-none">{stats.analyses.completed}</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-2">
              Successfully processed text layers
            </div>
          </div>

          <div className="glass-card flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-rose-500 to-red-500"></div>
            <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 font-rajdhani">
              <span>Analyses Failed</span>
              <AlertTriangle size={16} className="text-red-500 animate-pulse-soft" />
            </div>
            <div className="text-3xl font-extrabold font-display text-slate-900 leading-none">{stats.analyses.failed}</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-2">
              Scanned uploads or validation errors
            </div>
          </div>

          <div className="glass-card flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-orange-500 to-amber-500"></div>
            <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 font-rajdhani">
              <span>Average Health Score</span>
              <Activity size={16} className="text-orange-500" />
            </div>
            <div className="text-3xl font-extrabold font-display text-slate-900 leading-none">{stats.analyses.average_health_score} / 100</div>
            <div className="text-[10px] text-slate-400 font-semibold mt-2">
              Standard distribution across reports
            </div>
          </div>
        </div>

        {/* Main Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* User management container */}
          <div className="glass-card lg:col-span-2 space-y-4 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
              <h3 className="text-sm font-extrabold text-slate-900 font-rajdhani uppercase tracking-wide flex items-center gap-2">
                <Users size={18} className="text-slate-500" />
                User Account Management
              </h3>
              
              {/* Search Bar */}
              <div className="relative w-full sm:w-60">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search name, ID or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/50 border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-xl text-xs text-slate-800 outline-none transition-all"
                />
              </div>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Phone</th>
                    <th>Name</th>
                    <th>Plan Level</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="font-mono text-xs font-semibold">{u.phone}</td>
                      <td className="font-semibold text-slate-700">{u.name || "N/A"}</td>
                      <td>
                        <span className="badge" style={{ 
                          background: u.subscription_status === "premium" ? "rgba(224, 123, 63, 0.08)" : "rgba(100, 116, 139, 0.06)",
                          color: u.subscription_status === "premium" ? "var(--secondary)" : "var(--text-muted)"
                        }}>
                          {u.subscription_status}
                        </span>
                      </td>
                      <td className="capitalize font-semibold text-xs text-slate-600">{u.role}</td>
                      <td>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-rajdhani">
                          {u.is_test_account ? "Tester" : "Public Customer"}
                        </span>
                      </td>
                      <td>
                        <button 
                          onClick={() => handleToggleUserTier(u.id, u.subscription_status)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-orange-500 hover:text-orange-600 bg-white hover:bg-orange-50/10 font-bold text-[10px] uppercase tracking-wider transition-all duration-150 active:scale-95 shadow-sm font-rajdhani"
                        >
                          Toggle Plan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* System status health indicators */}
          <div className="glass-card lg:col-span-1 space-y-4 relative overflow-hidden">
            <h3 className="text-sm font-extrabold text-slate-900 font-rajdhani uppercase tracking-wide flex items-center gap-2">
              <Shield size={18} className="text-slate-500" />
              Infrastructure Uptime
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex gap-2.5 items-center">
                  <CloudLightning size={16} className="text-slate-500" />
                  <div>
                    <strong className="block text-xs text-slate-700 font-semibold">Modal Worker</strong>
                    <span className="text-[10px] text-slate-400 font-mono">ec-validator-worker</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="led-status led-active"></span>
                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[9px] font-rajdhani">Active (0-scale)</span>
                </div>
              </div>

              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex gap-2.5 items-center">
                  <Database size={16} className="text-slate-500" />
                  <div>
                    <strong className="block text-xs text-slate-700 font-semibold">Supabase Client</strong>
                    <span className="text-[10px] text-slate-400 font-mono">Storage RLS Active</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="led-status led-active"></span>
                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[9px] font-rajdhani">Connected</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex gap-2.5 items-center">
                  <Server size={16} className="text-slate-500" />
                  <div>
                    <strong className="block text-xs text-slate-700 font-semibold">FastAPI Gateway</strong>
                    <span className="text-[10px] text-slate-400 font-mono">Vercel Serverless</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="led-status led-active"></span>
                  <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[9px] font-rajdhani">Online</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Failed analyses review block */}
        <div className="glass-card space-y-4 relative overflow-hidden">
          <h3 className="text-sm font-extrabold text-red-600 font-rajdhani uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500 animate-pulse-soft" />
            Failed Analysis Review
          </h3>

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Error Code</th>
                  <th>Error Message</th>
                  <th>Date Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {failedAnalyses.length > 0 ? (
                  failedAnalyses.map((doc) => (
                    <tr key={doc.id}>
                      <td className="font-mono text-xs font-semibold text-slate-700">{doc.filename}</td>
                      <td>
                        <span className="badge badge-high">
                          {doc.error_code}
                        </span>
                      </td>
                      <td className="text-slate-500 text-xs font-medium">{doc.error_message}</td>
                      <td className="text-slate-500 text-xs font-semibold font-mono">{new Date(doc.created_at).toLocaleString()}</td>
                      <td>
                        <button 
                          onClick={() => handleRetryAnalysis(doc.id)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-orange-500 hover:text-orange-600 bg-white hover:bg-orange-50/10 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all duration-150 active:scale-95 shadow-sm font-rajdhani"
                        >
                          <RotateCcw size={10} />
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-400 py-6 font-medium">
                      No failed analysis reports recorded in the database logs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log Viewer */}
        <div className="glass-card space-y-4 relative overflow-hidden">
          <h3 className="text-sm font-extrabold text-slate-900 font-rajdhani uppercase tracking-wide flex items-center gap-2">
            <Activity size={18} className="text-slate-500" />
            Security Audit Trail Log (`ec_audit_log`)
          </h3>

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User ID</th>
                  <th>Action Event</th>
                  <th>IP Address</th>
                  <th>Event Metadata</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs font-semibold text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="font-mono text-xs text-slate-400 select-all">{log.user_id || "System"}</td>
                    <td>
                      <span className="badge" style={{ 
                        background: log.action.includes("complete") || log.action.includes("created") ? "rgba(5, 150, 105, 0.08)" : 
                                    log.action.includes("error") || log.action.includes("expired") ? "rgba(220, 38, 38, 0.08)" : "rgba(100, 116, 139, 0.06)",
                        color: log.action.includes("complete") || log.action.includes("created") ? "var(--success)" : 
                               log.action.includes("error") || log.action.includes("expired") ? "var(--danger)" : "var(--text-muted)"
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-slate-500">{log.ip_address || "Local"}</td>
                    <td className="font-mono text-xs text-slate-400">
                      {JSON.stringify(log.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
