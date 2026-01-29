# Simple API Test
$randomId = Get-Random

Write-Host "Testing Registration..." -ForegroundColor Cyan

$registerBody = @{
    email = "simpletest$randomId@test.com"
    password = "Test1234!"
    firstName = "Simple"
    lastName = "Test"
    organizationName = "SimpleTestOrg$randomId"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
        -Method POST `
        -Body ($registerBody | ConvertTo-Json) `
        -ContentType "application/json"
    
    Write-Host "✅ Registration Response:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 4)
    
    if ($response.data.token) {
        Write-Host ""
        Write-Host "✅ Token found at response.data.token" -ForegroundColor Green
        $token = $response.data.token
        
        # Now test login
        Write-Host ""
        Write-Host "Testing Login..." -ForegroundColor Cyan
        $loginBody = @{
            email = $registerBody.email
            password = $registerBody.password
        }
        
        $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
            -Method POST `
            -Body ($loginBody | ConvertTo-Json) `
            -ContentType "application/json"
        
        Write-Host "✅ Login Response:" -ForegroundColor Green
        Write-Host ($loginResponse | ConvertTo-Json -Depth 4)
        
        if ($loginResponse.data.token) {
            Write-Host ""
            Write-Host "✅ Login token found at response.data.token" -ForegroundColor Green
            Write-Host "🎉 BACKEND IS WORKING CORRECTLY!" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
