CREATE TABLE public.telemetry_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_name TEXT NOT NULL,
  airframe TEXT NOT NULL DEFAULT 'UAV-01',
  flight_profile TEXT NOT NULL DEFAULT 'cruise',
  synthetic BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.telemetry_sessions TO anon, authenticated;
GRANT ALL ON public.telemetry_sessions TO service_role;
ALTER TABLE public.telemetry_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions readable by everyone" ON public.telemetry_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sessions insertable by everyone" ON public.telemetry_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.telemetry_snapshots (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,
  t TIMESTAMPTZ NOT NULL DEFAULT now(),
  flight_profile TEXT NOT NULL DEFAULT 'cruise',
  params JSONB NOT NULL,
  health JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX telemetry_snapshots_session_t_idx ON public.telemetry_snapshots (session_id, t);
GRANT SELECT, INSERT ON public.telemetry_snapshots TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.telemetry_snapshots_id_seq TO anon, authenticated;
GRANT ALL ON public.telemetry_snapshots TO service_role;
GRANT ALL ON SEQUENCE public.telemetry_snapshots_id_seq TO service_role;
ALTER TABLE public.telemetry_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots readable by everyone" ON public.telemetry_snapshots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "snapshots insertable by everyone" ON public.telemetry_snapshots FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.fault_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,
  scenario_key TEXT NOT NULL,
  label TEXT NOT NULL,
  subsystem TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  injected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fault_events TO anon, authenticated;
GRANT ALL ON public.fault_events TO service_role;
ALTER TABLE public.fault_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faults readable by everyone" ON public.fault_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "faults insertable by everyone" ON public.fault_events FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,
  raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subsystem TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0,
  rul_minutes NUMERIC,
  contributions JSONB NOT NULL DEFAULT '[]'::jsonb,
  narrative TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.alerts TO anon, authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts readable by everyone" ON public.alerts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "alerts insertable by everyone" ON public.alerts FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.self_heal_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger_key TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied',
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.self_heal_actions TO anon, authenticated;
GRANT ALL ON public.self_heal_actions TO service_role;
ALTER TABLE public.self_heal_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "heal readable by everyone" ON public.self_heal_actions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "heal insertable by everyone" ON public.self_heal_actions FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.blackbox_entries (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, seq)
);
GRANT SELECT, INSERT ON public.blackbox_entries TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.blackbox_entries_id_seq TO anon, authenticated;
GRANT ALL ON public.blackbox_entries TO service_role;
GRANT ALL ON SEQUENCE public.blackbox_entries_id_seq TO service_role;
ALTER TABLE public.blackbox_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blackbox readable by everyone" ON public.blackbox_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "blackbox insertable by everyone" ON public.blackbox_entries FOR INSERT TO anon, authenticated WITH CHECK (true);