#!/usr/bin/env python3
"""
Simple server for the Endura Admin Dashboard.
Run: python serve.py
Then open: http://localhost:3000
"""

import http.server
import socketserver
import os

PORT = 3002
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add CORS headers for API calls
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🌿 Endura Admin Dashboard")
        print(f"═══════════════════════════")
        print(f"Open: http://localhost:{PORT}")
        print(f"═══════════════════════════")
        print(f"Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
