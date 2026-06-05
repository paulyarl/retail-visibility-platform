#!/bin/bash

# Location Lifecycle E2E Test Runner with Doppler
# Run with: ./test-lifecycle.sh

echo "🧪 Location Lifecycle Management - E2E Test Suite"
echo ""
echo "Running with Doppler config: prd"
echo ""

# Check if Doppler is installed
if ! command -v doppler &> /dev/null; then
    echo "❌ Doppler CLI not found. Please install: https://docs.doppler.com/docs/install-cli"
    exit 1
fi

# Check if logged in to Doppler
if ! doppler me &> /dev/null; then
    echo "❌ Not logged in to Doppler. Run: doppler login"
    exit 1
fi

# Prompt for test credentials
echo "📝 Test Credentials Required:"
echo ""
echo "Please provide the following for testing:"
echo ""

read -p "Test Auth Token (JWT): " TEST_AUTH_TOKEN
read -p "Test Tenant ID: " TEST_TENANT_ID
read -p "Test User ID: " TEST_USER_ID

echo ""

# Validate inputs
if [ -z "$TEST_AUTH_TOKEN" ] || [ -z "$TEST_TENANT_ID" ] || [ -z "$TEST_USER_ID" ]; then
    echo "❌ All test credentials are required"
    exit 1
fi

echo "✅ Credentials provided"
echo ""
echo "Starting tests..."
echo ""

# Run tests with Doppler and test credentials
doppler run --config prd -- \
  env TEST_AUTH_TOKEN="$TEST_AUTH_TOKEN" \
      TEST_TENANT_ID="$TEST_TENANT_ID" \
      TEST_USER_ID="$TEST_USER_ID" \
  npm test -- src/tests/location-lifecycle.test.ts

# Capture exit code
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Tests failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE
