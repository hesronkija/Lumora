-- Create application roles (migrations grant table permissions)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lumora_app') THEN
    CREATE ROLE lumora_app WITH LOGIN PASSWORD 'lumora_app_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lumora_superuser') THEN
    CREATE ROLE lumora_superuser WITH LOGIN PASSWORD 'lumora_super_password' SUPERUSER;
  END IF;
END
$$;

-- Grant schema access
GRANT USAGE ON SCHEMA public TO lumora_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lumora_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lumora_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO lumora_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO lumora_app;
