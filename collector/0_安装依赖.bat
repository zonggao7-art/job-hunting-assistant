@echo off
echo === Python version check ===
python --version
python -m pip --version
echo ============================
echo.
echo [1/3] Trying Aliyun mirror...
python -m pip install drissionpage rapidocr_onnxruntime -i https://mirrors.aliyun.com/pypi/simple/
if not errorlevel 1 goto :done
echo.
echo [2/3] Aliyun failed, trying Tencent mirror...
python -m pip install drissionpage rapidocr_onnxruntime -i https://mirrors.cloud.tencent.com/pypi/simple/
if not errorlevel 1 goto :done
echo.
echo [3/3] Mirrors failed, trying official PyPI (may be slow)...
python -m pip install drissionpage rapidocr_onnxruntime
if errorlevel 1 (
    echo.
    echo All sources failed. Take a screenshot of this window and send it to Claude.
    pause
    exit /b 1
)
:done
echo.
echo Install OK. Now run 1_start_collector.bat
pause
