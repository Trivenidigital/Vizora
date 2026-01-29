# Simple Load Test
$ErrorActionPreference = "Continue"

Write-Host "Vizora Load Test Starting..." -ForegroundColor Cyan

# Setup
$baseUrl = "http://localhost:3000/api"
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$random = Get-Random -Minimum 1000 -Maximum 9999
$testEmail = "load-$timestamp-$random@vizora.test"

# Register user
$body = @{
    email = $testEmail
    password = "Test123!"
    firstName = "Load"
    lastName = "Test"
    organizationName = "LoadOrg$timestamp"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $body -ContentType "application/json"
$token = $response.data.token

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "Test user created. Running load test..." -ForegroundColor Green
Write-Host ""

# Test 1: Sequential Requests
Write-Host "TEST 1: Response Time (10 requests)" -ForegroundColor Yellow
$times = @()
for ($i = 1; $i -le 10; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $null = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Headers $headers
    $sw.Stop()
    $times += $sw.ElapsedMilliseconds
    Write-Host "  Request ${i}: $($sw.ElapsedMilliseconds) ms"
}

$avg = [math]::Round(($times | Measure-Object -Average).Average, 2)
Write-Host "  Average: $avg ms" -ForegroundColor Cyan
Write-Host ""

# Test 2: Concurrent Requests
Write-Host "TEST 2: Concurrent Load (50 requests)" -ForegroundColor Yellow

$jobs = @()
for ($i = 1; $i -le 50; $i++) {
    $job = Start-Job -ScriptBlock {
        param($url, $h)
        try {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            Invoke-RestMethod -Uri $url -Headers $h | Out-Null
            $sw.Stop()
            return @{ Success = $true; Time = $sw.ElapsedMilliseconds }
        } catch {
            return @{ Success = $false; Error = $_.Exception.Message }
        }
    } -ArgumentList "$baseUrl/auth/me", $headers
    $jobs += $job
}

$null = Wait-Job -Job $jobs -Timeout 30

$success = 0
$fail = 0
$concurrentTimes = @()

foreach ($job in $jobs) {
    $result = Receive-Job -Job $job
    if ($result.Success) {
        $success++
        $concurrentTimes += $result.Time
    } else {
        $fail++
    }
    Remove-Job -Job $job
}

Write-Host "  Success: $success/50" -ForegroundColor Green
Write-Host "  Failed: $fail/50" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })

if ($concurrentTimes.Count -gt 0) {
    $avgConcurrent = [math]::Round(($concurrentTimes | Measure-Object -Average).Average, 2)
    Write-Host "  Avg Response: $avgConcurrent ms" -ForegroundColor Cyan
}

Write-Host ""

# Health check
Write-Host "Middleware Health Check..." -NoNewline
try {
    Invoke-RestMethod -Uri "http://localhost:3000/api/health" | Out-Null
    Write-Host " OK" -ForegroundColor Green
} catch {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host ""
Write-Host "Load test complete!" -ForegroundColor Green
