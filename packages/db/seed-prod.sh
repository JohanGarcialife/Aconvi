#!/bin/bash
# Seed script para ejecutar en producción vía docker exec

docker exec tu74knshjfm4vu8wx4325h4j psql -U postgres -d aconvi << 'ENDSQL'

-- ─── Create missing tables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_document (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title varchar(256) NOT NULL,
  description text,
  category varchar(64) NOT NULL DEFAULT 'OTRO',
  file_url text NOT NULL,
  file_name varchar(256) NOT NULL,
  mime_type varchar(128),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Make sure user_admin exists ──────────────────────────────────────────────
INSERT INTO "user" (id, name, email, created_at, updated_at)
VALUES ('user_admin', 'Administrador Aconvi', 'admin@aconvi.com', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─── Notices ──────────────────────────────────────────────────────────────────
INSERT INTO notice (id, organization_id, author_id, title, content, type, pinned, created_at)
VALUES
  (gen_random_uuid(), 'org_aconvi_demo', 'user_admin', 'Revisión anual de ascensores', 'El próximo martes 20 de mayo se realizará la revisión técnica obligatoria de los ascensores del edificio. Se estima una parada de 2 horas por ascensor entre las 9:00 y las 14:00 h.', 'AVISO', true, now() - interval '1 day'),
  (gen_random_uuid(), 'org_aconvi_demo', 'user_admin', 'Corte de agua el sábado 17', 'La empresa suministradora de agua realizará trabajos de mantenimiento en la red general. El corte afectará al edificio entre las 08:00 y las 12:00 h del sábado 17 de mayo. Rogamos que llenen sus depósitos con antelación.', 'URGENTE', true, now() - interval '2 days'),
  (gen_random_uuid(), 'org_aconvi_demo', 'user_admin', 'Normas de uso de la piscina 2025', 'Recordamos las normas de uso de la piscina comunitaria: horario de 10:00 a 21:00 h, máximo 2 acompañantes externos por propietario, ducha obligatoria antes de entrar y uso de gorro en el vaso. Prohibido el acceso a menores sin supervisión adulta.', 'COMUNICADO', false, now() - interval '3 days'),
  (gen_random_uuid(), 'org_aconvi_demo', 'user_admin', 'Acta Junta Ordinaria Abril 2025', 'Adjuntamos el acta de la Junta Ordinaria de Propietarios celebrada el 10 de abril de 2025. Los acuerdos más relevantes fueron: aprobación del presupuesto 2025-2026, renovación del contrato de limpieza y aprobación de obras en la cubierta.', 'COMUNICADO', false, now() - interval '10 days')
ON CONFLICT DO NOTHING;

-- ─── Common Areas ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  padel_id uuid := gen_random_uuid();
  piscina_id uuid := gen_random_uuid();
  salon_id uuid := gen_random_uuid();
  user1_id text;
  user2_id text;
BEGIN
  -- Get real user IDs
  SELECT id INTO user1_id FROM "user" WHERE id != 'user_admin' LIMIT 1;
  SELECT id INTO user2_id FROM "user" WHERE id != 'user_admin' AND id != user1_id LIMIT 1;
  IF user2_id IS NULL THEN user2_id := user1_id; END IF;

  INSERT INTO common_area (id, organization_id, name, description, open_time, close_time, slot_duration_minutes, is_active, created_at)
  VALUES
    (padel_id, 'org_aconvi_demo', 'Pista de Pádel', 'Pista de pádel cubierta con iluminación. Capacidad: 4 personas.', '08:00', '22:00', 90, true, now()),
    (piscina_id, 'org_aconvi_demo', 'Piscina Comunitaria', 'Piscina exterior 25m x 12m. Acceso con llave comunitaria.', '10:00', '21:00', 60, true, now()),
    (salon_id, 'org_aconvi_demo', 'Salón de Reuniones', 'Sala equipada con proyector y pizarra. Capacidad: 20 personas.', '09:00', '20:00', 120, true, now())
  ON CONFLICT DO NOTHING;

  -- Add sample bookings
  INSERT INTO common_area_booking (id, common_area_id, user_id, date, start_time, end_time, notes, status, created_at)
  VALUES
    (gen_random_uuid(), padel_id, user1_id, to_char(now() + interval '1 day', 'YYYY-MM-DD'), '10:00', '11:30', 'Partido de vecinos', 'CONFIRMADA', now()),
    (gen_random_uuid(), piscina_id, user1_id, to_char(now() + interval '2 days', 'YYYY-MM-DD'), '11:00', '12:00', NULL, 'CONFIRMADA', now()),
    (gen_random_uuid(), salon_id, COALESCE(user2_id, user1_id), to_char(now() + interval '3 days', 'YYYY-MM-DD'), '09:00', '11:00', 'Reunión de vecinos', 'CONFIRMADA', now()),
    (gen_random_uuid(), padel_id, COALESCE(user2_id, user1_id), to_char(now() - interval '2 days', 'YYYY-MM-DD'), '16:00', '17:30', NULL, 'CANCELADA', now())
  ON CONFLICT DO NOTHING;
END $$;

-- ─── Documents ─────────────────────────────────────────────────────────────────
INSERT INTO community_document (id, organization_id, author_id, title, description, category, file_url, file_name, mime_type, created_at)
VALUES
  (gen_random_uuid(), 'org_aconvi_demo', 'user_admin', 'Acta Junta Ordinaria Abril 2025', 'Acta completa de la junta de propietarios del 10 de abril de 2025.', 'ACTA', 'https://drive.google.com/file/d/demo-acta-2025', 'acta-junta-abril-2025.pdf', 'application/pdf', now() - interval '10 days'),
  (gen_random_uuid(), 'org_aconvi_demo', 'user_admin', 'Estatutos de la Comunidad', 'Estatutos vigentes aprobados en asamblea de 2022.', 'ESTATUTO', 'https://drive.google.com/file/d/demo-estatutos', 'estatutos-comunidad-2022.pdf', 'application/pdf', now() - interval '30 days'),
  (gen_random_uuid(), 'org_aconvi_demo', 'user_admin', 'Presupuesto Anual 2025', 'Presupuesto de gastos e ingresos aprobado para el ejercicio 2025.', 'PRESUPUESTO', 'https://drive.google.com/file/d/demo-presupuesto', 'presupuesto-2025.pdf', 'application/pdf', now() - interval '20 days'),
  (gen_random_uuid(), 'org_aconvi_demo', 'user_admin', 'Reglamento de Régimen Interior', 'Normas de convivencia y uso de zonas comunes de la comunidad.', 'REGLAMENTO', 'https://drive.google.com/file/d/demo-reglamento', 'reglamento-interior.pdf', 'application/pdf', now() - interval '60 days'),
  (gen_random_uuid(), 'org_aconvi_demo', 'user_admin', 'Contrato Servicio de Limpieza', 'Contrato con la empresa Limpiezas García S.L. vigente hasta diciembre 2025.', 'CONTRATO', 'https://drive.google.com/file/d/demo-contrato', 'contrato-limpieza-2025.pdf', 'application/pdf', now() - interval '15 days')
ON CONFLICT DO NOTHING;

-- ─── Providers ──────────────────────────────────────────────────────────────────
INSERT INTO provider (id, organization_id, name, avatar_initials, speciality, rating, is_trusted, completed_jobs, avg_days_to_resolve, phone, email, price_range_min, price_range_max)
VALUES
  (gen_random_uuid(), 'org_aconvi_demo', 'Electricidad Martínez', 'EM', 'Electricidad', 4.8, true, 47, 2, '+34 612 345 678', 'martinez@electrico.es', 80, 200),
  (gen_random_uuid(), 'org_aconvi_demo', 'Fontanería García', 'FG', 'Fontanería', 4.5, true, 32, 3, '+34 623 456 789', 'garcia@fontaneros.es', 60, 180),
  (gen_random_uuid(), 'org_aconvi_demo', 'Cerrajería Rápida 24h', 'CR', 'Cerrajería', 4.9, true, 85, 1, '+34 634 567 890', 'info@cerrajeria24h.es', 50, 150),
  (gen_random_uuid(), 'org_aconvi_demo', 'Pinturas López e Hijos', 'PL', 'Pintura y revestimientos', 4.2, false, 18, 5, '+34 645 678 901', 'lopez@pinturas.es', 100, 400),
  (gen_random_uuid(), 'org_aconvi_demo', 'Ascensores Otis Service', 'AO', 'Ascensores y elevadores', 4.7, true, 120, 2, '+34 900 100 200', 'service@otis.es', 150, 600)
ON CONFLICT DO NOTHING;

-- ─── Summary ──────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM incident WHERE organization_id = 'org_aconvi_demo') AS incidents,
  (SELECT COUNT(*) FROM notice WHERE organization_id = 'org_aconvi_demo') AS notices,
  (SELECT COUNT(*) FROM common_area WHERE organization_id = 'org_aconvi_demo') AS common_areas,
  (SELECT COUNT(*) FROM common_area_booking) AS bookings,
  (SELECT COUNT(*) FROM community_document WHERE organization_id = 'org_aconvi_demo') AS documents,
  (SELECT COUNT(*) FROM provider WHERE organization_id = 'org_aconvi_demo') AS providers;

ENDSQL
