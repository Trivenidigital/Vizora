# Test with the EXACT credentials user reported
Write-Host "Testing with user's reported credentials..." -ForegroundColor Cyan
Write-Host ""

# User said they registered with: test@test.com / Test1234! / TestOrg
$email = "test@test.com"
$password = "Test1234!"

Write-Host "Attempting login with:" -ForegroundColor Yellow
Write-Host "  Email: $email"
Write-Host "  Password: $password"
Write-Host ""

$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json"
    
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ LOGIN SUCCESSFUL!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($data | ConvertTo-Json -Depth 3)
    Write-Host ""
    
    if ($data.data.token) {
        Write-Host "✅ Token found: $($data.data.token.Substring(0, 30))..." -ForegroundColor Green
        Write-Host ""
        Write-Host "🎯 CONCLUSION:" -ForegroundColor Cyan
        Write-Host "  The API works perfectly. If login fails in browser," -ForegroundColor Yellow
        Write-Host "  check browser console (F12) for JavaScript errors." -ForegroundColor Yellow
    }
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ LOGIN FAILED - Status: $statusCode" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        $errorData = $responseBody | ConvertFrom-Json
        
        Write-Host ""
        Write-Host "Error Response:" -ForegroundColor Red
        Write-Host ($errorData | ConvertTo-Json -Depth 3) -ForegroundColor Red
        Write-Host ""
        
        if ($errorData.message -like "*Invalid email or password*") {
            Write-Host "🔍 DIAGNOSIS: Wrong credentials!" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Possible issues:" -ForegroundColor Yellow
            Write-Host "  1. Email is case-sensitive - try exact match"
            Write-Host "  2. Password might be different than remembered"
            Write-Host "  3. User might not exist - try registering first"
            Write-Host ""
            Write-Host "💡 SOLUTION: Register a fresh user for testing" -ForegroundColor Cyan
        }
    }
}
