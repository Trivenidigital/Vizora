# Vizora Test Runner for CI/CD environments (Windows PowerShell version)
# This script runs tests for all Vizora components

# Exit immediately if a command fails
$ErrorActionPreference = "Stop"

# Set default timeout (in seconds)
$TIMEOUT = if ($env:TIMEOUT) { $env:TIMEOUT } else { 300 }

# Parse command line arguments
param(
    [switch]$SkipMiddleware = $false,
    [switch]$SkipWeb = $false,
    [switch]$SkipTV = $false,
    [switch]$Coverage = $false,
    [switch]$JunitReport = $false,
    [switch]$Performance = $false
)

# Create reports directory
if (-not (Test-Path -Path "reports")) {
    New-Item -ItemType Directory -Path "reports" | Out-Null
}

# Print test suite header
Write-Host "Running Vizora Test Suite" -ForegroundColor Blue
Write-Host "=======================" -ForegroundColor Blue
Write-Host "Configuration:"
Write-Host "- Timeout: ${TIMEOUT}s"
Write-Host "- Coverage: $Coverage"
Write-Host "- JUnit Reports: $JunitReport"
Write-Host "- Include Performance Tests: $Performance"
Write-Host "=======================" -ForegroundColor Blue

# Function to run tests for a specific component
function Run-ComponentTests {
    param(
        [string]$component,
        [string]$command
    )
    
    $reportFile = "reports/${component}-test-results.xml"
    $startTime = Get-Date
    
    Write-Host "`nTesting ${component}..." -ForegroundColor Blue
    
    # Change to component directory
    Push-Location -Path "Redesign/${component}"
    
    # Add JUnit reporter if needed
    if ($JunitReport) {
        $command = "$command --reporters=default --reporters=jest-junit"
        $env:JEST_JUNIT_OUTPUT_FILE = "../../${reportFile}"
    }
    
    # Add coverage if needed
    if ($Coverage) {
        $command = "$command --coverage"
    }
    
    # Skip performance tests unless explicitly requested
    if (-not $Performance -and $component -eq "VizoraMiddleware") {
        $command = "$command --testPathIgnorePatterns=performance.test.js"
    }
    
    # Run tests with timeout
    Write-Host "Running: $command"
    
    $job = Start-Job -ScriptBlock {
        param($cmd, $dir)
        Set-Location $dir
        Invoke-Expression $cmd
    } -ArgumentList $command, (Get-Location).Path
    
    $completed = Wait-Job -Job $job -Timeout $TIMEOUT
    
    $status = 0
    if ($completed -eq $null) {
        Stop-Job -Job $job
        Write-Host "Tests timed out after ${TIMEOUT}s" -ForegroundColor Red
        $status = 124
    } else {
        $result = Receive-Job -Job $job
        $status = $job.State -eq "Completed" ? 0 : 1
        $result | ForEach-Object { Write-Host $_ }
    }
    
    Remove-Job -Job $job -Force
    
    $endTime = Get-Date
    $duration = [math]::Round(($endTime - $startTime).TotalSeconds)
    
    if ($status -eq 0) {
        Write-Host "✓ ${component} tests passed in ${duration}s" -ForegroundColor Green
        Pop-Location
        return 0
    } elseif ($status -eq 124) {
        Write-Host "✗ ${component} tests timed out after ${TIMEOUT}s" -ForegroundColor Red
        Pop-Location
        return 1
    } else {
        Write-Host "✗ ${component} tests failed in ${duration}s with status ${status}" -ForegroundColor Red
        Pop-Location
        return $status
    }
}

# Track overall exit status
$EXIT_STATUS = 0
$MIDDLEWARE_STATUS = 0
$WEB_STATUS = 0
$TV_STATUS = 0

# Run VizoraMiddleware tests
if (-not $SkipMiddleware) {
    $MIDDLEWARE_STATUS = Run-ComponentTests -component "VizoraMiddleware" -command "npm test -- --ci --runInBand"
    if ($MIDDLEWARE_STATUS -ne 0) {
        $EXIT_STATUS = $MIDDLEWARE_STATUS
        Write-Host "Warning: VizoraMiddleware tests failed" -ForegroundColor Yellow
    }
}

# Run VizoraWeb tests
if (-not $SkipWeb) {
    $WEB_STATUS = Run-ComponentTests -component "VizoraWeb" -command "npm test -- --run"
    if ($WEB_STATUS -ne 0) {
        $EXIT_STATUS = $WEB_STATUS
        Write-Host "Warning: VizoraWeb tests failed" -ForegroundColor Yellow
    }
}

# Run VizoraTV tests
if (-not $SkipTV) {
    $TV_STATUS = Run-ComponentTests -component "VizoraTV" -command "npm test -- --ci --runInBand"
    if ($TV_STATUS -ne 0) {
        $EXIT_STATUS = $TV_STATUS
        Write-Host "Warning: VizoraTV tests failed" -ForegroundColor Yellow
    }
}

# Output summary
Write-Host "`nTest Suite Summary" -ForegroundColor Blue
Write-Host "=======================" -ForegroundColor Blue
if (-not $SkipMiddleware) {
    if ($MIDDLEWARE_STATUS -eq 0) {
        Write-Host "✓ VizoraMiddleware: PASSED" -ForegroundColor Green
    } else {
        Write-Host "✗ VizoraMiddleware: FAILED" -ForegroundColor Red
    }
} else {
    Write-Host "⚠ VizoraMiddleware: SKIPPED" -ForegroundColor Yellow
}

if (-not $SkipWeb) {
    if ($WEB_STATUS -eq 0) {
        Write-Host "✓ VizoraWeb: PASSED" -ForegroundColor Green
    } else {
        Write-Host "✗ VizoraWeb: FAILED" -ForegroundColor Red
    }
} else {
    Write-Host "⚠ VizoraWeb: SKIPPED" -ForegroundColor Yellow
}

if (-not $SkipTV) {
    if ($TV_STATUS -eq 0) {
        Write-Host "✓ VizoraTV: PASSED" -ForegroundColor Green
    } else {
        Write-Host "✗ VizoraTV: FAILED" -ForegroundColor Red
    }
} else {
    Write-Host "⚠ VizoraTV: SKIPPED" -ForegroundColor Yellow
}

Write-Host "=======================" -ForegroundColor Blue

# Exit with the appropriate status
if ($EXIT_STATUS -eq 0) {
    Write-Host "All tests passed successfully!" -ForegroundColor Green
} else {
    Write-Host "One or more test suites failed. Please check the logs for details." -ForegroundColor Red
}

exit $EXIT_STATUS 