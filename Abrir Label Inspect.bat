@echo off
title Label Inspect - AquaShield v4.0
color 0A
echo.
echo  =====================================
echo   AQUASHIELD  Label Inspect v4.0
echo  =====================================
echo.

:: Verificar Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python no esta instalado.
    echo.
    echo  Opcion 1: Instala Python desde Microsoft Store
    echo  Opcion 2: Usa la version web directamente:
    echo  https://aquashield-team.github.io/LabelInspect/
    echo.
    pause
    exit
)

:: Verificar si server/app.py existe (por si el ZIP se anido)
if not exist "server\app.py" (
    echo  [!] No se encontro server\app.py
    echo  [!] Iniciando en MODO BASICO (sin OpenCV)...
    echo.
    echo  Para modo completo, asegurate de estar en la
    echo  carpeta correcta del proyecto.
    echo.
    echo  Iniciando servidor basico en puerto 8085...
    start /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8085"
    python -m http.server 8085
    pause
    exit
)

:: Intentar iniciar Flask (modo completo)
pip show flask >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Instalando dependencias del backend...
    pip install -r server\requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo  [!] No se pudieron instalar las dependencias (firewall).
        echo  [!] Iniciando en MODO BASICO (sin OpenCV)...
        echo.
        start /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8085"
        python -m http.server 8085
        pause
        exit
    )
)

echo  Iniciando servidor con OpenCV backend...
echo  NO CIERRES ESTA VENTANA mientras usas la app.
echo.
echo  URL: http://localhost:8085
echo.
start /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8085"
python server\app.py

echo.
echo  Servidor cerrado. Puedes cerrar esta ventana.
pause
