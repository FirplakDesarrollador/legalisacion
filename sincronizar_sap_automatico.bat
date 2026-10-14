@echo off
chcp 65001 >nul
title Sincronizador Automatico SAP Firplak (Cada 2 min)
cd /d "%~dp0"
echo ======================================================================
echo    SINCRONIZADOR AUTOMATICO DE LEGALIZACIONES CON SAP - FIRPLAK
echo ======================================================================
echo.
echo Monitoreando Supabase cada 2 minutos...
echo (Puedes minimizar esta ventana. Para detenerlo, simplemente cierrala).
echo.
node scripts/sync-sap.js --watch
pause
