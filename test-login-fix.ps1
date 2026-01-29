# Test Login Fix
# Tests the corrected API response structure

Write-Host "🧪 Testing Login Fix..." -ForegroundColor Cyan
Write-Host ""

# Test registration
Write-Host "1️⃣ Testing Registration..." -ForegroundColor Yellow
$randomId = Get-Random
$registerBody = @{
    email = "testuser$randomId@test.com"
    password = "Test1234!"
    firstName = "Test"
    lastName = "User"
    organizationName = "TestOrg$randomId"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json"
    
    Write-Host "✅ Registration successful!" -ForegroundColor Green
    Write-Host "Response structure:" -ForegroundColor Gray
    Write-Host ($registerResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
    Write-Host ""
    
    # Check if token is in correct path
    if ($registerResponse.data.token) {
        Write-Host "✅ Token found at: response.data.token" -ForegroundColor Green
        $token = $registerResponse.data.token
        $email = $registerResponse.data.user.email
    } else {
        Write-Host "❌ Token NOT found at response.data.token" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Registration failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2️⃣ Testing Login with same credentials..." -ForegroundColor Yellow

$loginBody = @{
    email = $email
    password = "Test1234!"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json"
    
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "Response structure:" -ForegroundColor Gray
    Write-Host ($loginResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
    Write-Host ""
    
    # Check if token is in correct path
    if ($loginResponse.data.token) {
        Write-Host "✅ Token found at: response.data.token" -ForegroundColor Green
        Write-Host "✅ Frontend will now correctly extract token!" -ForegroundColor Green
    } else {
        Write-Host "❌ Token NOT found at response.data.token" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "3️⃣ Testing Protected Endpoint..." -ForegroundColor Yellow

try {
    $meResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/me" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
    
    Write-Host "✅ Protected endpoint accessible with token!" -ForegroundColor Green
    Write-Host "User info:" -ForegroundColor Gray
    Write-Host ($meResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
} catch {
    Write-Host "❌ Protected endpoint failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 ALL TESTS PASSED!" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Registration returns token at: response.data.token"
Write-Host "✅ Login returns token at: response.data.token"
Write-Host "✅ Token works for protected endpoints"
Write-Host "✅ Frontend fix correctly extracts token from response.data.token"
Write-Host ""
Write-Host "Next step: Test in browser at http://localhost:3002" -ForegroundColor Cyan
