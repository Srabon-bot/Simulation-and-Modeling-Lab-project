"""
F1 Race Simulation Launcher
Runs the Monte Carlo analysis, then serves the web visualization.
"""
import os
import sys
import webbrowser
import http.server
import socketserver
import threading

# Ensure we're in the right directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Step 1: Run the analysis engine
print("=" * 50)
print("  F1 RACE SIMULATION - DATA ENGINE")
print("=" * 50)
import f1_analysis
f1_analysis.run_analysis()

# Step 2: Start HTTP server and open browser
PORT = 8000

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress request logs

print(f"\nStarting race server on http://localhost:{PORT}")
print("Press Ctrl+C to stop.\n")

with socketserver.TCPServer(("", PORT), QuietHandler) as httpd:
    threading.Timer(0.5, lambda: webbrowser.open(f"http://localhost:{PORT}/index.html")).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
