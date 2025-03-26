@echo off
echo Starting Vizora Platform...

:: Start the middleware FIRST in a new window (since the web app depends on it)
start cmd /k "cd VizoraMiddleware && echo Starting Vizora Middleware on port 3003... && npm run dev"

:: Wait for middleware to initialize (5 seconds)
echo Waiting for middleware to initialize...
timeout /t 5 /nobreak >nul

:: Start the web app in a new window
start cmd /k "echo Starting Vizora Web App on port 3001... && npm run dev:web"

echo All components started!
echo Middleware: http://localhost:3003
echo Web App: http://localhost:3001

echo.
echo IMPORTANT: Make sure no other Socket.IO servers are running to avoid conflicts.
echo If you still experience connection issues, try running only the middleware.
echo.

pause 