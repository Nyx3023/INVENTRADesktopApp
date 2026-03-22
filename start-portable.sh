#!/bin/bash

echo "========================================"
echo "  ThesisPOS - Portable Edition"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Node.js found: $(node --version)"
echo ""

# Database will be initialized automatically by the server on first run

# Check if node_modules exists (for offline installation)
if [ ! -d "node_modules" ]; then
    echo "WARNING: node_modules not found. Attempting to install dependencies..."
    echo "This requires an internet connection."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies"
        echo "Please ensure you have an internet connection or reinstall the application."
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo "Dependencies installed successfully."
    echo ""
else
    echo "Dependencies found - offline mode ready."
    echo ""
fi

# Build frontend if dist doesn't exist
if [ ! -d "dist" ]; then
    echo "Building frontend..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to build frontend"
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo "Frontend built successfully."
    echo ""
fi

# Start the server in background temporarily so we can open the browser
echo "Starting ThesisPOS server..."
echo "Server will be available at: http://localhost:3001"
echo "Press Ctrl+C to stop the server"
echo ""

# Start server in background, wait for it to be ready, then open browser
node server/index.js &
SERVER_PID=$!

# Wait for server to be ready (poll until port 3001 is open)
echo "Waiting for server to be ready..."
for i in $(seq 1 30); do
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

# Open browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3001
elif command -v gnome-open &> /dev/null; then
    gnome-open http://localhost:3001
elif command -v open &> /dev/null; then
    open http://localhost:3001
else
    echo "Could not detect a browser opener. Please open http://localhost:3001 manually."
fi

# Bring server back to foreground so Ctrl+C works
wait $SERVER_PID
