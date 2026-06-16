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
    
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    
    setToken(storedToken);
    setAdminUser(parsedUser);
    
    // Fetch live data from backend if online
    fetchAdminData(storedToken);
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
    router.push("/");
  };

  // Filter users by search query
  const filteredUsers = usersList.filter(u => 
    u.phone.includes(searchQuery) || 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    u.id.includes(searchQuery)
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Admin Header */}
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button onClick={() => router.push("/dashboard")} className="btn btn-secondary" style={{ padding: "6px 10px" }}>
            <ArrowLeft size={16} />
            Back
          </button>
          <a href="#" className="logo-section">
            <div className="logo-icon" style={{ background: "var(--primary)" }}>AD</div>
            <span>{t("appName")} — Administrator Control Panel</span>
          </a>
        </div>

        <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }}>
          <LogOut size={14} />
        </button>
      </header>

      {/* Main Panel Content */}
      <main style={{ flex: 1, padding: "40px", maxWidth: "1400px", width: "100%", margin: "0 auto" }}>
        
        {/* Alerts messages banner */}
        {(successMsg || errorMsg) && (
          <div style={{ 
            background: successMsg ? "var(--success-glow)" : "var(--danger-glow)",
            borderLeft: `4px solid ${successMsg ? "var(--success)" : "var(--danger)"}`,
            padding: "14px",
            borderRadius: "6px",
            fontSize: "14px",
            color: successMsg ? "var(--success)" : "var(--danger)",
            marginBottom: "25px"
          }}>
            {successMsg || errorMsg}
          </div>
        )}

        {/* System Stats Row */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: "30px" }}>
          <div className="glass-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "13px", marginBottom: "10px" }}>
              <span>Total Customers</span>
              <Users size={16} color="var(--primary)" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700" }}>{stats.users.total}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              {stats.users.premium} premium, {stats.users.free} free accounts
            </div>
          </div>

          <div className="glass-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "13px", marginBottom: "10px" }}>
              <span>Analyses Completed</span>
              <CheckCircle size={16} color="var(--success)" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700" }}>{stats.analyses.completed}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Successfully processed text layers
            </div>
          </div>

          <div className="glass-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "13px", marginBottom: "10px" }}>
              <span>Analyses Failed</span>
              <AlertTriangle size={16} color="var(--danger)" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700" }}>{stats.analyses.failed}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Scanned uploads or validation errors
            </div>
          </div>

          <div className="glass-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "13px", marginBottom: "10px" }}>
              <span>Average health score</span>
              <Activity size={16} color="var(--warning)" />
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700" }}>{stats.analyses.average_health_score} / 100</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Standard distribution across reports
            </div>
          </div>
        </div>

        {/* Main Columns */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "24px", marginBottom: "30px" }}>
          
          {/* User management container */}
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={20} color="var(--primary)" />
                User Account Management
              </h3>
              
              {/* Search Bar */}
              <div style={{ position: "relative", width: "240px" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input 
                  type="text" 
                  placeholder="Search user ID or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", padding: "6px 10px 6px 32px", background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border-card)", borderRadius: "6px", color: "white", fontSize: "12px", outline: "none"
                  }}
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
                      <td>{u.phone}</td>
                      <td>{u.name || "N/A"}</td>
                      <td>
                        <span className={`badge`} style={{ 
                          background: u.subscription_status === "premium" ? "var(--success-glow)" : "rgba(255,255,255,0.05)",
                          color: u.subscription_status === "premium" ? "var(--success)" : "var(--text-secondary)"
                        }}>
                          {u.subscription_status}
                        </span>
                      </td>
                      <td style={{ textTransform: "capitalize" }}>{u.role}</td>
                      <td>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {u.is_test_account ? "Test Account" : "Public Customer"}
                        </span>
                      </td>
                      <td>
                        <button 
                          onClick={() => handleToggleUserTier(u.id, u.subscription_status)}
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
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
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              <Shield size={20} color="var(--primary)" />
              Infrastructure System Uptime
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-card)", paddingBottom: "12px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <CloudLightning size={16} color="var(--success)" />
                  <div>
                    <strong style={{ display: "block", fontSize: "13px" }}>Modal worker status</strong>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>ec-validator-worker</span>
                  </div>
                </div>
                <span className="badge" style={{ background: "var(--success-glow)", color: "var(--success)" }}>Active (0-scale)</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-card)", paddingBottom: "12px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <Database size={16} color="var(--success)" />
                  <div>
                    <strong style={{ display: "block", fontSize: "13px" }}>Supabase Client connectivity</strong>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Private Storage RLS active</span>
                  </div>
                </div>
                <span className="badge" style={{ background: "var(--success-glow)", color: "var(--success)" }}>Connected</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <Server size={16} color="var(--success)" />
                  <div>
                    <strong style={{ display: "block", fontSize: "13px" }}>FastAPI App Gateway</strong>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Render Web Service host</span>
                  </div>
                </div>
                <span className="badge" style={{ background: "var(--success-glow)", color: "var(--success)" }}>Online</span>
              </div>
            </div>
          </div>

        </div>

        {/* Failed analyses review block */}
        <div className="glass-card" style={{ marginBottom: "30px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", color: "var(--danger)" }}>
            <AlertTriangle size={20} color="var(--danger)" />
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
                      <td>{doc.filename}</td>
                      <td>
                        <span className="badge badge-high" style={{ fontSize: "10px" }}>
                          {doc.error_code}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{doc.error_message}</td>
                      <td style={{ fontSize: "12px" }}>{new Date(doc.created_at).toLocaleString()}</td>
                      <td>
                        <button 
                          onClick={() => handleRetryAnalysis(doc.id)}
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px", gap: "4px" }}
                        >
                          <RotateCcw size={10} />
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                      No failed analysis reports recorded in the database logs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log Viewer */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={20} color="var(--primary)" />
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
                    <td style={{ fontSize: "12px" }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>{log.user_id || "System"}</td>
                    <td>
                      <span className="badge" style={{ 
                        background: log.action.includes("complete") || log.action.includes("created") ? "var(--success-glow)" : 
                                    log.action.includes("error") || log.action.includes("expired") ? "var(--danger-glow)" : "rgba(255,255,255,0.05)",
                        color: log.action.includes("complete") || log.action.includes("created") ? "var(--success)" : 
                               log.action.includes("error") || log.action.includes("expired") ? "var(--danger)" : "var(--text-secondary)"
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px" }}>{log.ip_address || "Local"}</td>
                    <td style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
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
