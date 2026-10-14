@echo off
chcp 65001 >nul
title Sincronizador SAP Firplak
cd /d "%~dp0"
echo ======================================================================
echo           SINCRONIZADOR DE LEGALIZACIONES CON SAP - FIRPLAK
echo ======================================================================
echo.
echo Consultando registros aprobados en Supabase y enviando a SAP...
echo.
node scripts/sync-sap.js
echo.
echo ======================================================================
echo Presione cualquier tecla para cerrar esta ventana...
pause >nul
