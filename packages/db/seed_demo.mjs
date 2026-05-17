import pg from 'pg';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const { Client } = pg;
const client = new Client({ connectionString: process.env.POSTGRES_URL });

const reporters = [
  { id: 'e3443373-d68e-4be6-960b-8b1effb51ca7', name: 'María García López' },
  { id: '0d4624b5-e012-4959-9dee-897b9f57f430', name: 'Carlos Martínez Ruiz' },
  { id: 'test-user-jluis-1776971864823', name: 'Vecino Demo' },
];

const providers = {
  fontaneria: '3f122ef0-9c66-4bea-96cc-c55ff28dfa2c',
  electricidad: '3239f3ad-de27-4b9c-b32b-a4e5f4dbc8a2',
  cerrajeria: '8bb1347d-40f8-4ff1-8682-bf8b910dfdf5',
  pintura: 'adbb9ce5-0ab1-4e84-b594-e424120c908b',
};

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000);
}

const incidents = [
  {
    title: 'Gotera en tejado - 3ª planta',
    description: 'Se ha producido una gotera grande en el techo del ático. El agua está cayendo al suelo y puede dañar el parqué. Es urgente revisarlo antes de que empeoren los daños estructurales.',
    category: 'fontaneria',
    status: 'RECIBIDA',
    priority: 'ALTA',
    provider: null,
    reporter: reporters[0],
    daysAgo: 0,
    history: [
      { actor: 'María García López', action: 'CREATED', prev: null, next: 'RECIBIDA', comment: null, h: 0 },
    ],
  },
  {
    title: 'Ascensor bloqueado - Portal A',
    description: 'El ascensor del portal A lleva bloqueado desde esta mañana. Vecinos mayores no pueden subir a sus pisos. Se requiere intervención urgente del técnico de mantenimiento.',
    category: 'electricidad',
    status: 'EN_REVISION',
    priority: 'URGENTE',
    provider: providers.electricidad,
    reporter: reporters[1],
    daysAgo: 1,
    history: [
      { actor: 'Carlos Martínez Ruiz', action: 'CREATED', prev: null, next: 'RECIBIDA', comment: null, h: 0 },
      { actor: 'José Luis (AF)', action: 'ASSIGNED', prev: 'RECIBIDA', next: 'EN_REVISION', comment: 'Asignado a Electricidad Martínez, especialistas en elevadores', h: 2 },
    ],
  },
  {
    title: 'Piscina - Agua turbia y con olor',
    description: 'El agua de la piscina comunitaria está turbia y presenta mal olor. Posible fallo en el sistema de filtrado o cloración. Varios vecinos han notado irritación en los ojos al bañarse.',
    category: 'piscina',
    status: 'AGENDADA',
    priority: 'MEDIA',
    provider: providers.fontaneria,
    reporter: reporters[0],
    daysAgo: 3,
    history: [
      { actor: 'María García López', action: 'CREATED', prev: null, next: 'RECIBIDA', comment: null, h: 0 },
      { actor: 'José Luis (AF)', action: 'ASSIGNED', prev: 'RECIBIDA', next: 'EN_REVISION', comment: 'Revisando disponibilidad del proveedor', h: 4 },
      { actor: 'José Luis (AF)', action: 'STATUS_CHANGED', prev: 'EN_REVISION', next: 'AGENDADA', comment: 'Visita programada para el viernes 9:00h', h: 28 },
    ],
  },
  {
    title: 'Bajante atascada - Portal 2',
    description: 'La bajante de aguas residuales del portal 2 está atascada. Hay mal olor en el portal y en las plantas bajas. El vecino del 1ºA reporta que el agua del baño no desagua correctamente.',
    category: 'fontaneria',
    status: 'EN_CURSO',
    priority: 'MEDIA',
    provider: providers.fontaneria,
    reporter: reporters[2],
    daysAgo: 5,
    history: [
      { actor: 'Vecino Demo', action: 'CREATED', prev: null, next: 'RECIBIDA', comment: null, h: 0 },
      { actor: 'José Luis (AF)', action: 'ASSIGNED', prev: 'RECIBIDA', next: 'EN_REVISION', comment: 'Asignado a Fontanería García', h: 3 },
      { actor: 'José Luis (AF)', action: 'STATUS_CHANGED', prev: 'EN_REVISION', next: 'AGENDADA', comment: 'Revisión programada para el lunes por la mañana', h: 12 },
      { actor: 'Fontanería García', action: 'STATUS_CHANGED', prev: 'AGENDADA', next: 'EN_CURSO', comment: 'Trabajo iniciado. Desatasco en proceso, estimamos 3 horas.', h: 48 },
    ],
  },
  {
    title: 'Baja presión de agua - 2ª planta',
    description: 'Los vecinos del 2º piso reportan baja presión de agua en todos los grifos desde hace 4 días. La ducha apenas funciona. No afecta a otras plantas del edificio.',
    category: 'fontaneria',
    status: 'RECIBIDA',
    priority: 'BAJA',
    provider: null,
    reporter: reporters[1],
    daysAgo: 4,
    history: [
      { actor: 'Carlos Martínez Ruiz', action: 'CREATED', prev: null, next: 'RECIBIDA', comment: null, h: 0 },
    ],
  },
  {
    title: 'Luces del garaje fundidas',
    description: 'Las luces del garaje en la planta -1 no funcionan desde hace una semana. Es un riesgo de seguridad especialmente por la noche. Luces de emergencia instaladas provisionalmente.',
    category: 'electricidad',
    status: 'RESUELTA',
    priority: 'MEDIA',
    provider: providers.electricidad,
    reporter: reporters[0],
    daysAgo: 12,
    history: [
      { actor: 'María García López', action: 'CREATED', prev: null, next: 'RECIBIDA', comment: null, h: 0 },
      { actor: 'José Luis (AF)', action: 'ASSIGNED', prev: 'RECIBIDA', next: 'EN_REVISION', comment: 'Electricidad Martínez disponible esta semana', h: 5 },
      { actor: 'Electricidad Martínez', action: 'STATUS_CHANGED', prev: 'EN_REVISION', next: 'EN_CURSO', comment: 'Sustitución de 8 fluorescentes y revisión del cuadro eléctrico del garaje', h: 29 },
      { actor: 'Electricidad Martínez', action: 'COMPLETED', prev: 'EN_CURSO', next: 'RESUELTA', comment: 'Trabajo completado. Todos los fluorescentes sustituidos, cuadro eléctrico revisado y en perfecto estado.', h: 52 },
    ],
  },
  {
    title: 'Portón de acceso principal no cierra',
    description: 'El portón de acceso al garaje no cierra correctamente. Al bajar, queda entreabierto unos 20cm. Puede ser el motor o el sistema de cierre automático. Riesgo de seguridad.',
    category: 'cerrajeria',
    status: 'RESUELTA',
    priority: 'ALTA',
    provider: providers.cerrajeria,
    reporter: reporters[2],
    daysAgo: 18,
    history: [
      { actor: 'Vecino Demo', action: 'CREATED', prev: null, next: 'RECIBIDA', comment: null, h: 0 },
      { actor: 'José Luis (AF)', action: 'ASSIGNED', prev: 'RECIBIDA', next: 'EN_REVISION', comment: 'Cerrajería Rápida: servicio 24h disponible', h: 1 },
      { actor: 'Cerrajería Rápida', action: 'STATUS_CHANGED', prev: 'EN_REVISION', next: 'EN_CURSO', comment: 'En camino. Llegada estimada en 30 minutos.', h: 2 },
      { actor: 'Cerrajería Rápida', action: 'COMPLETED', prev: 'EN_CURSO', next: 'RESUELTA', comment: 'Motor del portón sustituido. Sistema de cierre automático calibrado y funcionando correctamente.', h: 5 },
    ],
  },
  {
    title: 'Pintura deteriorada - Hall y escalera',
    description: 'La pintura del hall de entrada y la escalera principal presenta grandes descascarados y manchas de humedad. Afecta a la imagen general de la comunidad.',
    category: 'otro',
    status: 'EN_REVISION',
    priority: 'BAJA',
    provider: providers.pintura,
    reporter: reporters[1],
    daysAgo: 7,
    history: [
      { actor: 'Carlos Martínez Ruiz', action: 'CREATED', prev: null, next: 'RECIBIDA', comment: null, h: 0 },
      { actor: 'José Luis (AF)', action: 'ASSIGNED', prev: 'RECIBIDA', next: 'EN_REVISION', comment: 'Esperando presupuesto de Pinturas López', h: 48 },
    ],
  },
];

async function main() {
  await client.connect();
  console.log('Connected to Neon DB\n');

  // Clear old demo data
  await client.query(`
    DELETE FROM incident 
    WHERE organization_id = 'org_aconvi_demo' 
    AND reporter_id IN (
      'e3443373-d68e-4be6-960b-8b1effb51ca7',
      '0d4624b5-e012-4959-9dee-897b9f57f430',
      'test-user-jluis-1776971864823'
    )
  `);
  console.log('🗑️  Cleared previous demo incidents\n');

  let created = 0;
  for (const inc of incidents) {
    const base = daysAgo(inc.daysAgo);
    const resolvedAt = inc.status === 'RESUELTA' ? daysAgo(inc.daysAgo - 4) : null;

    const res = await client.query(`
      INSERT INTO incident (title, description, category, status, priority, organization_id, reporter_id, provider_id, resolved_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,'org_aconvi_demo',$6,$7,$8,$9,$9)
      RETURNING id
    `, [inc.title, inc.description, inc.category, inc.status, inc.priority, inc.reporter.id, inc.provider, resolvedAt, base]);

    const id = res.rows[0].id;

    for (const h of inc.history) {
      const ts = new Date(base.getTime() + h.h * 3600000);
      await client.query(`
        INSERT INTO incident_history (incident_id, actor_name, action, previous_status, new_status, comment, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [id, h.actor, h.action, h.prev, h.next, h.comment, ts]);
    }

    console.log(`✅ [${inc.status.padEnd(12)}] ${inc.title}`);
    created++;
  }

  console.log(`\n🎉 Seeded ${created} demo incidents successfully!`);
  await client.end();
}

main().catch(e => { console.error('❌ ERROR:', e.message); process.exit(1); });
