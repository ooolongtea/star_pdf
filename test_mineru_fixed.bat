@echo off
echo MinerU客户端测试 (修复版)
echo.

REM 检查参数
if "%~1"=="" (
    echo 错误: 请提供要测试的文件路径
    echo 用法: test_mineru_fixed.bat 文件路径 [服务器URL] [服务器输出目录]
    exit /b 1
)

REM 设置服务器URL
set SERVER_URL=http://127.0.0.1:8010
if not "%~2"=="" set SERVER_URL=%~2

REM 设置服务器输出目录
set OUTPUT_DIR=/home/zhangxiaohong/zhouxingyu/zxy_extractor/data/tmp/mineru
if not "%~3"=="" set OUTPUT_DIR=%~3

REM 创建输出目录
if not exist mineru_test_results mkdir mineru_test_results

REM 运行测试脚本
python mineru_client_test_fixed.py "%~1" --server %SERVER_URL% --output-dir %OUTPUT_DIR%

echo.
if %ERRORLEVEL% EQU 0 (
    echo 测试完成，结果保存在 mineru_test_results 目录中
) else (
    echo 测试失败
)
pause
