# Vizora Platform E2E Test Script
# Generated: 2026-01-27

$ErrorActionPreference = "Continue"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YzI5Yzk4OS0yMWQwLTRmZGEtOTZkYy1iMWYyZTkzNzVhNDUiLCJlbWFpbCI6ImUyZS10ZXN0LWxvZ2luLTIwMjYwMTI3MTQwNDAyQHZpem9yYS5jb20iLCJvcmdhbml6YXRpb25JZCI6ImQxMTMwZTk4LTg2MDMtNGUzYS05Zjk3LTU2NDc5OTZjOWM5YyIsInJvbGUiOiJhZG1pbiIsInR5cGUiOiJ1c2VyIiwiaWF0IjoxNzY5NTQwNjQyLCJleHAiOjE3NzAxNDU0NDJ9.OSXifOyaHQlw1RdNKmzrg7nvNzNIy0G8p64B4TJvCd0"
$deviceId = "1910574c-9487-49d1-b31e-11f523c6a2ed"

Write-Host "===== VIZORA E2E TEST SUITE =====" -ForegroundColor Cyan
$results = @()

# Test 1: Middleware Health
Write-Host "`n[TEST 1] Middleware Health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri http://localhost:3000/api/health -ErrorAction Stop
    if ($health.status -eq "ok") {
        Write-Host "✅ PASS" -ForegroundColor Green
        $results += "✅ Middleware Health"
    } else {
        Write-Host "❌ FAIL - Status: $($health.status)" -ForegroundColor Red
        $results += "❌ Middleware Health"
    }
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ Middleware Health"
}

# Test 2: Realtime Health
Write-Host "`n[TEST 2] Realtime Health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri http://localhost:3001/api/health -ErrorAction Stop
    if ($health.status -eq "ok") {
        Write-Host "✅ PASS" -ForegroundColor Green
        $results += "✅ Realtime Health"
    } else {
        Write-Host "❌ FAIL" -ForegroundColor Red
        $results += "❌ Realtime Health"
    }
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ Realtime Health"
}

# Test 3: Get Current User
Write-Host "`n[TEST 3] Get Current User (Auth Test)..." -ForegroundColor Yellow
try {
    $user = Invoke-RestMethod -Uri http://localhost:3000/api/auth/me -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
    Write-Host "✅ PASS - User: $($user.email)" -ForegroundColor Green
    $results += "✅ Get Current User"
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ Get Current User"
}

# Test 4: List Devices
Write-Host "`n[TEST 4] List Devices..." -ForegroundColor Yellow
try {
    $devices = Invoke-RestMethod -Uri http://localhost:3000/api/displays -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
    Write-Host "✅ PASS - Found $($devices.Count) devices" -ForegroundColor Green
    $results += "✅ List Devices"
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ List Devices"
}

# Test 5: Get Single Device
Write-Host "`n[TEST 5] Get Single Device..." -ForegroundColor Yellow
try {
    $device = Invoke-RestMethod -Uri "http://localhost:3000/api/displays/$deviceId" -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
    Write-Host "✅ PASS - Device: $($device.nickname)" -ForegroundColor Green
    $results += "✅ Get Single Device"
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ Get Single Device"
}

# Test 6: Update Device
Write-Host "`n[TEST 6] Update Device..." -ForegroundColor Yellow
try {
    $updateBody = @{description="Updated E2E Test Device"} | ConvertTo-Json
    $device = Invoke-RestMethod -Uri "http://localhost:3000/api/displays/$deviceId" -Method PATCH -Headers @{"Content-Type"="application/json";"Authorization"="Bearer $token"} -Body $updateBody -ErrorAction Stop
    if ($device.description -eq "Updated E2E Test Device") {
        Write-Host "✅ PASS" -ForegroundColor Green
        $results += "✅ Update Device"
    } else {
        Write-Host "❌ FAIL - Description not updated" -ForegroundColor Red
        $results += "❌ Update Device"
    }
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ Update Device"
}

# Test 7: Create Content (Simulated - no file upload in API test)
Write-Host "`n[TEST 7] List Content..." -ForegroundColor Yellow
try {
    $content = Invoke-RestMethod -Uri http://localhost:3000/api/content -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
    Write-Host "✅ PASS - Found $($content.Count) content items" -ForegroundColor Green
    $results += "✅ List Content"
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ List Content"
}

# Test 8: Create Playlist
Write-Host "`n[TEST 8] Create Playlist..." -ForegroundColor Yellow
try {
    $playlistBody = @{name="E2E Test Playlist";description="Created by E2E test"} | ConvertTo-Json
    $playlist = Invoke-RestMethod -Uri http://localhost:3000/api/playlists -Method POST -Headers @{"Content-Type"="application/json";"Authorization"="Bearer $token"} -Body $playlistBody -ErrorAction Stop
    Write-Host "✅ PASS - Playlist ID: $($playlist.id)" -ForegroundColor Green
    $results += "✅ Create Playlist"
    $global:playlistId = $playlist.id
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ Create Playlist"
}

# Test 9: Get Playlists
Write-Host "`n[TEST 9] List Playlists..." -ForegroundColor Yellow
try {
    $playlists = Invoke-RestMethod -Uri http://localhost:3000/api/playlists -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
    Write-Host "✅ PASS - Found $($playlists.Count) playlists" -ForegroundColor Green
    $results += "✅ List Playlists"
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ List Playlists"
}

# Test 10: List Schedules
Write-Host "`n[TEST 10] List Schedules..." -ForegroundColor Yellow
try {
    $schedules = Invoke-RestMethod -Uri http://localhost:3000/api/schedules -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
    Write-Host "✅ PASS - Found $($schedules.Count) schedules" -ForegroundColor Green
    $results += "✅ List Schedules"
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ List Schedules"
}

# Test 11: Prometheus Metrics
Write-Host "`n[TEST 11] Realtime Metrics Endpoint..." -ForegroundColor Yellow
try {
    $metrics = Invoke-RestMethod -Uri http://localhost:3001/api/metrics -ErrorAction Stop
    if ($metrics -match "process_cpu") {
        Write-Host "✅ PASS - Metrics available" -ForegroundColor Green
        $results += "✅ Prometheus Metrics"
    } else {
        Write-Host "❌ FAIL - Metrics format unexpected" -ForegroundColor Red
        $results += "❌ Prometheus Metrics"
    }
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ Prometheus Metrics"
}

# Test 12: Database Connectivity
Write-Host "`n[TEST 12] Database Connectivity..." -ForegroundColor Yellow
try {
    $ready = Invoke-RestMethod -Uri http://localhost:3000/api/health/ready -ErrorAction Stop
    if ($ready.status -eq "ok") {
        Write-Host "✅ PASS" -ForegroundColor Green
        $results += "✅ Database Connectivity"
    } else {
        Write-Host "❌ FAIL" -ForegroundColor Red
        $results += "❌ Database Connectivity"
    }
} catch {
    Write-Host "❌ FAIL - $_" -ForegroundColor Red
    $results += "❌ Database Connectivity"
}

# Summary
Write-Host "`n===== TEST SUMMARY =====" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_ -match "✅" }).Count
$failed = ($results | Where-Object { $_ -match "❌" }).Count
$total = $results.Count

Write-Host "`nTotal Tests: $total" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "Pass Rate: $([math]::Round(($passed/$total)*100, 2))%" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })

Write-Host "`n===== DETAILED RESULTS =====" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host $_ }

Write-Host "`n===== REPORT SAVED =====" -ForegroundColor Cyan
$reportPath = "C:\Projects\vizora\vizora\E2E_TEST_RESULTS.txt"
$results | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "Report saved to: $reportPath" -ForegroundColor Green
