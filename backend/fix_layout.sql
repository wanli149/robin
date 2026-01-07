-- 修复"今日推荐"的 JSON 格式
UPDATE page_modules 
SET api_params = '{"t":1,"sort":"hot","limit":8}' 
WHERE id = 26;

-- 为"国内热播"添加 limit 参数
UPDATE page_modules 
SET api_params = '{"t":1,"area":"大陆","sort":"hits","limit":9}' 
WHERE id = 25;
