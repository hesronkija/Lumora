import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { ROLES } from '@lumora/shared-auth';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000002';

export async function seed(knex: Knex): Promise<void> {
  // Disable RLS for seeding
  await knex.raw(`SET LOCAL app.current_tenant_id = '${DEMO_TENANT_ID}'`);

  await knex('tenant').insert({
    id: DEMO_TENANT_ID,
    name: 'Green Valley Primary School',
    kind: 'private',
    registration_no: 'PS/DAR/2024/001',
    subdomain: 'greenvalley',
    active: true,
    config: JSON.stringify({ timezone: 'Africa/Dar_es_Salaam', currency: 'TZS' }),
  }).onConflict('id').ignore();

  await knex('campus').insert({
    id: uuidv4(),
    tenant_id: DEMO_TENANT_ID,
    name: 'Main Campus',
    address_ward: 'Msasani',
    address_district: 'Kinondoni',
    address_region: 'Dar es Salaam',
    is_primary: true,
  }).onConflict('id').ignore();

  // Seed system roles for the demo tenant
  const roleRows = ROLES.map((code) => ({
    id: uuidv4(),
    tenant_id: DEMO_TENANT_ID,
    code,
    name: code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    system_role: true,
  }));

  for (const row of roleRows) {
    await knex('role').insert(row).onConflict(['tenant_id', 'code']).ignore();
  }

  // Demo admin user (Keycloak sub will be linked after Keycloak setup)
  await knex('user').insert({
    id: DEMO_USER_ID,
    tenant_id: DEMO_TENANT_ID,
    email: 'admin@greenvalley.example.com',
    phone: '+255700000001',
    locale: 'en-TZ',
    active: true,
  }).onConflict('id').ignore();

  // Assign owner role
  const ownerRole = await knex('role')
    .where({ tenant_id: DEMO_TENANT_ID, code: 'owner' })
    .first();

  if (ownerRole) {
    await knex('user_role').insert({
      id: uuidv4(),
      tenant_id: DEMO_TENANT_ID,
      user_id: DEMO_USER_ID,
      role_id: ownerRole.id,
      scope_json: JSON.stringify({}),
    }).onConflict(['user_id', 'role_id']).ignore();
  }

  // Demo consent record
  await knex('consent').insert({
    id: uuidv4(),
    tenant_id: DEMO_TENANT_ID,
    subject_ref: DEMO_USER_ID,
    channel: 'sms',
    status: 'opted_in',
    evidence: 'seed',
    consented_at: knex.fn.now(),
  }).onConflict(['tenant_id', 'subject_ref', 'channel']).ignore();
}
