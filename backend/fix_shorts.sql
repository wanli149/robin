UPDATE page_modules 
SET api_params = '{"wd":"短剧","limit":20}' 
WHERE tab_id='shorts' AND module_type='waterfall';
