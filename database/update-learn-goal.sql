-- Learning-phase goal now that lessons include Part 2 (deep content ships with the app in dist/deep/).
-- Changes only this one text in the catalog settings; every other setting is kept.
begin;
update public.ru_study_settings set value=jsonb_set(value,'{studyPhases,0,goal}',to_jsonb('อ่านบทเรียนในแอปให้ครบทุกบท (ภาค 1 พื้นฐาน แล้วภาค 2 เจาะตำรา) ควบคู่ตำราและคำบรรยาย RU on Demand ตามวิชาประจำวัน'::text)) where key='config' and value#>>'{studyPhases,0,id}'='learn';
commit;
