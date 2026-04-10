@echo off
title Label Inspect - AquaShield
color 0A
echo.
echo  =====================================
echo   AQUASHIELD  Label Inspect v3.1
echo  =====================================
echo.
echo  Iniciando servidor local en puerto 8085...
echo  NO CIERRES ESTA VENTANA mientras usas la app.
echo.
start /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8085"
python -m http.server 8085
echo.
echo  Servidor cerrado. Puedes cerrar esta ventana.
pause
