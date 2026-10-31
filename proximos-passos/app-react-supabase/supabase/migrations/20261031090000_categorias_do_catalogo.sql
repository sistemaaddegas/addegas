-- Catálogo Addegas: categorias com o nome que a adega vê (o seed gravava a chave interna: cervejas, semalcool...).
update platform.catalog_products set suggested_category = case lower(suggested_category)
    when 'cervejas' then 'Cervejas' when 'destilados' then 'Destilados' when 'energeticos' then 'Energéticos'
    when 'semalcool' then 'Sem álcool' when 'gelo' then 'Gelo e carvão' else suggested_category end
where suggested_category is not null and suggested_category <> initcap(suggested_category) or lower(suggested_category) in ('cervejas', 'destilados', 'energeticos', 'semalcool', 'gelo');
