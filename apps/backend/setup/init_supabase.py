#!/usr/bin/env python3
"""
Initialize Supabase — create buckets and set RLS policies.
Run once to set up the project.
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] SUPABASE_URL or SUPABASE_KEY not set in .env")
    exit(1)

from supabase import create_client

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_bucket(name: str, public: bool = True):
    """Create bucket if it doesn't exist."""
    try:
        sb.storage.get_bucket(name)
        print(f"[OK] Bucket '{name}' already exists")
    except Exception as e:
        try:
            sb.storage.create_bucket(name, options={"public": public})
            print(f"[OK] Created bucket '{name}' (public={public})")
        except Exception as create_err:
            print(f"[ERROR] Failed to create bucket '{name}': {create_err}")
            raise

print("[INFO] Setting up Supabase Storage buckets...")
create_bucket('case-images', public=True)
create_bucket('uploads', public=False)

print("\n[OK] Supabase setup complete!")
