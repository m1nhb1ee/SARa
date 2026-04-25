# Set up siêu đơn giản

## Getting Started

### 1. Clone and setup

```bash
git clone <repo-url>
cd <repo>
```

### 2. Configure environment

paste file .env vào trong folder backend (./A20-App-076/apps/backend)

### 3. Run backend

cd vào folder backend sau đó chạy từng lệnh sau:

```bash
python -m venv venv     
venv\Scripts\activate
pip install -r requirements.txt
py manage.py runserver
```

### 4. Run frontend

cd vào folder frontend sau đó chạy từng lệnh sau:

```bash
npm install
npm run dev
```