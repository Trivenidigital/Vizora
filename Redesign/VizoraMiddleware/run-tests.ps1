# PowerShell Test Runner Script
# This script runs each test file individually to avoid memory issues

# Memory settings
$env:NODE_OPTIONS = "--max-old-space-size=2048 --expose-gc"

# Test directory
$TEST_DIRECTORY = ".\tests"

# List of test files to run
$testFiles = @()

# Find all test files recursively
function Find-TestFiles {
    param(
        [string]$Directory
    )
    
    $ignoreDirectories = @("helpers", "fixtures", "mocks")
    
    Get-ChildItem -Path $Directory -File -Filter "*.test.js" | ForEach-Object {
        $testFiles += $_.FullName
    }
    
    Get-ChildItem -Path $Directory -Directory | ForEach-Object {
        if ($ignoreDirectories -notcontains $_.Name) {
            Find-TestFiles -Directory $_.FullName
        }
    }
}

# Run a single test file
function Run-TestFile {
    param(
        [string]$TestFile
    )
    
    Write-Host "`n========== Running test: $TestFile ==========`n" -ForegroundColor Cyan
    
    # Run test with Jest
    $normalizedPath = $TestFile.Replace("\", "/")
    npx jest $normalizedPath --runInBand --detectOpenHandles
    
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "`n✅ Test passed: $TestFile`n" -ForegroundColor Green
        return $true
    } else {
        Write-Host "`n❌ Test failed: $TestFile`n" -ForegroundColor Red
        return $false
    }
}

# Main function
function Run-AllTests {
    Write-Host "Finding test files..." -ForegroundColor Yellow
    Find-TestFiles -Directory $TEST_DIRECTORY
    
    Write-Host "Found $($testFiles.Count) test files to run" -ForegroundColor Yellow
    
    $passed = @()
    $failed = @()
    
    $startTime = Get-Date
    
    foreach ($file in $testFiles) {
        $success = Run-TestFile -TestFile $file
        
        if ($success) {
            $passed += $file
        } else {
            $failed += $file
        }
        
        # Force garbage collection
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        
        Write-Host "Forcing garbage collection between tests..." -ForegroundColor Yellow
    }
    
    $duration = (Get-Date) - $startTime
    
    # Print summary
    Write-Host "`n============= TEST SUMMARY =============" -ForegroundColor Cyan
    Write-Host "Total test files: $($testFiles.Count)"
    Write-Host "Passed: $($passed.Count)" -ForegroundColor Green
    Write-Host "Failed: $($failed.Count)" -ForegroundColor Red
    Write-Host "Total duration: $($duration.TotalSeconds.ToString("0.00")) seconds"
    
    if ($failed.Count -gt 0) {
        Write-Host "`nFailed tests:" -ForegroundColor Red
        foreach ($file in $failed) {
            Write-Host "- $file" -ForegroundColor Red
        }
    }
    
    # Return appropriate exit code
    if ($failed.Count -gt 0) {
        return 1
    } else {
        return 0
    }
}

# Run the tests
try {
    $exitCode = Run-AllTests
    exit $exitCode
} catch {
    Write-Host "Error running tests: $_" -ForegroundColor Red
    exit 1
} 