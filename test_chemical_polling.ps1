# 化学式提取轮询测试脚本
# 启动化学式提取服务器并测试轮询功能

param(
    [string]$ServerPath = "starpdf\img_extractor",
    [int]$ServerPort = 8011,
    [string]$TestMode = "api"  # api, full, or both
)

Write-Host "=" * 60 -ForegroundColor Green
Write-Host "化学式提取轮询测试脚本" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green

# 检查Python环境
Write-Host "检查Python环境..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python版本: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python未安装或不在PATH中" -ForegroundColor Red
    exit 1
}

# 检查服务器目录
$serverDir = Join-Path $PWD $ServerPath
if (-not (Test-Path $serverDir)) {
    Write-Host "❌ 服务器目录不存在: $serverDir" -ForegroundColor Red
    exit 1
}

Write-Host "服务器目录: $serverDir" -ForegroundColor Green

# 检查服务器主程序
$serverMain = Join-Path $serverDir "run_api_server.py"
if (-not (Test-Path $serverMain)) {
    Write-Host "❌ 服务器主程序不存在: $serverMain" -ForegroundColor Red
    exit 1
}

Write-Host "服务器主程序: $serverMain" -ForegroundColor Green

# 启动服务器
Write-Host "`n启动化学式提取服务器..." -ForegroundColor Yellow
Write-Host "端口: $ServerPort" -ForegroundColor Green

$serverProcess = $null
try {
    # 切换到服务器目录
    Push-Location $serverDir
    
    # 启动服务器进程
    $serverProcess = Start-Process -FilePath "python" -ArgumentList "run_api_server.py", "--port", $ServerPort, "--processes", "1" -PassThru -WindowStyle Hidden
    
    Write-Host "服务器进程ID: $($serverProcess.Id)" -ForegroundColor Green
    
    # 等待服务器启动
    Write-Host "等待服务器启动..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # 检查服务器是否启动成功
    $serverUrl = "http://localhost:$ServerPort"
    $healthUrl = "$serverUrl/api/health"
    
    $maxRetries = 10
    $retryCount = 0
    $serverReady = $false
    
    while ($retryCount -lt $maxRetries -and -not $serverReady) {
        try {
            $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 5
            if ($response.status -eq "ok") {
                $serverReady = $true
                Write-Host "✅ 服务器启动成功!" -ForegroundColor Green
            }
        } catch {
            $retryCount++
            Write-Host "等待服务器启动... ($retryCount/$maxRetries)" -ForegroundColor Yellow
            Start-Sleep -Seconds 3
        }
    }
    
    if (-not $serverReady) {
        Write-Host "❌ 服务器启动失败或超时" -ForegroundColor Red
        throw "服务器启动失败"
    }
    
    # 切换回原目录
    Pop-Location
    
    # 运行测试
    Write-Host "`n开始运行测试..." -ForegroundColor Yellow
    
    if ($TestMode -eq "api" -or $TestMode -eq "both") {
        Write-Host "`n运行API测试..." -ForegroundColor Cyan
        $apiTestResult = python test_task_api.py
        Write-Host $apiTestResult
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ API测试通过" -ForegroundColor Green
        } else {
            Write-Host "❌ API测试失败" -ForegroundColor Red
        }
    }
    
    if ($TestMode -eq "full" -or $TestMode -eq "both") {
        Write-Host "`n运行完整轮询测试..." -ForegroundColor Cyan
        $fullTestResult = python test_chemical_extraction_polling.py
        Write-Host $fullTestResult
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ 完整轮询测试通过" -ForegroundColor Green
        } else {
            Write-Host "❌ 完整轮询测试失败" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "❌ 测试过程中发生错误: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # 清理：停止服务器进程
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Write-Host "`n停止服务器进程..." -ForegroundColor Yellow
        try {
            Stop-Process -Id $serverProcess.Id -Force
            Write-Host "✅ 服务器进程已停止" -ForegroundColor Green
        } catch {
            Write-Host "❌ 停止服务器进程失败: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # 确保回到原目录
    if ((Get-Location).Path -ne $PWD) {
        Pop-Location
    }
}

Write-Host "`n=" * 60 -ForegroundColor Green
Write-Host "测试完成" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green
