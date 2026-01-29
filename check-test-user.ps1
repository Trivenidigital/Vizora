# Check if test@test.com user exists and what the issue might be

Write-Host "Checking test@test.com user..." -ForegroundColor Cyan
Write-Host ""

# Try to login
$loginBody = @{
    email = "test@test.com"
    password = "Test1234!"
} | ConvertTo-Json

Write-Host "Attempting login..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json"
    
    Write-Host "✅ LOGIN WORKS!" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Token received: $($data.data.token.Substring(0, 30))..." -ForegroundColor Green
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ LOGIN FAILED - Status: $statusCode" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error response:" -ForegroundColor Red
        Write-Host $errorBody -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Now testing with wrong password..." -ForegroundColor Yellow
$wrongBody = @{
    email = "test@test.com"  
    password = "WrongPassword123!"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" `
        -Method POST `
        -Body $wrongBody `
        -ContentType "application/json"
    Write-Host "Unexpected success" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ Expected failure - Status: $statusCode" -ForegroundColor Yellow
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error: $errorBody" -ForegroundColor Yellow
    }
}
