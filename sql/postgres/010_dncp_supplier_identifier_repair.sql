insert into centinela.entity_identifiers (entity_id, scheme, value, is_primary)
select
  profiles.entity_id,
  'DNCP-SUPPLIER-CODE',
  upper(profiles.attributes ->> 'ruc'),
  true
from centinela.entity_local_profiles as profiles
where profiles.source_key = 'py-dncp-supplier-anchor'
  and profiles.profile_kind = 'dncp_supplier_registry'
  and profiles.attributes ->> 'ruc' ~* '^DNCP-[0-9]+$'
on conflict (scheme, value)
do update
set
  entity_id = excluded.entity_id,
  is_primary = excluded.is_primary;

delete from centinela.entity_identifiers
where scheme = 'PY-RUC-PLAIN'
  and value ~* '^DNCP-[0-9]+$';

update centinela.entity_local_profiles
set attributes =
  jsonb_set(
    jsonb_set(
      attributes - 'ruc',
      '{registryIdentifier}',
      to_jsonb(upper(attributes ->> 'ruc')),
      true
    ),
    '{registryIdentifierScheme}',
    '"DNCP-SUPPLIER-CODE"'::jsonb,
    true
  )
where source_key = 'py-dncp-supplier-anchor'
  and profile_kind = 'dncp_supplier_registry'
  and attributes ->> 'ruc' ~* '^DNCP-[0-9]+$';

update centinela.entity_source_mentions
set attributes =
  jsonb_set(
    jsonb_set(
      attributes - 'ruc',
      '{registryIdentifier}',
      to_jsonb(upper(attributes ->> 'ruc')),
      true
    ),
    '{registryIdentifierScheme}',
    '"DNCP-SUPPLIER-CODE"'::jsonb,
    true
  )
where source_key = 'py-dncp-supplier-anchor'
  and role = 'supplier_registry'
  and attributes ->> 'ruc' ~* '^DNCP-[0-9]+$';

update centinela.entity_relationships
set attributes =
  jsonb_set(
    jsonb_set(
      attributes - 'providerRuc',
      '{providerRegistryIdentifier}',
      to_jsonb(upper(attributes ->> 'providerRuc')),
      true
    ),
    '{providerRegistryIdentifierScheme}',
    '"DNCP-SUPPLIER-CODE"'::jsonb,
    true
  )
where source_key = 'py-dncp-supplier-anchor'
  and relation_type = 'representation_legal'
  and attributes ->> 'providerRuc' ~* '^DNCP-[0-9]+$';
