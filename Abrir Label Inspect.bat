@echo off
title Label Inspect - AquaShield v4.0
color 0A
echo.
echo  =====================================
echo   AQUASHIELD  Label Inspect v4.0
echo   OpenCV + Barcode + QR
echo  =====================================
echo.

:: Verificar si las dependencias del backend están instaladas
pip show flask >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Instalando dependencias del backend...
    pip install -r server\requirements.txt
    echo.
)

echo  Iniciando servidor con OpenCV backend...
echo  NO CIERRES ESTA VENTANA mientras usas la app.
echo.
echo  URL: http://localhost:8085
echo.

:: Iniciar Flask (que sirve tanto la API como los archivos estáticos)
start /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8085"
python server\app.py

echo.
echo  Servidor cerrado. Puedes cerrar esta ventana.
pause
