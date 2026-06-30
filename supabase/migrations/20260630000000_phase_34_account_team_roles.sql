-- FASE 34: Ciclo completo de cuenta, equipo, roles e invitaciones
-- Adds supervisor/viewer roles, extends profiles and organizations,
-- creates organization_invitations table with full RLS, and helper functions.

-- ─── 1. Extend organization_role enum ────────────────────────────────────────

ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'viewer';

-- ─── 2. Extend profiles table ─────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS job_title     text,
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS timezone      text DEFAULT 'America/Argentina/Buenos_Aires';

-- ─── 3. Extend organizations table ────────────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS country       text DEFAULT 'AR',
  ADD COLUMN IF NOT EXISTS currency      text DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS timezone      text DEFAULT 'America/Argentina/Buenos_Aires',
  ADD COLUMN IF NOT EXISTS logo_url      text,
  ADD COLUMN IF NOT EXISTS tax_id        text,
  ADD COLUMN IF NOT EXISTS fiscal_name   text,
  ADD COLUMN IF NOT EXISTS preferences   jsonb NOT NULL DEFAULT '{}';

-- ─── 4. organization_invitations table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            organization_role NOT NULL DEFAULT 'agent',
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  resend_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_invitations_org_idx   ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS org_invitations_token_idx ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS org_invitations_email_idx ON organization_invitations(email);

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Admins/owners can see all invitations for their org
CREATE POLICY "org_invitations_select" ON organization_invitations
  FOR SELECT USING (is_org_member(organization_id));

-- Only admins/owners can insert
CREATE POLICY "org_invitations_insert" ON organization_invitations
  FOR INSERT WITH CHECK (is_org_admin(organization_id));

-- Only admins/owners can update (revoke/resend)
CREATE POLICY "org_invitations_update" ON organization_invitations
  FOR UPDATE USING (is_org_admin(organization_id));

-- ─── 5. is_org_owner helper ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_org_owner(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

-- ─── 6. invite_member function ────────────────────────────────────────────────
-- Creates a new invitation (or refreshes an existing pending one).
-- Caller must be owner or admin. A viewer cannot be invited as owner.

CREATE OR REPLACE FUNCTION invite_member(
  p_organization_id uuid,
  p_email           text,
  p_role            organization_role,
  p_invited_by      uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id uuid;
BEGIN
  -- Guard: only admins/owners may invite
  IF NOT is_org_admin(p_organization_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to invite members';
  END IF;

  -- Guard: nobody can invite someone as 'owner'
  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot invite a member with the owner role';
  END IF;

  -- Guard: email already an active member?
  IF EXISTS (
    SELECT 1 FROM organization_members om
    JOIN profiles p ON p.id = om.user_id
    WHERE om.organization_id = p_organization_id
      AND lower(p.full_name) = lower(p_email)  -- email stored in auth.users
  ) THEN
    RAISE EXCEPTION 'User is already a member of this organization';
  END IF;

  -- Revoke any existing pending invitation for the same email
  UPDATE organization_invitations
  SET revoked_at = now()
  WHERE organization_id = p_organization_id
    AND lower(email) = lower(p_email)
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now();

  INSERT INTO organization_invitations (organization_id, email, role, invited_by)
  VALUES (p_organization_id, lower(p_email), p_role, p_invited_by)
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

-- ─── 7. accept_invitation function ────────────────────────────────────────────
-- Called when the invited user clicks the link and is authenticated.

CREATE OR REPLACE FUNCTION accept_invitation(
  p_token   text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv organization_invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_inv
  FROM organization_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has been revoked';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already accepted';
  END IF;

  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Add user to org (ignore if already member)
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_inv.organization_id, p_user_id, v_inv.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE organization_invitations
  SET accepted_at = now()
  WHERE id = v_inv.id;
END;
$$;

-- ─── 8. revoke_invitation function ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION revoke_invitation(
  p_invitation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM organization_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF NOT is_org_admin(v_org_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to revoke invitation';
  END IF;

  UPDATE organization_invitations
  SET revoked_at = now()
  WHERE id = p_invitation_id
    AND revoked_at IS NULL
    AND accepted_at IS NULL;
END;
$$;

-- ─── 9. Grant execute on new functions to authenticated ───────────────────────

GRANT EXECUTE ON FUNCTION is_org_owner(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION invite_member(uuid, text, organization_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(text, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_invitation(uuid)         TO authenticated;
