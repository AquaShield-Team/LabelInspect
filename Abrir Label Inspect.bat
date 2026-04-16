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
    exit /b
)

:: Liberar puerto 8085 si ya esta en uso
echo  [*] Verificando puerto 8085...
netstat -aon 2>nul | findstr ":8085.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo  [!] Puerto 8085 ocupado. Liberando...
    for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":8085.*LISTENING"') do taskkill /F /PID %%p >nul 2>&1
    timeout /t 1 /nobreak >nul
)

:: Verificar si server/app.py existe
if not exist "server\app.py" (
    echo  [!] No se encontro server\app.py
    echo  [!] Iniciando en MODO BASICO sin OpenCV...
    echo.
    start "" "http://localhost:8085"
    python -m http.server 8085
    pause
    exit /b
)

:: Verificar Flask
pip show flask >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Instalando dependencias...
    pip install -r server\requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org 2>nul
    if %errorlevel% neq 0 (
        echo  [!] No se pudieron instalar dependencias.
        echo  [!] Iniciando en MODO BASICO sin OpenCV...
        start "" "http://localhost:8085"
        python -m http.server 8085
        pause
        exit /b
    )
)

echo.
echo  [OK] Iniciando servidor con OpenCV backend...
echo  NO CIERRES ESTA VENTANA mientras usas la app.
echo.
echo  URL: http://localhost:8085
echo.

:: Abrir navegador
start "" "http://localhost:8085"

:: Iniciar Flask (esto mantiene la ventana abierta)
python server\app.py

echo.
echo  Servidor cerrado.
pause
