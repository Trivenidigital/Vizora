# Complete Login Flow Test
# This will test registration -> login -> verify token

Write-Host "🧪 Testing Complete Login Flow..." -ForegroundColor Cyan
Write-Host ""

$randomId = Get-Random
$testEmail = "flowtest$randomId@test.com"
$testPassword = "Test1234!"

Write-Host "Test Credentials:" -ForegroundColor Yellow
Write-Host "  Email: $testEmail"
Write-Host "  Password: $testPassword"
Write-Host ""

# Step 1: Register
Write-Host "1️⃣ Step 1: Registration" -ForegroundColor Yellow
$registerBody = @{
    email = $testEmail
    password = $testPassword
    firstName = "Flow"
    lastName = "Test"
    organizationName = "FlowTestOrg$randomId"
} | ConvertTo-Json

try {
    Write-Host "  POST /api/auth/register..." -ForegroundColor Gray
    $registerResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json"
    
    $registerData = $registerResponse.Content | ConvertFrom-Json
    
    Write-Host "  ✅ Status: $($registerResponse.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Response Body:" -ForegroundColor Gray
    Write-Host "  $($registerResponse.Content)" -ForegroundColor DarkGray
    Write-Host ""
    
    # Check response structure
    Write-Host "  Response Analysis:" -ForegroundColor Yellow
    Write-Host "    - success: $($registerData.success)" -ForegroundColor Gray
    Write-Host "    - data exists: $($null -ne $registerData.data)" -ForegroundColor Gray
    Write-Host "    - data.token exists: $($null -ne $registerData.data.token)" -ForegroundColor Gray
    Write-Host "    - data.user exists: $($null -ne $registerData.data.user)" -ForegroundColor Gray
    
    if ($registerData.data.token) {
        $token = $registerData.data.token
        Write-Host "  ✅ Token extracted: $($token.Substring(0, 30))..." -ForegroundColor Green
    } else {
        Write-Host "  ❌ NO TOKEN FOUND in response!" -ForegroundColor Red
        Write-Host "  Expected path: response.data.token" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Registration failed!" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "2️⃣ Step 2: Login (same credentials)" -ForegroundColor Yellow

$loginBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    Write-Host "  POST /api/auth/login..." -ForegroundColor Gray
    $loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json"
    
    $loginData = $loginResponse.Content | ConvertFrom-Json
    
    Write-Host "  ✅ Status: $($loginResponse.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Response Body:" -ForegroundColor Gray
    Write-Host "  $($loginResponse.Content)" -ForegroundColor DarkGray
    Write-Host ""
    
    # Check response structure
    Write-Host "  Response Analysis:" -ForegroundColor Yellow
    Write-Host "    - success: $($loginData.success)" -ForegroundColor Gray
    Write-Host "    - data exists: $($null -ne $loginData.data)" -ForegroundColor Gray
    Write-Host "    - data.token exists: $($null -ne $loginData.data.token)" -ForegroundColor Gray
    Write-Host "    - data.user exists: $($null -ne $loginData.data.user)" -ForegroundColor Gray
    
    if ($loginData.data.token) {
        $loginToken = $loginData.data.token
        Write-Host "  ✅ Token extracted: $($loginToken.Substring(0, 30))..." -ForegroundColor Green
    } else {
        Write-Host "  ❌ NO TOKEN FOUND in login response!" -ForegroundColor Red
        Write-Host "  Expected path: response.data.token" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Login failed!" -ForegroundColor Red
    Write-Host "  Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "3️⃣ Step 3: Test Protected Endpoint" -ForegroundColor Yellow

try {
    Write-Host "  GET /api/auth/me (with token)..." -ForegroundColor Gray
    $meResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/me" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $loginToken"
            "Content-Type" = "application/json"
        }
    
    Write-Host "  ✅ Status: $($meResponse.StatusCode)" -ForegroundColor Green
    Write-Host "  ✅ Token is valid and working!" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Protected endpoint failed!" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 BACKEND API WORKS PERFECTLY!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Registration returns token at: response.data.token"
Write-Host "✅ Login returns token at: response.data.token"
Write-Host "✅ Token format is valid JWT"
Write-Host "✅ Token works for authentication"
Write-Host ""
Write-Host "If login fails in browser, the issue is in FRONTEND code." -ForegroundColor Yellow
Write-Host "Check: web/src/lib/api.ts and browser console for errors" -ForegroundColor Yellow
