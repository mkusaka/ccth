#!/bin/bash

# Test local ccth installation

echo "=== Testing ccth CLI ==="
echo ""

echo "1. Testing help command:"
ccth --help
echo ""

echo "2. Testing UserPromptSubmit event (dry-run):"
cat test-events/user-prompt.json | ccth --dry-run -c test-channel
echo ""

echo "3. Testing PostToolUse event (dry-run):"
cat test-events/post-tool-use.json | ccth --dry-run -c test-channel
echo ""

echo "4. Testing Stop event (dry-run):"
cat test-events/stop.json | ccth --dry-run -c test-channel
echo ""

echo "5. Testing Notification event (dry-run):"
cat test-events/notification.json | ccth --dry-run -c test-channel
echo ""

echo "=== All tests completed ==="