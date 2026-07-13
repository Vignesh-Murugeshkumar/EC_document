import os
import time
import math
import hashlib
import re
import json
import jwt
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
import PyPDF2
from supabase import create_client, Client
import razorpay

# Custom .env loader to load local environment variables before config resolution
def load_env():
    possible_paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        os.path.join(os.getcwd(), ".env"),
        ".env"
    ]
    for path in possible_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip()
                            # Strip quotes
                            if val.startswith(('"', "'")) and val.endswith(('"', "'")):
                                val = val[1:-1]
                            if key not in os.environ:
                                os.environ[key] = val
                print(f"[load_env] Successfully loaded environment from {path}")
                break
            except Exception as e:
                print(f"[load_env] Error loading env from {path}: {e}")

load_env()

app = FastAPI(title="EC Analysis API", version="1.0.0")

# Enable CORS for Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def refresh_supabase_client_middleware(request: Request, call_next):
    try:
        get_supabase()
    except Exception as e:
        print(f"[Middleware Supabase Refresh Error] {str(e)}")
    response = await call_next(request)
    return response

# Load configuration from environment
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mock-supabase.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "mock-key")
JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "super-secret-jwt-signing-key-for-ec-app-2025")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "rzp_test_mock")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "mock_secret")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "mock_webhook_secret")


# Initialize Supabase client lazily to avoid stale httpx connection pools
# across Vercel Lambda warm starts (prevents [Errno 16] Device or resource busy)
_supabase_client: Client = None
_supabase_client_created_at: float = 0
_SUPABASE_CLIENT_TTL = 30  # Recreate client every 30 seconds to prevent stale sockets

def get_supabase() -> Client:
    """Return a Supabase client, creating a fresh one if stale or missing."""
    global _supabase_client, _supabase_client_created_at, supabase
    now = time.time()
    if _supabase_client is None or (now - _supabase_client_created_at) > _SUPABASE_CLIENT_TTL:
        try:
            if _supabase_client is not None:
                try:
                    if hasattr(_supabase_client, "postgrest") and hasattr(_supabase_client.postgrest, "session"):
                        _supabase_client.postgrest.session.close()
                except Exception:
                    pass
                try:
                    if hasattr(_supabase_client, "storage") and hasattr(_supabase_client.storage, "session"):
                        _supabase_client.storage.session.close()
                except Exception:
                    pass
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            _supabase_client_created_at = now
            supabase = _supabase_client
        except Exception as e:
            print(f"\n[SUPABASE INITIALIZATION ERROR] {str(e)}\n")
            if _supabase_client is None:
                raise
    return _supabase_client

# Backward-compatible global reference (used by monkeypatch and existing code)
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    _supabase_client = supabase
    _supabase_client_created_at = time.time()
except Exception as e:
    print(f"\n[SUPABASE INITIALIZATION ERROR] Running with mock Client fallback: {str(e)}\n")
    class MockTable:
        def select(self, *args, **kwargs): return self
        def insert(self, *args, **kwargs): return self
        def update(self, *args, **kwargs): return self
        def delete(self, *args, **kwargs): return self
        def eq(self, *args, **kwargs): return self
        def neq(self, *args, **kwargs): return self
        def order(self, *args, **kwargs): return self
        def limit(self, *args, **kwargs): return self
        def execute(self):
            class MockResponse:
                def __init__(self):
                    self.data = []
            return MockResponse()
            
    class MockStorageBucket:
        def upload(self, *args, **kwargs): return True
        def remove(self, *args, **kwargs): return True
        def create_signed_url(self, *args, **kwargs):
            return {"signedURL": "https://mock-supabase.supabase.co/signed-url"}
            
    class MockStorage:
        def from_(self, *args, **kwargs):
            return MockStorageBucket()
            
    class MockClient:
        def table(self, name): return MockTable()
        @property
        def storage(self): return MockStorage()
        
    supabase = MockClient()
    _supabase_client = supabase

# Monkeypatch postgrest sync request builders to handle [Errno 16] Device or resource busy
# and other transient connection/socket errors in serverless Vercel environments.
try:
    import postgrest
    sync_rb = None
    try:
        import postgrest._sync.request_builder as sync_rb
    except ImportError:
        try:
            import postgrest.request_builder as sync_rb
        except ImportError:
            pass
            
    if sync_rb:
        for name in dir(sync_rb):
            obj = getattr(sync_rb, name)
            if isinstance(obj, type) and "execute" in obj.__dict__:
                original_execute = obj.execute
                
                def make_wrapped_execute(orig_exec, class_name):
                    def wrapped_execute(self, *args, **kwargs):
                        import time
                        import httpx
                        import socket
                        from urllib.parse import urlparse
                        global supabase
                        
                        max_retries = 5
                        initial_delay = 0.3
                        delay = initial_delay
                        
                        for attempt in range(max_retries):
                            try:
                                return orig_exec(self, *args, **kwargs)
                            except Exception as e:
                                is_conn_error = False
                                # Catch httpx connection/OS/socket level errors
                                if isinstance(e, (httpx.HTTPError, OSError)):
                                    is_conn_error = True
                                elif hasattr(e, "__cause__") and isinstance(e.__cause__, OSError):
                                    is_conn_error = True
                                    
                                print(f"[Supabase Sync Query Attempt {attempt + 1} Failed] Class: {class_name} | Error: {str(e)}")
                                
                                if attempt == max_retries - 1:
                                    raise e
                                    
                                if is_conn_error:
                                    # DNS warmup: force a fresh getaddrinfo call to clear EBUSY state
                                    try:
                                        host = urlparse(SUPABASE_URL).hostname
                                        socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)
                                    except OSError:
                                        pass  # If DNS warmup itself fails, the retry will catch it
                                    
                                    # Close old httpx transport to release file descriptors
                                    try:
                                        if hasattr(self, 'session') and hasattr(self.session, 'close'):
                                            self.session.close()
                                    except Exception:
                                        pass
                                    try:
                                        if hasattr(supabase, 'postgrest') and hasattr(supabase.postgrest, 'session'):
                                            supabase.postgrest.session.close()
                                    except Exception:
                                        pass
                                    
                                    # Force-expire the client so get_supabase() builds a fresh one
                                    global _supabase_client_created_at
                                    _supabase_client_created_at = 0
                                    
                                    print(f"Recreating Supabase client (attempt {attempt + 1})...")
                                    try:
                                        fresh = get_supabase()
                                        supabase = fresh
                                        # Update the session reference on the current builder instance
                                        if hasattr(fresh, "postgrest") and hasattr(fresh.postgrest, "session"):
                                            self.session = fresh.postgrest.session
                                            print("Updated builder session reference to new client session.")
                                    except Exception as init_err:
                                        print(f"Failed to recreate Supabase client: {str(init_err)}")
                                        
                                time.sleep(delay)
                                delay *= 2
                    return wrapped_execute
                    
                obj.execute = make_wrapped_execute(original_execute, name)
                print(f"Monkeypatched {name}.execute successfully.")
except Exception as patch_err:
    print(f"Error applying postgrest execute monkeypatch: {str(patch_err)}")

rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# In-memory OTP Cache (phone -> {"otp": str, "expires_at": float})
OTP_STORE: Dict[str, Dict[str, Any]] = {}

# --- Pydantic Schemas ---
class OTPSendRequest(BaseModel):
    phone: str

class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = "Valued Customer"

class TierUpgradeRequest(BaseModel):
    subscription_status: str

class TestLoginRequest(BaseModel):
    email: str
    password: str



# --- JWT Helpers ---
def get_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid session token")

def get_admin_from_token(user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

# --- Audit Logging Helper ---
def log_audit_event(user_id: Optional[str], action: str, doc_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None, ip_address: Optional[str] = None):
    try:
        supabase.table("ec_audit_log").insert({
            "user_id": user_id,
            "action": action,
            "document_id": doc_id,
            "metadata": metadata or {},
            "ip_address": ip_address
        }).execute()
    except Exception as e:
        print(f"Error logging audit event: {str(e)}")

# --- Auth Endpoints ---

@app.post("/api/auth/send-otp")
async def send_otp(req: OTPSendRequest):
    phone = req.phone.strip()
    if not re.match(r"^\+91\d{10}$", phone):
        raise HTTPException(status_code=400, detail="Invalid Indian mobile number format. Must start with +91 followed by 10 digits.")
        
    # Generate 6-digit OTP
    import random
    otp = "".join([str(random.randint(0, 9)) for _ in range(6)])
        
    OTP_STORE[phone] = {
        "otp": otp,
        "expires_at": time.time() + 300 # 5 minutes expiry
    }
    
    # Mock SMS dispatch - print to terminal
    print(f"\n========================================")
    print(f"[SMS OTP DISPATCH] To: {phone} | OTP: {otp}")
    print(f"========================================\n")
    
    return {"status": "success", "message": f"OTP sent successfully. For testing, check the backend console logs."}

@app.post("/api/auth/verify-otp")
async def verify_otp(req: OTPVerifyRequest, request: Request):
    phone = req.phone.strip()
    otp = req.otp.strip()
    
    if phone not in OTP_STORE or OTP_STORE[phone]["expires_at"] < time.time():
         raise HTTPException(status_code=400, detail="Your OTP has expired. Please request a new one.")
         
    if OTP_STORE[phone]["otp"] != otp:
         raise HTTPException(status_code=400, detail="Invalid OTP code entered. Please try again.")
         
    # OTP verified, remove from store
    del OTP_STORE[phone]
    
    # Check if user profile already exists
    response = supabase.table("profiles").select("*").eq("phone", phone).execute()
    profile = response.data[0] if response.data else None
    
    if not profile:
        raise HTTPException(
            status_code=403, 
            detail="Public registration is disabled. Only pre-authorized mobile numbers are permitted to access this application."
        )
        
    user_id = profile["id"]
    role = profile["role"]
    sub_status = profile["subscription_status"]
        
    # Sign JWT session token
    payload = {
        "sub": user_id,
        "phone": phone,
        "role": role,
        "subscription_status": sub_status,
        "exp": int(time.time()) + 86400 * 7 # 7 days expiry
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    
    log_audit_event(user_id, "upload", ip_address=request.client.host, metadata={"method": "otp"})
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "phone": phone,
            "role": role,
            "subscription_status": sub_status
        }
    }

@app.post("/api/auth/test-login")
async def test_login(req: TestLoginRequest, request: Request):
    email = req.email.strip().lower()
    password = req.password.strip()
    
    # Standard email/password login using Supabase Auth REST endpoint
    import requests
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "email": email,
        "password": password
    }
    
    try:
        res = requests.post(url, json=payload, headers=headers)
        if res.status_code not in (200, 201):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
            
        data = res.json()
        user_id = data["user"]["id"]
        phone = data["user"].get("phone") or ""
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication server error: {str(e)}")
        
    # Retrieve user profile
    try:
        prof_resp = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if not prof_resp.data:
            # Fallback profile creation (e.g. if created externally)
            supabase.table("profiles").insert({
                "id": user_id,
                "phone": phone or "+910000000000",
                "name": email.split("@")[0],
                "role": "user",
                "subscription_status": "free"
            }).execute()
            role = "user"
            sub_status = "free"
        else:
            profile = prof_resp.data[0]
            role = profile.get("role", "user")
            sub_status = profile.get("subscription_status", "free")
            phone = profile.get("phone", phone)
    except Exception as e:
        print(f"[Supabase Profile Select/Insert Error] {e}")
        role = "user"
        sub_status = "free"
        
    # Sign custom backend JWT token
    payload_jwt = {
        "sub": user_id,
        "phone": phone,
        "role": role,
        "subscription_status": sub_status,
        "exp": int(time.time()) + 86400 * 7 # 7 days expiry
    }
    token = jwt.encode(payload_jwt, JWT_SECRET, algorithm="HS256")
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "phone": phone,
            "role": role,
            "subscription_status": sub_status
        }
    }



class RegisterProfileRequest(BaseModel):
    name: str
    phone: str
    plan: str

@app.post("/api/auth/register-profile")
async def register_profile(req: RegisterProfileRequest, request: Request, authorization: str = Header(None)):
    name = req.name.strip()
    phone = req.phone.strip()
    plan = req.plan.strip().lower()
    
    if not name or not phone or plan not in ("free", "premium"):
        raise HTTPException(status_code=400, detail="Missing or invalid profile registration parameters.")
        
    if not re.match(r"^\+91\d{10}$", phone):
        raise HTTPException(status_code=400, detail="Invalid Indian mobile number format. Must start with +91 followed by 10 digits.")
        
    # Verify Supabase Bearer token passed in the Authorization header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    sb_token = authorization.split(" ")[1]
    
    try:
        # Call Supabase Auth server directly using the SDK to verify the token and retrieve the user
        user_resp = supabase.auth.get_user(sb_token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid token: user not found.")
        user_id = user_resp.user.id
    except Exception as e:
        print(f"[Supabase Auth Debug] Token verification failed: {e}")
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")
        
    # Check if a profile with this ID already exists (idempotent login/registration)
    try:
        existing = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if existing.data:
            profile = existing.data[0]
            role = profile.get("role", "user")
            sub_status = profile.get("subscription_status", "free")
            
            # Log audit event
            log_audit_event(user_id, "subscription_created" if sub_status == "premium" else "upload", ip_address=request.client.host, metadata={"method": "supabase_native_register_existing", "plan": sub_status})
            
            payload_jwt = {
                "sub": user_id,
                "phone": profile.get("phone", phone),
                "role": role,
                "subscription_status": sub_status,
                "exp": int(time.time()) + 86400 * 7
            }
            token = jwt.encode(payload_jwt, JWT_SECRET, algorithm="HS256")
            
            return {
                "token": token,
                "user": {
                    "id": user_id,
                    "phone": profile.get("phone", phone),
                    "role": role,
                    "subscription_status": sub_status
                }
            }
    except Exception as e:
        print(f"[Supabase Select Profile Warning] {e}")
        
    # Check if the phone number is already registered by a different user
    try:
        dup_phone = supabase.table("profiles").select("id").eq("phone", phone).execute()
        if dup_phone.data and dup_phone.data[0]["id"] != user_id:
            raise HTTPException(status_code=400, detail="A user with this phone number is already registered.")
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"[Supabase Phone Check Warning] {e}")

    # Create profile in public.profiles since it doesn't exist
    try:
        expires = "now() + interval '1 year'" if plan == "premium" else None
        supabase.table("profiles").insert({
            "id": user_id,
            "phone": phone,
            "name": name,
            "role": "user",
            "subscription_status": plan,
            "subscription_expires_at": expires
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user profile in database: {str(e)}")
        
    # Log audit event
    log_audit_event(user_id, "subscription_created" if plan == "premium" else "upload", ip_address=request.client.host, metadata={"method": "supabase_native_register", "plan": plan})
    
    # Sign custom backend JWT session token
    payload_jwt = {
        "sub": user_id,
        "phone": phone,
        "role": "user",
        "subscription_status": plan,
        "exp": int(time.time()) + 86400 * 7 # 7 days expiry
    }
    token = jwt.encode(payload_jwt, JWT_SECRET, algorithm="HS256")
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "phone": phone,
            "role": "user",
            "subscription_status": plan
        }
    }



# --- Health Check ---
@app.get("/health")
async def health_check():
    return {"status": "ok"}



# --- Dynamic Supabase Configuration endpoint for frontend Realtime ---
@app.get("/api/config")
async def get_config():
    # If the official Supabase Anon Key is defined in environment, return it directly
    anon_key = os.environ.get("SUPABASE_ANON_KEY", "")
    if not anon_key:
        # Otherwise, fall back to dynamically generating a temporary anon JWT using the shared JWT_SECRET
        payload = {
            "role": "anon",
            "iss": "supabase",
            "iat": int(time.time()),
            "exp": int(time.time()) + 86400 * 365 # 1 year expiry
        }
        anon_key = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
        
    return {
        "supabaseUrl": SUPABASE_URL,
        "supabaseAnonKey": anon_key
    }


# --- Unified Paywall Configuration & Entitlement Layer ---
def apply_paywall_redaction(results: Dict[str, Any], sub_tier: str) -> Dict[str, Any]:
    """Apply paywall/tier-gating rules to analysis results.
    
    Free tier users only get access to the last 3 years of records.
    All older records are redacted/masked.
    """
    if sub_tier == "premium" or not results:
        return results
        
    redacted = results.copy()
    current_year = 2026  # System base clock year
    cutoff_year = current_year - 3  # last 3 years: 2024, 2025, 2026. Prior is locked.
    
    # Redact transactions before 2024
    masked_transactions = []
    for tx in redacted.get("transactions", []):
        if tx.get("year", 2026) < cutoff_year:
            masked_transactions.append({
                "entry_number": tx.get("entry_number"),
                "date": "XX-XX-XXXX",
                "year": tx.get("year"),
                "transaction_type": "Locked Feature",
                "parties": [{"name": "[Upgrade to Unlock]", "role": "Seller"}, {"name": "[Upgrade to Unlock]", "role": "Buyer"}],
                "survey_number": "XXX",
                "property_description": "This entry details are locked under the free tier. Please upgrade to Premium plan to view history older than 3 years.",
                "amount": "Locked"
            })
        else:
            masked_transactions.append(tx)
            
    # Redact ownership chain before 2024
    masked_chain = []
    for link in redacted.get("ownership_chain", []):
        if link.get("year", 2026) < cutoff_year:
            masked_chain.append({
                "transaction_id": link.get("transaction_id"),
                "from_party": "[Locked]",
                "to_party": "[Locked]",
                "year": link.get("year"),
                "status": "locked"
            })
        else:
            masked_chain.append(link)
            
    # Redact anomalies before 2024
    masked_anomalies = []
    for anom in redacted.get("anomalies", []):
        if anom.get("year", 2026) < cutoff_year:
            masked_anomalies.append({
                "type": anom.get("type"),
                "severity": anom.get("severity"),
                "year": anom.get("year"),
                "entry_number": anom.get("entry_number"),
                "description": "This anomaly occurred in a year outside your active range. Upgrade to Premium to see descriptions.",
                "recommendation": "Upgrade to Premium to view detailed legal recommendation."
            })
        else:
            masked_anomalies.append(anom)
            
    redacted["transactions"] = masked_transactions
    redacted["ownership_chain"] = masked_chain
    redacted["anomalies"] = masked_anomalies
    return redacted

# --- Document Endpoints ---

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    mode: str = "auto",
    language: str = "en",
    user: Dict[str, Any] = Depends(get_user_from_token),
    request: Request = None
):
    import uuid
    # 1. Enforce tier-based mode selection
    sub_tier = user.get("subscription_status", "free")
    mode_reason = ""
    if sub_tier == "free":
        # Free users are always locked to standard mode
        mode = "standard"
        mode_reason = "Free tier is limited to Standard mode."
    elif mode not in ("standard", "multi_agent", "auto"):
        # Sanitize invalid mode values; default premium users to auto
        mode = "auto"
        mode_reason = "Invalid mode specified, defaulting to Auto."
    else:
        if mode == "auto":
            mode_reason = "Auto mode: the optimal engine will be selected based on document complexity."
        elif mode == "standard":
            mode_reason = "Standard mode selected manually."
        else:
            mode_reason = "Multi-Agent mode selected manually."
    
    # 2. Enforce PDF only
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    # 3. Check Size (Max 20MB)
    contents = await file.read()
    file_size = len(contents)
    if file_size > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds the 20 MB limit. Please compress the PDF and try again.")
        
    # Calculate file SHA-256 hash
    sha256 = hashlib.sha256(contents).hexdigest()
    
    # 4. Read page count and metadata
    try:
        from io import BytesIO
        pdf_reader = PyPDF2.PdfReader(BytesIO(contents))
        page_count = len(pdf_reader.pages)
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to parse PDF metadata. The file might be corrupted.")
        
    if page_count > 200:
        raise HTTPException(status_code=400, detail="This document exceeds the 200-page limit. Please upload a shorter EC.")
        
    # --- Deduplication Cache-Hit Check ---
    try:
        dup_resp = get_supabase().table("ec_documents").select("*").eq("owner_id", user["sub"]).eq("sha256_hash", sha256).eq("status", "complete").execute()
        if dup_resp.data:
            existing_doc = dup_resp.data[0]
            doc_id = str(uuid.uuid4())
            get_supabase().table("ec_documents").insert({
                "id": doc_id,
                "owner_id": user["sub"],
                "filename": file.filename,
                "file_size": file_size,
                "page_count": page_count,
                "sha256_hash": sha256,
                "analysis_mode": mode,
                "status": "complete",
                "health_score": existing_doc.get("health_score"),
                "analysis_results": existing_doc.get("analysis_results"),
                "markdown_storage_path": existing_doc.get("markdown_storage_path"),
                "converter_version": existing_doc.get("converter_version")
            }).execute()
            
            log_audit_event(user["sub"], "upload", doc_id, {"filename": file.filename, "size": file_size, "page_count": page_count, "cached": True}, request.client.host)
            
            return {
                "document_id": doc_id,
                "status": "complete",
                "effective_mode": mode,
                "mode_reason": "Analysis retrieved instantly from cached document.",
                "filename": file.filename,
                "page_count": page_count,
                "cached": True
            }
    except Exception as dup_err:
        print(f"[DEDUPLICATION ERROR] {str(dup_err)}")

    # Generate unique document ID
    doc_id = str(uuid.uuid4())
    
    # 5. Upload file to Supabase private storage
    storage_path = f"{user['sub']}/{doc_id}.pdf"
    try:
        get_supabase().storage.from_("ec-documents").upload(
            path=storage_path,
            file=contents,
            file_options={"content-type": "application/pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save document: {str(e)}")
        
    # Insert entry into ec_documents database
    try:
        get_supabase().table("ec_documents").insert({
            "id": doc_id,
            "owner_id": user["sub"],
            "filename": file.filename,
            "file_size": file_size,
            "page_count": page_count,
            "sha256_hash": sha256,
            "analysis_mode": mode,
            "status": "queued"
        }).execute()
    except Exception as e:
        # Cleanup storage on failure
        try:
            get_supabase().storage.from_("ec-documents").remove([storage_path])
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to record document metadata: {str(e)}")
        
    # Log upload event
    log_audit_event(user["sub"], "upload", doc_id, {"filename": file.filename, "size": file_size, "page_count": page_count}, request.client.host)
    
    # 6. Insert entry into the durable analysis queue instead of triggering worker directly
    try:
        get_supabase().table("ec_analysis_queue").insert({
            "document_id": doc_id,
            "owner_id": user["sub"],
            "status": "pending"
        }).execute()
    except Exception as queue_err:
        # Cleanup database metadata and storage on failure
        try:
            get_supabase().table("ec_documents").delete().eq("id", doc_id).execute()
        except Exception:
            pass
        try:
            get_supabase().storage.from_("ec-documents").remove([storage_path])
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to queue document for analysis: {str(queue_err)}")
        
    return {
        "document_id": doc_id,
        "status": "queued",
        "effective_mode": mode,
        "mode_reason": mode_reason,
        "filename": file.filename,
        "page_count": page_count
    }

@app.get("/api/documents")
async def list_documents(user: Dict[str, Any] = Depends(get_user_from_token)):
    try:
        response = supabase.table("ec_documents").select("id", "filename", "status", "health_score", "created_at", "analysis_mode").eq("owner_id", user["sub"]).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        print(f"Error listing documents: {str(e)}")
        return []

@app.get("/api/documents/{document_id}")
async def get_document(document_id: str, user: Dict[str, Any] = Depends(get_user_from_token)):
    # Fetch document from DB
    doc_resp = supabase.table("ec_documents").select("*").eq("id", document_id).execute()
    if not doc_resp.data:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    doc = doc_resp.data[0]
    
    # Ensure owner matches or admin role
    if doc["owner_id"] != user["sub"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied to this document.")
        
    # Retrieve user's profile to inspect subscription tier
    prof_resp = supabase.table("profiles").select("subscription_status").eq("id", user["sub"]).execute()
    sub_tier = prof_resp.data[0]["subscription_status"] if prof_resp.data else "free"
    
    # Handle Free Tier Masking Constraints dynamically
    if user.get("role") != "admin" and doc["status"] == "complete" and doc["analysis_results"]:
        doc["analysis_results"] = apply_paywall_redaction(doc["analysis_results"], sub_tier)
        
    return doc

# --- Report Generation / Download Endpoint ---
@app.get("/api/reports/{document_id}/pdf")
async def download_report_pdf(document_id: str, user: Dict[str, Any] = Depends(get_user_from_token)):
    # 1. Fetch document and profile
    doc_resp = supabase.table("ec_documents").select("*").eq("id", document_id).execute()
    if not doc_resp.data:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    doc = doc_resp.data[0]
    
    # 2. Check Ownership
    if doc["owner_id"] != user["sub"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")
        
    # 3. Check subscription status
    prof_resp = supabase.table("profiles").select("*").eq("id", user["sub"]).execute()
    if not prof_resp.data or prof_resp.data[0]["subscription_status"] != "premium":
         raise HTTPException(status_code=403, detail="PDF report downloads are restricted to Premium Tier users. Please upgrade your account.")
         
    # 4. Generate HTML and convert to PDF using standard methods or a simple HTML payload
    # Let's write a simple structured report using weasyprint if available, or fall back to an HTML string returning content
    # We will build a highly stylized HTML file and compile it.
    results = doc["analysis_results"] or {}
    
    html_content = f"""
    <html>
    <head>
        <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; line-height: 1.5; }}
            .header {{ text-align: center; border-bottom: 2px solid #2B6CB0; padding-bottom: 20px; margin-bottom: 30px; }}
            .title {{ font-size: 24px; font-weight: bold; color: #2B6CB0; margin-bottom: 5px; }}
            .subtitle {{ font-size: 14px; color: #718096; }}
            .disclaimer {{ background-color: #FFF5F5; border-left: 4px solid #E53E3E; padding: 15px; margin-bottom: 30px; font-size: 12px; color: #C53030; }}
            .section {{ margin-bottom: 30px; }}
            .section-title {{ font-size: 18px; font-weight: bold; color: #2D3748; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; margin-bottom: 15px; }}
            .grid {{ display: flex; justify-content: space-between; margin-bottom: 20px; }}
            .card {{ background: #F7FAFC; border: 1px solid #EDF2F7; padding: 15px; border-radius: 5px; flex: 1; margin: 0 5px; text-align: center; }}
            .card-val {{ font-size: 20px; font-weight: bold; color: #2B6CB0; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
            th, td {{ border: 1px solid #E2E8F0; padding: 10px; text-align: left; font-size: 13px; }}
            th {{ background-color: #EDF2F7; color: #4A5568; }}
            .badge {{ display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; }}
            .badge-high {{ background-color: #FED7D7; color: #9B2C2C; }}
            .badge-medium {{ background-color: #FEEBC8; color: #9C4221; }}
            .badge-low {{ background-color: #EBF8FF; color: #2B6CB0; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">Encumbrance Certificate (EC) Verification Report</div>
            <div class="subtitle">File: {doc['filename']} | Analysis Date: {doc['created_at'][:10]}</div>
        </div>
        
        <div class="disclaimer">
            <strong>⚠️ AI-Generated Report — For Reference Only</strong><br/>
            This report has been generated by an artificial intelligence model and may contain errors or omissions. It is not a legal document. Users are strongly advised to cross-verify all findings with the original Encumbrance Certificate obtained from the Sub-Registrar's Office and consult a qualified legal professional before making any property-related decisions.
        </div>
        
        <div class="section">
            <div class="section-title">Summary Indicators</div>
            <div class="grid">
                <div class="card">
                    <div>Total Transactions</div>
                    <div class="card-val">{results.get('summary', {}).get('total_transactions', 0)}</div>
                </div>
                <div class="card">
                    <div>Health Score</div>
                    <div class="card-val">{results.get('summary', {}).get('health_score', 100)} / 100</div>
                </div>
                <div class="card">
                    <div>Anomalies Found</div>
                    <div class="card-val">{len(results.get('anomalies', []))}</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Anomalies & Findings</div>
            {"<p>No anomalies detected in the document.</p>" if not results.get('anomalies') else ""}
            <table>
                <thead>
                    <tr>
                        <th style="width: 10%;">Year</th>
                        <th style="width: 10%;">Entry</th>
                        <th style="width: 15%;">Severity</th>
                        <th style="width: 40%;">Description</th>
                        <th style="width: 25%;">Recommendation</th>
                    </tr>
                </thead>
                <tbody>
    """
    
    for anom in results.get('anomalies', []):
        sev_class = f"badge-{anom['severity'].lower()}"
        html_content += f"""
                    <tr>
                        <td>{anom['year']}</td>
                        <td>{anom['entry_number']}</td>
                        <td><span class="badge {sev_class}">{anom['severity']}</span></td>
                        <td>{anom['description']}</td>
                        <td>{anom['recommendation']}</td>
                    </tr>
        """
        
    html_content += """
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <div class="section-title">Ownership Chain Reconstructed</div>
            <table>
                <thead>
                    <tr>
                        <th>Transaction ID</th>
                        <th>From (Seller)</th>
                        <th>To (Buyer)</th>
                        <th>Year</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    """
    
    for link in results.get('ownership_chain', []):
        html_content += f"""
                    <tr>
                        <td>{link['transaction_id']}</td>
                        <td>{link['from_party']}</td>
                        <td>{link['to_party']}</td>
                        <td>{link['year']}</td>
                        <td>{link['status']}</td>
                    </tr>
        """
        
    html_content += """
                </tbody>
            </table>
        </div>
    </body>
    </html>
    """
    
    try:
        # Convert HTML to PDF using WeasyPrint (as requested by spec)
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        log_audit_event(user["sub"], "report_download", document_id)
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=EC_Analysis_Report_{document_id}.pdf"}
        )
    except Exception as e:
        # Fallback to returning HTML if WeasyPrint fails or library dependencies are not installed on machine
        print(f"[PDF ENGINE FAILED] Returning HTML representation: {str(e)}")
        # If weasyprint is not fully available locally, return HTML with pdf header to render in browser
        return Response(
            content=html_content,
            media_type="text/html"
        )

# --- Payments Webhook ---
@app.post("/api/payments/webhook")
async def razorpay_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("X-Razorpay-Signature", "")
    
    try:
        # Validate signature
        rzp_client.utility.verify_webhook_signature(
            payload.decode("utf-8"),
            sig,
            RAZORPAY_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature verification.")
        
    event_data = json.loads(payload.decode("utf-8"))
    event = event_data.get("event")
    
    # Extract order metadata / user reference
    if event in ["subscription.charged", "payment.captured"]:
        # Extract user id from webhook notes or email
        payment_entity = event_data["payload"]["payment"]["entity"]
        notes = payment_entity.get("notes", {})
        user_id = notes.get("user_id")
        
        if not user_id:
            # Fallback check email in profile
            email = payment_entity.get("email")
            if email:
                prof_resp = supabase.table("profiles").select("id").eq("phone", email).execute()
                if prof_resp.data:
                    user_id = prof_resp.data[0]["id"]
                    
        if user_id:
            # Upgrade user to premium status
            supabase.table("profiles").update({
                "subscription_status": "premium",
                "subscription_expires_at": "now() + interval '1 year'"
            }).eq("id", user_id).execute()
            
            log_audit_event(user_id, "subscription_created", metadata={"payment_id": payment_entity.get("id")})
            
    return {"status": "ok"}


# --- Admin API Router Panel ---

@app.get("/api/admin/stats", dependencies=[Depends(get_admin_from_token)])
async def get_admin_stats():
    # Fetch uploads count, success, error rates, premium users count
    profiles_resp = supabase.table("profiles").select("subscription_status, role").execute()
    docs_resp = supabase.table("ec_documents").select("status, health_score").execute()
    
    total_users = len(profiles_resp.data)
    premium_users = sum(1 for p in profiles_resp.data if p["subscription_status"] == "premium")
    
    total_docs = len(docs_resp.data)
    completed_docs = sum(1 for d in docs_resp.data if d["status"] == "complete")
    failed_docs = sum(1 for d in docs_resp.data if d["status"] == "error")
    
    avg_score = 0
    scores = [d["health_score"] for d in docs_resp.data if d["health_score"] is not None]
    if scores:
        avg_score = int(sum(scores) / len(scores))
        
    return {
        "users": {
            "total": total_users,
            "premium": premium_users,
            "free": total_users - premium_users
        },
        "analyses": {
            "total": total_docs,
            "completed": completed_docs,
            "failed": failed_docs,
            "average_health_score": avg_score
        }
    }

@app.get("/api/admin/users", dependencies=[Depends(get_admin_from_token)])
async def get_admin_users():
    users_resp = supabase.table("profiles").select("*").order("created_at").execute()
    return users_resp.data

@app.post("/api/admin/users/{user_id}/tier", dependencies=[Depends(get_admin_from_token)])
async def update_user_tier(user_id: str, req: TierUpgradeRequest):
    expires = "now() + interval '1 year'" if req.subscription_status == "premium" else None
    supabase.table("profiles").update({
        "subscription_status": req.subscription_status,
        "subscription_expires_at": expires
    }).eq("id", user_id).execute()
    return {"status": "success"}

@app.get("/api/admin/audit-logs", dependencies=[Depends(get_admin_from_token)])
async def get_admin_audit_logs(limit: int = 100):
    logs_resp = supabase.table("ec_audit_log").select("*").order("created_at", desc=True).limit(limit).execute()
    return logs_resp.data

@app.get("/api/admin/failed-analyses", dependencies=[Depends(get_admin_from_token)])
async def get_failed_analyses():
    docs_resp = supabase.table("ec_documents").select("*").eq("status", "error").execute()
    return docs_resp.data

@app.post("/api/admin/failed-analyses/{document_id}/retry", dependencies=[Depends(get_admin_from_token)])
async def retry_analysis(document_id: str):
    # Fetch details
    doc_resp = supabase.table("ec_documents").select("*").eq("id", document_id).execute()
    if not doc_resp.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    doc = doc_resp.data[0]
    
    storage_path = f"{doc['owner_id']}/{doc['id']}.pdf"
    signed_url_resp = supabase.storage.from_("ec-documents").create_signed_url(storage_path, 900)
    pdf_signed_url = signed_url_resp["signedURL"]
    
    # Look up document owner's subscription status for premium flag
    owner_profile = supabase.table("profiles").select("subscription_status").eq("id", doc["owner_id"]).execute()
    is_premium = (owner_profile.data and owner_profile.data[0].get("subscription_status") == "premium")
    
    # Trigger worker again
    supabase.table("ec_documents").update({"status": "queued", "error_code": None, "error_message": None}).eq("id", document_id).execute()
    
    try:
        import modal
        f = modal.Function.from_name("ec-validator-worker", "process_ec_document")
        f.spawn(document_id, pdf_signed_url, doc["owner_id"], "en", doc.get("analysis_mode", "standard"), is_premium)
    except Exception as e:
        supabase.table("ec_documents").update({"status": "error", "error_code": "worker_retrigger_failed", "error_message": str(e)}).eq("id", document_id).execute()
        raise HTTPException(status_code=500, detail=f"Failed to trigger analysis worker: {str(e)}")
        
    return {"status": "success", "message": "Retry scheduled successfully"}


