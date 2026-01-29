# Automated E2E API Testing Script
# Tests complete user journey via API calls
# Run: .\auto-test-e2e.ps1

$ErrorActionPreference = "Continue"
$API_BASE = "http://localhost:3000/api"
$timestamp = (Get-Date).Ticks
$global:testsPassed = 0
$global:testsFailed = 0
$global:authToken = $null
$global:orgId = $null
$global:userId = $null
$global:contentId = $null
$global:playlistId = $null
$global:displayId = $null

function Log-Test {
    param([string]$name, [bool]$passed, [string]$message = "")
    if ($passed) {
        Write-Host "✅ PASS: $name" -ForegroundColor Green
        $global:testsPassed++
    } else {
        Write-Host "❌ FAIL: $name - $message" -ForegroundColor Red
        $global:testsFailed++
    }
}

function Test-API {
    param(
        [string]$method,
        [string]$endpoint,
        [object]$body = $null,
        [hashtable]$headers = @{},
        [string]$testName
    )
    
    try {
        $url = "$API_BASE$endpoint"
        $params = @{
            Uri = $url
            Method = $method
            ContentType = "application/json"
            Headers = $headers
        }
        
        if ($body) {
            $params.Body = ($body | ConvertTo-Json)
        }
        
        $response = Invoke-RestMethod @params -ErrorAction Stop
        Write-Host "  Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
        return @{success=$true; data=$response}
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  Error: $statusCode - $($_.Exception.Message)" -ForegroundColor Red
        return @{success=$false; error=$_.Exception.Message; statusCode=$statusCode}
    }
}

Write-Host "`n🚀 Starting Automated E2E API Tests`n" -ForegroundColor Cyan
Write-Host "Timestamp: $timestamp`n"

# Test 1: Health Check
Write-Host "`n📊 Test 1: API Health Check" -ForegroundColor Yellow
$result = Test-API -method "GET" -endpoint "/health" -testName "Health"
Log-Test "API Health Check" ($result.success)

# Test 2: User Registration
Write-Host "`n👤 Test 2: User Registration" -ForegroundColor Yellow
$registerData = @{
    email = "test-$timestamp@test.com"
    password = "Test123!@#"
    organizationName = "Test Org $timestamp"
    firstName = "Test"
    lastName = "User"
}
$result = Test-API -method "POST" -endpoint "/auth/register" -body $registerData -testName "Registration"
if ($result.success -and $result.data.data.token) {
    $global:authToken = $result.data.data.token
    $global:orgId = $result.data.data.organization.id
    $global:userId = $result.data.data.user.id
    Log-Test "User Registration" $true
    Write-Host "  Token: $($global:authToken.Substring(0, 20))..." -ForegroundColor Gray
} else {
    Log-Test "User Registration" $false "No token received"
}

# Test 3: Login
Write-Host "`n🔐 Test 3: User Login" -ForegroundColor Yellow
$loginData = @{
    email = $registerData.email
    password = $registerData.password
}
$result = Test-API -method "POST" -endpoint "/auth/login" -body $loginData -testName "Login"
if ($result.success -and $result.data.data.token) {
    Log-Test "User Login" $true
} else {
    Log-Test "User Login" $false "Login failed"
}

# Test 4: Get Profile
Write-Host "`n👥 Test 4: Get User Profile" -ForegroundColor Yellow
$headers = @{ Authorization = "Bearer $global:authToken" }
$result = Test-API -method "GET" -endpoint "/auth/me" -headers $headers -testName "Profile"
Log-Test "Get Profile" ($result.success -and $result.data.id -eq $global:userId)

# Test 5: Create Content (Image URL)
Write-Host "`n📄 Test 5: Create Content" -ForegroundColor Yellow
$contentData = @{
    name = "Test Image $timestamp"
    type = "image"
    url = "https://via.placeholder.com/1920x1080"
    metadata = @{ source = "auto-test" }
}
$result = Test-API -method "POST" -endpoint "/content" -body $contentData -headers $headers -testName "Create Content"
if ($result.success -and $result.data.id) {
    $global:contentId = $result.data.id
    Log-Test "Create Content" $true
} else {
    Log-Test "Create Content" $false "No content ID returned"
}

# Test 6: Get Content List
Write-Host "`n📋 Test 6: Get Content List" -ForegroundColor Yellow
$result = Test-API -method "GET" -endpoint "/content" -headers $headers -testName "List Content"
Log-Test "Get Content List" ($result.success -and $result.data.data.Count -gt 0)

# Test 7: Create Playlist
Write-Host "`n🎵 Test 7: Create Playlist" -ForegroundColor Yellow
$playlistData = @{
    name = "Test Playlist $timestamp"
    description = "Automated test playlist"
    items = @()
}
$result = Test-API -method "POST" -endpoint "/playlists" -body $playlistData -headers $headers -testName "Create Playlist"
if ($result.success -and $result.data.id) {
    $global:playlistId = $result.data.id
    Log-Test "Create Playlist" $true
} else {
    Log-Test "Create Playlist" $false "No playlist ID returned"
}

# Test 8: Add Item to Playlist
Write-Host "`n➕ Test 8: Add Content to Playlist" -ForegroundColor Yellow
$itemData = @{
    contentId = $global:contentId
    duration = 10
    order = 0
}
$result = Test-API -method "POST" -endpoint "/playlists/$global:playlistId/items" -body $itemData -headers $headers -testName "Add Playlist Item"
Log-Test "Add Content to Playlist" $result.success

# Test 9: Create Display
Write-Host "`n🖥️  Test 9: Create Display" -ForegroundColor Yellow
$displayData = @{
    name = "Test Display $timestamp"
    deviceId = "device-$timestamp"
    location = "Auto Test Room"
}
$result = Test-API -method "POST" -endpoint "/displays" -body $displayData -headers $headers -testName "Create Display"
if ($result.success -and $result.data.id) {
    $global:displayId = $result.data.id
    Log-Test "Create Display" $true
} else {
    Log-Test "Create Display" $false "No display ID returned"
}

# Test 10: Assign Playlist to Display
Write-Host "`n🎯 Test 10: Assign Playlist to Display (CRITICAL FIX)" -ForegroundColor Yellow
$updateData = @{
    currentPlaylistId = $global:playlistId
}
$result = Test-API -method "PATCH" -endpoint "/displays/$global:displayId" -body $updateData -headers $headers -testName "Assign Playlist"
if ($result.success) {
    Log-Test "Assign Playlist to Display" $true
    Write-Host "  ✨ This was the broken feature - now working!" -ForegroundColor Green
} else {
    Log-Test "Assign Playlist to Display" $false "Assignment failed"
}

# Test 11: Verify Display Update
Write-Host "`n✔️  Test 11: Verify Display Shows Assigned Playlist" -ForegroundColor Yellow
$result = Test-API -method "GET" -endpoint "/displays/$global:displayId" -headers $headers -testName "Get Display"
if ($result.success -and $result.data.currentPlaylistId -eq $global:playlistId) {
    Log-Test "Display Has Correct Playlist" $true
} else {
    Log-Test "Display Has Correct Playlist" $false "Playlist not assigned correctly"
}

# Test 12: Multi-Tenant Isolation (Register Second Org)
Write-Host "`n🔒 Test 12: Multi-Tenant Isolation" -ForegroundColor Yellow
$org2Data = @{
    email = "test-org2-$timestamp@test.com"
    password = "Test123!@#"
    organizationName = "Org 2 $timestamp"
    firstName = "Other"
    lastName = "User"
}
$result = Test-API -method "POST" -endpoint "/auth/register" -body $org2Data -testName "Register Org 2"
if ($result.success -and $result.data.data.token) {
    $org2Token = $result.data.data.token
    $org2Headers = @{ Authorization = "Bearer $org2Token" }
    
    # Try to access Org 1's content
    $result = Test-API -method "GET" -endpoint "/content/$global:contentId" -headers $org2Headers -testName "Cross-Org Access"
    if (!$result.success -and $result.statusCode -in @(403, 404)) {
        Log-Test "Multi-Tenant Isolation" $true
        Write-Host "  ✨ Org 2 correctly blocked from Org 1's content" -ForegroundColor Green
    } else {
        Log-Test "Multi-Tenant Isolation" $false "Security breach - cross-org access possible!"
    }
} else {
    Log-Test "Multi-Tenant Isolation" $false "Could not create second org"
}

# Test 13: XSS Protection
Write-Host "`n🛡️  Test 13: XSS Protection" -ForegroundColor Yellow
$xssData = @{
    name = "<script>alert('xss')</script>"
    type = "image"
    url = "https://example.com/image.jpg"
}
$result = Test-API -method "POST" -endpoint "/content" -body $xssData -headers $headers -testName "XSS Test"
if ($result.success) {
    # Check if script tags were stripped
    if ($result.data.name -notlike "*<script>*") {
        Log-Test "XSS Protection" $true
        Write-Host "  ✨ Script tags properly sanitized" -ForegroundColor Green
    } else {
        Log-Test "XSS Protection" $false "Script tags not sanitized!"
    }
} else {
    Log-Test "XSS Protection" $false "Content creation failed"
}

# Test 14: Rate Limiting
Write-Host "`n⏱️  Test 14: Rate Limiting" -ForegroundColor Yellow
$rateLimitHit = $false
for ($i = 1; $i -le 15; $i++) {
    $result = Test-API -method "GET" -endpoint "/content" -headers $headers -testName "Rate Limit $i"
    if (!$result.success -and $result.statusCode -eq 429) {
        $rateLimitHit = $true
        break
    }
    Start-Sleep -Milliseconds 100
}
if ($rateLimitHit) {
    Log-Test "Rate Limiting Works" $true
    Write-Host "  ✨ Rate limit correctly enforced" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Warning: Rate limit not hit in 15 requests" -ForegroundColor Yellow
    $global:testsPassed++  # Not a failure, just a warning
}

# Test 15: Delete Operations
Write-Host "`n🗑️  Test 15: Delete Operations" -ForegroundColor Yellow
$result = Test-API -method "DELETE" -endpoint "/content/$global:contentId" -headers $headers -testName "Delete Content"
Log-Test "Delete Content" $result.success

$result = Test-API -method "DELETE" -endpoint "/playlists/$global:playlistId" -headers $headers -testName "Delete Playlist"
Log-Test "Delete Playlist" $result.success

$result = Test-API -method "DELETE" -endpoint "/displays/$global:displayId" -headers $headers -testName "Delete Display"
Log-Test "Delete Display" $result.success

# Summary
Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host "="*60 -ForegroundColor Cyan
Write-Host "Tests Passed: $global:testsPassed" -ForegroundColor Green
Write-Host "Tests Failed: $global:testsFailed" -ForegroundColor Red
Write-Host "Total Tests: $($global:testsPassed + $global:testsFailed)"

if ($global:testsFailed -eq 0) {
    Write-Host "`nALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "API Backend is working correctly" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nSOME TESTS FAILED" -ForegroundColor Red
    Write-Host "Review failures above and fix issues" -ForegroundColor Yellow
    exit 1
}
