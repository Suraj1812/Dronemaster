-- Serialize quota and ownership checks with the insert, including concurrent requests.
CREATE TRIGGER files_insert_guard BEFORE INSERT ON files
BEGIN
  SELECT RAISE(ABORT, 'inactive_inspection') WHERE NOT EXISTS (
    SELECT 1 FROM inspections WHERE id=NEW.inspection_id AND owner_id=NEW.owner_id AND deleted_at IS NULL
  );
  SELECT RAISE(ABORT, 'workspace_photo_limit') WHERE
    (SELECT COUNT(*) FROM files WHERE inspection_id=NEW.inspection_id)>=12 OR
    (SELECT COALESCE(SUM(bytes),0) FROM files WHERE owner_id=NEW.owner_id)+NEW.bytes>104857600;
END;
--> statement-breakpoint
CREATE TRIGGER findings_insert_guard BEFORE INSERT ON findings
BEGIN
  SELECT RAISE(ABORT, 'inactive_inspection') WHERE NOT EXISTS (
    SELECT 1 FROM inspections WHERE id=NEW.inspection_id AND owner_id=NEW.owner_id AND deleted_at IS NULL
  );
  SELECT RAISE(ABORT, 'inspection_finding_limit') WHERE
    (SELECT COUNT(*) FROM findings WHERE inspection_id=NEW.inspection_id AND owner_id=NEW.owner_id)>=50;
  SELECT RAISE(ABORT, 'invalid_evidence') WHERE NEW.file_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM files WHERE id=NEW.file_id AND inspection_id=NEW.inspection_id AND owner_id=NEW.owner_id AND deleted_at IS NULL
  );
END;
--> statement-breakpoint
CREATE TRIGGER findings_evidence_guard BEFORE UPDATE OF file_id,deleted_at ON findings
WHEN NEW.deleted_at IS NULL AND NEW.file_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'invalid_evidence') WHERE NOT EXISTS (
    SELECT 1 FROM files WHERE id=NEW.file_id AND inspection_id=NEW.inspection_id AND owner_id=NEW.owner_id AND deleted_at IS NULL
  );
END;
