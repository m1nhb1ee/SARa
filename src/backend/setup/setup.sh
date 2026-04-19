#!/bin/bash
# Setup script for Smart AI Radiology Backend

echo "🚀 Smart AI Radiology Backend Setup"
echo "===================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

echo "✓ Python found: $(python3 --version)"
echo ""

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Create .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
fi

# Run migrations
echo "🗄️ Running migrations..."
python manage.py migrate

# Create mock data
echo "📊 Creating mock data..."
python manage.py create_mock_data

# Collect static files
echo "🎨 Collecting static files..."
python manage.py collectstatic --noinput

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Activate venv: source venv/bin/activate"
echo "   2. Run server: python manage.py runserver"
echo "   3. Visit: http://localhost:8000"
echo ""
echo "👤 Test accounts:"
echo "   - Admin: admin / adminpass123"
echo "   - Student 1: student1 / testpass123"
echo "   - Student 2: student2 / testpass123"
echo ""
