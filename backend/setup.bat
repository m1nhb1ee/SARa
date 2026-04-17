@echo off
REM Setup script for Smart AI Radiology Backend (Windows)

echo.
echo 🚀 Smart AI Radiology Backend Setup
echo ====================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed
    exit /b 1
)

echo ✓ Python found: 
python --version
echo.

REM Create virtual environment
echo 📦 Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo 🔌 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📚 Installing dependencies...
pip install -r requirements.txt

REM Create .env file
if not exist .env (
    echo 📝 Creating .env file...
    copy .env.example .env
)

REM Run migrations
echo 🗄️ Running migrations...
python manage.py migrate

REM Create mock data
echo 📊 Creating mock data...
python manage.py create_mock_data

REM Collect static files
echo 🎨 Collecting static files...
python manage.py collectstatic --noinput

echo.
echo ✅ Setup complete!
echo.
echo 📋 Next steps:
echo    1. Activate venv: venv\Scripts\activate.bat
echo    2. Run server: python manage.py runserver
echo    3. Visit: http://localhost:8000
echo.
echo 👤 Test accounts:
echo    - Admin: admin / adminpass123
echo    - Student 1: student1 / testpass123
echo    - Student 2: student2 / testpass123
echo.
