# Vizora Web App End-to-End Test Script
# Tests the complete user journey through the platform

$ErrorActionPreference = "Continue"

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🧪 VIZORA WEB APP E2E TEST SUITE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000/api"
$testEmail = "e2e-test-$(Get-Date -Format 'yyyyMMddHHmmss')@vizora.test"
$testPassword = "TestPass123!"

$results = @{
    Passed = 0
    Failed = 0
    Tests = @()
}

function Test-Step {
    param($Name, $ScriptBlock)
    
    Write-Host "Testing: $Name..." -NoNewline
    try {
        $result = & $ScriptBlock
        Write-Host " ✅ PASS" -ForegroundColor Green
        $results.Passed++
        $results.Tests += @{ Name = $Name; Status = "PASS"; Result = $result }
        return $result
    }
    catch {
        Write-Host " ❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $results.Failed++
        $results.Tests += @{ Name = $Name; Status = "FAIL"; Error = $_.Exception.Message }
        return $null
    }
}

Write-Host "PHASE 1: AUTHENTICATION" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray

# Test 1: Register
$user = Test-Step "User Registration" {
    $body = @{
        email = $testEmail
        password = $testPassword
        firstName = "E2E"
        lastName = "Test"
        organizationName = "E2E Test Org"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/register" `
        -Method POST `
        -Body $body `
        -ContentType "application/json"
    
    if (-not $response.token) { throw "No token received" }
    return $response
}

if (-not $user) {
    Write-Host ""
    Write-Host "❌ CRITICAL: Cannot proceed without authentication" -ForegroundColor Red
    exit 1
}

$token = $user.token
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Test 2: Login
Test-Step "User Login" {
    $body = @{
        email = $testEmail
        password = $testPassword
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
        -Method POST `
        -Body $body `
        -ContentType "application/json"
    
    if (-not $response.token) { throw "No token received" }
    return $response
}

# Test 3: Get Current User
Test-Step "Get Current User" {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/me" `
        -Method GET `
        -Headers $headers
    
    if ($response.email -ne $testEmail) { throw "Wrong user returned" }
    return $response
}

Write-Host ""
Write-Host "PHASE 2: CONTENT MANAGEMENT" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray

# Test 4: Create Image Content
$imageContent = Test-Step "Create Image Content" {
    $body = @{
        name = "Test Image"
        type = "image"
        url = "https://via.placeholder.com/1920x1080/FF5733/FFFFFF?text=Test+Image"
        duration = 10
        metadata = @{
            width = 1920
            height = 1080
        }
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$baseUrl/content" `
        -Method POST `
        -Body $body `
        -Headers $headers
    
    if (-not $response.id) { throw "No content ID returned" }
    return $response
}

# Test 5: Create Video Content
$videoContent = Test-Step "Create Video Content" {
    $body = @{
        name = "Test Video"
        type = "video"
        url = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        duration = 30
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$baseUrl/content" `
        -Method POST `
        -Body $body `
        -Headers $headers
    
    if (-not $response.id) { throw "No content ID returned" }
    return $response
}

# Test 6: List Content
Test-Step "List Content" {
    $url = $baseUrl + '/content?page=1&limit=10'
    $response = Invoke-RestMethod -Uri $url `
        -Method GET `
        -Headers $headers
    
    if ($response.data.Count -lt 2) { throw "Should have at least 2 content items" }
    return $response
}

# Test 7: Get Single Content
Test-Step "Get Content by ID" {
    $response = Invoke-RestMethod -Uri "$baseUrl/content/$($imageContent.id)" `
        -Method GET `
        -Headers $headers
    
    if ($response.id -ne $imageContent.id) { throw "Wrong content returned" }
    return $response
}

Write-Host ""
Write-Host "PHASE 3: PLAYLIST MANAGEMENT" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray

# Test 8: Create Playlist
$playlist = Test-Step "Create Playlist" {
    $body = @{
        name = "E2E Test Playlist"
        description = "Automated test playlist"
        items = @(
            @{
                contentId = $imageContent.id
                duration = 10
                order = 0
            },
            @{
                contentId = $videoContent.id
                duration = 30
                order = 1
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$baseUrl/playlists" `
        -Method POST `
        -Body $body `
        -Headers $headers
    
    if (-not $response.id) { throw "No playlist ID returned" }
    if ($response.items.Count -ne 2) { throw "Playlist should have 2 items" }
    return $response
}

# Test 9: List Playlists
Test-Step "List Playlists" {
    $url = $baseUrl + '/playlists?page=1&limit=10'
    $response = Invoke-RestMethod -Uri $url `
        -Method GET `
        -Headers $headers
    
    if ($response.data.Count -lt 1) { throw "Should have at least 1 playlist" }
    return $response
}

# Test 10: Get Playlist with Items
Test-Step "Get Playlist by ID" {
    $response = Invoke-RestMethod -Uri "$baseUrl/playlists/$($playlist.id)" `
        -Method GET `
        -Headers $headers
    
    if ($response.id -ne $playlist.id) { throw "Wrong playlist returned" }
    if (-not $response.items) { throw "Playlist items not included" }
    return $response
}

Write-Host ""
Write-Host "PHASE 4: DISPLAY MANAGEMENT" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray

# Test 11: Create Display
$display = Test-Step "Create Display" {
    $body = @{
        deviceId = "e2e-device-$(Get-Date -Format 'yyyyMMddHHmmss')"
        name = "E2E Test Display"
        location = "Test Lab"
        orientation = "landscape"
        resolution = "1920x1080"
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$baseUrl/displays" `
        -Method POST `
        -Body $body `
        -Headers $headers
    
    if (-not $response.id) { throw "No display ID returned" }
    return $response
}

# Test 12: List Displays
Test-Step "List Displays" {
    $url = $baseUrl + '/displays?page=1&limit=10'
    $response = Invoke-RestMethod -Uri $url `
        -Method GET `
        -Headers $headers
    
    if ($response.data.Count -lt 1) { throw "Should have at least 1 display" }
    return $response
}

# Test 13: Assign Playlist to Display (BLOCKER #1 FIX)
Test-Step "Assign Playlist to Display" {
    $body = @{
        currentPlaylistId = $playlist.id
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/displays/$($display.id)" `
        -Method PATCH `
        -Body $body `
        -Headers $headers
    
    if ($response.currentPlaylistId -ne $playlist.id) { 
        throw "Playlist not assigned correctly" 
    }
    return $response
}

# Test 14: Verify Playlist Assignment
Test-Step "Verify Playlist Assignment" {
    $response = Invoke-RestMethod -Uri "$baseUrl/displays/$($display.id)" `
        -Method GET `
        -Headers $headers
    
    if ($response.currentPlaylistId -ne $playlist.id) {
        throw "Playlist assignment not persisted"
    }
    return $response
}

Write-Host ""
Write-Host "PHASE 5: CLEANUP" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray

# Test 15: Delete Display
Test-Step "Delete Display" {
    $response = Invoke-RestMethod -Uri "$baseUrl/displays/$($display.id)" `
        -Method DELETE `
        -Headers $headers
    
    return $response
}

# Test 16: Delete Playlist
Test-Step "Delete Playlist" {
    $response = Invoke-RestMethod -Uri "$baseUrl/playlists/$($playlist.id)" `
        -Method DELETE `
        -Headers $headers
    
    return $response
}

# Test 17: Delete Content
Test-Step "Delete Image Content" {
    $response = Invoke-RestMethod -Uri "$baseUrl/content/$($imageContent.id)" `
        -Method DELETE `
        -Headers $headers
    
    return $response
}

Test-Step "Delete Video Content" {
    $response = Invoke-RestMethod -Uri "$baseUrl/content/$($videoContent.id)" `
        -Method DELETE `
        -Headers $headers
    
    return $response
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ✅ Passed: $($results.Passed)" -ForegroundColor Green
Write-Host "  ❌ Failed: $($results.Failed)" -ForegroundColor $(if ($results.Failed -eq 0) { "Green" } else { "Red" })
Write-Host "  📊 Total:  $($results.Passed + $results.Failed)" -ForegroundColor Cyan

$passRate = [math]::Round(($results.Passed / ($results.Passed + $results.Failed)) * 100, 2)
Write-Host ""
Write-Host "  Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 90) { "Green" } elseif ($passRate -ge 75) { "Yellow" } else { "Red" })

if ($results.Failed -eq 0) {
    Write-Host ""
    Write-Host "🎉 ALL TESTS PASSED! Platform is working correctly!" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "Failed Tests:" -ForegroundColor Red
    foreach ($test in $results.Tests | Where-Object { $_.Status -eq "FAIL" }) {
        Write-Host "  - $($test.Name): $($test.Error)" -ForegroundColor Red
    }
    exit 1
}
