# seed_6_cases.py
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

BASE_URL = "https://sriaolvqfchkbjehgiym.supabase.co/storage/v1/object/public/case_images"

cases = [
    {
        "title": "Bone fracture with avulsion",
        "modality": "X-ray",
        "difficulty": "medium",
        "clinical_history": "Patient presents with acute limb pain following trauma. Unable to bear weight. Swelling and tenderness noted at the affected site.",
        "image_urls": [f"{BASE_URL}/Bone_Break_Avulsion_Fra.jpg"],
        "tags": ["fracture", "bone", "avulsion", "trauma"],
        "disease_tag": "bone_break",
        "status": "draft"
    },
    {
        "title": "Meningioma — intracranial mass",
        "modality": "MRI",
        "difficulty": "hard",
        "clinical_history": "Female, 52 years old. Progressive headache over 3 months, occasional blurred vision. No history of trauma or seizure.",
        "image_urls": [f"{BASE_URL}/Meningioma_001.jpg"],
        "tags": ["meningioma", "brain", "tumor", "neuro"],
        "disease_tag": "meningioma",
        "status": "draft"
    },
    {
        "title": "Normal brain — baseline reference",
        "modality": "MRI",
        "difficulty": "easy",
        "clinical_history": "Male, 30 years old. Routine neurological workup. No complaints. No focal deficits on examination.",
        "image_urls": [f"{BASE_URL}/Normal_Brain_001.jpg"],
        "tags": ["normal", "brain", "baseline", "neuro"],
        "disease_tag": "normal_brain",
        "status": "draft"
    },
    {
        "title": "Renal malignancy — kidney tumor",
        "modality": "CT",
        "difficulty": "hard",
        "clinical_history": "Male, 60 years old. Incidental finding on abdominal CT done for flank pain. Microscopic hematuria on urinalysis.",
        "image_urls": [f"{BASE_URL}/Renal_Malignancy_Tumor.jpg"],
        "tags": ["renal", "kidney", "malignancy", "tumor"],
        "disease_tag": "renal_malignancy",
        "status": "draft"
    },
    {
        "title": "Skin lesion — malignant presentation",
        "modality": "X-ray",
        "difficulty": "medium",
        "clinical_history": "Female, 45 years old. Skin lesion present for 6 months, recently changed in size and color. Irregular borders noted on examination.",
        "image_urls": [f"{BASE_URL}/Skin_Lession_Malignant.jpg"],
        "tags": ["skin", "lesion", "malignant", "dermatology"],
        "disease_tag": "skin_lession",
        "status": "draft"
    },
    {
        "title": "Squamous cell carcinoma",
        "modality": "CT",
        "difficulty": "hard",
        "clinical_history": "Male, 58 years old. Heavy smoker, 30 pack-years. Persistent hoarseness and mild dysphagia for 2 months. Palpable cervical lymph node.",
        "image_urls": [f"{BASE_URL}/squamous_cell_carcinoma.jpg"],
        "tags": ["squamous", "carcinoma", "scc", "oncology"],
        "disease_tag": "squamous_cell_carcinoma",
        "status": "draft"
    },
]

# Upsert minimal disease profiles — just the tag, enrich later
for case in cases:
    supabase.table("disease_profiles").upsert(
        {"disease_tag": case["disease_tag"]},
        on_conflict="disease_tag"
    ).execute()
    print(f"✓ Disease profile: {case['disease_tag']}")

# Insert cases
for case in cases:
    result = supabase.table("cases").insert(case).execute()
    print(f"✓ Case inserted: {result.data[0]['id']} — {case['title']}")

print("\nDone. 6 cases inserted as draft.")