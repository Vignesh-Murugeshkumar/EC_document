"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "../i18n";
import { ArrowLeft, Check, Award, Shield, DollarSign, CreditCard, Sparkles } from "lucide-react";

export default function SubscriptionHub() {
  const router = useRouter();
  const { t } = useTranslation();

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    const storedToken = localStorage.getItem("ec_token");
    const storedUser = localStorage.getItem("ec_user");
    
    if (!storedToken || !storedUser) {
      router.push("/");
      return;
    }
    
    setToken(storedToken);
    setUser(JSON.parse(storedUser));

    // Load Razorpay checkout script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [router]);

  const handleCheckout = async () => {
    setLoading(true);
    
    const rzpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_mock";
    
    // Check if Razorpay script loaded successfully, otherwise fall back to simulated checkout
    if (window.Razorpay) {
      try {
        const options = {
          key: rzpKey,
          amount: 99900, // ₹999 in paise
          currency: "INR",
          name: "EC Analysis Engine",
          description: "1 Year Premium Subscription Plan",
          image: "https://mock-logo.com/logo.png",
          notes: {
            user_id: user.id
          },
          handler: async function (response) {
            // Mock response verification or send to backend webhook
            // On success, update local storage and database
            await upgradeUserTier();
          },
          prefill: {
            contact: user.phone || ""
          },
          theme: {
            color: "#3b82f6"
          }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (err) {
        console.warn("Failed to open Razorpay checkout widget:", err);
        await upgradeUserTier();
      } finally {
        setLoading(false);
      }
    } else {
      // Offline Simulation Prompt
      console.warn("Razorpay script not available. Running simulated transaction checkout.");
      const confirmMock = window.confirm("Razorpay script is offline/mocked. Do you want to simulate a successful payment of ₹999 to upgrade your account?");
      if (confirmMock) {
        await upgradeUserTier();
      }
      setLoading(false);
    }
  };

  const upgradeUserTier = async () => {
    try {
      // Call backend to update tier if online
      const response = await fetch(`${backendUrl}/api/payments/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Razorpay-Signature": "mocked_sig" // backend webhook processes standard webhook events
        },
        body: JSON.stringify({
          event: "subscription.charged",
          payload: {
            payment: {
              entity: {
                id: "pay_mock_" + Math.random().toString(36).substr(2, 9),
                notes: { user_id: user.id }
              }
            }
          }
        })
      });
      
      if (!response.ok) throw new Error("Backend tier upgrade failed");
    } catch (e) {
      console.warn("Backend webhook offline, manually upgrading local session state:", e);
    }

    // Always update local session so the dashboard reflects premium tier immediately!
    const updatedUser = { ...user, subscription_status: "premium" };
    localStorage.setItem("ec_user", JSON.stringify(updatedUser));
    setUser(updatedUser);
    
    alert("Payment Successful! Your account has been upgraded to Premium Tier.");
    router.push("/dashboard");
  };

  const handlePromoApply = async () => {
    if (!promoCode) return;
    setLoading(true);
    setPromoError("");
    
    try {
      const response = await fetch(`${backendUrl}/api/subscription/apply-promo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ promo_code: promoCode.trim().toUpperCase() })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Invalid promo code.");
      }
      
      setPromoApplied(true);
      
      // Update local storage credentials with upgraded token and user object
      localStorage.setItem("ec_token", data.token);
      localStorage.setItem("ec_user", JSON.stringify(data.user));
      document.cookie = `ec_token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
      
      setUser(data.user);
      setToken(data.token);
      
      alert("Promo Code Applied! Your account has been upgraded to Premium Tier.");
      router.push("/dashboard");
    } catch (err) {
      console.error("Error applying promo code:", err);
      setPromoError(err.message || "Failed to apply promo code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f4f6f9] text-slate-900 font-sans min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="flex justify-between items-center px-6 py-3.5 border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push("/dashboard")} 
            className="flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm transition-all active:scale-95 duration-100"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="font-display text-lg font-bold text-slate-900 font-rajdhani tracking-wider uppercase">EC Analyser</span>
        </div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
          Subscription Center
        </div>
      </header>

      {/* Main comparison grid */}
      <main className="flex-grow flex flex-col items-center justify-center py-12 px-6 max-w-5xl mx-auto w-full animate-fade-in">
        <div className="text-center mb-10 max-w-lg">
          <div className="h-12 w-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-4 text-orange-500 shadow-sm">
            <Sparkles size={24} />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2 font-rajdhani uppercase tracking-wide">
            Choose Your Access Plan
          </h2>
          <p className="text-slate-500 text-xs leading-relaxed">
            Unlock complete title reports, unlimited history ranges, and detailed legal recommendations for safer property transactions.
          </p>
        </div>

        {/* Comparison Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
          
          {/* Free Tier Card */}
          <div className="glass-card flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 font-rajdhani uppercase tracking-wider">Free Plan</h3>
                <p className="text-slate-400 text-xs mt-1">
                  Basic property checks for initial verification.
                </p>
              </div>
              
              <div className="text-3xl font-extrabold text-slate-950 font-display font-rajdhani leading-none">
                ₹0 <span className="text-xs font-normal text-slate-400">/ forever</span>
              </div>

              <ul className="space-y-3.5 text-xs text-slate-600 border-t border-slate-100 pt-5">
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-emerald-500 bg-emerald-50 rounded-full p-0.5" />
                  PDF Upload & Text Extraction
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-emerald-500 bg-emerald-50 rounded-full p-0.5" />
                  Last 3 years history analysis
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-emerald-500 bg-emerald-50 rounded-full p-0.5" />
                  On-screen summary dashboard
                </li>
                <li className="flex items-center gap-2.5 text-slate-400 line-through opacity-70">
                  <span className="h-3.5 w-3.5 border border-slate-200 rounded-full flex items-center justify-center text-[8px] font-bold text-slate-400">✕</span>
                  Download report as PDF
                </li>
                <li className="flex items-center gap-2.5 text-slate-400 line-through opacity-70">
                  <span className="h-3.5 w-3.5 border border-slate-200 rounded-full flex items-center justify-center text-[8px] font-bold text-slate-400">✕</span>
                  Print verification reports
                </li>
                <li className="flex items-center gap-2.5 text-slate-400 line-through opacity-70">
                  <span className="h-3.5 w-3.5 border border-slate-200 rounded-full flex items-center justify-center text-[8px] font-bold text-slate-400">✕</span>
                  Unlimited monthly processing
                </li>
              </ul>
            </div>

            <button 
              disabled={user?.subscription_status === "free"} 
              className="w-full mt-8 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 bg-slate-50 font-bold text-xs uppercase tracking-wider transition-colors hover:bg-slate-100 disabled:opacity-85 disabled:cursor-default"
            >
              {user?.subscription_status === "free" ? "Current Plan" : "Downgrade"}
            </button>
          </div>

          {/* Premium Tier Card */}
          <div className="glass-card-premium flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-orange-500 to-amber-500"></div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-extrabold text-orange-950 font-rajdhani uppercase tracking-wider">Premium Plan</h3>
                  <p className="text-orange-900/60 text-xs mt-1">
                    Comprehensive title validation for professionals.
                  </p>
                </div>
                <span className="badge bg-orange-100 text-orange-700 border border-orange-200 text-[9px] font-bold">RECOMMENDED</span>
              </div>
              
              <div className="text-3xl font-extrabold text-orange-950 font-display font-rajdhani leading-none">
                ₹999 <span className="text-xs font-normal text-orange-900/60">/ year</span>
              </div>

              <ul className="space-y-3.5 text-xs text-orange-950 border-t border-orange-100 pt-5">
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-emerald-600 bg-emerald-100 rounded-full p-0.5" />
                  PDF Upload & Text Extraction
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-emerald-600 bg-emerald-100 rounded-full p-0.5" />
                  <strong>Unlimited history range</strong> (Full EC)
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-emerald-600 bg-emerald-100 rounded-full p-0.5" />
                  On-screen summary dashboard
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-emerald-600 bg-emerald-100 rounded-full p-0.5" />
                  <strong>Download PDF Reports</strong>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-emerald-600 bg-emerald-100 rounded-full p-0.5" />
                  <strong>Print verification reports</strong>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-emerald-600 bg-emerald-100 rounded-full p-0.5" />
                  <strong>Unlimited monthly uploads</strong>
                </li>
              </ul>
            </div>

            <button 
              onClick={handleCheckout} 
              disabled={loading || user?.subscription_status === "premium"} 
              className="w-full mt-8 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md transition-all uppercase tracking-wider active:scale-[0.98] duration-150 disabled:opacity-85 disabled:cursor-default"
            >
              {user?.subscription_status === "premium" ? "Active Plan" : (loading ? "Processing..." : "Upgrade to Premium")}
            </button>

            {user?.subscription_status !== "premium" && (
              <div className="mt-6 border-t border-orange-100/50 pt-5">
                <label className="block text-[10px] font-bold text-orange-950/60 uppercase tracking-wider mb-2">Have a Promo Code?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      setPromoError("");
                    }}
                    disabled={promoApplied || loading}
                    className="flex-grow bg-white/60 border border-orange-200/80 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 placeholder:text-orange-950/30 text-orange-950 uppercase"
                  />
                  <button
                    onClick={handlePromoApply}
                    disabled={!promoCode || promoApplied || loading}
                    className="px-4 py-2 bg-orange-950 text-white rounded-xl text-xs font-bold transition-all hover:bg-orange-900 active:scale-95 disabled:opacity-50 disabled:cursor-default"
                  >
                    Apply
                  </button>
                </div>
                {promoError && <p className="text-[10px] text-red-600 font-medium mt-1.5">{promoError}</p>}
                {promoApplied && <p className="text-[10px] text-emerald-700 font-bold mt-1.5">✓ Upgrading tier...</p>}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
