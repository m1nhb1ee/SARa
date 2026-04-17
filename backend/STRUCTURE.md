# Backend Structure - Smart AI Radiology

## 📦 Backend Architecture

### Technology Stack
- **Framework**: Django 4.2 + Django REST Framework
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Authentication**: Session-based
- **AI Agents**: Mock (development mode)

### Core Features Implemented

✅ **Case Management**
- Create, read, filter, and search medical cases
- Support multiple modalities (X-Ray, CT, MRI, Ultrasound)
- Difficulty levels (Basic, Intermediate, Advanced)
- Tags for categorization

✅ **Session Management**
- Create training sessions per case
- Track 6-step diagnostic pipeline progression
- Store session history and scores
- Session-level state management

✅ **Step-by-Step Pipeline**
1. OBSERVE - Observe full image
2. DESCRIBE - Describe findings in detail
3. INTERPRET - Interpret findings
4. HYPOTHESIS - Form diagnostic hypothesis
5. DDx - Differential diagnosis
6. CONCLUSION - Final conclusion

✅ **AI Feedback System** (Mock)
- Evaluate student answers per step
- Scoring (0-1 scale)
- Error identification
- Contextual feedback
- Socratic hints for wrong answers
- Real-time response

✅ **Performance Tracking**
- Per-user statistics
- Score by step accuracy
- Case completion tracking
- Last activity tracking

✅ **Admin Interface**
- Full Django admin for all models
- Batch case management
- Student performance monitoring
- Session inspection

## 🗂️ Directory Structure

```
backend/
│
├── config/                          # Django project settings
│   ├── __init__.py
│   ├── settings.py                 # Django settings
│   ├── urls.py                     # Main URL routing
│   └── wsgi.py                     # WSGI entry point
│
├── radiology/                       # Main Django app
│   ├── migrations/                 # Database migrations (auto-generated)
│   │   └── __init__.py
│   │
│   ├── management/
│   │   ├── __init__.py
│   │   └── commands/
│   │       ├── __init__.py
│   │       └── create_mock_data.py # Seed script
│   │
│   ├── __init__.py
│   ├── admin.py                    # Django admin configuration
│   ├── apps.py                     # App configuration
│   ├── models.py                   # Data models (Case, Session, etc)
│   ├── serializers.py              # REST serializers
│   ├── views.py                    # API ViewSets & Views
│   ├── urls.py                     # App URL routing
│   ├── ai_services.py              # Mock AI agents
│   ├── signals.py                  # Django signals
│   └── tests.py                    # Unit tests
│
├── manage.py                        # Django CLI
├── requirements.txt                 # Python dependencies
├── .env                            # Environment variables
├── .env.example                    # Example env template
├── .gitignore                      # Git ignore rules
│
├── Dockerfile                      # Docker image
├── docker-compose.yml              # Docker Compose setup
│
├── setup.sh                        # Setup script (Linux/macOS)
├── setup.bat                       # Setup script (Windows)
│
├── README.md                       # Project README
├── ENDPOINTS.md                    # API Documentation
└── DEVELOPMENT.md                  # Development Guide
```

## 🗄️ Database Models

### Case
- id, title, description
- modality (XRAY, CT, MRI, ULTRASOUND)
- difficulty (BASIC, INTERMEDIATE, ADVANCED)
- clinical_history
- pipeline_rubric (JSON) - scoring criteria
- answer_key (JSON) - correct answers (hidden from students)
- image_urls (JSON) - medical images
- tags (M2M with CaseTag)
- is_active, created_at, updated_at

### Session
- id, user_id, case_id
- current_step (0-5)
- status (IN_PROGRESS, COMPLETED, ABANDONED)
- step_history (JSON) - {step, attempts, score}
- cv_findings (JSON) - image analysis cache
- total_score, started_at, completed_at

### StepAttempt
- id, session_id
- step_index (0-5), step_name
- student_answer
- score (0-1)
- errors (JSON), feedback (JSON)
- latency_ms, created_at

### StudentPerformance
- id, user_id
- total_cases_completed
- average_score
- accuracy_by_step (JSON)
- last_activity

### CaseTag
- id, name, description

## 🔌 API Endpoints

Base: `/api/v1/`

### Cases (Public)
```
GET    /cases/                  List cases (with filters)
GET    /cases/{id}/             Get case detail
GET    /tags/                   List tags
```

### Sessions (Auth Required)
```
GET    /sessions/               My sessions
POST   /sessions/               Create new session
GET    /sessions/{id}/          Session detail
POST   /sessions/{id}/submit_answer/    Submit answer
GET    /sessions/{id}/answer_key/       View answer key
```

### Performance (Auth Required)
```
GET    /performance/my_stats/   Personal stats
```

## 🎯 Mock Data Included

### Cases (4)
1. Viêm phổi điển hình (X-Ray, Basic)
2. Gãy xương sườn (X-Ray, Intermediate)
3. U não (MRI, Advanced)
4. Tràn dịch màng phổi (X-Ray, Intermediate)

### Test Users
- admin / adminpass123 (staff)
- student1 / testpass123 (student)
- student2 / testpass123 (student)

### Sample Sessions
- student1 đang làm case 1 (step 2)
- 2 step attempts đã hoàn thành

## 🚀 Quick Start

### Option 1: Automatic Setup
**Windows:**
```bash
backend\setup.bat
```

**Linux/macOS:**
```bash
bash backend/setup.sh
```

### Option 2: Manual Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py create_mock_data
python manage.py runserver
```

### Option 3: Docker
```bash
cd backend
docker-compose up
```

## 📚 Testing

```bash
# Run all tests
python manage.py test radiology

# Run specific test class
python manage.py test radiology.tests.CaseAPITestCase

# Test with verbose output
python manage.py test radiology -v 2
```

## 🔐 Security (Development Only)

⚠️ **Current setup is for DEVELOPMENT only**

Production checklist:
- Set DEBUG = False
- Use strong SECRET_KEY
- Use PostgreSQL
- Enable HTTPS
- Set proper ALLOWED_HOSTS
- Configure CORS restrictively
- Use environment variables for secrets
- Set up authentication (JWT, OAuth2)
- Enable rate limiting
- Set up monitoring (Sentry)

## 📝 Key Design Decisions

1. **Mock AI Agents**: Development-friendly, swap with real APIs for production
2. **Session State Machine**: Server-side enforcement prevents cheating
3. **Step Attempts Logging**: Full audit trail for analytics
4. **Asynchronous CV Agent**: Image analysis runs independently
5. **JSON-based Pipeline/Rubric**: Flexible, case-specific configuration
6. **SQLite for Dev**: Fast setup, PostgreSQL for production

## 🔄 Workflow Example

1. Student creates session for a case
2. System analyzes image (CV Agent) → stores in session
3. Student answers OBSERVE step
4. System evaluates with rubric (Answer-Check Agent)
5. If score >= 0.6 → advance to next step
6. If score < 0.6 → show Socratic hint
7. Repeat until all 6 steps completed
8. Show answer key + detailed explanation

## 📊 Response Time (Mock)

- List cases: ~50ms
- Create session: ~100ms
- Submit answer: ~2000ms (includes AI evaluation)
- Get answer key: ~50ms

## 🛠️ Development Notes

- **No authentication required** for case listing (public API)
- **Session-based auth** for user endpoints
- **No user registration endpoint** (use admin or Django createsuperuser)
- **CORS allows all origins** for development (configure in production)
- **Mock AI returns random scores** ± 10% variance for realism

## 📖 Documentation Files

- **README.md** - Project overview & quick start
- **ENDPOINTS.md** - Detailed API documentation with examples
- **DEVELOPMENT.md** - Development workflow & common tasks
- **DEVELOPMENT.md** - Deployment checklist

## 🤝 Integration with Frontend

Frontend should:
1. Call `/api/v1/cases/` to list cases
2. Show case images from `image_urls`
3. Create session via POST `/api/v1/sessions/`
4. Implement step-by-step form following `current_step`
5. Submit answers to `/api/v1/sessions/{id}/submit_answer/`
6. After completion, fetch answer key from `/api/v1/sessions/{id}/answer_key/`

## Next Steps

1. ✅ Backend complete with mock data
2. ⏭️ Frontend: Connect to backend APIs
3. ⏭️ Real AI Integration: Replace MockAIAgent with Claude/GPT-4 APIs
4. ⏭️ Production Deployment: PostgreSQL, Gunicorn, Nginx
5. ⏭️ Monitoring: Sentry, analytics

---

**Created**: April 15, 2026
**Status**: MVP Ready for Development
**Test Accounts**: See Quick Start section
