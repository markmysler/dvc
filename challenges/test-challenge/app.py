#!/usr/bin/env python3
"""
Basic XSS Challenge Application

A simple Flask web application with an intentional XSS vulnerability
for educational purposes. Users learn to identify and exploit reflected XSS.
"""

import os
import logging
from flask import Flask, render_template, request, jsonify
from markupsafe import Markup

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)

# Challenge flag from environment
FLAG = os.getenv('CHALLENGE_FLAG', os.getenv('FLAG', 'FLAG{xss_vulnerabilities_are_dangerous_83f2a1}'))

# Sample data for the search functionality
SAMPLE_USERS = [
    {'id': 1, 'name': 'Alice Johnson', 'email': 'alice@example.com'},
    {'id': 2, 'name': 'Bob Smith', 'email': 'bob@example.com'},
    {'id': 3, 'name': 'Carol Davis', 'email': 'carol@example.com'},
    {'id': 4, 'name': 'David Wilson', 'email': 'david@example.com'},
]

@app.route('/')
def index():
    """Main page with search form"""
    return render_template('index.html')

@app.route('/search', methods=['GET', 'POST'])
def search():
    """Search functionality with XSS vulnerability"""
    query = request.args.get('q', '') if request.method == 'GET' else request.form.get('q', '')

    # Log the search query
    logger.info(f"Search query received: {query}")

    # Vulnerable: Direct rendering without sanitization
    results = []
    if query:
        # Search through sample users
        results = [user for user in SAMPLE_USERS
                  if query.lower() in user['name'].lower() or query.lower() in user['email'].lower()]

    # Intentionally vulnerable: render query without escaping
    return render_template('search.html',
                         query=Markup(query),  # Vulnerable line!
                         results=results,
                         flag=FLAG if '<script>' in query.lower() else None)

@app.route('/flag')
def flag():
    """Flag endpoint - reveals flag when XSS is successfully triggered"""
    # This would normally be protected, but for the challenge it's accessible
    return jsonify({'flag': FLAG, 'message': 'Congratulations! XSS successfully exploited!'})

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'xss-challenge'})

@app.route('/about')
def about():
    """About page explaining the challenge"""
    return render_template('about.html')

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=False)