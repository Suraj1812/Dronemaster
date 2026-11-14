"""Real local HTTP workflow checks. Run with the development server at port 5173.
Only creates its own UUID-marked fixture; cleanup removes only that fixture.
"""
import http.cookiejar
import json
import sqlite3
import subprocess
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:5173'
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
client.open(BASE + '/signin-with-chatgpt?return_to=/inspections').read()
fixture = {'inspection': None, 'file': None, 'finding': None, 'owner': None}
checks = 0

def request(path, payload=None, method=None, origin=BASE, auth=True, raw=None, content_type='application/json'):
    data = raw if raw is not None else json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + '/api/' + path, data=data, method=method,
        headers={'Content-Type': content_type, 'Origin': origin})
    try:
        with (client if auth else urllib.request.build_opener()).open(req) as res:
            body = res.read()
            return res.status, json.loads(body) if 'application/json' in res.headers.get('Content-Type', '') else body
    except urllib.error.HTTPError as error:
        return error.code, error.read()

def expect(name, actual, expected):
    global checks
    assert actual == expected, (name, actual, expected)
    checks += 1
    print('PASS:', name)

try:
    expect('anonymous API rejected', request('workspace', auth=False)[0], 401)
    expect('cross-origin write blocked', request('inspections', {'title':'check','site':'check'}, origin='https://untrusted.invalid')[0], 403)
    expect('invalid input rejected', request('inspections', {'title':'x','site':'x'})[0], 400)
    expect('unknown inspection rejected', request('inspections/' + str(uuid.uuid4()))[0], 404)
    marker = 'Automated check ' + str(uuid.uuid4())[:8]
    status, result = request('inspections', {'title':marker, 'site':'Local test only', 'notes':'Temporary automated verification fixture.'})
    expect('create inspection', status, 201)
    iid = fixture['inspection'] = result['id']
    status, detail = request('inspections/' + iid)
    fixture['owner'] = detail['inspection']['owner_id']
    expect('saved record is dynamic', detail['inspection']['title'], marker)
    expect('edit inspection', request('inspections/' + iid, {'title':marker + ' edited','site':'Local test','notes':'Edited'}, 'PATCH')[0], 200)
    boundary = 'Dronemaster' + uuid.uuid4().hex
    image = (ROOT / 'public/dronemaster-logo.png').read_bytes()
    raw = (f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="check.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + image + f'\r\n--{boundary}--\r\n'.encode())
    status, result = request('inspections/' + iid + '/files', raw=raw, content_type='multipart/form-data; boundary=' + boundary)
    expect('real file upload', status, 201)
    fid = fixture['file'] = result['id']
    expect('retrieve actual photo bytes', request('files/' + fid)[1], image)
    expect('rename photo', request('files/' + fid, {'name':'Renamed check.png'}, 'PATCH')[0], 200)
    finding = {'titleEn':'Verified file','titleIt':'File verificato','detailEn':'Uploaded original bytes match the source image.','detailIt':'I byte originali corrispondono all’immagine sorgente.','severity':'low','fileId':fid}
    status, result = request('inspections/' + iid + '/findings', finding)
    expect('create bilingual observation', status, 201)
    oid = fixture['finding'] = result['id']
    finding['titleEn'] = 'Edited verification'
    expect('edit observation', request('findings/' + oid, finding, 'PATCH')[0], 200)
    expect('mark reviewed', request('findings/' + oid, {'reviewed':True}, 'PATCH')[0], 200)
    status, report = request('inspections/' + iid + '/report')
    expect('real bilingual report export', status, 200)
    expect('report contains English and Italian', b'Edited verification' in report and b'File verificato' in report, True)
    expect('linked evidence deletion blocked', request('files/' + fid, method='DELETE')[0], 409)
    expect('delete observation', request('findings/' + oid, method='DELETE')[0], 200)
    expect('observation removed from active records', len(request('inspections/' + iid)[1]['findings']), 0)
    expect('restore observation', request('trash/finding/' + oid, {}, 'POST')[0], 200)
    finding['fileId'] = None
    request('findings/' + oid, finding, 'PATCH')
    expect('delete photo', request('files/' + fid, method='DELETE')[0], 200)
    expect('deleted photo not accessible', request('files/' + fid)[0], 404)
    expect('restore photo', request('trash/photo/' + fid, {}, 'POST')[0], 200)
    expect('delete inspection', request('inspections/' + iid, method='DELETE')[0], 200)
    expect('deleted inspection not accessible', request('inspections/' + iid)[0], 404)
    expect('child photo inaccessible with deleted parent', request('files/' + fid)[0], 404)
    expect('restore inspection', request('trash/inspection/' + iid, {}, 'POST')[0], 200)
    expect('restored inspection available', request('inspections/' + iid)[0], 200)
    print(f'{checks} checks passed')
finally:
    # The development database has its own state. Never run this against production.
    iid = fixture['inspection']
    if iid:
        for path in (ROOT / '.wrangler/state/v3/d1').rglob('*.sqlite'):
            try:
                with sqlite3.connect(path) as db:
                    row = db.execute('SELECT title FROM inspections WHERE id=?', (iid,)).fetchone()
                    if not row or not row[0].startswith('Automated check '):
                        continue
                    db.execute('DELETE FROM findings WHERE inspection_id=?', (iid,))
                    db.execute('DELETE FROM files WHERE inspection_id=?', (iid,))
                    db.execute('DELETE FROM inspections WHERE id=?', (iid,))
                    ids = [i for i in (iid, fixture['file'], fixture['finding']) if i]
                    for item_id in ids:
                        db.execute('DELETE FROM audit_events WHERE entity_id=?', (item_id,))
            except sqlite3.OperationalError:
                continue
    if fixture['file']:
        key = 'site-creator-r2/' + fixture['owner'] + '/' + iid + '/' + fixture['file']
        subprocess.run(['node','--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','r2','object','delete',key,'--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
