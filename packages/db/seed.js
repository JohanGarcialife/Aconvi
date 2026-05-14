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
    await client.query(`INSERT INTO "organization" (id, name, slug, created_at) VALUES ($1, $2, $3, now()) ON CONFLICT DO NOTHING`, [orgId, 'Aconvi Demo Community', 'aconvi-demo']);

    // 1. Ensure user exists
    await client.query(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1, $2, $3, $4, now(), now()) ON CONFLICT DO NOTHING`, [authorId, 'Admin Demo', 'admin@aconvi.app', true]);
    
    // Ensure member exists
    await client.query(`INSERT INTO "member" (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT DO NOTHING`, [crypto.randomUUID(), orgId, authorId, 'ADMIN']);

    // 2. Incident
    const incId = crypto.randomUUID();
    await client.query(`INSERT INTO "incident" (id, organization_id, reporter_id, title, description, status, priority, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`, [incId, orgId, authorId, 'Lámpara fundida en el pasillo', 'La luz del tercer piso está parpadeando y se fundió.', 'NUEVA', 'BAJA']);

    // 3. Voting
    const voteId = crypto.randomUUID();
    await client.query(`INSERT INTO "vote_session" (id, organization_id, author_id, title, description, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, now())`, [voteId, orgId, authorId, 'Pintar fachada', '¿De qué color deberíamos pintar el edificio?', 'OPEN']);
    
    await client.query(`INSERT INTO "vote_option" (id, session_id, label, display_order) VALUES ($1, $2, $3, $4)`, [crypto.randomUUID(), voteId, 'Blanco', 0]);
    await client.query(`INSERT INTO "vote_option" (id, session_id, label, display_order) VALUES ($1, $2, $3, $4)`, [crypto.randomUUID(), voteId, 'Beige', 1]);

    // 4. Common area
    const areaId = crypto.randomUUID();
    await client.query(`INSERT INTO "common_area" (id, organization_id, name, description, created_at) VALUES ($1, $2, $3, $4, now())`, [areaId, orgId, 'Piscina', 'Piscina comunitaria']);
    
    console.log("Mock data inserted successfully.");
  } catch (e) {
    console.error("Error seeding:", e);
  }

  await client.end();
}

main();
