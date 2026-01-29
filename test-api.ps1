# Simple API Test Script
# Tests critical user flows

$API_BASE = "http://localhost:3000/api"
$timestamp = (Get-Date).Ticks
$passed = 0
$failed = 0

function Test-Endpoint {
    param([string]$method, [string]$url, $body, $headers, [string]$name)
    try {
        $params = @{Uri="$API_BASE$url"; Method=$method; ContentType="application/json"}
        if ($headers) { $params.Headers = $headers }
        if ($body) { $params.Body = ($body | ConvertTo-Json) }
        $response = Invoke-RestMethod @params
        Write-Host "PASS: $name" -ForegroundColor Green
        $script:passed++
        return @{success=$true; data=$response}
    } catch {
        Write-Host "FAIL: $name - $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return @{success=$false}
    }
}

Write-Host "`nStarting API Tests...`n"

# Test 1: Register
$regData = @{
    email="test-$timestamp@test.com"
    password="Test123!@#"
    organizationName="Test Org"
    firstName="Test"
    lastName="User"
}
$result = Test-Endpoint "POST" "/auth/register" $regData $null "User Registration"
$token = $result.data.data.token
$headers = @{Authorization="Bearer $token"}

# Test 2: Login  
$loginData = @{email=$regData.email; password=$regData.password}
$result = Test-Endpoint "POST" "/auth/login" $loginData $null "User Login"

# Test 3: Create Content
$contentData = @{name="Test Content"; type="image"; url="https://example.com/img.jpg"}
$result = Test-Endpoint "POST" "/content" $contentData $headers "Create Content"
$contentId = $result.data.id

# Test 4: Create Playlist
$playlistData = @{name="Test Playlist"; description="Test"; items=@()}
$result = Test-Endpoint "POST" "/playlists" $playlistData $headers "Create Playlist"
$playlistId = $result.data.id

# Test 5: Create Display
$displayData = @{name="Test Display"; deviceId="device-$timestamp"; location="Test Room"}
$result = Test-Endpoint "POST" "/displays" $displayData $headers "Create Display"
$displayId = $result.data.id

# Test 6: Assign Playlist (THE CRITICAL FIX)
$updateData = @{currentPlaylistId=$playlistId}
$result = Test-Endpoint "PATCH" "/displays/$displayId" $updateData $headers "Assign Playlist to Display"

# Test 7: Verify Assignment
$result = Test-Endpoint "GET" "/displays/$displayId" $null $headers "Verify Display"
if ($result.success -and $result.data.currentPlaylistId -eq $playlistId) {
    Write-Host "PASS: Playlist correctly assigned to display" -ForegroundColor Green
    $script:passed++
} else {
    Write-Host "FAIL: Playlist not assigned correctly" -ForegroundColor Red
    $script:failed++
}

Write-Host "`n======================================="
Write-Host "PASSED: $passed | FAILED: $failed"
Write-Host "======================================="

if ($failed -eq 0) {
    Write-Host "`nSUCCESS: All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nFAILURE: Some tests failed" -ForegroundColor Red
    exit 1
}
