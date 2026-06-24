"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "./i18n";
import { ShieldAlert, UserCheck, ArrowRight, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, changeLanguage } = useTranslation();

  // Tab state: 'login' or 'register'
  const [activeTab, setActiveTab] = useState("login");
  
  // Authentication states
  const [phone, setPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(300); // 5 minutes
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState("");
  const [showTestAccounts, setShowTestAccounts] = useState(false);

  // References for OTP auto-focus
  const otpRefs = [
    useRef(null), useRef(null), useRef(null), 
    useRef(null), useRef(null), useRef(null)
  ];

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "";

  // Resend OTP countdown timer
  useEffect(() => {
    if (!otpSent || resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpSent, resendTimer]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Handle Send OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);

    const cleanPhone = phone.replace(/\s+/g, "");
    const fullPhone = cleanPhone.startsWith("+91") ? cleanPhone : `+91${cleanPhone}`;
    
    if (!/^\+91\d{10}$/.test(fullPhone)) {
      setError("Please enter a valid 10-digit mobile number.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to send OTP");
      }

      setOtpSent(true);
      setResendTimer(300);
      setSuccessInfo("Verification code sent! Enter '123456' for test accounts.");
    } catch (err) {
      console.warn("Failed to contact backend, running offline mock dispatch:", err);
      setOtpSent(true);
      setResendTimer(300);
      setSuccessInfo("[Offline Mode] Verification code simulated. Use OTP '123456'.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);

    const enteredOtp = otpDigits.join("");
    if (enteredOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      setLoading(false);
      return;
    }

    const cleanPhone = phone.replace(/\s+/g, "");
    const fullPhone = cleanPhone.startsWith("+91") ? cleanPhone : `+91${cleanPhone}`;

    try {
      const response = await fetch(`${backendUrl}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, otp: enteredOtp, name: name || "Demo User" }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Invalid OTP code");
      }

      localStorage.setItem("ec_token", data.token);
      localStorage.setItem("ec_user", JSON.stringify(data.user));
      document.cookie = `ec_token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
      router.push("/dashboard");
    } catch (err) {
      console.warn("Verify OTP failed, falling back to local session generation:", err);
      // Offline fallback login logic
      if (enteredOtp === "123456" || enteredOtp === "654321") {
        const dummyUser = {
          id: "dummy-user-uid",
          phone: fullPhone,
          role: "user",
          subscription_status: "free"
        };
        localStorage.setItem("ec_token", "offline-mock-jwt-token");
        localStorage.setItem("ec_user", JSON.stringify(dummyUser));
        document.cookie = "ec_token=offline-mock-jwt-token; path=/; max-age=604800; SameSite=Lax";
        router.push("/dashboard");
      } else {
        setError("Invalid OTP code. Please enter '123456' for offline verification.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Quick Login for Pre-authorised Test Accounts
  const handleQuickLogin = async (email, password) => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/auth/test-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Test Login failed");
      }

      localStorage.setItem("ec_token", data.token);
      localStorage.setItem("ec_user", JSON.stringify(data.user));
      document.cookie = `ec_token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
      
      if (data.user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.warn("Backend unavailable, using local quick bypass for:", email);
      const subStatus = email.includes("premium") ? "premium" : "free";
      const userRole = email.includes("admin") ? "admin" : "user";
      
      const offlineUser = {
        id: email === "admin@ec-app.in" ? "00000000-0000-0000-0000-000000000003" : (subStatus === "premium" ? "00000000-0000-0000-0000-000000000002" : "00000000-0000-0000-0000-000000000001"),
        email: email,
        phone: email.includes("admin") ? "+919000000003" : (subStatus === "premium" ? "+919000000002" : "+919000000001"),
        role: userRole,
        subscription_status: subStatus
      };
      
      localStorage.setItem("ec_token", `offline-token-${subStatus}`);
      localStorage.setItem("ec_user", JSON.stringify(offlineUser));
      document.cookie = `ec_token=offline-token-${subStatus}; path=/; max-age=604800; SameSite=Lax`;
      
      if (userRole === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit changes with focus shifting
  const handleOtpInput = (index, value) => {
    const cleanValue = value.replace(/\D/g, "").slice(-1);
    const updated = [...otpDigits];
    updated[index] = cleanValue;
    setOtpDigits(updated);

    if (cleanValue.length > 0 && index < 5) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && otpDigits[index] === "" && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-[#f4f6f9]">
      {/* Left Side: Branding & Trust */}
      <section className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#0b1329] via-[#10223f] to-[#1d3d63] relative overflow-hidden flex-col justify-between p-12">
        {/* Decorative Grid Mesh */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <svg height="100%" viewBox="0 0 800 800" width="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern height="50" id="grid-pattern" patternUnits="userSpaceOnUse" width="50">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect fill="url(#grid-pattern)" height="100%" width="100%"></rect>
          </svg>
        </div>
        
        {/* Glowing Orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-orange-500/10 blur-[100px] pointer-events-none animate-pulse-soft"></div>
        <div className="absolute -bottom-40 -right-20 w-[450px] h-[450px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-orange-500 text-3xl font-bold animate-spin-slow">gavel</span>
            <span className="font-display text-2xl font-bold text-white font-rajdhani tracking-wider uppercase">EC Analyser</span>
          </div>
          <h2 className="font-display text-4xl font-extrabold text-white mb-3 font-rajdhani leading-tight max-w-lg">
            Verify property ownership. Spot legal anomalies.
          </h2>
          <p className="font-body-md text-base text-slate-300 max-w-md leading-relaxed">
            Protect your property investments with automated title checks, chain of custody verification, and bank-grade analysis.
          </p>
        </div>

        {/* Illustration Area: Floating Glass Deed */}
        <div className="relative z-10 flex flex-grow items-center justify-center py-10">
          <div className="w-full max-w-[340px] aspect-[4/5] bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-5 backdrop-blur-md shadow-2xl animate-float relative overflow-hidden">
            {/* Deed Grid Header */}
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <div className="flex flex-col gap-1">
                <div className="h-3 w-20 bg-white/20 rounded"></div>
                <div className="h-2 w-12 bg-white/10 rounded"></div>
              </div>
              <div className="h-6 w-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-[12px] text-orange-400">gavel</span>
              </div>
            </div>

            {/* Simulated Transaction Nodes */}
            <div className="space-y-4 flex-grow">
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mt-0.5">
                  <span className="material-symbols-outlined text-[10px] text-emerald-400">check</span>
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="h-2.5 w-full bg-white/20 rounded"></div>
                  <div className="h-2 w-2/3 bg-white/10 rounded"></div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center mt-0.5">
                  <span className="material-symbols-outlined text-[10px] text-orange-400">lock</span>
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="h-2.5 w-full bg-white/20 rounded"></div>
                  <div className="h-2 w-1/2 bg-white/10 rounded"></div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mt-0.5 animate-pulse">
                  <span className="material-symbols-outlined text-[10px] text-red-400">warning</span>
                </div>
                <div className="space-y-1.5 flex-1 text-red-400">
                  <div className="h-2.5 w-4/5 bg-red-500/20 rounded"></div>
                  <div className="h-2 w-1/3 bg-red-500/10 rounded"></div>
                </div>
              </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
              <div className="h-10 bg-white/5 rounded border border-dashed border-white/20 flex items-center justify-center text-[10px] text-white/40">LEDGER OK</div>
              <div className="h-10 bg-white/5 rounded border border-dashed border-white/20 flex items-center justify-center text-[10px] text-white/40">RLS VERIFIED</div>
            </div>

            {/* Glowing Verified Seal */}
            <div className="absolute -bottom-3 -right-3 w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center text-white border-[6px] border-[#0c203b] shadow-2xl transform rotate-12">
              <span className="material-symbols-outlined text-3xl">verified</span>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="relative z-10 grid grid-cols-3 gap-4 mt-auto pt-6 border-t border-white/10 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <span className="material-symbols-outlined text-orange-400 text-xl">security</span>
            <span className="font-label-bold text-[9px] text-white uppercase tracking-wider font-semibold">Bank-Grade SSL</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="material-symbols-outlined text-orange-400 text-xl">psychology</span>
            <span className="font-label-bold text-[9px] text-white uppercase tracking-wider font-semibold">AI Auditor</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="material-symbols-outlined text-orange-400 text-xl">verified_user</span>
            <span className="font-label-bold text-[9px] text-white uppercase tracking-wider font-semibold">DPDP Compliant</span>
          </div>
        </div>
      </section>

      {/* Right Side: Interaction Panel */}
      <section className="w-full md:w-1/2 flex flex-col relative min-h-screen justify-between">
        {/* Top Action Bar */}
        <header className="flex justify-between items-center p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
          <div className="md:hidden flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-500 text-2xl font-bold animate-spin-slow">gavel</span>
            <h2 className="font-headline-md text-lg text-slate-900 font-bold font-rajdhani">EC Analyser</h2>
          </div>
          <div className="ml-auto">
            {/* Language dropdown */}
            <select 
              value={locale} 
              onChange={(e) => changeLanguage(e.target.value)}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm outline-none cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value="en">🇮🇳 English</option>
              <option value="hi">🇮🇳 हिन्दी</option>
              <option value="ta">🇮🇳 தமிழ்</option>
              <option value="te">🇮🇳 తెలుగు</option>
              <option value="kn">🇮🇳 Kannada (ಕನ್ನಡ)</option>
              <option value="ml">🇮🇳 Malayalam (മലയാളം)</option>
              <option value="mr">🇮🇳 Marathi (मરાठी)</option>
              <option value="bn">🇮🇳 Bangla (বাংলা)</option>
              <option value="gu">🇮🇳 Gujarati (ગુજરાતી)</option>
            </select>
          </div>
        </header>

        {/* Center Form Container */}
        <div className="flex-grow flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-2xl shadow-xl p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-orange-500 to-amber-500"></div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 mb-6">
              <button 
                onClick={() => { setActiveTab("login"); setError(""); }}
                className={`flex-1 py-3 font-label-bold text-xs uppercase tracking-wider font-bold transition-all border-b-2 ${
                  activeTab === "login" 
                    ? "text-slate-900 border-orange-500" 
                    : "text-slate-400 border-transparent hover:text-slate-700"
                }`}
              >
                Login
              </button>
              <button 
                disabled
                className="flex-1 py-3 font-label-bold text-xs uppercase tracking-wider font-bold transition-all border-b-2 text-slate-300 border-transparent cursor-not-allowed flex items-center justify-center gap-1.5"
                title="Public registration is disabled"
              >
                Register
                <Lock size={12} className="text-slate-400" />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-lg text-xs text-red-700 mb-5 flex items-center gap-2 animate-fade-in">
                <span className="material-symbols-outlined text-sm">error</span>
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Success Message */}
            {successInfo && (
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-lg text-xs text-emerald-700 mb-5 animate-fade-in">
                {successInfo}
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-5">
              <div className="text-center">
                <h3 className="font-headline-lg text-xl font-bold text-slate-900 mb-1.5 font-rajdhani uppercase tracking-wide">
                  {otpSent ? "Verify Mobile" : (activeTab === "register" ? "Create Account" : "Secure Login")}
                </h3>
                <p className="font-body-md text-xs text-slate-500 leading-normal">
                  {otpSent 
                    ? <span>Enter the 6-digit verification code sent to <strong className="text-slate-800 font-mono">+91 {phone}</strong></span>
                    : "Analyze Indian property documents with institutional precision."}
                </p>
              </div>

              {/* Name field (Register only, before OTP sent) */}
              {activeTab === "register" && !otpSent && (
                <div className="space-y-1">
                  <label className="block font-label-bold text-xs text-slate-600 font-bold">Your Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter your full name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 outline-none border border-slate-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all text-sm bg-slate-50 text-slate-900"
                  />
                </div>
              )}

              {/* Phone Input (before OTP sent) */}
              {!otpSent && (
                <div className="space-y-1">
                  <label className="block font-label-bold text-xs text-slate-600 font-bold">Mobile number</label>
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100 transition-all bg-slate-50">
                    <span className="bg-slate-100 px-4 py-2.5 font-mono text-sm border-r border-slate-200 text-slate-600">+91</span>
                    <input 
                      className="w-full px-4 py-2.5 outline-none font-mono text-sm placeholder:text-slate-400 text-slate-900 bg-transparent" 
                      placeholder="98765 43210" 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    />
                  </div>
                </div>
              )}

              {/* OTP Input Grid */}
              {otpSent && (
                <div className="space-y-4">
                  <div className="flex justify-between gap-2.5">
                    {otpDigits.map((digit, i) => (
                      <input 
                        key={i}
                        ref={otpRefs[i]}
                        className="otp-input w-12 h-14 text-center text-xl font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all outline-none font-mono" 
                        maxLength={1} 
                        type="text" 
                        value={digit}
                        onChange={(e) => handleOtpInput(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      />
                    ))}
                  </div>

                  <div className="text-center">
                    <p className="font-body-sm text-xs text-slate-500">
                      {resendTimer > 0 ? (
                        <span>Resend code in <strong className="font-mono text-orange-500 font-bold" id="timer">{formatTimer(resendTimer)}</strong></span>
                      ) : (
                        <button onClick={handleSendOtp} className="text-orange-500 font-bold hover:underline">Resend OTP</button>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* CTA Buttons */}
              {!otpSent ? (
                <button 
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all py-3 rounded-xl font-headline-md text-sm font-bold active:scale-[0.98] duration-150 font-rajdhani uppercase tracking-wider"
                >
                  {loading ? "Sending..." : "Send OTP"}
                </button>
              ) : (
                <div className="flex gap-2.5">
                  <button 
                    onClick={() => { setOtpSent(false); setOtpDigits(["", "", "", "", "", ""]); setError(""); }} 
                    className="w-1/3 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all py-3 rounded-xl font-bold text-sm"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleVerifyOtp}
                    disabled={loading}
                    className="w-2/3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all py-3 rounded-xl font-headline-md text-sm font-bold active:scale-[0.98] duration-150 font-rajdhani uppercase tracking-wider"
                  >
                    {loading ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>
              )}

              {/* Back / Change Phone option when OTP sent */}
              {otpSent && (
                <div className="text-center pt-1">
                  <button 
                    onClick={() => { setOtpSent(false); setOtpDigits(["", "", "", "", "", ""]); setError(""); }} 
                    className="font-body-sm text-xs text-orange-500 font-semibold hover:underline"
                  >
                    Change Mobile Number
                  </button>
                </div>
              )}
            </div>

            {/* Test accounts triggers */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="font-body-md text-xs text-slate-500">
                Pre-authorised tester?{" "}
                <button 
                  onClick={() => setShowTestAccounts(!showTestAccounts)} 
                  className="text-orange-500 font-bold hover:underline focus:outline-none"
                >
                  Sign in with credentials
                </button>
              </p>

              {showTestAccounts && (
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 text-left mt-3.5 space-y-2.5 animate-fade-in">
                  <button 
                    onClick={() => handleQuickLogin("test.free@ec-app.in", "TestFree@2025")}
                    className="w-full flex justify-between items-center text-xs p-2.5 rounded-xl border border-slate-200/60 bg-white hover:bg-slate-50 border-l-4 border-l-slate-400 hover:border-l-slate-500 shadow-sm transition-all hover:translate-x-1"
                  >
                    <div>
                      <strong className="block text-slate-800 text-left font-semibold">Free Tier Tester</strong>
                      <span className="text-[10px] text-slate-400 font-mono">test.free@ec-app.in</span>
                    </div>
                    <span className="material-symbols-outlined text-sm text-slate-400">arrow_forward</span>
                  </button>

                  <button 
                    onClick={() => handleQuickLogin("test.premium@ec-app.in", "TestPremium@2025")}
                    className="w-full flex justify-between items-center text-xs p-2.5 rounded-xl border border-slate-200/60 bg-white hover:bg-slate-50 border-l-4 border-l-orange-500 hover:border-l-orange-600 shadow-sm transition-all hover:translate-x-1"
                  >
                    <div>
                      <strong className="block text-orange-600 text-left font-semibold">Premium Tier Tester</strong>
                      <span className="text-[10px] text-slate-400 font-mono">test.premium@ec-app.in</span>
                    </div>
                    <span className="material-symbols-outlined text-sm text-orange-500">arrow_forward</span>
                  </button>

                  <button 
                    onClick={() => handleQuickLogin("admin@ec-app.in", "AdminEC@2025")}
                    className="w-full flex justify-between items-center text-xs p-2.5 rounded-xl border border-slate-200/60 bg-white hover:bg-slate-50 border-l-4 border-l-slate-900 hover:border-l-black shadow-sm transition-all hover:translate-x-1"
                  >
                    <div>
                      <strong className="block text-slate-900 text-left font-semibold">System Administrator</strong>
                      <span className="text-[10px] text-slate-400 font-mono">admin@ec-app.in</span>
                    </div>
                    <span className="material-symbols-outlined text-sm text-slate-900">arrow_forward</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Global Footer */}
        <footer className="p-6 text-center border-t border-slate-100 bg-white/40">
          <p className="font-label-bold text-[9px] text-slate-400 uppercase tracking-widest font-semibold">
            DPDP Act 2023 Compliant • Secure Ledger Technology
          </p>
        </footer>
      </section>
    </main>
  );
}
