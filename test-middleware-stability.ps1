# Middleware Stability Test Script
# Tests if middleware crashes after repeated requests

$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MTYxMGI0YS0xMzVhLTQ0YjQtOTFlYS01MjAxZmMzNjA0YjYiLCJlbWFpbCI6InRlc3QtMjAyNjAxMjgwMDA2MjBAdml6b3JhLnRlc3QiLCJvcmdhbml6YXRpb25JZCI6IjhmY2ViM2Y5LWExZGYtNDljYS05NzA0LTZiOWE0ZTk1MzI0NiIsInJvbGUiOiJhZG1pbiIsInR5cGUiOiJ1c2VyIiwiaWF0IjoxNzY5NTc2NzkxLCJleHAiOjE3NzAxODE1OTF9.HUhzAgX-nlau4PUAAH11FFUTFdp7YYUD85kq77yWf-w"
$headers = @{ 
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "🧪 Middleware Stability Test" -ForegroundColor Cyan
Write-Host "Testing with 20 sequential requests..." -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$errorCount = 0

for ($i = 1; $i -le 20; $i++) {
    try {
        Write-Host "Request #$i..." -NoNewline
        
        # Test different endpoints
        switch ($i % 4) {
            0 { $result = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/me" -Headers $headers -Method GET }
            1 { $result = Invoke-RestMethod -Uri "http://localhost:3000/api/content?page=1&limit=10" -Headers $headers -Method GET }
            2 { $result = Invoke-RestMethod -Uri "http://localhost:3000/api/playlists?page=1&limit=10" -Headers $headers -Method GET }
            3 { $result = Invoke-RestMethod -Uri "http://localhost:3000/api/displays?page=1&limit=10" -Headers $headers -Method GET }
        }
        
        Write-Host " ✅ OK" -ForegroundColor Green
        $successCount++
        
        # Small delay between requests
        Start-Sleep -Milliseconds 100
    }
    catch {
        Write-Host " ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
        
        # Check if middleware is still responding
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method GET
            Write-Host "   Middleware still alive (health check passed)" -ForegroundColor Yellow
        }
        catch {
            Write-Host "   ⚠️ MIDDLEWARE CRASHED! Cannot reach health endpoint" -ForegroundColor Red
            break
        }
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "RESULTS:" -ForegroundColor Cyan
Write-Host "  ✅ Successful: $successCount/20" -ForegroundColor Green
Write-Host "  ❌ Failed: $errorCount/20" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })

if ($successCount -eq 20) {
    Write-Host ""
    Write-Host "🎉 BLOCKER #3 RESOLVED: Middleware is STABLE!" -ForegroundColor Green
} elseif ($errorCount -gt 0 -and $successCount -gt 15) {
    Write-Host ""
    Write-Host "⚠️ BLOCKER #3 PARTIALLY RESOLVED: Some errors but middleware didn't crash" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ BLOCKER #3 STILL EXISTS: Middleware unstable" -ForegroundColor Red
}
