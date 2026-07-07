"""
EC Document Analysis Worker — Modal Labs Serverless Pipeline
=============================================================
Ingests Encumbrance Certificate PDFs via Microsoft MarkItDown,
chunks the resulting markdown, extracts transactions with OpenAI
structured outputs, and runs a rolling batch-reduce anomaly pipeline.

Key Design Decisions:
  • Disk-buffered download (64 KB blocks) to avoid OOM on 20 MB PDFs.
  • MarkItDown converts the PDF on-disk → flat markdown string.
  • textwrap.wrap (6 000 chars) replaces page-based chunking since
    MarkItDown produces a single continuous document.
  • Free-tier users skip chunks that contain only historical years
    (pre-2024) to save OpenAI tokens.
  • Rolling batch-reduce (batches of 20 txns via gpt-4o-mini) feeds
    into a single gpt-4o synthesis pass for the final anomaly report.
"""

import os
import json
import re
import hashlib
import textwrap
import urllib.request
from pathlib import Path
from typing import Dict, Any, List, TypedDict

import modal
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Modal Container Image
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libxml2-dev", "libxslt-dev")
    .pip_install(
        "supabase",
        "langgraph",
        "openai",
        "markitdown[all]",
        "pydantic",
        "langdetect",
    )
)

app = modal.App(name="ec-validator-worker", image=image)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CHUNK_SIZE_CHARS = 6_000          # Semantic chunk width (characters)
BATCH_SIZE_TXNS = 20              # Rolling reduce batch size
DOWNLOAD_BLOCK = 65_536           # 64 KB disk-streaming block
MIN_TEXT_LENGTH = 150             # Minimum viable text density
RECENT_YEARS = {"2024", "2025", "2026"}

MODEL_EXTRACT = os.environ.get("OPENAI_MODEL_EXTRACT", "gpt-4o-mini")
MODEL_REDUCE = os.environ.get("OPENAI_MODEL_REDUCE", "gpt-4o-mini")
MODEL_SYNTH = os.environ.get("OPENAI_MODEL_SYNTH", "gpt-4o")

# ---------------------------------------------------------------------------
# OpenAI Client Helper
# ---------------------------------------------------------------------------
def get_openai_client():
    from openai import OpenAI
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


# ═══════════════════════════════════════════════════════════════════════════
# Pydantic Schemas  (preserved from original — shared with frontend)
# ═══════════════════════════════════════════════════════════════════════════

class Party(BaseModel):
    name: str = Field(..., description="Name of the party involved in the transaction")
    role: str = Field(..., description="Role of the party (e.g., Seller, Buyer, Mortgagor, Mortgagee, Donor, Donee)")


class Transaction(BaseModel):
    entry_number: str = Field(..., description="Unique entry number of the transaction in the EC. If not specified, assign a sequential placeholder like 'N/A'")
    date: str = Field(..., description="Date of the transaction. If not specified, use 'N/A'")
    year: int = Field(..., description="Year of the transaction. If not specified or not numeric, use 0")
    transaction_type: str = Field(..., description="Type of transaction (e.g., Sale Deed, Mortgage, Release). If not specified, use 'Unknown'")
    parties: List[Party] = Field(default=[], description="List of parties involved and their roles. If none specified, use an empty list")
    survey_number: str = Field(..., description="Survey or plot number(s) mentioned. If none specified, use 'N/A'")
    property_description: str = Field(..., description="Description of property details. If none specified, use 'N/A'")
    amount: str = Field(..., description="Transaction or consideration amount. If none specified, use 'N/A'")


class OwnershipTransfer(BaseModel):
    transaction_id: str = Field(..., description="The transaction entry_number that caused this transfer")
    from_party: str = Field(..., description="The transferor or seller name(s). If there are multiple, list them all comma-separated, sorted alphabetically (e.g., 'A, B')")
    to_party: str = Field(..., description="The transferee or buyer name(s). If there are multiple, list them all comma-separated, sorted alphabetically (e.g., 'C, D')")
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


# ═══════════════════════════════════════════════════════════════════════════
# Supabase Helpers
# ═══════════════════════════════════════════════════════════════════════════

def _get_supabase():
    from supabase import create_client
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def update_db_status(
    doc_id: str,
    status: str,
    error_code: str = None,
    error_msg: str = None,
    health_score: int = None,
    analysis_results: Dict[str, Any] = None,
):
    data: Dict[str, Any] = {"status": status, "updated_at": "now()"}
    if error_code:
        data["error_code"] = error_code
    if error_msg:
        data["error_message"] = error_msg
    if health_score is not None:
        data["health_score"] = health_score
    if analysis_results is not None:
        data["analysis_results"] = analysis_results

    _get_supabase().table("ec_documents").update(data).eq("id", doc_id).execute()


def log_audit(user_id: str, action: str, doc_id: str, metadata: Dict[str, Any] = None):
    _get_supabase().table("ec_audit_log").insert({
        "user_id": user_id,
        "action": action,
        "document_id": doc_id,
        "metadata": metadata or {},
    }).execute()


# ═══════════════════════════════════════════════════════════════════════════
# PDF Download  — 64 KB Disk-Buffered Stream
# ═══════════════════════════════════════════════════════════════════════════

def download_to_disk(signed_url: str, dest_path: str) -> str:
    """Stream a remote file to *dest_path* in 64 KB blocks.

    Returns the absolute path written.  Raises on HTTP or I/O errors.
    """
    req = urllib.request.Request(signed_url, headers={"User-Agent": "ECWorker/1.0"})
    with urllib.request.urlopen(req) as response, open(dest_path, "wb") as out:
        while True:
            block = response.read(DOWNLOAD_BLOCK)
            if not block:
                break
            out.write(block)
    return dest_path


# ═══════════════════════════════════════════════════════════════════════════
# MarkItDown Ingestion
# ═══════════════════════════════════════════════════════════════════════════

def convert_pdf_to_markdown(local_path: str) -> str:
    """Convert a local PDF file to a markdown string via MarkItDown.

    Raises RuntimeError if the conversion yields no useful text.
    """
    from markitdown import MarkItDown

    md = MarkItDown()
    result = md.convert(local_path)
    return result.text_content


# ═══════════════════════════════════════════════════════════════════════════
# Semantic Character Chunking
# ═══════════════════════════════════════════════════════════════════════════

def chunk_text(text: str, width: int = CHUNK_SIZE_CHARS) -> List[str]:
    """Split *text* into chunks of ≤ *width* characters.

    Uses ``textwrap.wrap`` with ``break_long_words=False`` and
    ``replace_whitespace=False`` so Markdown table pipes (``|``) and
    column alignment are preserved.
    """
    chunks = textwrap.wrap(
        text,
        width=width,
        break_long_words=False,
        replace_whitespace=False,
    )
    return chunks


# ═══════════════════════════════════════════════════════════════════════════
# Paywall Token Optimisation  — Year-Gated Chunk Filter
# ═══════════════════════════════════════════════════════════════════════════

_HISTORICAL_YEAR_RE = re.compile(r"\b(19\d{2}|20(?:0\d|1\d|2[0-3]))\b")
_RECENT_YEAR_RE = re.compile(r"\b(202[4-6])\b")


def filter_chunks_for_free_tier(chunks: List[str]) -> List[str]:
    """Drop chunks that contain *only* historical years (≤2023) and
    absolutely zero matches for recent active years (2024-2026).

    Premium users bypass this filter entirely.
    """
    filtered: List[str] = []
    for chunk in chunks:
        has_historical = bool(_HISTORICAL_YEAR_RE.search(chunk))
        has_recent = bool(_RECENT_YEAR_RE.search(chunk))
        # Keep the chunk if it has recent years OR has no year references at all
        if has_recent or not has_historical:
            filtered.append(chunk)
    return filtered


# ═══════════════════════════════════════════════════════════════════════════
# Heuristic Transaction Count Estimator (no API call)
# ═══════════════════════════════════════════════════════════════════════════

def estimate_transaction_count(raw_text: str) -> int:
    """Estimates the number of transactions in an EC document using regex
    patterns.  Returns the highest count found across all heuristics.
    """
    patterns = [
        r'(?:entry|sl\.?|serial|s\.?no\.?)\s*(?:no\.?|number\.?|#)?\s*:?\s*\d+',
        r'(?:sale\s+deed|mortgage\s+deed|gift\s+deed|release\s+deed|partition\s+deed|lease\s+deed|power\s+of\s+attorney|settlement\s+deed|exchange\s+deed|rectification\s+deed|supplementary\s+deed|cancellation\s+deed|relinquishment\s+deed|will\s+deed)',
        r'(?:doc(?:ument)?|reg(?:istration)?)\s*(?:no\.?|number\.?|#)\s*:?\s*\d+',
    ]
    counts = [len(re.findall(p, raw_text, re.IGNORECASE)) for p in patterns]
    estimated = max(counts) if counts else 0

    if estimated == 0:
        date_lines = len(re.findall(r'\d{2}[-/]\d{2}[-/]\d{4}', raw_text))
        estimated = max(1, date_lines // 2)

    return max(1, estimated)


# ═══════════════════════════════════════════════════════════════════════════
# Mode Resolution
# ═══════════════════════════════════════════════════════════════════════════

def resolve_analysis_mode(mode: str, estimated_transaction_count: int) -> str:
    """Resolves 'auto' mode to 'standard' or 'multi_agent' based on
    document complexity.

    Rules:
    - 'standard' or 'multi_agent' passed explicitly → kept as-is
    - 'auto' + < 5 estimated transactions  → 'standard'
    - 'auto' + >= 5 estimated transactions → 'multi_agent'
    """
    if mode in ("standard", "multi_agent"):
        return mode
    return "standard" if estimated_transaction_count < 5 else "multi_agent"


# ═══════════════════════════════════════════════════════════════════════════
# Chunked Transaction Extraction  (markdown-chunk aware)
# ═══════════════════════════════════════════════════════════════════════════

class ExtractedTransactions(BaseModel):
    transactions: List[Transaction]


def extract_transactions_from_chunks(chunks: List[str]) -> List[Dict[str, Any]]:
    """Send each text chunk to OpenAI for structured transaction extraction,
    then deduplicate and chronologically sort the results.
    """
    client = get_openai_client()
    all_transactions: List[Dict[str, Any]] = []

    for idx, chunk in enumerate(chunks):
        chunk_header = f"\n--- Chunk {idx + 1} of {len(chunks)} ---\n"
        chunk_text = chunk_header + chunk

        # Collapse excessive blank lines to save tokens
        chunk_text = re.sub(r'\n\s*\n', '\n', chunk_text)

        prompt = f"""\
Extract all transaction entries from the following Encumbrance Certificate (EC) markdown text chunk.

CRITICAL GUIDELINES:
- Do not summarise or skip any transaction.  Every single transaction entry
  mentioned in the text must be extracted.
- If a transaction is incomplete or cut off at the boundary of this chunk,
  extract whatever details are present.
- For each transaction extract: entry number, date, year, transaction type
  (e.g. Sale Deed, Mortgage, Gift, Release), parties involved and their
  roles, survey number, property description, and amount.

EC Text Chunk:
{chunk_text}
"""

        response = client.beta.chat.completions.parse(
            model=MODEL_EXTRACT,
            messages=[
                {"role": "system", "content": "Extract transactions from an EC document chunk rendered as markdown."},
                {"role": "user", "content": prompt},
            ],
            response_format=ExtractedTransactions,
            temperature=0.1,
        )
        data = json.loads(response.choices[0].message.content)
        all_transactions.extend(data.get("transactions", []))

    # --- Deduplication ---
    return _deduplicate_and_sort(all_transactions)


def _deduplicate_and_sort(all_transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove duplicates (by normalised entry number) and sort chronologically."""
    seen: Dict[str, Dict[str, Any]] = {}
    deduplicated: List[Dict[str, Any]] = []

    for tx in all_transactions:
        entry_raw = str(tx.get("entry_number", "")).strip().lower()
        entry_norm = re.sub(r'[^a-z0-9]', '', entry_raw)

        if not entry_norm:
            parties_str = "".join(
                p.get("name", "").lower() for p in tx.get("parties", [])
            )
            entry_norm = hashlib.sha256(
                f"{tx.get('date')}{tx.get('transaction_type')}{tx.get('amount')}{parties_str}".encode()
            ).hexdigest()

        if entry_norm not in seen:
            seen[entry_norm] = tx
            deduplicated.append(tx)
        else:
            existing = seen[entry_norm]
            if len(str(tx.get("property_description", ""))) > len(str(existing.get("property_description", ""))):
                idx = deduplicated.index(existing)
                deduplicated[idx] = tx
                seen[entry_norm] = tx

    # --- Chronological sort ---
    def _sort_key(tx):
        try:
            year = int(tx.get("year", 0))
        except (ValueError, TypeError):
            year = 0

        date_str = str(tx.get("date", "")).strip()
        month, day = 0, 0
        m_ymd = re.match(r'^(\d{4})[-/](\d{1,2})[-/](\d{1,2})', date_str)
        if m_ymd:
            if year == 0:
                year = int(m_ymd.group(1))
            month, day = int(m_ymd.group(2)), int(m_ymd.group(3))
        else:
            m_dmy = re.match(r'^(\d{1,2})[-/](\d{1,2})[-/](\d{4})', date_str)
            if m_dmy:
                day, month = int(m_dmy.group(1)), int(m_dmy.group(2))
                if year == 0:
                    year = int(m_dmy.group(3))

        entry_num = 999_999
        m_entry = re.search(r'\d+', str(tx.get("entry_number", "")))
        if m_entry:
            entry_num = int(m_entry.group())

        return (year, month, day, entry_num)

    try:
        deduplicated.sort(key=_sort_key)
    except Exception:
        pass

    return deduplicated


# ═══════════════════════════════════════════════════════════════════════════
# Rolling Batch-Reduce Anomaly Detection
# ═══════════════════════════════════════════════════════════════════════════

class BatchAnomalyResult(BaseModel):
    """Result of a single batch-reduce pass over ≤20 transactions."""
    ownership_chain: List[OwnershipTransfer]
    anomalies: List[Anomaly]
    context_summary: str = Field(
        ...,
        description=(
            "A concise running summary of the ownership state after "
            "processing this batch.  Include current owner(s), active "
            "encumbrances, and any unresolved anomalies.  This will be "
            "fed into the next batch as context."
        ),
    )


class SynthesisResult(BaseModel):
    """Final gpt-4o synthesis pass output."""
    anomalies: List[Anomaly]
    ownership_chain: List[OwnershipTransfer]
    summary: Summary


def rolling_batch_reduce(
    transactions: List[Dict[str, Any]],
    target_lang: str = "en",
) -> Dict[str, Any]:
    """Process transactions in batches of BATCH_SIZE_TXNS using gpt-4o-mini,
    then synthesise the full anomaly report with a single gpt-4o pass.
    """
    client = get_openai_client()

    # --- Phase 1: iterative batch reduce with gpt-4o-mini ---
    all_chain: List[Dict[str, Any]] = []
    all_anomalies: List[Dict[str, Any]] = []
    running_context = "No prior context.  This is the first batch."

    for batch_start in range(0, len(transactions), BATCH_SIZE_TXNS):
        batch = transactions[batch_start : batch_start + BATCH_SIZE_TXNS]
        batch_num = (batch_start // BATCH_SIZE_TXNS) + 1

        prompt = f"""\
You are an expert Indian Property Law AI Analyzer performing batch {batch_num} \
of a rolling analysis over an Encumbrance Certificate.

PRIOR CONTEXT from previous batches:
{running_context}

CURRENT BATCH of transactions ({len(batch)} entries):
{json.dumps(batch, indent=2)}

INSTRUCTIONS:
1. Reconstruct the ownership chain for these transactions, connecting to the
   prior ownership state described above.
2. Detect all anomalies in this batch (missing entries, duplicates,
   incorrect ownership transfers, inconsistent property descriptions,
   encumbrance anomalies, date anomalies).
3. Produce a concise *context_summary* string that captures the current
   ownership state, active encumbrances, and unresolved anomalies — this
   will be passed to the next batch.

Guidelines for Joint/Multiple Parties:
- Format multiple names as a comma-separated list sorted alphabetically.
- A transfer is valid only if all sellers were the registered owners.
"""

        response = client.beta.chat.completions.parse(
            model=MODEL_REDUCE,
            messages=[
                {"role": "system", "content": "Perform incremental EC analysis on a batch of transactions."},
                {"role": "user", "content": prompt},
            ],
            response_format=BatchAnomalyResult,
            temperature=0.1,
        )
        batch_data = json.loads(response.choices[0].message.content)

        all_chain.extend(batch_data.get("ownership_chain", []))
        all_anomalies.extend(batch_data.get("anomalies", []))
        running_context = batch_data.get("context_summary", running_context)

    # --- Phase 2: single gpt-4o synthesis pass ---
    lang_instruction = ""
    if target_lang != "en":
        lang_instruction = (
            f"\n\nIMPORTANT: Write all anomaly descriptions and recommendations "
            f"in the language: '{target_lang}'."
        )

    synthesis_prompt = f"""\
You are a senior Indian Property Law analyst.  Below is the complete set of
extracted transactions, the rolling ownership chain, and all anomalies
detected across multiple batch passes.

TRANSACTIONS ({len(transactions)} total):
{json.dumps(transactions, indent=2)}

ROLLING OWNERSHIP CHAIN ({len(all_chain)} links):
{json.dumps(all_chain, indent=2)}

RAW ANOMALIES ({len(all_anomalies)} items):
{json.dumps(all_anomalies, indent=2)}

FINAL RUNNING CONTEXT:
{running_context}

YOUR TASK:
1. Deduplicate the ownership chain and anomalies.  Merge or discard entries
   that refer to the same underlying issue.
2. Validate the full ownership chain end-to-end.  Flag any remaining gaps.
3. Compute the health_score (start at 100; deduct 20 per HIGH, 10 per MEDIUM,
   5 per LOW anomaly; minimum 0).
4. Produce the final Summary with year-wise anomaly distribution.
{lang_instruction}
"""

    synth_response = client.beta.chat.completions.parse(
        model=MODEL_SYNTH,
        messages=[
            {"role": "system", "content": "Synthesise a comprehensive EC analysis report."},
            {"role": "user", "content": synthesis_prompt},
        ],
        response_format=SynthesisResult,
        temperature=0.1,
    )
    synth_data = json.loads(synth_response.choices[0].message.content)

    # Sort ownership chain chronologically
    chain = synth_data.get("ownership_chain", [])
    try:
        chain.sort(key=lambda x: int(x.get("year", 0)))
    except Exception:
        pass

    return {
        "transactions": transactions,
        "ownership_chain": chain,
        "anomalies": synth_data.get("anomalies", []),
        "summary": synth_data.get("summary", {}),
    }


# ═══════════════════════════════════════════════════════════════════════════
# Mode 1 — Standard (single-pass) Analysis
# ═══════════════════════════════════════════════════════════════════════════

def analyze_standard_mode(
    chunks: List[str],
    target_lang: str = "en",
) -> Dict[str, Any]:
    """Extract transactions from chunks, then run a single OpenAI pass for
    ownership chain + anomaly detection + summary.
    """
    transactions = extract_transactions_from_chunks(chunks)
    client = get_openai_client()

    lang_instruction = ""
    if target_lang != "en":
        lang_instruction = (
            f"\nIf the target language is not 'en', write the descriptions "
            f"and recommendations of the anomalies in: '{target_lang}'."
        )

    prompt = f"""\
You are an expert Indian Property Law AI Analyzer.  Reconstruct the title
ownership chain and identify anomalies based on the following extracted
transactions.

Guidelines for Joint/Multiple Parties:
- Format multiple names as a comma-separated list sorted alphabetically.
- Clean and normalise names (remove titles, aliases, spelling variations).
- Do not use "&", "and", "or".
- A transfer is valid if all sellers were registered owners.

Anomalies to check:
- missing_entries, duplicate_entries, incorrect_ownership_transfer,
  inconsistent_property_description, encumbrance_anomaly, date_anomaly.

Health score (0-100): start at 100, deduct 20/HIGH, 10/MEDIUM, 5/LOW.
{lang_instruction}

Transactions:
{json.dumps(transactions, indent=2)}
"""

    response = client.beta.chat.completions.parse(
        model=MODEL_SYNTH,
        messages=[
            {"role": "system", "content": "You are a helpful property document assistant."},
            {"role": "user", "content": prompt},
        ],
        response_format=ECAnalysisReport,
        temperature=0.1,
    )

    report_data = json.loads(response.choices[0].message.content)
    report_data["transactions"] = transactions

    chain = report_data.get("ownership_chain", [])
    try:
        chain.sort(key=lambda x: int(x.get("year", 0)))
    except Exception:
        pass
    report_data["ownership_chain"] = chain

    return report_data


# ═══════════════════════════════════════════════════════════════════════════
# Mode 2 — LangGraph Multi-Agent Pipeline  (now markdown-chunk aware)
# ═══════════════════════════════════════════════════════════════════════════

class AgentState(TypedDict):
    raw_text: str
    chunks: List[str]
    doc_id: str
    user_lang: str
    transactions: List[Dict[str, Any]]
    ownership_chain: List[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]
    summary: Dict[str, Any]


def extractor_node(state: AgentState) -> Dict[str, Any]:
    update_db_status(state["doc_id"], "extracting")
    transactions = extract_transactions_from_chunks(state["chunks"])
    return {"transactions": transactions}


def ownership_chain_node(state: AgentState) -> Dict[str, Any]:
    update_db_status(state["doc_id"], "analysing")
    client = get_openai_client()

    prompt = f"""\
Based on the following transactions, reconstruct the chain of ownership
(from earliest to latest).  Identify transfers and trace who owns the
property at any point in time.  Check for gaps or conflicts.

Guidelines for Joint/Multiple Parties:
- Format multiple names as a comma-separated list sorted alphabetically.
- Clean and normalise names consistently.
- Do not use "&", "and", "or".

Transactions:
{json.dumps(state["transactions"], indent=2)}
"""

    class OwnershipChainResponse(BaseModel):
        ownership_chain: List[OwnershipTransfer]

    response = client.beta.chat.completions.parse(
        model=MODEL_SYNTH,
        messages=[
            {"role": "system", "content": "Reconstruct property ownership sequence and flag title gaps."},
            {"role": "user", "content": prompt},
        ],
        response_format=OwnershipChainResponse,
        temperature=0.1,
    )

    data = json.loads(response.choices[0].message.content)
    chain = data.get("ownership_chain", [])
    try:
        chain.sort(key=lambda x: int(x.get("year", 0)))
    except Exception:
        pass
    return {"ownership_chain": chain}


def anomaly_detection_node(state: AgentState) -> Dict[str, Any]:
    client = get_openai_client()

    prompt = f"""\
Review the transactions and ownership chain to identify anomalies.

Guidelines for Joint/Multiple Owners:
- A transfer is valid if all sellers are registered owners.
- Treat comma-separated names as multiple owners.

Anomaly Types:
- missing_entries, duplicate_entries, incorrect_ownership_transfer,
  inconsistent_property_description, encumbrance_anomaly, date_anomaly.

Transactions:
{json.dumps(state["transactions"], indent=2)}

Ownership Chain:
{json.dumps(state["ownership_chain"], indent=2)}
"""

    class AnomaliesResponse(BaseModel):
        anomalies: List[Anomaly]

    response = client.beta.chat.completions.parse(
        model=MODEL_SYNTH,
        messages=[
            {"role": "system", "content": "Detect legal and factual anomalies in EC transactions."},
            {"role": "user", "content": prompt},
        ],
        response_format=AnomaliesResponse,
        temperature=0.1,
    )

    data = json.loads(response.choices[0].message.content)
    return {"anomalies": data["anomalies"]}


def summariser_node(state: AgentState) -> Dict[str, Any]:
    update_db_status(state["doc_id"], "summarising")

    total_tx = len(state["transactions"])
    missing_cnt = dup_cnt = owner_cnt = enc_cnt = 0
    health = 100
    yearly_anomalies: Dict[int, int] = {}

    for anomaly in state["anomalies"]:
        year = anomaly["year"]
        yearly_anomalies[year] = yearly_anomalies.get(year, 0) + 1

        sev = anomaly["severity"].lower()
        if sev == "high":
            health -= 20
        elif sev == "medium":
            health -= 10
        else:
            health -= 5

        atype = anomaly["type"].lower()
        if "missing" in atype:
            missing_cnt += 1
        elif "duplicate" in atype:
            dup_cnt += 1
        elif "owner" in atype:
            owner_cnt += 1
        elif "encumbrance" in atype:
            enc_cnt += 1

    health = max(0, health)
    year_wise = [{"year": y, "anomaly_count": c} for y, c in sorted(yearly_anomalies.items())]

    return {
        "summary": {
            "total_transactions": total_tx,
            "missing_entries_count": missing_cnt,
            "duplicate_entries_count": dup_cnt,
            "ownership_issues_count": owner_cnt,
            "encumbrance_anomalies_count": enc_cnt,
            "health_score": health,
            "year_wise_distribution": year_wise,
        }
    }


def report_generator_node(state: AgentState) -> Dict[str, Any]:
    update_db_status(state["doc_id"], "generating_report")
    target_lang = state["user_lang"]

    if target_lang != "en":
        client = get_openai_client()
        prompt = f"""\
Translate the following list of anomalies to the language: '{target_lang}'.
Only translate the 'description' and 'recommendation' strings.
Keep key property terms clear.

Anomalies:
{json.dumps(state["anomalies"], indent=2)}
"""

        class TranslatedAnomalies(BaseModel):
            anomalies: List[Anomaly]

        response = client.beta.chat.completions.parse(
            model=MODEL_SYNTH,
            messages=[
                {"role": "system", "content": "Translate anomaly descriptions and recommendations to regional language."},
                {"role": "user", "content": prompt},
            ],
            response_format=TranslatedAnomalies,
            temperature=0.1,
        )
        data = json.loads(response.choices[0].message.content)
        return {"anomalies": data["anomalies"]}

    return {}


def run_langgraph_pipeline(
    raw_text: str,
    chunks: List[str],
    doc_id: str,
    user_lang: str,
) -> Dict[str, Any]:
    from langgraph.graph import StateGraph, END

    workflow = StateGraph(AgentState)

    workflow.add_node("extractor", extractor_node)
    workflow.add_node("ownership", ownership_chain_node)
    workflow.add_node("anomaly_detector", anomaly_detection_node)
    workflow.add_node("summariser", summariser_node)
    workflow.add_node("report_generator", report_generator_node)

    workflow.set_entry_point("extractor")
    workflow.add_edge("extractor", "ownership")
    workflow.add_edge("ownership", "anomaly_detector")
    workflow.add_edge("anomaly_detector", "summariser")
    workflow.add_edge("summariser", "report_generator")
    workflow.add_edge("report_generator", END)

    graph = workflow.compile()

    initial_state: AgentState = {
        "raw_text": raw_text,
        "chunks": chunks,
        "doc_id": doc_id,
        "user_lang": user_lang,
        "transactions": [],
        "ownership_chain": [],
        "anomalies": [],
        "summary": {},
    }

    final = graph.invoke(initial_state)
    return {
        "transactions": final["transactions"],
        "ownership_chain": final["ownership_chain"],
        "anomalies": final["anomalies"],
        "summary": final["summary"],
    }


# ═══════════════════════════════════════════════════════════════════════════
# Master Entry Point
# ═══════════════════════════════════════════════════════════════════════════

@app.function(
    secrets=[
        modal.Secret.from_name("supabase-secrets"),
        modal.Secret.from_name("openai-secret"),
    ],
    timeout=600,
)
def process_ec_document(
    doc_id: str,
    file_path_or_url: str,
    user_id: str,
    target_lang: str = "en",
    mode: str = "auto",
    is_premium: bool = False,
):
    """Download an EC PDF, convert to markdown via MarkItDown, chunk the
    text, extract transactions, and run the anomaly analysis pipeline.
    """
    local_path = f"/tmp/{doc_id}.pdf"

    try:
        # ── 1. Stream PDF to container disk (64 KB blocks) ──────────────
        update_db_status(doc_id, "downloading")
        download_to_disk(file_path_or_url, local_path)

        # ── 2. Convert PDF → Markdown via MarkItDown ────────────────────
        update_db_status(doc_id, "converting")
        try:
            markdown_text = convert_pdf_to_markdown(local_path)
        except Exception as conv_err:
            update_db_status(
                doc_id, "error",
                error_code="CONVERSION_FAILED",
                error_msg=f"MarkItDown conversion failed: {conv_err}",
            )
            log_audit(user_id, "analysis_error", doc_id, {
                "error": "CONVERSION_FAILED",
                "message": str(conv_err),
            })
            return

        # ── 3. Text density safety check ────────────────────────────────
        if len(markdown_text.strip()) < MIN_TEXT_LENGTH:
            update_db_status(
                doc_id, "error",
                error_code="UNSUPPORTED_PDF_TYPE",
                error_msg=(
                    "This PDF appears to be a scanned image lacking digital "
                    "text vector data.  The EC Analysis tool only supports "
                    "digitally generated PDFs with a selectable text layer.  "
                    "Please obtain a digital copy from the sub-registrar's "
                    "office and try again."
                ),
            )
            log_audit(user_id, "analysis_error", doc_id, {
                "error": "UNSUPPORTED_PDF_TYPE",
                "message": "Extracted text below density threshold.",
            })
            return

        # ── 4. Semantic character chunking ──────────────────────────────
        chunks = chunk_text(markdown_text)

        # ── 5. Paywall token optimisation (free-tier year gating) ───────
        if not is_premium:
            chunks = filter_chunks_for_free_tier(chunks)

        if not chunks:
            update_db_status(
                doc_id, "error",
                error_code="NO_RELEVANT_DATA",
                error_msg=(
                    "No recent transaction data found in this document.  "
                    "Upgrade to Premium to analyse the full historical record."
                ),
            )
            log_audit(user_id, "analysis_error", doc_id, {
                "error": "NO_RELEVANT_DATA",
            })
            return

        # ── 6. Resolve analysis mode ────────────────────────────────────
        estimated_tx_count = estimate_transaction_count(markdown_text)
        resolved_mode = resolve_analysis_mode(mode, estimated_tx_count)

        # Persist resolved mode to Supabase
        _get_supabase().table("ec_documents").update({
            "analysis_mode": resolved_mode,
        }).eq("id", doc_id).execute()

        log_audit(user_id, "analysis_start", doc_id, {
            "requested_mode": mode,
            "resolved_mode": resolved_mode,
            "estimated_transactions": estimated_tx_count,
            "chunk_count": len(chunks),
            "is_premium": is_premium,
            "text_length": len(markdown_text),
        })

        # ── 7. Run analysis pipeline ───────────────────────────────────
        if resolved_mode == "standard":
            update_db_status(doc_id, "analysing")
            report_data = analyze_standard_mode(chunks, target_lang)
        else:
            # Multi-agent LangGraph mode
            report_data = run_langgraph_pipeline(
                markdown_text, chunks, doc_id, target_lang,
            )

        # ── 8. Rolling Batch Reduce (if many transactions) ─────────────
        # If the pipeline returned > BATCH_SIZE_TXNS transactions, re-run
        # through the rolling batch-reduce for deeper anomaly detection.
        transactions = report_data.get("transactions", [])
        if len(transactions) > BATCH_SIZE_TXNS:
            update_db_status(doc_id, "deep_analysis")
            report_data = rolling_batch_reduce(transactions, target_lang)

        # ── 9. Persist results to Supabase ──────────────────────────────
        health = report_data.get("summary", {}).get("health_score", 100)
        update_db_status(
            doc_id, "complete",
            health_score=health,
            analysis_results=report_data,
        )
        log_audit(user_id, "analysis_complete", doc_id, {
            "health_score": health,
            "resolved_mode": resolved_mode,
            "estimated_transactions": estimated_tx_count,
        })

    except Exception as e:
        err_msg = f"Unexpected error during analysis pipeline: {e}"
        update_db_status(
            doc_id, "error",
            error_code="internal_pipeline_error",
            error_msg=err_msg,
        )
        log_audit(user_id, "analysis_error", doc_id, {
            "error": "internal_pipeline_error",
            "message": err_msg,
        })

    finally:
        # ── Cleanup: remove the downloaded PDF from container scratch ───
        try:
            Path(local_path).unlink(missing_ok=True)
        except OSError:
            pass
