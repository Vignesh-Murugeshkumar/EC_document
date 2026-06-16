import os
import json
import re
import hashlib
from typing import Dict, Any, List, TypedDict
import modal
from pydantic import BaseModel, Field

# Define Modal App
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "supabase",
        "langgraph",
        "openai",
        "pypdf2",
        "pdfminer.six",
        "pydantic",
        "langdetect"
    )
)

app = modal.App(name="ec-validator-worker", image=image)

# Initialize OpenAI client helper
def get_openai_client():
    from openai import OpenAI
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# Pydantic Schemas for Structured Output (Mode 1: Standard Mode)
class Party(BaseModel):
    name: str = Field(..., description="Name of the party involved in the transaction")
    role: str = Field(..., description="Role of the party (e.g., Seller, Buyer, Mortgagor, Mortgagee, Donor, Donee)")

class Transaction(BaseModel):
    entry_number: str = Field(..., description="Unique entry number of the transaction in the EC")
    date: str = Field(..., description="Date of the transaction in YYYY-MM-DD or DD-MM-YYYY format as written")
    year: int = Field(..., description="Year of the transaction")
    transaction_type: str = Field(..., description="Type of transaction (e.g., Sale Deed, Mortgage, Release, Gift, Partition)")
    parties: List[Party] = Field(..., description="List of parties involved and their roles")
    survey_number: str = Field(..., description="Survey or plot number(s) mentioned")
    property_description: str = Field(..., description="Description of property details (boundaries, area, dimensions)")
    amount: str = Field(..., description="Transaction or consideration amount mentioned, or 'N/A'")

class OwnershipTransfer(BaseModel):
    transaction_id: str = Field(..., description="The transaction entry_number that caused this transfer")
    from_party: str = Field(..., description="The transferor or seller name")
    to_party: str = Field(..., description="The transferee or buyer name")
    year: int = Field(..., description="Year of transfer")
    status: str = Field(..., description="Status of this link (e.g., 'valid', 'gap_detected', 'conflict')")

class Anomaly(BaseModel):
    type: str = Field(..., description="Type of anomaly (e.g., missing_entries, duplicate_entries, incorrect_ownership_transfer, inconsistent_property_description, encumbrance_anomaly, date_anomaly)")
    severity: str = Field(..., description="Severity of anomaly (low, medium, high)")
    year: int = Field(..., description="Year the anomaly occurred or was detected")
    entry_number: str = Field(..., description="Entry number of the affected transaction")
    description: str = Field(..., description="Detailed explanation of the issue")
    recommendation: str = Field(..., description="Clear recommendation for the buyer/lawyer to resolve the issue")

class YearlyStats(BaseModel):
    year: int
    anomaly_count: int

class Summary(BaseModel):
    total_transactions: int = Field(..., description="Total count of transactions parsed")
    missing_entries_count: int = Field(..., description="Number of missing entry gaps found")
    duplicate_entries_count: int = Field(..., description="Number of duplicate entries found")
    ownership_issues_count: int = Field(..., description="Number of ownership transfer issues detected")
    encumbrance_anomalies_count: int = Field(..., description="Number of active mortgages/liens with no corresponding discharge/release")
    health_score: int = Field(..., description="Health score between 0 and 100. Deduct points based on anomalies (high: -20, medium: -10, low: -5)")
    year_wise_distribution: List[YearlyStats] = Field(..., description="Count of anomalies detected in each year")

class ECAnalysisReport(BaseModel):
    transactions: List[Transaction]
    ownership_chain: List[OwnershipTransfer]
    anomalies: List[Anomaly]
    summary: Summary

# Supabase database updater
def update_db_status(doc_id: str, status: str, error_code: str = None, error_msg: str = None, health_score: int = None, analysis_results: Dict[str, Any] = None):
    from supabase import create_client
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase = create_client(supabase_url, supabase_key)
    
    data = {
        "status": status,
        "updated_at": "now()"
    }
    if error_code:
        data["error_code"] = error_code
    if error_msg:
        data["error_message"] = error_msg
    if health_score is not None:
        data["health_score"] = health_score
    if analysis_results is not None:
        data["analysis_results"] = analysis_results
        
    supabase.table("ec_documents").update(data).eq("id", doc_id).execute()

# Log audit event
def log_audit(user_id: str, action: str, doc_id: str, metadata: Dict[str, Any] = None):
    from supabase import create_client
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase = create_client(supabase_url, supabase_key)
    
    supabase.table("ec_audit_log").insert({
        "user_id": user_id,
        "action": action,
        "document_id": doc_id,
        "metadata": metadata or {}
    }).execute()

# Native PDF Text Layer Extractor
def extract_pdf_text_native(file_path: str) -> Dict[str, Any]:
    import PyPDF2
    from pdfminer.high_level import extract_text
    
    try:
        # 1. Page count check
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            page_count = len(reader.pages)
            
        if page_count > 200:
            return {"error": "max_pages_exceeded", "message": f"This document exceeds the 200-page limit ({page_count} pages). Please upload a shorter EC."}
            
        # 2. Text extraction
        text = extract_text(file_path)
        
        # 3. Native Text check (scanned vs. digital)
        # We check characters count. If it's less than 100 characters overall, or average < 40 chars per page, it's scanned
        if not text or len(text.strip()) < 100 or (len(text.strip()) / page_count) < 40:
            return {"error": "unsupported_pdf_type", "message": "This PDF appears to be a scanned document. The EC Analysis tool only supports digitally generated PDFs with a selectable text layer. Please obtain a digital copy from the sub-registrar's office and try again."}
            
        return {"text": text, "page_count": page_count}
        
    except Exception as e:
        return {"error": "extraction_failed", "message": f"Failed to parse PDF: {str(e)}"}

# Heuristic Transaction Count Estimator (no API call needed)
def estimate_transaction_count(raw_text: str) -> int:
    """
    Estimates the number of transactions in an EC document using regex patterns.
    Looks for common indicators: entry/serial numbers, deed types, registration numbers.
    Returns the highest count found across all heuristics.
    """
    patterns = [
        # Entry/serial number patterns (e.g., "Entry No. 1", "Sl. No. 5", "Entry Number: 12")
        r'(?:entry|sl\.?|serial|s\.?no\.?)\s*(?:no\.?|number\.?|#)?\s*:?\s*\d+',
        # Deed type mentions (each typically = one transaction)
        r'(?:sale\s+deed|mortgage\s+deed|gift\s+deed|release\s+deed|partition\s+deed|lease\s+deed|power\s+of\s+attorney|settlement\s+deed|exchange\s+deed|rectification\s+deed|supplementary\s+deed|cancellation\s+deed|relinquishment\s+deed|will\s+deed)',
        # Registration/document numbers (e.g., "Doc No. 1234/2022", "Reg. No. 5678")
        r'(?:doc(?:ument)?|reg(?:istration)?)\s*(?:no\.?|number\.?|#)\s*:?\s*\d+',
    ]
    
    counts = []
    for pattern in patterns:
        matches = re.findall(pattern, raw_text, re.IGNORECASE)
        counts.append(len(matches))
    
    estimated = max(counts) if counts else 0
    
    # Fallback: if no patterns matched, estimate by page count (rough: ~2 transactions per page)
    if estimated == 0:
        lines = raw_text.strip().split('\n')
        # Very rough heuristic: count lines with dates (DD-MM-YYYY or DD/MM/YYYY)
        date_lines = len(re.findall(r'\d{2}[-/]\d{2}[-/]\d{4}', raw_text))
        estimated = max(1, date_lines // 2)  # Each transaction often has 2+ dates
    
    return max(1, estimated)

# Mode Resolution Logic
def resolve_analysis_mode(mode: str, estimated_transaction_count: int) -> str:
    """
    Resolves 'auto' mode to 'standard' or 'multi_agent' based on document complexity.
    
    Rules:
    - 'standard' or 'multi_agent' passed explicitly → kept as-is
    - 'auto' + < 5 estimated transactions → 'standard' (fast, sufficient)
    - 'auto' + >= 5 estimated transactions → 'multi_agent' (thorough)
    """
    if mode in ("standard", "multi_agent"):
        return mode
    
    # Auto mode resolution
    if estimated_transaction_count < 5:
        return "standard"
    else:
        return "multi_agent"

# ----------------- Mode 1: Standard AI Model parser -----------------
def analyze_standard_mode(raw_text: str, target_lang: str = "en") -> Dict[str, Any]:
    client = get_openai_client()
    
    prompt = f"""
    You are an expert Indian Property Law AI Analyzer. Analyze the following Encumbrance Certificate (EC) text.
    Extract the list of transactions, reconstruct the title ownership chain, and identify any anomalies.
    
    Anomalies to check for:
    - missing_entries: gaps in transaction dates or years where ownership status is unclear.
    - duplicate_entries: duplicate transaction entries.
    - incorrect_ownership_transfer: seller/transferor is not the registered owner at the time of the transaction.
    - inconsistent_property_description: changes in survey numbers, plot sizes, or boundaries across entries.
    - encumbrance_anomaly: mortgages or liens without release or discharge entries.
    - date_anomaly: future-dated entries or dates pre-dating acquisition.
    
    Make sure to compute the health_score (0-100) based on findings:
    - Start at 100.
    - Deduct 20 points for each HIGH severity anomaly (incorrect transfer, active mortgage).
    - Deduct 10 points for each MEDIUM severity anomaly (missing entries, inconsistent description).
    - Deduct 5 points for each LOW severity anomaly (duplicates, date inconsistencies).
    - Minimum score is 0.
    
    If the target language is not 'en' (English), write the descriptions and recommendations of the anomalies and properties in the requested target language: '{target_lang}'.
    
    EC Text:
    {raw_text}
    """
    
    response = client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a helpful property document assistant."},
            {"role": "user", "content": prompt}
        ],
        response_format=ECAnalysisReport,
        temperature=0.1
    )
    
    return json.loads(response.choices[0].message.content)


# ----------------- Mode 2: LangGraph Multi-Agent Architecture -----------------
# Define Agent State
class AgentState(TypedDict):
    raw_text: str
    doc_id: str
    user_lang: str
    transactions: List[Dict[str, Any]]
    ownership_chain: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]
    summary: Dict[str, Any]

# Extractor Agent
def extractor_node(state: AgentState) -> Dict[str, Any]:
    update_db_status(state["doc_id"], "extracting")
    client = get_openai_client()
    
    prompt = f"""
    Extract all transaction entries from the following Encumbrance Certificate (EC) text.
    For each transaction, extract: entry number, date, year, transaction type (e.g. Sale Deed, Mortgage, Gift, Release), parties involved and their roles (e.g. Seller, Buyer, Mortgagor, Mortgagee), survey number, property description, and amount.
    
    EC Text:
    {state["raw_text"]}
    """
    
    class ExtractedTransactions(BaseModel):
        transactions: List[Transaction]
        
    response = client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Extract transactions from the text layer of an EC document."},
            {"role": "user", "content": prompt}
        ],
        response_format=ExtractedTransactions,
        temperature=0.1
    )
    
    data = json.loads(response.choices[0].message.content)
    return {"transactions": data["transactions"]}

# Ownership Chain Agent
def ownership_chain_node(state: AgentState) -> Dict[str, Any]:
    update_db_status(state["doc_id"], "analysing")
    client = get_openai_client()
    
    prompt = f"""
    Based on the following transactions, reconstruct the chain of ownership (from earliest to latest).
    Identify transfers and trace who owns the property at any point in time. Check for gaps or conflicts.
    
    Transactions:
    {json.dumps(state["transactions"], indent=2)}
    """
    
    class OwnershipChainResponse(BaseModel):
        ownership_chain: List[OwnershipTransfer]
        
    response = client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Reconstruct property ownership sequence and flag title gaps."},
            {"role": "user", "content": prompt}
        ],
        response_format=OwnershipChainResponse,
        temperature=0.1
    )
    
    data = json.loads(response.choices[0].message.content)
    return {"ownership_chain": data["ownership_chain"]}

# Anomaly Detection Agent
def anomaly_detection_node(state: AgentState) -> Dict[str, Any]:
    # Remains in analysing state
    client = get_openai_client()
    
    prompt = f"""
    Review the transactions and ownership chain to identify anomalies.
    
    Anomaly Types to look for:
    - missing_entries: Gaps in the ownership chain or timeline.
    - duplicate_entries: Repeated or duplicate transaction records.
    - incorrect_ownership_transfer: A transfer made by someone who is not the current owner.
    - inconsistent_property_description: Mismatches in area, boundaries, or survey numbers.
    - encumbrance_anomaly: Active mortgage/liens with no corresponding release deed.
    - date_anomaly: Future dates or sale pre-dating purchase.
    
    Transactions:
    {json.dumps(state["transactions"], indent=2)}
    
    Ownership Chain:
    {json.dumps(state["ownership_chain"], indent=2)}
    """
    
    class AnomaliesResponse(BaseModel):
        anomalies: List[Anomaly]
        
    response = client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Detect legal and factual anomalies in EC transactions."},
            {"role": "user", "content": prompt}
        ],
        response_format=AnomaliesResponse,
        temperature=0.1
    )
    
    data = json.loads(response.choices[0].message.content)
    return {"anomalies": data["anomalies"]}

# Summariser Agent
def summariser_node(state: AgentState) -> Dict[str, Any]:
    update_db_status(state["doc_id"], "summarising")
    
    # Calculate health score locally based on the extracted anomalies
    total_tx = len(state["transactions"])
    missing_cnt = 0
    dup_cnt = 0
    owner_cnt = 0
    enc_cnt = 0
    
    health = 100
    yearly_anomalies = {}
    
    for anomaly in state["anomalies"]:
        year = anomaly["year"]
        yearly_anomalies[year] = yearly_anomalies.get(year, 0) + 1
        
        severity = anomaly["severity"].lower()
        if severity == "high":
            health -= 20
        elif severity == "medium":
            health -= 10
        else:
            health -= 5
            
        anom_type = anomaly["type"].lower()
        if "missing" in anom_type:
            missing_cnt += 1
        elif "duplicate" in anom_type:
            dup_cnt += 1
        elif "owner" in anom_type:
            owner_cnt += 1
        elif "encumbrance" in anom_type:
            enc_cnt += 1
            
    health = max(0, health)
    
    year_wise = [{"year": y, "anomaly_count": c} for y, c in sorted(yearly_anomalies.items())]
    
    summary = {
        "total_transactions": total_tx,
        "missing_entries_count": missing_cnt,
        "duplicate_entries_count": dup_cnt,
        "ownership_issues_count": owner_cnt,
        "encumbrance_anomalies_count": enc_cnt,
        "health_score": health,
        "year_wise_distribution": year_wise
    }
    
    return {"summary": summary}

# Report Generator / Translator Agent
def report_generator_node(state: AgentState) -> Dict[str, Any]:
    update_db_status(state["doc_id"], "generating_report")
    client = get_openai_client()
    
    # If translation is required, translate findings text (descriptions, recommendations)
    target_lang = state["user_lang"]
    if target_lang != "en":
        # Formulate a prompt to translate descriptions/recommendations inside anomalies list
        prompt = f"""
        Translate the following list of anomalies to the language: '{target_lang}'.
        Ensure that only the 'description' and 'recommendation' strings are translated. Keep key property terms clear.
        
        Anomalies:
        {json.dumps(state["anomalies"], indent=2)}
        """
        
        class TranslatedAnomalies(BaseModel):
            anomalies: List[Anomaly]
            
        response = client.beta.chat.completions.parse(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Translate the anomaly descriptions and recommendations to regional language."},
                {"role": "user", "content": prompt}
            ],
            response_format=TranslatedAnomalies,
            temperature=0.1
        )
        data = json.loads(response.choices[0].message.content)
        return {"anomalies": data["anomalies"]}
        
    return {}

# Orchestrate LangGraph execution flow
def run_langgraph_pipeline(raw_text: str, doc_id: str, user_lang: str) -> Dict[str, Any]:
    from langgraph.graph import StateGraph, END
    
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("extractor", extractor_node)
    workflow.add_node("ownership", ownership_chain_node)
    workflow.add_node("anomaly_detector", anomaly_detection_node)
    workflow.add_node("summariser", summariser_node)
    workflow.add_node("report_generator", report_generator_node)
    
    # Set entry point
    workflow.set_entry_point("extractor")
    
    # Add edges
    workflow.add_edge("extractor", "ownership")
    workflow.add_edge("ownership", "anomaly_detector")
    workflow.add_edge("anomaly_detector", "summariser")
    workflow.add_edge("summariser", "report_generator")
    workflow.add_edge("report_generator", END)
    
    app = workflow.compile()
    
    initial_state = {
        "raw_text": raw_text,
        "doc_id": doc_id,
        "user_lang": user_lang,
        "transactions": [],
        "ownership_chain": [],
        "anomalies": [],
        "summary": {}
    }
    
    final_output = app.invoke(initial_state)
    
    return {
        "transactions": final_output["transactions"],
        "ownership_chain": final_output["ownership_chain"],
        "anomalies": final_output["anomalies"],
        "summary": final_output["summary"]
    }


# Modal main trigger function
@app.function(
    secrets=[
        modal.Secret.from_name("supabase-secrets"),
        modal.Secret.from_name("openai-secret"),
    ],
    timeout=300
)
def process_ec_document(doc_id: str, file_path_or_url: str, user_id: str, target_lang: str = "en", mode: str = "auto"):
    import urllib.request
    local_path = "/tmp/document.pdf"
    
    try:
        # 1. Download file from storage URL
        urllib.request.urlretrieve(file_path_or_url, local_path)
        
        # 2. Extract Text Layer
        extraction = extract_pdf_text_native(local_path)
        if "error" in extraction:
            update_db_status(doc_id, "error", error_code=extraction["error"], error_msg=extraction["message"])
            log_audit(user_id, "analysis_error", doc_id, {"error": extraction["error"], "message": extraction["message"]})
            return
            
        raw_text = extraction["text"]
        page_count = extraction["page_count"]
        
        # 3. Resolve analysis mode if 'auto'
        estimated_tx_count = estimate_transaction_count(raw_text)
        resolved_mode = resolve_analysis_mode(mode, estimated_tx_count)
        
        # Update DB with the resolved mode so the frontend/DB reflects what actually ran
        from supabase import create_client
        supabase_url = os.environ["SUPABASE_URL"]
        supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        supabase = create_client(supabase_url, supabase_key)
        supabase.table("ec_documents").update({
            "analysis_mode": resolved_mode
        }).eq("id", doc_id).execute()
        
        # Log analysis start with mode resolution details
        log_audit(user_id, "analysis_start", doc_id, {
            "requested_mode": mode,
            "resolved_mode": resolved_mode,
            "estimated_transactions": estimated_tx_count,
            "page_count": page_count
        })
        
        # 4. Analyze based on resolved Mode
        if resolved_mode == "standard":
            update_db_status(doc_id, "analysing")
            report_data = analyze_standard_mode(raw_text, target_lang)
        else:
            # Multi-agent LangGraph mode
            report_data = run_langgraph_pipeline(raw_text, doc_id, target_lang)
            
        # 5. Save results to Database
        health = report_data.get("summary", {}).get("health_score", 100)
        update_db_status(
            doc_id,
            "complete",
            health_score=health,
            analysis_results=report_data
        )
        
        # Log analysis complete
        log_audit(user_id, "analysis_complete", doc_id, {
            "health_score": health,
            "resolved_mode": resolved_mode,
            "estimated_transactions": estimated_tx_count
        })
        
    except Exception as e:
        err_msg = f"Unexpected error during analysis pipeline: {str(e)}"
        update_db_status(doc_id, "error", error_code="internal_pipeline_error", error_msg=err_msg)
        log_audit(user_id, "analysis_error", doc_id, {"error": "internal_pipeline_error", "message": err_msg})

