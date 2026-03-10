
-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'reviewer', 'adjuster', 'readonly');

-- 2. Tenants
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 3. Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. User roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM public.profiles WHERE id = _user_id LIMIT 1 $$;

-- 6. Signup completion RPC
CREATE OR REPLACE FUNCTION public.complete_signup(
  _display_name text DEFAULT '',
  _org_name text DEFAULT 'My Organization',
  _org_code text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _email text;
  _tenant_id uuid;
  _role app_role;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN json_build_object('status', 'already_exists');
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _user_id;
  IF _org_code IS NOT NULL AND _org_code != '' THEN
    SELECT id INTO _tenant_id FROM public.tenants WHERE slug = _org_code;
    IF _tenant_id IS NULL THEN RAISE EXCEPTION 'Invalid organization code'; END IF;
    _role := 'readonly';
  ELSE
    INSERT INTO public.tenants (name, slug)
    VALUES (_org_name, lower(replace(_org_name, ' ', '-')) || '-' || substr(gen_random_uuid()::text, 1, 8))
    RETURNING id INTO _tenant_id;
    _role := 'admin';
  END IF;
  INSERT INTO public.profiles (id, tenant_id, email, display_name)
  VALUES (_user_id, _tenant_id, _email, COALESCE(NULLIF(_display_name, ''), split_part(_email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
  RETURN json_build_object('status', 'created', 'role', _role::text, 'tenant_id', _tenant_id::text);
END;
$$;

-- 7. Admin role change RPC
CREATE OR REPLACE FUNCTION public.admin_update_user_role(_target_user_id uuid, _new_role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF public.get_user_tenant_id(_target_user_id) != public.get_user_tenant_id(auth.uid()) THEN
    RAISE EXCEPTION 'User not in your organization';
  END IF;
  -- Upsert: update existing role or insert
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _target_user_id) THEN
    UPDATE public.user_roles SET role = _new_role WHERE user_id = _target_user_id;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _new_role);
  END IF;
END;
$$;

-- 8. RLS policies
-- Tenants
CREATE POLICY "read_own_tenant" ON public.tenants FOR SELECT TO authenticated
  USING (id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "admin_update_tenant" ON public.tenants FOR UPDATE TO authenticated
  USING (id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE POLICY "read_tenant_profiles" ON public.profiles FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- User roles
CREATE POLICY "read_tenant_roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id IN (SELECT p.id FROM public.profiles p WHERE p.tenant_id = public.get_user_tenant_id(auth.uid())));
CREATE POLICY "admin_insert_roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update_roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete_roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
