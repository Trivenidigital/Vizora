# Vizora Load & Performance Test
# Tests system under concurrent load

$ErrorActionPreference = "Continue"

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 VIZORA LOAD & PERFORMANCE TEST" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000/api"

# Create test user first
Write-Host "Setting up test user..." -ForegroundColor Yellow
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$random = Get-Random -Minimum 1000 -Maximum 9999
$testEmail = "load-test-$timestamp-$random@vizora.test"
$testPassword = "TestPass123!"

$registerBody = @{
    email = $testEmail
    password = $testPassword
    firstName = "Load"
    lastName = "Test"
    organizationName = "Load Test Org $timestamp"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json"
    
    $token = $registerResponse.data.token
    Write-Host "✅ Test user created" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to create test user: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host ""
Write-Host "TEST 1: Response Time Measurement" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray

$endpoints = @(
    @{ Name = "GET /auth/me"; Url = "$baseUrl/auth/me"; Method = "GET" },
    @{ Name = "GET /content"; Url = "$baseUrl/content"; Method = "GET" },
    @{ Name = "GET /playlists"; Url = "$baseUrl/playlists"; Method = "GET" },
    @{ Name = "GET /displays"; Url = "$baseUrl/displays"; Method = "GET" }
)

$responseTimes = @()

foreach ($endpoint in $endpoints) {
    Write-Host "Testing $($endpoint.Name)..." -NoNewline
    
    $measurements = @()
    for ($i = 1; $i -le 10; $i++) {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $response = Invoke-RestMethod -Uri $endpoint.Url -Method $endpoint.Method -Headers $headers
            $stopwatch.Stop()
            $measurements += $stopwatch.ElapsedMilliseconds
        }
        catch {
            $stopwatch.Stop()
            Write-Host " ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
            break
        }
    }
    
    if ($measurements.Count -eq 10) {
        $avg = [math]::Round(($measurements | Measure-Object -Average).Average, 2)
        $min = ($measurements | Measure-Object -Minimum).Minimum
        $max = ($measurements | Measure-Object -Maximum).Maximum
        
        Write-Host " ✅" -ForegroundColor Green
        Write-Host "   Avg: $avg ms | Min: $min ms | Max: $max ms" -ForegroundColor Gray
        
        $responseTimes += @{
            Endpoint = $endpoint.Name
            Average = $avg
            Min = $min
            Max = $max
        }
    }
}

Write-Host ""
Write-Host "TEST 2: Concurrent Request Load" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "Running 50 concurrent requests..." -ForegroundColor Cyan

$jobs = @()
$totalRequests = 50

$scriptBlock = {
    param($Url, $Headers, $RequestNum)
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-RestMethod -Uri $Url -Method GET -Headers $Headers -ErrorAction Stop
        $stopwatch.Stop()
        
        return @{
            Success = $true
            Time = $stopwatch.ElapsedMilliseconds
            RequestNum = $RequestNum
        }
    }
    catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
            RequestNum = $RequestNum
        }
    }
}

# Start all jobs
for ($i = 1; $i -le $totalRequests; $i++) {
    $job = Start-Job -ScriptBlock $scriptBlock -ArgumentList "$baseUrl/auth/me", $headers, $i
    $jobs += $job
}

Write-Host "Started $totalRequests concurrent requests..." -NoNewline

# Wait for all jobs to complete
$timeout = 30  # 30 seconds timeout
$completed = Wait-Job -Job $jobs -Timeout $timeout

Write-Host " Done!" -ForegroundColor Green

# Collect results
$successCount = 0
$failCount = 0
$times = @()

foreach ($job in $jobs) {
    $result = Receive-Job -Job $job
    
    if ($result.Success) {
        $successCount++
        $times += $result.Time
    } else {
        $failCount++
    }
    
    Remove-Job -Job $job
}

Write-Host ""
Write-Host "Results:" -ForegroundColor Cyan
Write-Host "  ✅ Successful: $successCount/$totalRequests" -ForegroundColor $(if ($successCount -eq $totalRequests) { "Green" } else { "Yellow" })
Write-Host "  ❌ Failed: $failCount/$totalRequests" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })

if ($times.Count -gt 0) {
    $avgConcurrent = [math]::Round(($times | Measure-Object -Average).Average, 2)
    $minConcurrent = ($times | Measure-Object -Minimum).Minimum
    $maxConcurrent = ($times | Measure-Object -Maximum).Maximum
    
    Write-Host "  ⏱️  Average Response Time: $avgConcurrent ms" -ForegroundColor Cyan
    Write-Host "  ⚡ Fastest Response: $minConcurrent ms" -ForegroundColor Green
    Write-Host "  🐌 Slowest Response: $maxConcurrent ms" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "TEST 3: Middleware Stability Check" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray

Write-Host "Checking if middleware is still responsive..." -NoNewline
try {
    $healthCheck = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method GET
    Write-Host " ✅ Middleware is healthy!" -ForegroundColor Green
}
catch {
    Write-Host " ❌ Middleware crashed!" -ForegroundColor Red
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "PERFORMANCE SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

foreach ($rt in $responseTimes) {
    $color = if ($rt.Average -lt 100) { "Green" } elseif ($rt.Average -lt 500) { "Yellow" } else { "Red" }
    Write-Host "$($rt.Endpoint): $($rt.Average) ms (min: $($rt.Min) ms, max: $($rt.Max) ms)" -ForegroundColor $color
}

Write-Host ""
$successRate = [math]::Round(($successCount / $totalRequests) * 100, 2)
Write-Host "Concurrent Load Test: $successRate% success rate ($successCount/$totalRequests)" -ForegroundColor $(if ($successRate -eq 100) { "Green" } elseif ($successRate -ge 95) { "Yellow" } else { "Red" })

Write-Host ""
if ($successRate -eq 100 -and $avgConcurrent -lt 500) {
    Write-Host "EXCELLENT PERFORMANCE! System handles load well." -ForegroundColor Green
} elseif ($successRate -ge 95 -and $avgConcurrent -lt 1000) {
    Write-Host "GOOD PERFORMANCE. System is stable under load." -ForegroundColor Yellow
} else {
    Write-Host "PERFORMANCE ISSUES DETECTED. Investigation needed." -ForegroundColor Red
}
