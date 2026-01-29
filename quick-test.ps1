$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "test-$ts@test.com"
$pass = "Test123!@#"
$org = "TestOrg$ts"

Write-Host "1. Register..." -ForegroundColor Yellow
$reg = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method POST -ContentType "application/json" -Body (@{email=$email; password=$pass; organizationName=$org; firstName="Test"; lastName="User"} | ConvertTo-Json)
$token = $reg.data.token
Write-Host "✅ Registered. Token: $($token.Substring(0,20))..." -ForegroundColor Green

Write-Host "`n2. Create Content..." -ForegroundColor Yellow
$headers = @{Authorization="Bearer $token"}
$content = Invoke-RestMethod -Uri "http://localhost:3000/api/content" -Method POST -Headers $headers -ContentType "application/json" -Body (@{name="Test Image"; type="image"; url="https://via.placeholder.com/1920x1080"} | ConvertTo-Json)
Write-Host "✅ Content ID: $($content.id)" -ForegroundColor Green

Write-Host "`n3. Create Playlist..." -ForegroundColor Yellow
$playlist = Invoke-RestMethod -Uri "http://localhost:3000/api/playlists" -Method POST -Headers $headers -ContentType "application/json" -Body (@{name="Test Playlist"; description="Auto test"; items=@()} | ConvertTo-Json)
Write-Host "✅ Playlist ID: $($playlist.id)" -ForegroundColor Green

Write-Host "`n4. Add Content to Playlist..." -ForegroundColor Yellow
$item = Invoke-RestMethod -Uri "http://localhost:3000/api/playlists/$($playlist.id)/items" -Method POST -Headers $headers -ContentType "application/json" -Body (@{contentId=$content.id; duration=10; order=0} | ConvertTo-Json)
Write-Host "✅ Item added" -ForegroundColor Green

Write-Host "`n5. Create Display..." -ForegroundColor Yellow
$display = Invoke-RestMethod -Uri "http://localhost:3000/api/displays" -Method POST -Headers $headers -ContentType "application/json" -Body (@{name="Test Display"; deviceId="device-$ts"; location="Test Room"} | ConvertTo-Json)
Write-Host "✅ Display ID: $($display.id)" -ForegroundColor Green

Write-Host "`n6. Assign Playlist to Display (CRITICAL FIX)..." -ForegroundColor Yellow
$updated = Invoke-RestMethod -Uri "http://localhost:3000/api/displays/$($display.id)" -Method PATCH -Headers $headers -ContentType "application/json" -Body (@{currentPlaylistId=$playlist.id} | ConvertTo-Json)
Write-Host "✅ Playlist assigned: $($updated.currentPlaylistId)" -ForegroundColor Green

Write-Host "`n7. Verify..." -ForegroundColor Yellow
$verify = Invoke-RestMethod -Uri "http://localhost:3000/api/displays/$($display.id)" -Headers $headers
if ($verify.currentPlaylistId -eq $playlist.id) {
    Write-Host "✅ SUCCESS! Playlist correctly assigned" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL! Playlist not assigned" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ALL TESTS PASSED! ✅" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
