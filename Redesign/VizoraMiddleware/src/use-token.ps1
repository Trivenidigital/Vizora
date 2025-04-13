$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3ZjE5ZTM4ODZjZTFiZTYxYTY3YzgyOSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc0Mzg4ODA2NywiZXhwIjoxNzQ0NDkyODY3fQ.uuJr9eWFSg3jG4eoNBWoSPQOxnblro7za44B8dfWrYI"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:3003/api/protected-route" -Headers $headers