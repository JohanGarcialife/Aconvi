import pg from 'pg';
import crypto from 'crypto';
const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  await client.connect();

  const orgId = 'org_aconvi_demo';
  const authorId = 'user_admin'; 

  try {
    // 0. Ensure Organization exists
    await client.query(`INSERT INTO "organization" (id, name, slug, created_at) VALUES ($1, $2, $3, now()) ON CONFLICT DO NOTHING`, [orgId, 'Residencial Los Olivos', 'residencial-los-olivos']);

    // 1. Ensure user exists
    await client.query(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1, $2, $3, $4, now(), now()) ON CONFLICT DO NOTHING`, [authorId, 'Admin Demo', 'admin@aconvi.app', true]);
    
    // 2. Ensure member (owner) exists for admin
    await client.query(`INSERT INTO "member" (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, authorId, 'owner']);

    // 3. Demo neighbor users
    const vecino1Id = crypto.randomUUID();
    const vecino2Id = crypto.randomUUID();
    await client.query(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1, $2, $3, true, now(), now()) ON CONFLICT DO NOTHING`, [vecino1Id, 'María García López', 'maria.garcia@vecino.com']);
    await client.query(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1, $2, $3, true, now(), now()) ON CONFLICT DO NOTHING`, [vecino2Id, 'Carlos Martínez Ruiz', 'carlos.martinez@vecino.com']);
    await client.query(`INSERT INTO "member" (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, vecino1Id, 'vecino:2A']);
    await client.query(`INSERT INTO "member" (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, vecino2Id, 'vecino:3B']);

    // 4. Incidents (multiple)
    await client.query(`INSERT INTO "incident" (id, organization_id, reporter_id, title, description, status, priority, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now() - INTERVAL '3 days', now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, vecino1Id, 'Lámpara fundida en pasillo 2ª planta', 'La luz del pasillo de la segunda planta lleva días parpadeando y ahora se ha fundido completamente.', 'RECIBIDA', 'MEDIA']);
    await client.query(`INSERT INTO "incident" (id, organization_id, reporter_id, title, description, status, priority, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now() - INTERVAL '5 days', now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, vecino2Id, 'Fuga de agua en garaje', 'Se observa una pequeña fuga de agua en la zona de los contadores del garaje.', 'EN_PROGRESO', 'ALTA']);
    await client.query(`INSERT INTO "incident" (id, organization_id, reporter_id, title, description, status, priority, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now() - INTERVAL '10 days', now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, authorId, 'Puerta del portal no cierra bien', 'La puerta del portal principal tiene problemas con el mecanismo de cierre automático.', 'RESUELTA', 'BAJA']);

    // 5. Notices (comunicados)
    await client.query(`INSERT INTO "notice" (id, organization_id, author_id, title, content, type, pinned, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now() - INTERVAL '2 days', now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, authorId, 'Mantenimiento de ascensores', 'El próximo lunes de 10:00 a 14:00 se realizará el mantenimiento preventivo de los ascensores de todas las torres. Durante ese período los ascensores estarán fuera de servicio.', 'AVISO', true]);
    await client.query(`INSERT INTO "notice" (id, organization_id, author_id, title, content, type, pinned, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now() - INTERVAL '5 hours', now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, authorId, 'Corte de agua programado', 'Aviso urgente: corte de agua programado para mañana de 09:00 a 13:00 debido a una reparación en la tubería principal de la calle. Por favor, guarden agua con antelación.', 'URGENTE', false]);
    await client.query(`INSERT INTO "notice" (id, organization_id, author_id, title, content, type, pinned, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now() - INTERVAL '5 days', now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, authorId, 'Normativa de uso de piscina 2025', 'Ya está publicada la normativa de uso de la piscina para este verano. Horario: 10:00-21:00. Aforo máximo: 30 personas. Obligatorio ducharse antes de entrar.', 'COMUNICADO', false]);
    await client.query(`INSERT INTO "notice" (id, organization_id, author_id, title, content, type, pinned, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now() - INTERVAL '15 days', now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, authorId, 'Resultado votación obras fachada', 'La votación sobre la renovación de la fachada ha concluido con un 78% de votos a favor. Las obras comenzarán en septiembre.', 'COMUNICADO', false]);

    // 6. Common areas
    const areaId1 = crypto.randomUUID();
    const areaId2 = crypto.randomUUID();
    const areaId3 = crypto.randomUUID();
    await client.query(`INSERT INTO "common_area" (id, organization_id, name, description, is_active, open_time, close_time, slot_duration_minutes, created_at) VALUES ($1, $2, $3, $4, true, '08:00', '22:00', 120, now()) ON CONFLICT DO NOTHING`, [areaId1, orgId, 'Pista de Pádel', 'Pista de pádel de cristal con iluminación LED. Vestuarios disponibles.']);
    await client.query(`INSERT INTO "common_area" (id, organization_id, name, description, is_active, open_time, close_time, slot_duration_minutes, created_at) VALUES ($1, $2, $3, $4, true, '10:00', '21:00', 60, now()) ON CONFLICT DO NOTHING`, [areaId2, orgId, 'Piscina Comunitaria', 'Piscina exterior con zona de bañistas y área de niños. Aforo máximo 30 personas.']);
    await client.query(`INSERT INTO "common_area" (id, organization_id, name, description, is_active, open_time, close_time, slot_duration_minutes, created_at) VALUES ($1, $2, $3, $4, true, '09:00', '23:00', 240, now()) ON CONFLICT DO NOTHING`, [areaId3, orgId, 'Sala Multiusos', 'Espacio polivalente para celebraciones y reuniones. Capacidad: 50 personas. Cocina equipada disponible.']);

    // 7. Demo bookings
    await client.query(`INSERT INTO "common_area_booking" (id, common_area_id, user_id, date, start_time, end_time, status, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), areaId1, vecino1Id, '2025-05-15', '18:00', '20:00', 'CONFIRMADA', 'Partido con vecinos del 4B']);
    await client.query(`INSERT INTO "common_area_booking" (id, common_area_id, user_id, date, start_time, end_time, status, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), areaId3, vecino2Id, '2025-05-20', '17:00', '21:00', 'CONFIRMADA', 'Cumpleaños de mi hijo']);

    // 8. Community Documents
    await client.query(`INSERT INTO "community_document" (id, organization_id, author_id, title, category, file_url, file_name, mime_type, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() - INTERVAL '10 days') ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, authorId, 'Acta Junta Ordinaria Abril 2025', 'ACTA', 'https://example.com/acta-abril-2025.pdf', 'acta-abril-2025.pdf', 'application/pdf']);
    await client.query(`INSERT INTO "community_document" (id, organization_id, author_id, title, category, file_url, file_name, mime_type, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() - INTERVAL '20 days') ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, authorId, 'Presupuesto Anual 2025', 'OTRO', 'https://example.com/presupuesto-2025.pdf', 'presupuesto-2025.pdf', 'application/pdf']);
    await client.query(`INSERT INTO "community_document" (id, organization_id, author_id, title, category, file_url, file_name, mime_type, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() - INTERVAL '30 days') ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, authorId, 'Estatutos de la Comunidad', 'ESTATUTO', 'https://example.com/estatutos.pdf', 'estatutos.pdf', 'application/pdf']);

    // 9. Voting session
    const voteId = crypto.randomUUID();
    await client.query(`INSERT INTO "vote_session" (id, organization_id, author_id, title, description, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, now() - INTERVAL '2 days') ON CONFLICT DO NOTHING`, [voteId, orgId, authorId, 'Renovación de la fachada del edificio', '¿Aprueba la renovación de la fachada por un importe de 45.000€, a repartir entre los propietarios?', 'OPEN']);
    await client.query(`INSERT INTO "vote_option" (id, session_id, label, display_order) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), voteId, 'Sí, apruebo', 0]);
    await client.query(`INSERT INTO "vote_option" (id, session_id, label, display_order) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), voteId, 'No, rechazo', 1]);
    await client.query(`INSERT INTO "vote_option" (id, session_id, label, display_order) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), voteId, 'Me abstengo', 2]);

    console.log("✅ Datos de demostración insertados con éxito.");
  } catch (e) {
    console.error("❌ Error seeding:", e.message);
  }

  await client.end();
}

main();
