from flask import Flask, request, send_file, render_template_string, abort
import os

app = Flask(__name__)

# Flag is stored in /app/flag.txt (writable by challenge user)
FLAG_PATH = '/app/flag.txt'

# Get flag from environment variable (injected by orchestrator)
CHALLENGE_FLAG = os.environ.get('CHALLENGE_FLAG', 'DVC{default_flag_error}')

# Write flag to file at startup
with open(FLAG_PATH, 'w') as f:
    f.write(CHALLENGE_FLAG + '\n')

# Safe files directory
FILES_DIR = '/app/files'

# Create some safe files
os.makedirs(FILES_DIR, exist_ok=True)
with open(os.path.join(FILES_DIR, 'document1.txt'), 'w') as f:
    f.write('This is a public document.\n')
with open(os.path.join(FILES_DIR, 'document2.txt'), 'w') as f:
    f.write('Another safe file.\n')
with open(os.path.join(FILES_DIR, 'README.md'), 'w') as f:
    f.write('# File Server\nDownload files from the list below.\n')

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>Secure File Server</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #333; }
        .file-list {
            list-style: none;
            padding: 0;
        }
        .file-list li {
            padding: 10px;
            margin: 5px 0;
            background: #f9f9f9;
            border-radius: 4px;
        }
        .file-list a {
            color: #0066cc;
            text-decoration: none;
        }
        .file-list a:hover {
            text-decoration: underline;
        }
        .info {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .error {
            background: #ffebee;
            color: #c62828;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 Secure File Server</h1>
        <div class="info">
            <strong>Available Files:</strong>
            <p>Download any of the public documents below.</p>
        </div>
        
        <ul class="file-list">
            <li>📄 <a href="/download?file=document1.txt">document1.txt</a></li>
            <li>📄 <a href="/download?file=document2.txt">document2.txt</a></li>
            <li>📄 <a href="/download?file=README.md">README.md</a></li>
        </ul>

        {% if error %}
        <div class="error">
            <strong>Error:</strong> {{ error }}
        </div>
        {% endif %}
    </div>
</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/download')
def download():
    filename = request.args.get('file', '')
    
    if not filename:
        return render_template_string(HTML_TEMPLATE, error="No file specified"), 400
    
    # VULNERABLE: Direct path concatenation without validation
    # This allows path traversal attacks like: ?file=../../flag.txt
    file_path = os.path.join(FILES_DIR, filename)
    
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            return render_template_string(HTML_TEMPLATE, error=f"File not found: {filename}"), 404
        
        # Send the file
        return send_file(file_path, as_attachment=True, download_name=os.path.basename(filename))
    except Exception as e:
        return render_template_string(HTML_TEMPLATE, error=str(e)), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
