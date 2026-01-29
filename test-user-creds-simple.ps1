# Test with user's credentials
$email = "test@test.com"
$password = "Test1234!"

Write-Host "Testing login with: $email" -ForegroundColor Cyan

$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json"
    
    Write-Host "SUCCESS - Login works!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 3)
    
} catch {
    Write-Host "FAILED - Login error" -ForegroundColor Red
    Write-Host $_.Exception.Message
    
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message
    }
}
