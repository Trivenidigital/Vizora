# Cleanup Test Data Script
# Removes test users and data from database

Write-Host "Cleaning up test data..." -ForegroundColor Yellow

# Connect to PostgreSQL and delete test data
$env:PGPASSWORD = "postgres"
$commands = @"
DELETE FROM "Content" WHERE "name" LIKE 'Test%';
DELETE FROM "Playlist" WHERE "name" LIKE 'Test%';
DELETE FROM "Display" WHERE "nickname" LIKE 'Test%';
DELETE FROM "User" WHERE "email" LIKE 'test-%';
DELETE FROM "Organization" WHERE "name" LIKE 'Test%' OR "name" LIKE 'Org 2%';
"@

try {
    $commands | & psql -h localhost -U postgres -d vizora 2>&1
    Write-Host "Test data cleaned successfully" -ForegroundColor Green
} catch {
    Write-Host "Error cleaning data: $_" -ForegroundColor Red
}
