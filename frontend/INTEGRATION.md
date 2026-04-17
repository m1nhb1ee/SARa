# Smart AI Radiology Frontend - Backend Integration Guide

## 📦 Setup Frontend

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure API URL

Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

**`.env` content:**
```
VITE_API_URL=http://localhost:8000/api/v1
```

### 3. Start Frontend

```bash
npm run dev
```

Frontend runs at: `http://localhost:5173`

## 🌐 API Integration

### File Structure

```
frontend/src/
├── api/
│   ├── client.ts       # API client with all endpoints
│   └── hooks.ts        # React hooks for API calls
├── app/
│   └── pages/
│       ├── CaseListPage.tsx         # Case library
│       ├── DiagnosisTrainingPage.tsx  # Training interface
│       └── DashboardPage.tsx         # Dashboard & stats
```

### Using API

#### Option 1: Using Hooks (Recommended)

```tsx
import { useCases, useCreateSession, useSubmitAnswer } from '@/api/hooks';

export function MyComponent() {
  // Get cases with filters
  const { data: cases, loading, error } = useCases({
    difficulty: 'BASIC',
    page: 1
  });

  // Create session
  const { createSession } = useCreateSession();
  
  const handleStartTraining = async (caseId: number) => {
    const session = await createSession(caseId);
    if (session) {
      console.log('Session created:', session.id);
    }
  };

  // Submit answer
  const { submitAnswer } = useSubmitAnswer();
  
  const handleSubmit = async (sessionId: number, answer: string) => {
    const result = await submitAnswer(sessionId, answer);
    console.log('Feedback:', result.feedback);
  };
}
```

#### Option 2: Using API Client Directly

```tsx
import { apiClient } from '@/api/client';

// Get cases
const response = await apiClient.getCases({ difficulty: 'BASIC' });
if (response.error) {
  console.error(response.error);
} else {
  console.log(response.data.results);
}

// Create session
const session = await apiClient.createSession(1);
if (!session.error) {
  console.log('Session ID:', session.data.id);
}
```

## 🎯 Key Pages

### 1. CaseListPage (`/cases`)
- Display all cases
- Filter by modality, difficulty
- Search by title
- Pagination
- Start new training session

**API Calls:**
- `GET /cases/` - List cases
- `POST /sessions/` - Create session

### 2. DiagnosisTrainingPage (`/training/:caseId`)
- Show medical image
- 6-step diagnostic pipeline
- Submit answers
- Get AI feedback
- View answer key after completion

**API Calls:**
- `GET /cases/{id}/` - Get case details
- `GET /sessions/{id}/` - Get session details
- `POST /sessions/{id}/submit_answer/` - Submit answer
- `GET /sessions/{id}/answer_key/` - Get answer key

### 3. DashboardPage (`/`)
- User statistics
- Completed cases
- In-progress sessions
- Performance by step
- Quick links

**API Calls:**
- `GET /sessions/` - Get user sessions
- `GET /performance/my_stats/` - Get statistics

## 🔌 API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/cases/` | List all cases |
| GET | `/cases/{id}/` | Get case detail |
| GET | `/tags/` | Get tags |
| GET | `/sessions/` | List user sessions |
| POST | `/sessions/` | Create new session |
| GET | `/sessions/{id}/` | Get session detail |
| POST | `/sessions/{id}/submit_answer/` | Submit answer |
| GET | `/sessions/{id}/answer_key/` | Get answer key |
| GET | `/performance/my_stats/` | Get user stats |

## 📋 Response Examples

### Create Session
```json
{
  "id": 1,
  "case": 1,
  "case_title": "Viêm phổi điển hình",
  "current_step": 0,
  "status": "IN_PROGRESS",
  "total_score": 0.0,
  "started_at": "2024-04-15T10:30:00Z",
  "completed_at": null
}
```

### Submit Answer
```json
{
  "attempt": {
    "id": 1,
    "step_index": 0,
    "step_name": "OBSERVE",
    "score": 0.82,
    "feedback": {
      "type": "correct",
      "content": "Bước OBSERVE: Tuyệt vời!"
    }
  },
  "passed": true,
  "next_step": 1,
  "message": "Đáp án số được! Chuyển sang bước tiếp theo."
}
```

### Get Answer Key
```json
{
  "answer_key": {
    "OBSERVE": "Thấy infiltrate phổi dưới phải",
    "DESCRIBE": "Infiltrate mờ phím...",
    "INTERPRET": "Mật độ cao có thể do...",
    "HYPOTHESIS": "Viêm phổi",
    "DDx": ["Lao", "Ung thư phổi"],
    "CONCLUSION": "Viêm phổi phải",
    "explanation": "Dựa vào triệu trứng..."
  },
  "your_score": 0.78,
  "details": [...]
}
```

## 🚀 Running Both Frontend & Backend

### Terminal 1: Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py create_mock_data
python manage.py runserver
```

Backend: `http://localhost:8000`

### Terminal 2: Frontend

```bash
cd frontend
npm install
# Create .env with VITE_API_URL=http://localhost:8000/api/v1
npm run dev
```

Frontend: `http://localhost:5173`

## 🔐 Authentication

Current implementation uses **Session-based authentication**:
- No login endpoint implemented in MVP
- Use Django admin to create test users
- Test users created by mock data script:
  - `student1` / `testpass123`
  - `student2` / `testpass123`

**For production**, add:
- JWT authentication
- Login/Register pages
- Token refresh logic

## 🧪 Testing API

### Using cURL

```bash
# List cases
curl http://localhost:8000/api/v1/cases/

# Get specific case
curl http://localhost:8000/api/v1/cases/1/

# Create session (need session auth)
curl -X POST http://localhost:8000/api/v1/sessions/ \
  -H "Content-Type: application/json" \
  -d '{"case": 1}' \
  -c cookies.txt

# Submit answer
curl -X POST http://localhost:8000/api/v1/sessions/1/submit_answer/ \
  -H "Content-Type: application/json" \
  -d '{"student_answer": "My observation..."}' \
  -b cookies.txt
```

### Using Postman

1. Create collection for Smart AI Radiology
2. Add requests for each endpoint
3. Use environment variables for API_URL
4. Test with different filters and parameters

## 📊 Mock Data

### Cases
- Viêm phổi (Basic)
- Gãy xương sườn (Intermediate)
- U não (Advanced)
- Tràn dịch màng phổi (Intermediate)

### Test Users
- admin / adminpass123
- student1 / testpass123
- student2 / testpass123

## 🛠️ Development Tips

### Debug API Calls

Add logging in `api/client.ts`:

```tsx
private async request<T>(...) {
  console.log(`[API] ${method} ${endpoint}`);
  const response = await fetch(url, options);
  console.log('[API Response]', response.status, data);
  return { data, status: response.status };
}
```

### Check Browser Network Tab

All API calls visible in:
Developer Tools → Network tab → Filter by XHR/Fetch

### Mock Data in Development

If backend is down, you can mock responses:

```tsx
// In hooks.ts
if (import.meta.env.DEV) {
  // Return mock data
  return {
    data: mockData,
    loading: false,
    error: null
  };
}
```

## 🚨 Troubleshooting

### CORS Error

**Problem**: `Access-Control-Allow-Origin` error

**Solution**: Backend has CORS enabled for all origins (dev only)
- Production: Configure specific origins in Django settings

### 401 Unauthorized

**Problem**: Session endpoints return 401

**Solution**:
- Session cookie not being sent (missing `credentials: 'include'`)
- Already fixed in `api/client.ts`

### Empty Mock Data

**Problem**: No cases appear

**Solution**: Run `python manage.py create_mock_data` on backend

### API URL Not Resolving

**Problem**: `Failed to fetch from http://localhost:8000`

**Solution**:
1. Check backend is running on port 8000
2. Verify `VITE_API_URL` in `.env`
3. Check firewall/network settings

## 📚 Next Steps

1. ✅ Backend with mock data
2. ✅ Frontend API integration
3. ⏭️ Add real authentication (JWT)
4. ⏭️ Add Claude/GPT-4 Vision for real AI feedback
5. ⏭️ Deploy to production

## 📖 Related Documentation

- [Backend README](../backend/README.md)
- [Backend API Docs](../backend/ENDPOINTS.md)
- [Development Guide](../backend/DEVELOPMENT.md)
