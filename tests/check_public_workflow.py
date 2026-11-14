"""HTTP verification for the public Vercel app. Uses an isolated guest session.

Creates only a UUID-marked fixture and moves it to Trash after verification.
Does not run or claim to verify browser-side model inference.
"""
import hashlib
import http.cookiejar
import json
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

BASE = sys.argv[1].rstrip('/')
ROOT = Path(__file__).resolve().parents[1]
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
other = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
checks = 0
iid = None

def call(path, payload=None, method=None, opener=client, origin=BASE, raw=None, content_type='application/json'):
    data = raw if raw is not None else json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
        headers={'Content-Type': content_type, 'Origin': origin})
    try:
        with opener.open(req, timeout=45) as res:
            body = res.read()
            return res.status, json.loads(body) if 'application/json' in res.headers.get('Content-Type', '') else body, res.headers
    except urllib.error.HTTPError as error:
        return error.code, error.read(), error.headers

def expect(name, actual, expected):
    global checks
    assert actual == expected, (name, actual, expected)
    checks += 1
    print('PASS:', name, flush=True)

try:
    status, page, headers = call('/inspections')
    expect('public page without sign-in', status, 200)
    expect('inspection workspace rendered', b'Inspections' in page, True)
    cookie = next(c for c in jar if c.name == 'dronemaster_session')
    expect('private session cookie', cookie.secure and cookie.has_nonstandard_attr('HttpOnly'), True)
    expect('storage API connected', call('/api/workspace')[0], 200)
    expect('cross-origin writes rejected', call('/api/inspections', {'title':'check','site':'check'}, origin='https://untrusted.invalid')[0], 403)
    expect('invalid fields rejected', call('/api/inspections', {'title':'x','site':'x'})[0], 400)
    marker = 'Deployment verification ' + uuid.uuid4().hex[:8]
    status, created, _ = call('/api/inspections', {'title':marker,'site':'Temporary verification','notes':'HTTP workflow check; safe to remove.'})
    expect('create inspection', status, 201)
    iid = created['id']
    expect('persisted title', call('/api/inspections/' + iid)[1]['inspection']['title'], marker)
    expect('separate guest cannot access inspection', call('/api/inspections/' + iid, opener=other)[0], 404)
    expect('edit inspection', call('/api/inspections/' + iid, {'title':marker+' edited','site':'Verification','notes':'Updated'}, 'PATCH')[0], 200)
    boundary = 'Dronemaster' + uuid.uuid4().hex
    photo = (ROOT / 'public/dronemaster-logo.png').read_bytes()
    raw = (f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="check.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + photo + f'\r\n--{boundary}--\r\n'.encode())
    status, result, _ = call('/api/inspections/'+iid+'/files', raw=raw, content_type='multipart/form-data; boundary='+boundary)
    expect('upload photo to persistent storage', status, 201)
    fid = result['id']
    expect('original photo bytes retrieved', call('/api/files/'+fid)[1], photo)
    expect('separate guest cannot access photo', call('/api/files/'+fid, opener=other)[0], 404)
    expect('rename photo', call('/api/files/'+fid, {'name':'Verified logo.png'}, 'PATCH')[0], 200)
    finding = {'titleEn':'Upload verified','titleIt':'Caricamento verificato','detailEn':'Original uploaded bytes match the source.','detailIt':'I byte caricati corrispondono all’originale.','severity':'low','fileId':fid}
    status, result, _ = call('/api/inspections/'+iid+'/findings', finding)
    expect('create bilingual observation', status, 201)
    oid = result['id']
    finding['titleEn'] = 'Edited observation'
    expect('edit observation', call('/api/findings/'+oid, finding, 'PATCH')[0], 200)
    expect('review observation', call('/api/findings/'+oid, {'reviewed':True}, 'PATCH')[0], 200)
    status, report, _ = call('/api/inspections/'+iid+'/report')
    expect('export report', status, 200)
    expect('English and Italian in report', b'Edited observation' in report and b'Caricamento verificato' in report, True)
    expect('linked evidence protected', call('/api/files/'+fid, method='DELETE')[0], 409)
    expect('delete observation', call('/api/findings/'+oid, method='DELETE')[0], 200)
    expect('restore observation', call('/api/trash/finding/'+oid, {}, 'POST')[0], 200)
    finding['fileId'] = None
    expect('unlink evidence', call('/api/findings/'+oid, finding, 'PATCH')[0], 200)
    expect('delete photo', call('/api/files/'+fid, method='DELETE')[0], 200)
    expect('deleted photo unavailable', call('/api/files/'+fid)[0], 404)
    expect('restore photo', call('/api/trash/photo/'+fid, {}, 'POST')[0], 200)
    expect('delete inspection', call('/api/inspections/'+iid, method='DELETE')[0], 200)
    expect('deleted parent hides photo', call('/api/files/'+fid)[0], 404)
    expect('restore inspection', call('/api/trash/inspection/'+iid, {}, 'POST')[0], 200)
    expect('restored inspection loads', call('/api/inspections/'+iid)[0], 200)
    for path in ['/reports','/settings','/trash','/inspections/new','/inspections/'+iid]:
        expect('page '+path, call(path)[0], 200)
    for path in ['/vision-worker.js','/vendor/transformers-3.8.1.min.js','/vendor/ort-wasm-simd-threaded.jsep.mjs','/vendor/ort-wasm-simd-threaded.jsep.wasm','/dronemaster-logo.png']:
        status, content, headers = call(path)
        expect('asset '+path, status, 200)
        expect('asset bytes '+path, hashlib.sha256(content).digest(), hashlib.sha256((ROOT/'public'/path.lstrip('/')).read_bytes()).digest())
        if path.endswith('.wasm'):
            expect('WASM MIME', 'application/wasm' in headers.get('Content-Type',''), True)
    print(str(checks)+' production HTTP checks passed. Browser model inference is a separate check.', flush=True)
finally:
    if iid:
        call('/api/inspections/'+iid, method='DELETE')
