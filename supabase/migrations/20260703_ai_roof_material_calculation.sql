-- KI-gestuetzte Dachdecker-Materialberechnung mit pruefpflichtigem Vorschlag.
-- Preise bleiben ueber bestehende RLS/Views fuer Mitarbeiter ausgeblendet.

alter table public.job_material_calculations add column if not exists roof_form text;
alter table public.job_material_calculations add column if not exists material_type text;
alter table public.job_material_calculations add column if not exists dormers_count integer not null default 0;
alter table public.job_material_calculations add column if not exists chimneys_count integer not null default 0;
alter table public.job_material_calculations add column if not exists ai_enabled boolean not null default false;
alter table public.job_material_calculations add column if not exists ai_model text;
alter table public.job_material_calculations add column if not exists ai_confidence numeric(5, 2);
alter table public.job_material_calculations add column if not exists ai_notes text;
alter table public.job_material_calculations add column if not exists review_notice text not null default 'Materialberechnung ist ein Vorschlag und muss fachlich geprueft werden.';

alter table public.job_material_calculation_items add column if not exists missing_quantity numeric(12, 2) not null default 0;
alter table public.job_material_calculation_items add column if not exists source text not null default 'rule';
alter table public.job_material_calculation_items add column if not exists ai_reason text;

alter table public.material_calculation_rules drop constraint if exists material_calculation_rules_calculation_method_check;
alter table public.material_calculation_rules
  add constraint material_calculation_rules_calculation_method_check
  check (
    calculation_method in (
      'area',
      'area_per_spacing',
      'first_length',
      'eaves_length',
      'verge_length',
      'valley_length',
      'wall_connection_length',
      'penetrations_count',
      'roof_windows_count',
      'dormers_count',
      'chimneys_count',
      'gutter_hangers'
    )
  );

alter table public.job_material_calculation_items drop constraint if exists job_material_calculation_items_source_check;
alter table public.job_material_calculation_items
  add constraint job_material_calculation_items_source_check
  check (source in ('rule', 'ai', 'manual'));

alter table public.job_material_calculations drop constraint if exists job_material_calculations_dormers_count_check;
alter table public.job_material_calculations
  add constraint job_material_calculations_dormers_count_check
  check (dormers_count >= 0);

alter table public.job_material_calculations drop constraint if exists job_material_calculations_chimneys_count_check;
alter table public.job_material_calculations
  add constraint job_material_calculations_chimneys_count_check
  check (chimneys_count >= 0);

alter table public.job_material_calculation_items drop constraint if exists job_material_calculation_items_missing_quantity_check;
alter table public.job_material_calculation_items
  add constraint job_material_calculation_items_missing_quantity_check
  check (missing_quantity >= 0);

create index if not exists job_material_calculations_ai_idx
on public.job_material_calculations(company_id, ai_enabled, created_at desc);

with rule_rows (
  rule_key,
  roof_type,
  name,
  material_name,
  unit,
  calculation_method,
  factor,
  spacing_m,
  waste_applies,
  sort_order
) as (
  values
    ('steildach_dachziegel', 'steildach', 'Dachziegel/Pfannen aus Flaeche', 'Tonziegel Doppelmulde naturrot', 'Stueck', 'area', 10.5, null, true, 10),
    ('steildach_unterspannbahn', 'steildach', 'Unterspannbahn aus Dachflaeche', 'Unterspannbahn diffusionsoffen 160 g', 'm2', 'area', 1, null, true, 20),
    ('steildach_konterlatten', 'steildach', 'Konterlatten grob aus Dachflaeche', 'Konterlatte 30 x 50 mm imprraegniert', 'm', 'area', 1.6, null, true, 30),
    ('steildach_dachlatten', 'steildach', 'Dachlatten aus Flaeche und Lattenabstand', 'Dachlatte 30 x 50 mm S10 imprraegniert', 'm', 'area_per_spacing', 1, 0.33, true, 40),
    ('steildach_schrauben_naegel', 'steildach', 'Schrauben/Naegel grob aus Flaeche', 'Dachdecker-Schrauben und Naegel gemischt', 'Stueck', 'area', 8, null, true, 45),
    ('steildach_firstrolle', 'steildach', 'Firstmaterial aus Firstlaenge', 'Firstrolle Aluminium 300 mm', 'm', 'first_length', 1, null, true, 50),
    ('steildach_sturmklammern', 'steildach', 'Sturmklammern grob pro m2', 'Sturmklammer Typ passend Edelstahl', 'Stueck', 'area', 5, null, true, 60),
    ('steildach_traufblech', 'steildach', 'Traufblech aus Trauflaenge', 'Traufblech Zink 200 mm', 'm', 'eaves_length', 1, null, true, 70),
    ('steildach_ortgangblech', 'steildach', 'Ortgangmaterial aus Ortganglaenge', 'Ortgangblech Zink 250 mm', 'm', 'verge_length', 1, null, true, 80),
    ('steildach_kehlblech', 'steildach', 'Kehlblech aus Kehllaenge', 'Kehlblech Zink 500 mm', 'm', 'valley_length', 1, null, true, 90),
    ('steildach_gaubenanschluss', 'steildach', 'Gauben-Anschlussmaterial', 'Anschlussband fuer Gauben und Einfassungen', 'Stueck', 'dormers_count', 1, null, true, 100),
    ('steildach_schornsteinanschluss', 'steildach', 'Schornstein-Anschlussmaterial', 'Schornstein-Anschlussset Blei/Flex', 'Stueck', 'chimneys_count', 1, null, true, 110),

    ('flachdach_dampfsperre', 'flachdach', 'Dampfsperre aus Flaeche', 'Dampfsperrbahn AL G200 S4', 'm2', 'area', 1, null, true, 10),
    ('flachdach_daemmung', 'flachdach', 'Daemmung aus Flaeche', 'PIR Aufsparrendaemmung 120 mm Nut und Feder', 'm2', 'area', 1, null, true, 20),
    ('flachdach_unterlage', 'flachdach', 'Schweissbahn Unterlage aus Flaeche', 'Bitumenbahn V60 S4 talkumiert', 'm2', 'area', 1, null, true, 30),
    ('flachdach_oberlage', 'flachdach', 'Schweissbahn Oberlage aus Flaeche', 'Polymerbitumenbahn PYE PV200 S5 beschiefert', 'm2', 'area', 1, null, true, 40),
    ('flachdach_voranstrich', 'flachdach', 'Voranstrich 0,3 l pro m2', 'Bitumenvoranstrich 10 Liter', 'Liter', 'area', 0.3, null, true, 50),
    ('flachdach_fluessigkunststoff', 'flachdach', 'Fluessigkunststoff grob pro m2', 'Fluessigkunststoff Abdichtung grau 5 kg', 'kg', 'area', 0.5, null, true, 60),
    ('flachdach_dachablauf', 'flachdach', 'Dachablaeufe aus Durchdringungen', 'Dachablauf senkrecht DN 100', 'Stueck', 'penetrations_count', 1, null, false, 70),
    ('flachdach_attikaabdeckung', 'flachdach', 'Attikaabdeckung aus Wandanschlusslaenge', 'Attikaabdeckung Aluminium 500 mm', 'm', 'wall_connection_length', 1, null, true, 90),

    ('entwaesserung_dachrinne', 'entwaesserung', 'Dachrinne aus Trauflaenge', 'Dachrinne halbrund RG 333 Zink', 'm', 'eaves_length', 1, null, true, 10),
    ('entwaesserung_rinnenhalter', 'entwaesserung', 'Rinnenhalter alle 60 cm', 'Rinnenhalter RG 333 verzinkt lang', 'Stueck', 'gutter_hangers', 1, 0.6, true, 20),
    ('entwaesserung_fallrohr', 'entwaesserung', 'Fallrohr aus Wand-/Fallrohrlaenge', 'Fallrohr DN 100 Zink', 'm', 'wall_connection_length', 1, null, true, 30),
    ('entwaesserung_rohrschellen', 'entwaesserung', 'Rohrschellen pro Meter', 'Rohrschelle DN 100 Zink mit Schlagstift', 'Stueck', 'wall_connection_length', 1, null, true, 40),

    ('blech_traufblech', 'blech', 'Traufblech aus Laenge', 'Traufblech Zink 200 mm', 'm', 'eaves_length', 1, null, true, 10),
    ('blech_kehlblech', 'blech', 'Kehlblech aus Laenge', 'Kehlblech Zink 500 mm', 'm', 'valley_length', 1, null, true, 20),
    ('blech_wandanschlussprofil', 'blech', 'Wandanschlussprofil aus Laenge', 'Wandanschlussprofil Aluminium', 'm', 'wall_connection_length', 1, null, true, 30),
    ('blech_kappleiste', 'blech', 'Kappleiste aus Laenge', 'Kappleiste Aluminium gelocht', 'm', 'wall_connection_length', 1, null, true, 40),

    ('reparatur_unterspannbahn', 'reparatur', 'Unterspannbahn Reparaturflaeche', 'Unterspannbahn diffusionsoffen 160 g', 'm2', 'area', 1, null, true, 10),
    ('reparatur_ersatzpfanne', 'reparatur', 'Ersatzpfannen grob pro m2', 'Ersatzpfanne universal Kunststoff', 'Stueck', 'area', 4, null, true, 20),
    ('reparatur_dichtstoff', 'reparatur', 'Dichtstoff fuer Anschluesse', 'PU Dichtstoff grau Kartusche', 'Stueck', 'wall_connection_length', 0.2, null, true, 30)
)
insert into public.material_calculation_rules (
  company_id,
  rule_key,
  roof_type,
  name,
  material_name,
  catalog_item_id,
  unit,
  calculation_method,
  factor,
  spacing_m,
  waste_applies,
  sort_order
)
select
  null,
  r.rule_key,
  r.roof_type,
  r.name,
  r.material_name,
  mc.id,
  r.unit,
  r.calculation_method,
  r.factor,
  r.spacing_m,
  r.waste_applies,
  r.sort_order
from rule_rows r
left join public.material_catalog mc on mc.name = r.material_name
on conflict (rule_key) where company_id is null do update set
  roof_type = excluded.roof_type,
  name = excluded.name,
  material_name = excluded.material_name,
  catalog_item_id = excluded.catalog_item_id,
  unit = excluded.unit,
  calculation_method = excluded.calculation_method,
  factor = excluded.factor,
  spacing_m = excluded.spacing_m,
  waste_applies = excluded.waste_applies,
  sort_order = excluded.sort_order,
  active = true;

create or replace view public.job_material_calculation_items_public as
select
  item.id,
  item.company_id,
  item.calculation_id,
  item.jobsite_id,
  item.rule_id,
  item.catalog_item_id,
  item.inventory_item_id,
  item.material_name,
  item.unit,
  item.base_quantity,
  item.waste_percent,
  item.waste_quantity,
  item.total_quantity,
  item.location_name,
  item.stock,
  item.minimum_stock,
  item.created_at,
  item.updated_at,
  item.missing_quantity,
  item.source,
  item.ai_reason
from public.job_material_calculation_items item
join public.job_material_calculations calculation on calculation.id = item.calculation_id
join public.jobsites jobsite on jobsite.id = item.jobsite_id
where item.company_id = public.current_company_id()
  and (
    public.can_manage_company()
    or auth.uid() = any(jobsite.assigned_employee_ids)
  );

grant select on public.job_material_calculation_items_public to authenticated;

select pg_notify('pgrst', 'reload schema');
