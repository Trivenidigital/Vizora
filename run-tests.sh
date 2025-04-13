#!/bin/bash
# Vizora Test Runner for CI/CD environments
# This script runs tests for all Vizora components

set -e # Exit immediately if a command exits with a non-zero status

# Output formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Set default timeout (in seconds)
TIMEOUT=${TIMEOUT:-300}

# Parse command line arguments
SKIP_MIDDLEWARE=false
SKIP_WEB=false
SKIP_TV=false
COVERAGE=false
JUNIT_REPORT=false
PERFORMANCE=false

for arg in "$@"
do
    case $arg in
        --skip-middleware)
        SKIP_MIDDLEWARE=true
        shift
        ;;
        --skip-web)
        SKIP_WEB=true
        shift
        ;;
        --skip-tv)
        SKIP_TV=true
        shift
        ;;
        --coverage)
        COVERAGE=true
        shift
        ;;
        --junit)
        JUNIT_REPORT=true
        shift
        ;;
        --performance)
        PERFORMANCE=true
        shift
        ;;
    esac
done

# Create reports directory
mkdir -p reports

# Print test suite header
echo -e "${BOLD}Running Vizora Test Suite${NC}"
echo "======================="
echo "Configuration:"
echo "- Timeout: ${TIMEOUT}s"
echo "- Coverage: $COVERAGE"
echo "- JUnit Reports: $JUNIT_REPORT"
echo "- Include Performance Tests: $PERFORMANCE"
echo "======================="

# Function to run tests for a specific component
run_tests() {
    local component=$1
    local command=$2
    local report_file="reports/${component}-test-results.xml"
    local start_time=$(date +%s)
    
    echo -e "\n${BOLD}Testing ${component}...${NC}"
    
    # Change to component directory
    cd "Redesign/${component}"
    
    # Add JUnit reporter if needed
    if [ "$JUNIT_REPORT" = true ]; then
        command="${command} --reporters=default --reporters=jest-junit"
        export JEST_JUNIT_OUTPUT_FILE="../../${report_file}"
    fi
    
    # Add coverage if needed
    if [ "$COVERAGE" = true ]; then
        command="${command} --coverage"
    fi
    
    # Skip performance tests unless explicitly requested
    if [ "$PERFORMANCE" = false ] && [ "${component}" = "VizoraMiddleware" ]; then
        command="${command} --testPathIgnorePatterns=performance.test.js"
    fi
    
    # Run tests with timeout
    echo "Running: $command"
    timeout $TIMEOUT $command
    local status=$?
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $status -eq 0 ]; then
        echo -e "${GREEN}✓ ${component} tests passed in ${duration}s${NC}"
        cd ../..
        return 0
    elif [ $status -eq 124 ]; then
        echo -e "${RED}✗ ${component} tests timed out after ${TIMEOUT}s${NC}"
        cd ../..
        return 1
    else
        echo -e "${RED}✗ ${component} tests failed in ${duration}s with status ${status}${NC}"
        cd ../..
        return $status
    fi
}

# Track overall exit status
EXIT_STATUS=0

# Run VizoraMiddleware tests
if [ "$SKIP_MIDDLEWARE" = false ]; then
    run_tests "VizoraMiddleware" "npm test -- --ci --runInBand"
    MIDDLEWARE_STATUS=$?
    if [ $MIDDLEWARE_STATUS -ne 0 ]; then
        EXIT_STATUS=$MIDDLEWARE_STATUS
        echo -e "${YELLOW}Warning: VizoraMiddleware tests failed${NC}"
    fi
fi

# Run VizoraWeb tests
if [ "$SKIP_WEB" = false ]; then
    run_tests "VizoraWeb" "npm test -- --run"
    WEB_STATUS=$?
    if [ $WEB_STATUS -ne 0 ]; then
        EXIT_STATUS=$WEB_STATUS
        echo -e "${YELLOW}Warning: VizoraWeb tests failed${NC}"
    fi
fi

# Run VizoraTV tests
if [ "$SKIP_TV" = false ]; then
    run_tests "VizoraTV" "npm test -- --ci --runInBand"
    TV_STATUS=$?
    if [ $TV_STATUS -ne 0 ]; then
        EXIT_STATUS=$TV_STATUS
        echo -e "${YELLOW}Warning: VizoraTV tests failed${NC}"
    fi
fi

# Output summary
echo -e "\n${BOLD}Test Suite Summary${NC}"
echo "======================="
if [ "$SKIP_MIDDLEWARE" = false ]; then
    if [ $MIDDLEWARE_STATUS -eq 0 ]; then
        echo -e "${GREEN}✓ VizoraMiddleware: PASSED${NC}"
    else
        echo -e "${RED}✗ VizoraMiddleware: FAILED${NC}"
    fi
else
    echo -e "${YELLOW}⚠ VizoraMiddleware: SKIPPED${NC}"
fi

if [ "$SKIP_WEB" = false ]; then
    if [ $WEB_STATUS -eq 0 ]; then
        echo -e "${GREEN}✓ VizoraWeb: PASSED${NC}"
    else
        echo -e "${RED}✗ VizoraWeb: FAILED${NC}"
    fi
else
    echo -e "${YELLOW}⚠ VizoraWeb: SKIPPED${NC}"
fi

if [ "$SKIP_TV" = false ]; then
    if [ $TV_STATUS -eq 0 ]; then
        echo -e "${GREEN}✓ VizoraTV: PASSED${NC}"
    else
        echo -e "${RED}✗ VizoraTV: FAILED${NC}"
    fi
else
    echo -e "${YELLOW}⚠ VizoraTV: SKIPPED${NC}"
fi

echo "======================="

# Exit with the appropriate status
if [ $EXIT_STATUS -eq 0 ]; then
    echo -e "${GREEN}${BOLD}All tests passed successfully!${NC}"
else
    echo -e "${RED}${BOLD}One or more test suites failed. Please check the logs for details.${NC}"
fi

exit $EXIT_STATUS 