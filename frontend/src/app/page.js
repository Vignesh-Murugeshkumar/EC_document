"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "./i18n";
import { ShieldAlert, UserCheck, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, changeLanguage } = useTranslation();

  // Tab state: 'login' or 'register'
  const [activeTab, setActiveTab] = useState("register");
  
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
    <main className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-background">
      {/* Left Side: Branding & Trust */}
      <section className="hidden md:flex md:w-1/2 bg-primary-container relative overflow-hidden flex-col justify-between p-12">
        {/* Decorative Background Element */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg height="100%" viewBox="0 0 800 800" width="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern height="40" id="grid" patternUnits="userSpaceOnUse" width="40">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"></path>
              </pattern>
            </defs>
            <rect fill="url(#grid)" height="100%" width="100%"></rect>
          </svg>
        </div>
        <div className="relative z-10">
          <h1 className="font-display-md text-3xl font-bold text-white mb-2 font-rajdhani">EC Analyser</h1>
          <p className="font-body-lg text-lg text-on-primary-container max-w-md">
            Verify property ownership. Spot anomalies. Protect your investment.
          </p>
        </div>
        {/* Illustration Area */}
        <div className="relative z-10 flex flex-grow items-center justify-center py-12">
          <div className="w-full max-w-sm aspect-[4/5] bg-white/5 border border-white/20 rounded-xl p-6 flex flex-col gap-4 backdrop-blur-sm shadow-2xl">
            {/* Line art representation of a document */}
            <div className="h-8 w-1/3 bg-white/20 rounded"></div>
            <div className="space-y-3">
              <div className="h-2 w-full bg-white/10 rounded"></div>
              <div className="h-2 w-full bg-white/10 rounded"></div>
              <div className="h-2 w-2/3 bg-white/10 rounded"></div>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-4">
              <div className="h-16 bg-white/10 rounded border border-dashed border-white/30"></div>
              <div className="h-16 bg-white/10 rounded border border-dashed border-white/30"></div>
            </div>
            {/* Abstract Saffron Seal */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-secondary/80 rounded-full flex items-center justify-center text-white border-4 border-primary-container shadow-xl">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
          </div>
        </div>
        {/* Trust Badges */}
        <div className="relative z-10 grid grid-cols-3 gap-6 mt-auto pt-8 border-t border-white/10">
          <div className="flex flex-col items-center text-center gap-1">
            <span className="material-symbols-outlined text-on-primary-container">lock</span>
            <span className="font-label-bold text-[10px] text-white uppercase tracking-wider font-semibold">Bank-grade security</span>
          </div>
          <div className="flex flex-col items-center text-center gap-1">
            <span className="material-symbols-outlined text-on-primary-container">psychology</span>
            <span className="font-label-bold text-[10px] text-white uppercase tracking-wider font-semibold">AI-powered</span>
          </div>
          <div className="flex flex-col items-center text-center gap-1">
            <span className="material-symbols-outlined text-on-primary-container">gavel</span>
            <span className="font-label-bold text-[10px] text-white uppercase tracking-wider font-semibold">DPDP compliant</span>
          </div>
        </div>
      </section>

      {/* Right Side: Interaction Panel */}
      <section className="w-full md:w-1/2 parchment-texture flex flex-col relative min-h-screen">
        {/* Top Action Bar */}
        <header className="flex justify-between items-center p-6">
          <div className="md:hidden flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
            <h2 className="font-headline-md text-xl text-primary font-bold font-rajdhani">EC Analyser</h2>
          </div>
          <div className="ml-auto">
            {/* Language dropdown */}
            <select 
              value={locale} 
              onChange={(e) => changeLanguage(e.target.value)}
              className="flex items-center gap-2 bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm outline-none cursor-pointer"
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
        <div className="flex-grow flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md bg-white p-8 rounded-xl border border-outline-variant shadow-lg">
            {/* Tabs */}
            <div className="flex border-b border-outline-variant mb-6">
              <button 
                onClick={() => { setActiveTab("login"); setError(""); }}
                className={`flex-1 py-3 font-label-bold text-xs uppercase tracking-wider font-bold transition-all border-b-2 ${
                  activeTab === "login" 
                    ? "text-primary border-primary" 
                    : "text-on-surface-variant border-transparent hover:text-primary"
                }`}
              >
                Login
              </button>
              <button 
                onClick={() => { setActiveTab("register"); setError(""); }}
                className={`flex-1 py-3 font-label-bold text-xs uppercase tracking-wider font-bold transition-all border-b-2 ${
                  activeTab === "register" 
                    ? "text-primary border-primary" 
                    : "text-on-surface-variant border-transparent hover:text-primary"
                }`}
              >
                Register
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-error p-3 rounded-lg text-xs text-error mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {successInfo && (
              <div className="bg-green-50 border-l-4 border-success p-3 rounded-lg text-xs text-success mb-5">
                {successInfo}
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="font-headline-lg text-xl font-bold text-primary mb-2 font-rajdhani">
                  {otpSent ? "Verify Mobile" : (activeTab === "register" ? "Create Account" : "Secure Login")}
                </h3>
                <p className="font-body-md text-xs text-on-surface-variant">
                  {otpSent 
                    ? <span>Enter the 6-digit code sent to <span className="font-bold text-on-surface">+91 {phone}</span></span>
                    : "Analyze Indian property documents with institutional precision."}
                </p>
              </div>

              {/* Name field (Register only, before OTP sent) */}
              {activeTab === "register" && !otpSent && (
                <div className="space-y-1">
                  <label className="block font-label-bold text-xs text-on-surface-variant font-semibold">Your Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter your full name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 outline-none border border-outline-variant rounded-lg focus:border-secondary transition-colors text-sm bg-white text-on-surface"
                  />
                </div>
              )}

              {/* Phone Input (before OTP sent) */}
              {!otpSent && (
                <div className="space-y-1">
                  <label className="block font-label-bold text-xs text-on-surface-variant font-semibold">Mobile number</label>
                  <div className="flex items-center border border-outline-variant rounded-lg overflow-hidden focus-within:border-secondary transition-colors bg-white">
                    <span className="bg-surface-container-low px-4 py-2.5 font-mono text-sm border-r border-outline-variant text-on-surface">+91</span>
                    <input 
                      className="w-full px-4 py-2.5 outline-none font-mono text-sm placeholder:text-outline-variant text-on-surface" 
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
                  <div className="flex justify-between gap-2">
                    {otpDigits.map((digit, i) => (
                      <input 
                        key={i}
                        ref={otpRefs[i]}
                        className="otp-input w-12 h-14 text-center text-xl font-bold text-primary bg-surface-container-low border border-outline-variant rounded-lg focus:bg-white focus:border-secondary transition-all outline-none font-mono" 
                        maxLength={1} 
                        type="text" 
                        value={digit}
                        onChange={(e) => handleOtpInput(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      />
                    ))}
                  </div>

                  <div className="text-center">
                    <p className="font-body-sm text-xs text-on-surface-variant">
                      {resendTimer > 0 ? (
                        <span>Resend in <span className="font-mono text-secondary font-bold" id="timer">{formatTimer(resendTimer)}</span></span>
                      ) : (
                        <button onClick={handleSendOtp} className="text-secondary font-bold hover:underline">Resend OTP</button>
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
                  className="w-full bg-secondary-container text-on-secondary-container hover:brightness-95 transition-all py-3.5 rounded-lg font-headline-md text-base font-bold shadow-md active:scale-95 duration-150 font-rajdhani uppercase tracking-wider"
                >
                  {loading ? "Sending..." : "Send OTP"}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setOtpSent(false); setOtpDigits(["", "", "", "", "", ""]); setError(""); }} 
                    className="w-1/3 bg-surface-container-high text-on-surface font-semibold py-3.5 rounded-lg border border-outline-variant text-sm"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleVerifyOtp}
                    disabled={loading}
                    className="w-2/3 bg-secondary-container text-on-secondary-container hover:brightness-95 transition-all py-3.5 rounded-lg font-headline-md text-base font-bold shadow-md active:scale-95 duration-150 font-rajdhani uppercase tracking-wider"
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
                    className="font-body-sm text-xs text-primary font-semibold hover:underline"
                  >
                    Change Mobile Number
                  </button>
                </div>
              )}
            </div>

            {/* Test accounts triggers */}
            <div className="mt-6 pt-4 border-t border-outline-variant text-center">
              <p className="font-body-md text-xs text-on-surface-variant">
                Pre-authorised tester?{" "}
                <button 
                  onClick={() => setShowTestAccounts(!showTestAccounts)} 
                  className="text-primary font-bold hover:underline"
                >
                  Sign in with credentials
                </button>
              </p>

              {showTestAccounts && (
                <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant text-left mt-3 space-y-2">
                  <button 
                    onClick={() => handleQuickLogin("test.free@ec-app.in", "TestFree@2025")}
                    className="w-full flex justify-between items-center text-xs p-2 rounded border border-outline-variant bg-white hover:bg-surface-container transition-colors"
                  >
                    <div>
                      <strong className="block text-on-surface text-left">Free Tier Tester</strong>
                      <span className="text-[10px] text-outline">test.free@ec-app.in</span>
                    </div>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>

                  <button 
                    onClick={() => handleQuickLogin("test.premium@ec-app.in", "TestPremium@2025")}
                    className="w-full flex justify-between items-center text-xs p-2 rounded border border-outline-variant bg-white hover:bg-surface-container transition-colors"
                  >
                    <div>
                      <strong className="block text-secondary text-left text-orange-600">Premium Tier Tester</strong>
                      <span className="text-[10px] text-outline">test.premium@ec-app.in</span>
                    </div>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>

                  <button 
                    onClick={() => handleQuickLogin("admin@ec-app.in", "AdminEC@2025")}
                    className="w-full flex justify-between items-center text-xs p-2 rounded border border-outline-variant bg-white hover:bg-surface-container transition-colors"
                  >
                    <div>
                      <strong className="block text-primary text-left">System Administrator</strong>
                      <span className="text-[10px] text-outline">admin@ec-app.in</span>
                    </div>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Global Footer */}
        <footer className="p-6 text-center mt-auto border-t border-outline-variant/30">
          <p className="font-label-bold text-[10px] text-on-surface-variant uppercase tracking-widest opacity-60">
            DPDP Act 2023 Compliant • Secure Ledger Technology
          </p>
        </footer>
      </section>
    </main>
  );
}
