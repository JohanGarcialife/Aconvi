-- Ensure user_admin exists
INSERT INTO "user" (id, name, email, created_at, updated_at)
VALUES ('user_admin', 'Administrador Aconvi', 'admin@aconvi.com', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Create community_document table
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

-- Notices
INSERT INTO notice (organization_id, author_id, title, content, created_at)
VALUES
  ('org_aconvi_demo', 'user_admin', 'Revision anual de ascensores', 'El proximo martes 20 de mayo se realizara la revision tecnica obligatoria de los ascensores. Se estima una parada de 2 horas entre las 9:00 y las 14:00 h.', now() - INTERVAL '1 day'),
  ('org_aconvi_demo', 'user_admin', 'Corte de agua el sabado', 'La empresa suministradora realizara trabajos de mantenimiento. El corte afectara al edificio entre las 08:00 y las 12:00 h del sabado. Rogamos llenen sus depositos con antelacion.', now() - INTERVAL '2 days'),
  ('org_aconvi_demo', 'user_admin', 'Normas de uso de la piscina 2025', 'Horario: 10:00 a 21:00 h. Maximo 2 acompanantes externos por propietario. Ducha obligatoria antes de entrar. Prohibido el acceso a menores sin supervision adulta.', now() - INTERVAL '5 days'),
  ('org_aconvi_demo', 'user_admin', 'Acta Junta Ordinaria Abril 2025', 'Adjuntamos el acta de la Junta Ordinaria de Propietarios del 10 de abril de 2025. Acuerdos: aprobacion presupuesto 2025-2026, renovacion contrato de limpieza y obras en cubierta.', now() - INTERVAL '10 days');

-- Common Areas
INSERT INTO common_area (organization_id, name, description, open_time, close_time, slot_duration_minutes, is_active, icon)
VALUES
  ('org_aconvi_demo', 'Pista de Padel', 'Pista cubierta con iluminacion. Cap: 4 personas.', '08:00', '22:00', 90, true, ':tennis:'),
  ('org_aconvi_demo', 'Piscina Comunitaria', 'Piscina exterior 25m. Acceso con llave comunitaria.', '10:00', '21:00', 60, true, ':swim:'),
  ('org_aconvi_demo', 'Salon de Reuniones', 'Sala equipada con proyector y pizarra. Cap: 20 personas.', '09:00', '20:00', 120, true, ':office:');

-- Documents
INSERT INTO community_document (organization_id, author_id, title, description, category, file_url, file_name, mime_type)
VALUES
  ('org_aconvi_demo', 'user_admin', 'Acta Junta Ordinaria Abril 2025', 'Acta completa de la junta de propietarios del 10 de abril de 2025.', 'ACTA', 'https://drive.google.com/file/d/demo-acta-2025', 'acta-junta-abril-2025.pdf', 'application/pdf'),
  ('org_aconvi_demo', 'user_admin', 'Estatutos de la Comunidad', 'Estatutos vigentes aprobados en asamblea de 2022.', 'ESTATUTO', 'https://drive.google.com/file/d/demo-estatutos', 'estatutos-comunidad-2022.pdf', 'application/pdf'),
  ('org_aconvi_demo', 'user_admin', 'Presupuesto Anual 2025', 'Presupuesto de gastos e ingresos aprobado para el ejercicio 2025.', 'PRESUPUESTO', 'https://drive.google.com/file/d/demo-presupuesto', 'presupuesto-2025.pdf', 'application/pdf'),
  ('org_aconvi_demo', 'user_admin', 'Reglamento de Regimen Interior', 'Normas de convivencia y uso de zonas comunes.', 'REGLAMENTO', 'https://drive.google.com/file/d/demo-reglamento', 'reglamento-interior.pdf', 'application/pdf'),
  ('org_aconvi_demo', 'user_admin', 'Contrato Servicio de Limpieza', 'Contrato con Limpiezas Garcia S.L. vigente hasta diciembre 2025.', 'CONTRATO', 'https://drive.google.com/file/d/demo-contrato', 'contrato-limpieza-2025.pdf', 'application/pdf');

-- Providers
INSERT INTO provider (organization_id, name, avatar_initials, speciality, rating, is_trusted, completed_jobs, avg_days, phone, email, price_min, price_max)
VALUES
  ('org_aconvi_demo', 'Electricidad Martinez', 'EM', 'Electricidad', 4.8, true, 47, 2, '+34 612 345 678', 'martinez@electrico.es', 80, 200),
  ('org_aconvi_demo', 'Fontaneria Garcia', 'FG', 'Fontaneria', 4.5, true, 32, 3, '+34 623 456 789', 'garcia@fontaneros.es', 60, 180),
  ('org_aconvi_demo', 'Cerrajeria Rapida 24h', 'CR', 'Cerrajeria', 4.9, true, 85, 1, '+34 634 567 890', 'info@cerrajeria24h.es', 50, 150),
  ('org_aconvi_demo', 'Pinturas Lopez e Hijos', 'PL', 'Pintura', 4.2, false, 18, 5, '+34 645 678 901', 'lopez@pinturas.es', 100, 400),
  ('org_aconvi_demo', 'Ascensores Otis Service', 'AO', 'Ascensores', 4.7, true, 120, 2, '+34 900 100 200', 'service@otis.es', 150, 600);

-- Summary
SELECT
  (SELECT COUNT(*) FROM incident WHERE organization_id = 'org_aconvi_demo') AS incidents,
  (SELECT COUNT(*) FROM notice WHERE organization_id = 'org_aconvi_demo') AS notices,
  (SELECT COUNT(*) FROM common_area WHERE organization_id = 'org_aconvi_demo') AS areas,
  (SELECT COUNT(*) FROM community_document WHERE organization_id = 'org_aconvi_demo') AS documents,
  (SELECT COUNT(*) FROM provider WHERE organization_id = 'org_aconvi_demo') AS providers;
