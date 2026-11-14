import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { newInspection, newFinding, imageAnalysisInput, classificationInput, imageMime, markdownText } from './inspection-validation';
import { ZodError } from 'zod';
class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;
let lastRateCleanupMinute = -1;
async function limitedBytes(request: Request, limit: number) {
    if (Number(request.headers.get('Content-Length') || 0) > limit)
        throw new HttpError(413, 'Request too large.');
    const reader = request.body?.getReader();
    if (!reader)
        return new Uint8Array();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > limit) {
                await reader.cancel();
                throw new HttpError(413, 'Request too large.');
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}
async function uploadForm(request: Request) { const bytes = await limitedBytes(request, MAX_UPLOAD_BYTES); try {
    return await new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type')! } }).formData();
}
catch {
    throw new HttpError(400, 'Invalid photo upload.');
} }
const json = (p: unknown, status = 200) => Response.json(p, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const now = () => new Date().toISOString();
function db() { if (!env.DB)
    throw new HttpError(503, 'Database is not configured.'); return env.DB; }
async function body(r: Request): Promise<Record<string, unknown>> { if (r.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new HttpError(415, 'Use JSON for this request.'); const bytes = await limitedBytes(r, 40 * 1024); let value: unknown; try {
    value = JSON.parse(new TextDecoder().decode(bytes));
}
catch {
    throw new HttpError(400, 'Invalid JSON.');
} if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Use a JSON object.'); return value as Record<string, unknown>; }
function audit(owner: string, action: string, id: string) { return db().prepare('INSERT INTO audit_events (id,owner_id,action,entity_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), owner, action, id, now()); }
async function owned(owner: string, id: string) { const row = await db().prepare('SELECT * FROM inspections WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id, owner).first(); if (!row)
    throw new HttpError(404, 'Inspection not found.'); return row; }
async function details(owner: string, id: string) {
    const [parent, photos, findings] = await db().batch<Record<string, unknown>>([
        db().prepare('SELECT * FROM inspections WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id, owner),
        db().prepare('SELECT id,name,mime,bytes,created_at,classification,analysis FROM files WHERE inspection_id=? AND owner_id=? AND deleted_at IS NULL ORDER BY created_at').bind(id, owner),
        db().prepare('SELECT * FROM findings WHERE inspection_id=? AND owner_id=? AND deleted_at IS NULL ORDER BY created_at DESC').bind(id, owner)
    ]);
    const inspection = parent.results[0];
    if (!inspection)
        throw new HttpError(404, 'Inspection not found.');
    return { inspection, files: (photos.results as {
            id: string;
            name: string;
            mime: string;
            bytes: number;
            created_at: string;
            classification: string | null; analysis:string|null;
        }[]).map(f => ({ ...f, analysis:f.analysis?JSON.parse(f.analysis):null, classification: f.classification ? JSON.parse(String(f.classification)) : null })), findings: findings.results };
}
export async function handleApi(request: Request): Promise<Response> {
    try {
        const user = await getChatGPTUser();
        if (!user)
            throw new HttpError(401, 'Sign in to continue.');
        const owner = user.userId;
        const p = new URL(request.url).pathname.split('/').filter(Boolean).slice(1), method = request.method;
        if (method !== 'GET') {
            if (request.headers.get('Origin') !== new URL(request.url).origin)
                throw new HttpError(403, 'Cross-origin request blocked.');
            if (Number(request.headers.get('Content-Length') || 0) > 7 * 1024 * 1024)
                throw new HttpError(413, 'Maximum photo size is 6 MB.');
            const minute = Math.floor(Date.now() / 60000);
            const rate = await db().prepare('INSERT INTO rate_windows (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=MIN(count+1,41) RETURNING count').bind(`${owner}:${minute}`, minute + 2).first<{
                count: number;
            }>();
            if ((rate?.count ?? 0) > 40)
                throw new HttpError(429, 'Please wait a minute before trying again.');
            if (lastRateCleanupMinute !== minute) {
                lastRateCleanupMinute = minute;
                try {
                    await db().prepare('DELETE FROM rate_windows WHERE key IN (SELECT key FROM rate_windows WHERE expires_at < ? LIMIT 500)').bind(minute).run();
                }
                catch {
                    lastRateCleanupMinute = -1;
                }
            }
        }
        if (method === 'GET' && p.length === 1 && p[0] === 'trash') {
            const rows = await db().prepare("SELECT id,title AS name,'inspection' AS kind,deleted_at FROM inspections WHERE owner_id=? AND deleted_at IS NOT NULL UNION ALL SELECT id,name,'photo' AS kind,deleted_at FROM files WHERE owner_id=? AND deleted_at IS NOT NULL UNION ALL SELECT id,title_en AS name,'finding' AS kind,deleted_at FROM findings WHERE owner_id=? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200").bind(owner, owner, owner).all();
            return json({ items: rows.results });
        }
        if (method === 'POST' && p[0] === 'trash' && p[1] && p[2] && p.length === 3) {
            const table = ({ inspection: 'inspections', photo: 'files', finding: 'findings' } as Record<string, string>)[p[1]];
            if (!table)
                throw new HttpError(404, 'Not found.');
            const item = await db().prepare(`SELECT * FROM ${table} WHERE id=? AND owner_id=? AND deleted_at IS NOT NULL`).bind(p[2], owner).first();
            if (!item)
                throw new HttpError(404, 'Item not found.');
            if (table !== 'inspections' && !await db().prepare('SELECT id FROM inspections WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(item.inspection_id, owner).first())
                throw new HttpError(409, 'Restore the parent inspection first.');
            await db().batch([db().prepare(`UPDATE ${table} SET deleted_at=NULL WHERE id=? AND owner_id=?`).bind(p[2], owner), audit(owner, 'item_restored', p[2])]);
            return json({ ok: true });
        }
        if (method === 'DELETE' && p[0] === 'files' && p[1] && p[2] === 'classification' && p.length === 3) {
            const result = await db().prepare('UPDATE files SET classification=NULL WHERE id=? AND owner_id=? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM inspections i WHERE i.id=inspection_id AND i.deleted_at IS NULL)').bind(p[1], owner).run();
            if (!result.meta.changes)
                throw new HttpError(404, 'Photo not found.');
            await audit(owner, 'labels_cleared', p[1]).run();
            return json({ ok: true });
        }
        if (method === 'DELETE' && p.length === 2 && ['inspections', 'files', 'findings'].includes(p[0])) {
            const table = p[0];
            const item = await db().prepare(`SELECT * FROM ${table} WHERE id=? AND owner_id=? AND deleted_at IS NULL`).bind(p[1], owner).first();
            if (!item)
                throw new HttpError(404, 'Item not found.');
            if (table !== 'inspections')
                await owned(owner, String(item.inspection_id));
            if (table === 'files' && await db().prepare('SELECT id FROM findings WHERE file_id=? AND owner_id=? AND deleted_at IS NULL LIMIT 1').bind(p[1], owner).first())
                throw new HttpError(409, 'Unlink this photo from its observations before deleting it.');
            await db().batch([db().prepare(`UPDATE ${table} SET deleted_at=? WHERE id=? AND owner_id=?`).bind(now(), p[1], owner), audit(owner, 'item_deleted', p[1])]);
            return json({ ok: true });
        }
        if (method === 'PATCH' && p[0] === 'files' && p.length === 2) {
            const v = await body(request);
            if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 120)
                throw new HttpError(400, 'Use a photo name between 1 and 120 characters.');
            const r = await db().prepare('UPDATE files SET name=? WHERE id=? AND owner_id=? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM inspections i WHERE i.id=inspection_id AND i.deleted_at IS NULL)').bind(v.name.trim().replace(/[\x00-\x1f/\\]/g, '_'), p[1], owner).run();
            if (!r.meta.changes)
                throw new HttpError(404, 'Photo not found.');
            await audit(owner, 'photo_renamed', p[1]).run();
            return json({ ok: true });
        }
        if (method === 'PATCH' && p[0] === 'inspections' && p.length === 2) {
            await owned(owner, p[1]);
            const v = newInspection.parse(await body(request));
            await db().batch([db().prepare('UPDATE inspections SET title=?,site=?,notes=?,updated_at=? WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(v.title, v.site, v.notes, now(), p[1], owner), audit(owner, 'inspection_updated', p[1])]);
            return json({ ok: true });
        }
        if (method === 'GET' && p.length === 1 && p[0] === 'workspace') {
            const [list, stats, activity] = await Promise.all([db().prepare('SELECT i.*,(SELECT COUNT(*) FROM files f WHERE f.inspection_id=i.id AND f.owner_id=i.owner_id AND f.deleted_at IS NULL) AS file_count,(SELECT COUNT(*) FROM findings f WHERE f.inspection_id=i.id AND f.owner_id=i.owner_id AND f.deleted_at IS NULL) AS finding_count FROM inspections i WHERE i.owner_id=? AND i.deleted_at IS NULL ORDER BY i.updated_at DESC LIMIT 100').bind(owner).all(), db().prepare('SELECT (SELECT COUNT(*) FROM inspections WHERE owner_id=? AND deleted_at IS NULL) AS inspections,(SELECT COUNT(*) FROM files WHERE owner_id=? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM inspections i WHERE i.id=inspection_id AND i.deleted_at IS NULL)) AS photos,(SELECT COUNT(*) FROM findings WHERE owner_id=? AND reviewed=0 AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM inspections i WHERE i.id=inspection_id AND i.deleted_at IS NULL)) AS pending,(SELECT COALESCE(SUM(bytes),0) FROM files WHERE owner_id=?) AS bytes').bind(owner, owner, owner, owner).first(), db().prepare('SELECT action,entity_id,created_at FROM audit_events WHERE owner_id=? ORDER BY created_at DESC LIMIT 8').bind(owner).all()]);
            return json({ inspections: list.results, stats, activity: activity.results, storageReady: !!env.BUCKET, ai: { mode: 'browser', model: 'Xenova/mobilevit-xx-small', apiKeyRequired: false } });
        }
        if (method === 'POST' && p.length === 1 && p[0] === 'inspections') {
            const b = newInspection.parse(await body(request)), id = crypto.randomUUID(), time = now();
            const r = await db().prepare('INSERT INTO inspections (id,owner_id,title,site,notes,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM inspections WHERE owner_id=?)<100').bind(id, owner, b.title, b.site, b.notes, time, time, owner).run();
            if (!r.meta.changes)
                throw new HttpError(409, 'Maximum 100 inspections per workspace.');
            await audit(owner, 'inspection_created', id).run();
            return json({ id }, 201);
        }
        if (p[0] === 'files' && p[1] && p.length === 2 && method === 'GET') {
            const f = await db().prepare('SELECT object_key,mime,bytes,sha256 FROM files WHERE id=? AND owner_id=? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM inspections i WHERE i.id=inspection_id AND i.deleted_at IS NULL)').bind(p[1], owner).first();
            if (!f || !env.BUCKET)
                throw new HttpError(404, 'Photo not found.');
            const etag = '"' + String(f.sha256) + '"';
            const headers = { 'Content-Type': String(f.mime), 'Cache-Control': 'private, no-cache', 'ETag': etag, 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' };
            const tags = request.headers.get('If-None-Match')?.split(',').map(tag => tag.trim().replace(/^W\//, ''));
            if (tags?.includes(etag) || tags?.includes('*'))
                return new Response(null, { status: 304, headers });
            const o = await env.BUCKET.get(String(f.object_key));
            if (!o)
                throw new HttpError(404, 'Photo not found.');
            return new Response(o.body, { headers: { ...headers, 'Content-Length': String(f.bytes) } });
        }
        if (p[0] === 'files' && p[1] && p[2] === 'analysis' && p.length === 3 && ['POST','DELETE'].includes(method)) {
            const photo=await db().prepare('SELECT id FROM files WHERE id=? AND owner_id=? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM inspections i WHERE i.id=inspection_id AND i.deleted_at IS NULL)').bind(p[1],owner).first();
            if(!photo)throw new HttpError(404,'Photo not found.');
            const analysis=method==='DELETE'?null:{...imageAnalysisInput.parse(await body(request)),createdAt:now(),execution:'browser',verification:'client-reported',reviewed:false};
            await db().batch([db().prepare('UPDATE files SET analysis=? WHERE id=? AND owner_id=?').bind(analysis?JSON.stringify(analysis):null,p[1],owner),audit(owner,analysis?'photo_described':'analysis_cleared',p[1])]);
            return json({ok:true});
        }
        if (p[0] === 'files' && p[1] && p[2] === 'classification' && p.length === 3 && method === 'POST') {
            const b = classificationInput.parse(await body(request));
            const f = await db().prepare('SELECT id FROM files WHERE id=? AND owner_id=? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM inspections i WHERE i.id=inspection_id AND i.deleted_at IS NULL)').bind(p[1], owner).first();
            if (!f)
                throw new HttpError(404, 'Photo not found.');
            await db().batch([db().prepare('UPDATE files SET classification=? WHERE id=? AND owner_id=?').bind(JSON.stringify({ ...b, computedAt: now(), execution: 'browser', verification: 'client-reported' }), p[1], owner), audit(owner, 'photo_classified', p[1])]);
            return json({ ok: true });
        }
        if (p[0] === 'findings' && p[1] && p.length === 2 && method === 'PATCH') {
            const b = await body(request);
            const f = await db().prepare('SELECT id,inspection_id FROM findings WHERE id=? AND owner_id=? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM inspections i WHERE i.id=inspection_id AND i.deleted_at IS NULL)').bind(p[1], owner).first();
            if (!f)
                throw new HttpError(404, 'Finding not found.');
            if (typeof b.reviewed === 'boolean') {
                await db().batch([db().prepare('UPDATE findings SET reviewed=? WHERE id=? AND owner_id=?').bind(b.reviewed ? 1 : 0, p[1], owner), audit(owner, b.reviewed ? 'finding_reviewed' : 'finding_reopened', p[1])]);
            }
            else {
                const v = newFinding.parse(b);
                if (v.fileId && !await db().prepare('SELECT id FROM files WHERE id=? AND inspection_id=? AND owner_id=? AND deleted_at IS NULL').bind(v.fileId, f.inspection_id, owner).first())
                    throw new HttpError(400, 'Choose a photo from this inspection.');
                await db().batch([db().prepare('UPDATE findings SET title_en=?,title_it=?,detail_en=?,detail_it=?,severity=?,file_id=? WHERE id=? AND owner_id=?').bind(v.titleEn, v.titleIt, v.detailEn, v.detailIt, v.severity, v.fileId, p[1], owner), audit(owner, 'finding_updated', p[1])]);
            }
            return json({ ok: true });
        }
        if (p[0] === 'inspections' && p[1]) {
            const id = p[1];
            if (p.length === 2 && method === 'GET')
                return json(await details(owner, id));
            if (p.length === 3 && p[2] === 'files' && method === 'POST') {
                await owned(owner, id);
                if (!env.BUCKET)
                    throw new HttpError(503, 'Photo storage is not configured.');
                if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data'))
                    throw new HttpError(415, 'Use a photo upload.');
                const form = await uploadForm(request), f = form.get('photo');
                if (!(f instanceof File) || !f.size || f.size > 6 * 1024 * 1024)
                    throw new HttpError(400, 'Choose a JPG, PNG or WebP photo up to 6 MB.');
                const bytes = new Uint8Array(await f.arrayBuffer()), mime = imageMime(bytes);
                if (!mime)
                    throw new HttpError(415, 'Only JPG, PNG and WebP photos are supported.');
                const count = await db().prepare('SELECT (SELECT COUNT(*) FROM files WHERE inspection_id=?) AS n,(SELECT COALESCE(SUM(bytes),0) FROM files WHERE owner_id=?) AS total').bind(id, owner).first<{
                    n: number;
                    total: number;
                }>();
                if ((count?.n ?? 0) >= 12 || (count?.total ?? 0) + f.size > 100 * 1024 * 1024)
                    throw new HttpError(409, 'Limit reached: 12 photos per inspection, 100 MB per workspace.');
                const fid = crypto.randomUUID(), key = `${owner}/${id}/${fid}`, hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
                await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
                try {
                    await db().batch([db().prepare('INSERT INTO files (id,inspection_id,owner_id,name,mime,bytes,object_key,sha256,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(fid, id, owner, f.name.replace(/[\x00-\x1f/\\]/g, '_').slice(0, 120), mime, f.size, key, hash, now()), db().prepare('UPDATE inspections SET updated_at=? WHERE id=? AND owner_id=?').bind(now(), id, owner), audit(owner, 'photo_uploaded', id)]);
                }
                catch (error) {
                    await env.BUCKET.delete(key);
                    throw error;
                }
                return json({ id: fid }, 201);
            }
            if (p.length === 3 && p[2] === 'findings' && method === 'POST') {
                await owned(owner, id);
                const b = newFinding.parse(await body(request));
                if (b.fileId && !await db().prepare('SELECT id FROM files WHERE id=? AND inspection_id=? AND owner_id=? AND deleted_at IS NULL').bind(b.fileId, id, owner).first())
                    throw new HttpError(400, 'Choose a photo from this inspection.');
                const fid = crypto.randomUUID();
                await db().batch([db().prepare('INSERT INTO findings (id,inspection_id,owner_id,file_id,title_en,title_it,detail_en,detail_it,severity,reviewed,created_at) VALUES (?,?,?,?,?,?,?,?,?,0,?)').bind(fid, id, owner, b.fileId, b.titleEn, b.titleIt, b.detailEn, b.detailIt, b.severity, now()), db().prepare('UPDATE inspections SET updated_at=? WHERE id=? AND owner_id=?').bind(now(), id, owner), audit(owner, 'finding_added', id)]);
                return json({ id: fid }, 201);
            }
            if (p.length === 3 && p[2] === 'report' && method === 'GET') {
                const d = await details(owner, id);
                let text = `# Dronemaster\n## Inspection report / Rapporto di ispezione\n\n${markdownText(d.inspection.title)}\n\n${markdownText(d.inspection.site)}\n\nID: ${id}\nExported / Esportato: ${now()}\n\n`;
                for (const l of ['en', 'it']) {
                    text += `## ${l === 'en' ? 'English' : 'Italiano'}\n\n${l === 'en' ? 'Notes (original language)' : 'Note (lingua originale)'}: ${markdownText(d.inspection.notes) || '—'}\n\n`;
                    if (!d.findings.length)
                        text += l === 'en' ? 'No findings recorded.\n\n' : 'Nessun rilievo registrato.\n\n';
                    d.findings.forEach(f => { text += `### ${markdownText(f['title_' + l] || (l === 'it' ? 'Traduzione non fornita' : 'Translation not provided'))}\n\n${markdownText(f['detail_' + l] || (l === 'it' ? 'Traduzione non fornita' : 'Translation not provided'))}\n\n${l === 'en' ? 'Severity' : 'Gravità'}: ${markdownText(f.severity)} | ${l === 'en' ? 'Reviewed' : 'Verificato'}: ${f.reviewed ? '✓' : '—'}\n${l === 'en' ? 'Evidence photo ID' : 'ID foto evidenza'}: ${markdownText(f.file_id) || '—'}\n\n`; });
                }
                text += '## Evidence / Evidenze\n\n';
                d.files.forEach(f => { if(f.analysis)text+=`\n### AI draft — not operator-approved / Bozza AI non approvata\n\n${markdownText(f.name)}\nQuestion: ${markdownText(f.analysis.question)}\n\n${markdownText(f.analysis.answer)}\n\nModel: ${markdownText(f.analysis.model)} | Generated: ${markdownText(f.analysis.createdAt)}\n\n`; text += `- ${markdownText(f.name)} | ${f.id} | ${f.bytes} bytes\n`; if (f.classification && f.classification.dtype === 'fp32' && f.classification.pipelineVersion === 'mobilevit-fp32-v1')
                    text += `  Browser-computed general labels (client-reported): ${markdownText(JSON.stringify(f.classification))}\n`; });
                text += '\nGeneral image labels are not industrial diagnoses. Observations and translations are supplied by the operator.\nLe etichette generiche non sono diagnosi industriali. Osservazioni e traduzioni sono fornite dall’operatore.\n';
                await audit(owner, 'report_exported', id).run();
                return new Response(text, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="dronemaster-${id.slice(0, 8)}-EN-IT.md"`, 'Cache-Control': 'no-store' } });
            }
        }
        throw new HttpError(404, 'Not found.');
    }
    catch (e) {
        const message = e instanceof Error ? e.message : '';
        if (message.includes('workspace_photo_limit'))
            return json({ error: 'Limit reached: 12 photos per inspection, 100 MB per workspace.' }, 409);
        if (message.includes('inspection_finding_limit'))
            return json({ error: 'Maximum 50 findings per inspection.' }, 409);
        if (message.includes('inactive_inspection'))
            return json({ error: 'Inspection not found.' }, 404);
        if (message.includes('invalid_evidence'))
            return json({ error: 'Choose an active photo from this inspection.' }, 409);
        if (e instanceof HttpError) {
            const response = json({ error: e.message }, e.status);
            if (e.status === 429)
                response.headers.set('Retry-After', String(60 - Math.floor(Date.now() / 1000) % 60));
            return response;
        }
        if (e instanceof ZodError)
            return json({ error: 'Please check the fields and try again.', fields: e.flatten().fieldErrors }, 400);
        console.error('Dronemaster request failed', e instanceof Error ? e.name : 'unknown');
        return json({ error: 'The request could not be completed. Please try again.' }, 500);
    }
}
