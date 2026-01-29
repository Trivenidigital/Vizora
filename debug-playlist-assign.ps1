$ErrorActionPreference = "Continue"
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host "Creating test user..." -ForegroundColor Yellow
$reg = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method POST -ContentType "application/json" -Body (@{
    email="debug-$ts@test.com"
    password="Test123!@#"
    organizationName="DebugOrg$ts"
    firstName="Debug"
    lastName="User"
} | ConvertTo-Json)

$token = $reg.data.token
$headers = @{Authorization="Bearer $token"}

Write-Host "Creating playlist..." -ForegroundColor Yellow
$playlist = Invoke-RestMethod -Uri "http://localhost:3000/api/playlists" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    name="Debug Playlist"
    description="Test"
    items=@()
} | ConvertTo-Json)

Write-Host "Creating display..." -ForegroundColor Yellow
$display = Invoke-RestMethod -Uri "http://localhost:3000/api/displays" -Method POST -Headers $headers -ContentType "application/json" -Body (@{
    name="Debug Display"
    deviceId="debug-$ts"
    location="Test"
} | ConvertTo-Json)

Write-Host "Assigning playlist to display..." -ForegroundColor Yellow
Write-Host "Display ID: $($display.id)" -ForegroundColor Cyan
Write-Host "Playlist ID: $($playlist.id)" -ForegroundColor Cyan

try {
    $updated = Invoke-RestMethod -Uri "http://localhost:3000/api/displays/$($display.id)" -Method PATCH -Headers $headers -ContentType "application/json" -Body (@{
        currentPlaylistId=$playlist.id
    } | ConvertTo-Json) -Verbose -ErrorAction Stop
    
    Write-Host "SUCCESS! Playlist assigned" -ForegroundColor Green
    Write-Host "Updated display:" -ForegroundColor Green
    $updated | ConvertTo-Json
} catch {
    Write-Host "FAILED with error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Response:" -ForegroundColor Red
    $_.ErrorDetails.Message
}
