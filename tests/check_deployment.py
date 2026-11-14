"""Read-only production check. Private Sites service token is supplied via stdin.
Does not impersonate a user or bypass application ownership checks.
"""
import hashlib
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path
base = sys.argv[1].rstrip('/')
token = sys.stdin.readline().strip()
root = Path(__file__).resolve().parents[1]
def fetch(path, authenticated=True):
    headers = {'OAI-Sites-Authorization': 'Bearer ' + token} if authenticated else {}
    try:
        with urllib.request.urlopen(urllib.request.Request(base + path, headers=headers), timeout=45) as r:
            return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()
for path in ['/vision-worker.js', '/vendor/transformers-3.8.1.min.js', '/vendor/ort-wasm-simd-threaded.jsep.mjs', '/vendor/ort-wasm-simd-threaded.jsep.wasm', '/dronemaster-logo.png']:
    status, headers, content = fetch(path)
    assert status == 200, (path, status)
    expected = (root / 'public' / path.lstrip('/')).read_bytes()
    assert hashlib.sha256(content).digest() == hashlib.sha256(expected).digest(), path + ': deployed bytes mismatch'
    if path.endswith('.wasm'):
        assert 'application/wasm' in headers.get('Content-Type', ''), 'WASM MIME type incorrect'
    print('PASS deployed asset:', path)
for path in ['/api/workspace', '/api/inspections/not-a-real-inspection']:
    status, headers, content = fetch(path)
    assert status == 401, (path, status)
    assert json.loads(content)['error'] == 'Sign in to continue.'
    assert headers.get('X-Content-Type-Options') == 'nosniff'
    print('PASS application identity enforced:', path)
for path in ['/api/workspace', '/inspections']:
    status, headers, content = fetch(path, False)
    # The private platform gate may use a login page or redirect.
    assert 'Log in to access' in content.decode(errors='ignore') or status in [401, 403], (path, status)
    print('PASS private access gate:', path)
print('Production assets and authentication boundaries verified. Signed-in UI workflow still requires browser testing.')
