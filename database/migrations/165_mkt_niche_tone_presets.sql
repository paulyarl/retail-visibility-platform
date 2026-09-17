-- ============================================================
-- Migration 165: Marketing Ops — Business Niche Tone Presets
-- ============================================================
-- Description:
--   Prepopulates mkt_category_tone_presets_list with business
--   niches so the Prompt Library "Tone" field can be used to
--   organize prompt templates by niche.
--
--   Each niche is stored as a preset row where:
--     - category = lowercased niche slug (e.g. 'hvac contractor')
--     - tone     = niche display name  (e.g. 'HVAC Contractor')
--
--   The Prompt Library tone dropdown reads available tones from
--   presets, so these niches become selectable tone values.
--
-- Prerequisite: 132_marketing_ops_category_tone.sql applied
-- Date: 2026-08-04
-- ============================================================

INSERT INTO mkt_category_tone_presets_list (id, category, tone, description)
VALUES
  ('mctp-niche-hvac',              'hvac contractor',           'HVAC Contractor',           'Heating, ventilation, and air conditioning contractors.'),
  ('mctp-niche-roofing',           'roofing contractor',        'Roofing Contractor',        'Roofing installation, repair, and inspection contractors.'),
  ('mctp-niche-dentist',           'dentist',                   'Dentist',                   'Dental practices and clinics.'),
  ('mctp-niche-plumber',           'plumber',                   'Plumber',                   'Plumbing services and contractors.'),
  ('mctp-niche-moving',            'moving company',            'Moving Company',            'Local and long-distance moving services.'),
  ('mctp-niche-tree-service',      'tree service',              'Tree Service',              'Tree removal, trimming, and arborist services.'),
  ('mctp-niche-med-spa',           'med spa',                   'Med Spa',                   'Medical spas and aesthetic wellness clinics.'),
  ('mctp-niche-auto-repair',       'auto repair shop',          'Auto Repair Shop',          'Automotive repair and maintenance shops.'),
  ('mctp-niche-pest-control',      'pest control',              'Pest Control',              'Pest and wildlife control services.'),
  ('mctp-niche-garage-door',       'garage door repair',        'Garage Door Repair',        'Garage door installation and repair services.'),
  ('mctp-niche-electrician',       'electrician',               'Electricians',              'Licensed electrical contractors and services.'),
  ('mctp-niche-landscaping',       'landscaping / lawn care',   'Landscaping / Lawn Care',   'Landscaping, lawn care, and grounds maintenance.'),
  ('mctp-niche-veterinarian',      'veterinarian',              'Veterinarian',              'Veterinary clinics and animal hospitals.'),
  ('mctp-niche-chiropractor',      'chiropractor',              'Chiropractor',              'Chiropractic care and spinal health clinics.'),
  ('mctp-niche-auto-detailing',    'auto detailing',            'Auto Detailing',            'Vehicle detailing and reconditioning services.'),
  ('mctp-niche-towing',            'towing company',            'Towing Company',            'Towing and roadside assistance services.'),
  ('mctp-niche-physical-therapy',  'physical therapy',          'Physical Therapy',          'Physical therapy and rehabilitation clinics.'),
  ('mctp-niche-gyms-fitness',      'gyms & fitness studio',     'Gyms & Fitness Studio',     'Gyms, fitness studios, and personal training.'),
  ('mctp-niche-law-firm',          'law firm',                  'Law Firm',                  'Law firms and attorney practices.'),
  ('mctp-niche-wedding-venue',     'wedding venue',             'Wedding Venue',             'Wedding and event venues.'),
  ('mctp-niche-photographer',      'photographer',              'Photographer',              'Professional photography services.'),
  ('mctp-niche-real-estate',       'real estate',               'Real Estate',               'Real estate agencies and agents.'),
  ('mctp-niche-apartment',         'apartment',                 'Apartment',                 'Apartment complexes and multifamily housing.'),
  ('mctp-niche-restaurants',       'restaurants',               'Restaurants',               'Restaurants, cafes, and eateries.'),
  ('mctp-niche-hair-salon',        'hair salon & barbershop',   'Hair Salon & Barbershop',   'Hair salons and barbershops.'),
  ('mctp-niche-african-grocery',   'african grocery',           'African Grocery',           'African and international grocery stores.'),
  ('mctp-niche-beauty-supply',     'beauty supply',             'Beauty Supply',             'Beauty supply stores and retailers.')
ON CONFLICT (category, tone) DO NOTHING;
