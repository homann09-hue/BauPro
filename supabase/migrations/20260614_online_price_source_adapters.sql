-- BauPro migration: erlaubte Online-Preisquellen fuer neue Adapter erweitern.

alter table public.online_price_offers
drop constraint if exists online_price_offers_source_key_check;

alter table public.online_price_offers
add constraint online_price_offers_source_key_check
check (
  source_key in (
    'idealo',
    'geizhals',
    'ebay',
    'amazon',
    'contorion',
    'toolineo',
    'custom_feed',
    'priceapi',
    'dataforseo_google_shopping',
    'searchapi_google_shopping',
    'wuerth_catalog_csv',
    'manual_csv',
    'market_reference'
  )
);

select pg_notify('pgrst', 'reload schema');
