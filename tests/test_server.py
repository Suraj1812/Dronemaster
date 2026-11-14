import io
import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from functools import partial
from pathlib import Path
from unittest.mock import patch
import server


class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.original = server.DB_PATH
        server.DB_PATH = Path(cls.tmp.name) / 'test.sqlite3'
        server.init_db()
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), partial(server.Handler, directory=str(server.ROOT / 'dist')))
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        server.DB_PATH = cls.original
        cls.tmp.cleanup()

    def request(self, path, payload=None, headers=None):
        request = urllib.request.Request(self.base + path,
            data=json.dumps(payload).encode() if payload is not None else None,
            headers={'Content-Type': 'application/json', **(headers or {})})
        try:
            return urllib.request.urlopen(request)
        except urllib.error.HTTPError as e:
            return e

    def test_inspection_and_headers(self):
        with self.request('/api/inspection') as r:
            self.assertEqual(len(json.load(r)['inspection']['findings']), 3)
            self.assertEqual(r.headers['X-Content-Type-Options'], 'nosniff')
            self.assertIn("script-src 'self'", r.headers['Content-Security-Policy'])

    def test_bilingual_retrieval_and_abstention(self):
        for language, question, expected in [('en','Explain thermal anomaly','78.4'),('it','Spiega l’anomalia termica','78,4')]:
            answer = server.evidence_answer(question, language, server.inspection_data())
            self.assertEqual(answer['sources'], ['F-001'])
            self.assertIn(expected, answer['answer'])
        self.assertEqual(server.evidence_answer('What is the weather?', 'en', server.inspection_data())['sources'], [])

    def test_chat_and_audit(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
            with self.request('/api/chat', {'question':'signal', 'language':'it'}) as r:
                self.assertEqual(json.load(r)['sources'], ['F-003'])
        with server.connect() as db:
            self.assertTrue(db.execute("SELECT 1 FROM audit_events WHERE action='inspection_question'").fetchone())

    def test_validation(self):
        for payload in [{}, [], {'question':'x'*501}, {'question':'x','language':'xx'}, {'question':5}]:
            with self.request('/api/chat', payload) as r:
                self.assertEqual(r.status, 400)

    def test_origin_host_and_files(self):
        with self.request('/api/chat', {'question':'x'}, {'Origin':'https://evil.example'}) as r:
            self.assertEqual(r.status,403)
        with self.request('/api/inspection', headers={'Host':'evil.example'}) as r:
            self.assertEqual(r.status,403)
        for path in ['/server.py','/data/aeris.sqlite3','/.env','/../server.py']:
            with self.request(path) as r:
                self.assertEqual(r.status,404)

    def test_sql_injection_does_not_change_data(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
            with self.request('/api/chat', {'question':"'; DROP TABLE findings;--", 'language':'en'}) as r:
                self.assertEqual(r.status,200)
        with server.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM findings').fetchone()[0],3)

    def test_live_adapter_contract(self):
        response = {'status':'completed','output':[{'content':[{'type':'output_text','text':json.dumps({'answer':'Panel B7 [F-001]','sources':['F-001','invalid']})}]}]}
        with patch.dict(os.environ, {'OPENAI_API_KEY':'test-key'}), patch('server.urllib.request.urlopen',return_value=io.BytesIO(json.dumps(response).encode())) as call:
            answer = server.live_answer('Thermal?', 'en', server.inspection_data())
            self.assertEqual(answer['sources'],['F-001'])
            body = json.loads(call.call_args.args[0].data)
            self.assertFalse(body['store'])
            self.assertEqual(body['text']['format']['type'],'json_schema')

    def test_failed_ai_is_not_presented_as_answer(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY':'test-key'}), patch('server.urllib.request.urlopen',side_effect=urllib.error.URLError('unavailable')):
            # Avoid patching the test client's urllib path, which shares the module.
            with self.assertRaises(urllib.error.URLError):
                server.live_answer('Thermal?', 'it', server.inspection_data())


if __name__ == '__main__':
    unittest.main()
