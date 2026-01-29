# Path Traversal Challenge

## Overview
This challenge demonstrates a classic path traversal (directory traversal) vulnerability in a web application.

## Vulnerability
The application has a file download feature that doesn't properly validate or sanitize the file path parameter, allowing attackers to traverse the directory structure using `../` sequences.

## How to Solve

1. **Reconnaissance**: Browse the application and identify the file download functionality
2. **Test for vulnerability**: Try adding `../` to the file parameter
3. **Exploit**: Use multiple `../` sequences to traverse up directories
4. **Retrieve the flag**: Access `/app/flag.txt` using path traversal

### Example Exploit
```
http://localhost:PORT/download?file=../flag.txt
```

## Learning Points
- Always validate and sanitize user input, especially file paths
- Use allowlists for permitted files
- Implement path normalization before file operations
- Never trust user-supplied file paths directly
- Consider using secure file handling libraries

## Remediation
```python
# Secure implementation
import os
from werkzeug.utils import secure_filename

def safe_download(filename):
    # Sanitize filename
    safe_name = secure_filename(filename)
    
    # Construct full path
    file_path = os.path.join(FILES_DIR, safe_name)
    
    # Resolve any symbolic links and normalize path
    file_path = os.path.realpath(file_path)
    
    # Verify the resolved path is within the allowed directory
    if not file_path.startswith(os.path.realpath(FILES_DIR)):
        abort(403, "Access denied")
    
    return send_file(file_path)
```
