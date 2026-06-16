"""
Vercel Serverless Function — FastAPI Gateway

This module wraps the FastAPI application from backend/main.py
using Mangum so it can run as a Vercel Python Serverless Function.

Vercel routes all /api/* requests to this handler via the catch-all
[[...path]].py file path convention.
"""

import sys
import os

# Add the project root and backend directory to the Python path
# so that imports from backend/main.py resolve correctly.
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
backend_dir = os.path.join(project_root, "backend")
sys.path.insert(0, project_root)
sys.path.insert(0, backend_dir)

from mangum import Mangum
from main import app  # Import the FastAPI app instance from backend/main.py

# Mangum adapter: converts AWS Lambda / Vercel serverless events
# into ASGI requests that FastAPI can handle.
handler = Mangum(app, lifespan="off")
