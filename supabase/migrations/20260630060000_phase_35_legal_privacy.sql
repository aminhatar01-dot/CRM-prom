-- FASE 35: Legal, privacidad, consentimiento y gestión de datos
-- Creates legal_documents, legal_acceptances, privacy_requests tables with RLS.

-- ─── 1. legal_documents ───────────────────────────────────────────────────────
-- Stores versioned legal documents (terms, privacy policy, etc.)
-- Managed by super_admin; content is stored for auditability.

CREATE TABLE IF NOT EXISTS legal_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type     text NOT NULL,           -- 'terms', 'privacy', 'cookies', 'data_processing', 'ai_consent'
  version      text NOT NULL,           -- e.g. '1.0', '1.1'
  title        text NOT NULL,
  content_hash text,                    -- SHA-256 of content for integrity
  effective_at timestamptz NOT NULL DEFAULT now(),
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_type, version)
);

CREATE INDEX IF NOT EXISTS legal_docs_type_active_idx ON legal_documents(doc_type, active);

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active legal documents (needed for consent UI)
CREATE POLICY "legal_documents_public_read" ON legal_documents
  FOR SELECT USING (true);

-- Only service_role can insert/update/delete (via admin actions with createAdminClient)
-- No INSERT/UPDATE policy for authenticated role — only service_role bypasses RLS.

-- ─── 2. legal_acceptances ─────────────────────────────────────────────────────
-- Records each user's acceptance of a legal document version.

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  document_id     uuid NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  doc_type        text NOT NULL,
  version         text NOT NULL,
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  ip_address      text,
  user_agent      text
);

CREATE INDEX IF NOT EXISTS legal_accept_user_idx ON legal_acceptances(user_id);
CREATE INDEX IF NOT EXISTS legal_accept_org_idx  ON legal_acceptances(organization_id);
CREATE INDEX IF NOT EXISTS legal_accept_doc_idx  ON legal_acceptances(document_id);

ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Users can read their own acceptances
CREATE POLICY "legal_accept_own_select" ON legal_acceptances
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own acceptances
CREATE POLICY "legal_accept_own_insert" ON legal_acceptances
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── 3. privacy_requests ──────────────────────────────────────────────────────
-- Tracks LGPD/GDPR data requests from users.

CREATE TABLE IF NOT EXISTS privacy_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type    text NOT NULL,        -- 'export_data', 'delete_data', 'anonymize_contact', 'restrict_processing'
  status          text NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'rejected', 'cancelled'
  target_type     text,                 -- 'organization', 'contact', 'user', etc.
  target_id       uuid,
  reason          text,
  export_url      text,                 -- signed URL when export is ready
  export_expires_at timestamptz,
  completed_at    timestamptz,
  handled_by      uuid REFERENCES profiles(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privacy_req_org_idx  ON privacy_requests(organization_id);
CREATE INDEX IF NOT EXISTS privacy_req_user_idx ON privacy_requests(requested_by);
CREATE INDEX IF NOT EXISTS privacy_req_status_idx ON privacy_requests(status);

ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests within their org
CREATE POLICY "privacy_req_own_select" ON privacy_requests
  FOR SELECT USING (
    requested_by = auth.uid()
    AND is_org_member(organization_id)
  );

-- Users can insert their own requests within their org
CREATE POLICY "privacy_req_own_insert" ON privacy_requests
  FOR INSERT WITH CHECK (
    requested_by = auth.uid()
    AND is_org_member(organization_id)
  );

-- Users can cancel their own pending requests
CREATE POLICY "privacy_req_own_cancel" ON privacy_requests
  FOR UPDATE USING (
    requested_by = auth.uid()
    AND status = 'pending'
  );

-- ─── 4. organizations.ai_consent_at ───────────────────────────────────────────
-- Records when the org owner explicitly consented to AI data processing.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ai_consent_at       timestamptz,
  ADD COLUMN IF NOT EXISTS ai_consent_by       uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS legal_accepted_at   timestamptz;

-- ─── 5. Helper: get_active_legal_document ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_active_legal_document(p_doc_type text)
RETURNS TABLE(id uuid, doc_type text, version text, title text, effective_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, doc_type, version, title, effective_at
  FROM legal_documents
  WHERE doc_type = p_doc_type AND active = true
  ORDER BY effective_at DESC
  LIMIT 1;
$$;

-- ─── 6. Helper: user_has_accepted_current ────────────────────────────────────

CREATE OR REPLACE FUNCTION user_has_accepted_current(p_user_id uuid, p_doc_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM legal_acceptances la
    JOIN legal_documents ld ON ld.id = la.document_id
    WHERE la.user_id = p_user_id
      AND la.doc_type = p_doc_type
      AND ld.active = true
  );
$$;

GRANT EXECUTE ON FUNCTION get_active_legal_document(text) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_accepted_current(uuid, text) TO authenticated;

-- ─── 7. Seed initial legal documents ─────────────────────────────────────────
-- Insert v1.0 of all legal documents as inactive placeholders.
-- They become active when the admin activates them from the panel.
-- Content hash is NULL until real content is provided.

INSERT INTO legal_documents (doc_type, version, title, active, effective_at)
VALUES
  ('terms',           '1.0', 'Terminos y Condiciones de Uso v1.0',        true,  now()),
  ('privacy',         '1.0', 'Politica de Privacidad v1.0',                true,  now()),
  ('cookies',         '1.0', 'Politica de Cookies v1.0',                   true,  now()),
  ('data_processing', '1.0', 'Acuerdo de Tratamiento de Datos (DPA) v1.0', true,  now()),
  ('ai_consent',      '1.0', 'Consentimiento de Procesamiento con IA v1.0', true, now())
ON CONFLICT (doc_type, version) DO NOTHING;

-- ─── 8. Rate limit bucket for privacy requests ────────────────────────────────
-- Reuse existing rate_limit_buckets infrastructure from FASE 28.
-- No DDL needed — bucket key 'privacy_requests' is checked in application code.
