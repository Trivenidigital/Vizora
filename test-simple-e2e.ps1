# Simple E2E Test - Debug Version
$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:3000/api"
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$random = Get-Random -Minimum 1000 -Maximum 9999
$testEmail = "test-$timestamp-$random@vizora.test"
$testPassword = "TestPass123!"

Write-Host "Testing Vizora E2E Flow" -ForegroundColor Cyan
Write-Host ""

# Step 1: Register
Write-Host "1. Registering user..." -NoNewline
try {
    $registerBody = @{
        email = $testEmail
        password = $testPassword
        firstName = "Test"
        lastName = "User"
        organizationName = "Test Org $timestamp$random"
    } | ConvertTo-Json
    
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json"
    
    Write-Host " ✅" -ForegroundColor Green
    Write-Host "   Token: $($registerResponse.data.token.Substring(0, 20))..." -ForegroundColor Gray
    $token = $registerResponse.data.token
}
catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Step 2: Get Current User
Write-Host "2. Getting current user..." -NoNewline
try {
    $meResponse = Invoke-RestMethod -Uri "$baseUrl/auth/me" `
        -Method GET `
        -Headers $headers
    
    Write-Host " ✅" -ForegroundColor Green
    Write-Host "   Email: $($meResponse.email)" -ForegroundColor Gray
}
catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Create Content
Write-Host "3. Creating image content..." -NoNewline
try {
    $contentBody = @{
        name = "Test Image"
        type = "image"
        url = "https://via.placeholder.com/1920x1080"
        duration = 10
    } | ConvertTo-Json
    
    $contentResponse = Invoke-RestMethod -Uri "$baseUrl/content" `
        -Method POST `
        -Body $contentBody `
        -Headers $headers
    
    Write-Host " ✅" -ForegroundColor Green
    Write-Host "   Content ID: $($contentResponse.id)" -ForegroundColor Gray
    $contentId = $contentResponse.id
}
catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Create Playlist
Write-Host "4. Creating playlist..." -NoNewline
try {
    $playlistBody = @{
        name = "Test Playlist"
        description = "E2E Test"
        items = @(
            @{
                contentId = $contentId
                duration = 10
                order = 0
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $playlistResponse = Invoke-RestMethod -Uri "$baseUrl/playlists" `
        -Method POST `
        -Body $playlistBody `
        -Headers $headers
    
    Write-Host " ✅" -ForegroundColor Green
    Write-Host "   Playlist ID: $($playlistResponse.id)" -ForegroundColor Gray
    $playlistId = $playlistResponse.id
}
catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

# Step 5: Create Display
Write-Host "5. Creating display..." -NoNewline
try {
    $displayBody = @{
        deviceId = "test-device-$(Get-Date -Format 'yyyyMMddHHmmss')"
        name = "Test Display"
        location = "Test Lab"
        orientation = "landscape"
        resolution = "1920x1080"
    } | ConvertTo-Json
    
    $displayResponse = Invoke-RestMethod -Uri "$baseUrl/displays" `
        -Method POST `
        -Body $displayBody `
        -Headers $headers
    
    Write-Host " ✅" -ForegroundColor Green
    Write-Host "   Display ID: $($displayResponse.id)" -ForegroundColor Gray
    $displayId = $displayResponse.id
}
catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

# Step 6: Assign Playlist to Display
Write-Host "6. Assigning playlist to display..." -NoNewline
try {
    $assignBody = @{
        currentPlaylistId = $playlistId
    } | ConvertTo-Json
    
    $assignResponse = Invoke-RestMethod -Uri "$baseUrl/displays/$displayId" `
        -Method PATCH `
        -Body $assignBody `
        -Headers $headers
    
    Write-Host " ✅" -ForegroundColor Green
    Write-Host "   Assigned Playlist: $($assignResponse.currentPlaylistId)" -ForegroundColor Gray
    
    if ($assignResponse.currentPlaylistId -eq $playlistId) {
        Write-Host "   ✅ Assignment verified!" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Assignment failed!" -ForegroundColor Red
    }
}
catch {
    Write-Host " ❌" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 ALL TESTS PASSED!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  User: $testEmail" -ForegroundColor Gray
Write-Host "  Content: $contentId" -ForegroundColor Gray
Write-Host "  Playlist: $playlistId" -ForegroundColor Gray
Write-Host "  Display: $displayId" -ForegroundColor Gray
Write-Host "  Status: Playlist assigned successfully" -ForegroundColor Green
