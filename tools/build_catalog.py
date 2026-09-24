# Generates ../catalog.js from the tables below.
# Sources: L21 U.S. Price List (Mar 2026, exact price/CPO/points, tools/l21_2026.json), Cutco Orders app screenshots, CGP Gifting Price List (Aug 2026: gift price, CPO, points),
# Auxiliary Price List (Mar 2026), and the 2019 L21 list (used only for CPO/point RATIOS where 2026 numbers are unknown).
# Row: (base, name, cat, retail, cpo, pts, gift, colors, flags, ref19)
#   cpo/pts None -> estimated from ref19 ratios (or default ratio); retail None -> estimated from gift price.
#   colors: 'CWR' 'CW' 'C' '' ; flags: ch=cherry option, D/SH/B/-1 = item# suffix, mat, out:BK,H,.. outdoor colors, na=not in app
import json, re, datetime
R = []
def add(cat, rows):
    for r in rows: R.append((cat,) + tuple(r))

# base,name,retail,cpo,pts,gift,colors,flags,ref19
add('sets', [
 ('2024','Limited-Edition Grand Culinary Set',1819,1637,None,None,'CWR','ch wps=2100',(1819,1637,1255)),  # value + CPO from Carlo, Sep 2026; points estimated
 ('2018','Homemaker + 8 Set with Block w/ Petite Chef',1715,1544,1190,1659,'CWR','ch',None),
 ('1818','Homemaker + 8 Set with Block w/ French Chef',None,1558,1210,1674,'CW','ch',None),
 ('2001','Homemaker Set with Block w/ Petite Chef',None,1213,925,1287,'CWR','ch',None),
 ('1801','Homemaker Set with Block w/ French Chef',None,1227,945,1302,'CW','ch',None),
 ('2000','Homemaker Set with Trays w/ Petite Chef',None,1112,815,1172,'CWR','',None),
 ('1800','Homemaker Set with Trays w/ French Chef',None,1125,835,1187,'CW','',None),
 ('2008','Galley + 6 Set with Block',1236,1120,840,1180,'CWR','ch',None),
 ('2007','Galley Set with Block',None,852,645,889,'CWR','ch',None),
 ('1945','Essentials + 5 Set with Block',963,856,630,907,'CWR','ch',None),
 ('1845','Essentials Set with Block',None,638,465,655,'CWR','ch',None),
 ('1810','Studio + 4 Set with Block',769,672,500,731,'CWR','ch',None),
 ('1809','Studio Set with Block',None,500,370,529,'CWR','ch',None),
 ('1847','Space Saver Set with Block',788,698,520,732,'CW','ch',None),
 ('2085','All Knife Set with Tray',676,590,435,620,'CWR','',None),
 ('1783','Kitchenette Set with Tray',559,491,360,521,'CWR','',None),
 ('1805','Gourmet Set with Santoku with Block',1072,988,770,1016,'CW','ch',None),
 ('1813','Ultimate Set with Block (Table Knives)',3519,3286,2615,3463,'CW','ch',None),
 ('6813','Ultimate Set with Block (Steak Knives)',None,3668,3040,3882,'CW','ch',None),
 ('1814','Signature Set with Block (Table Knives)',2565,2319,1875,2509,'CWR','ch',None),
 ('6814','Signature Set with Block (Steak Knives)',None,2633,2225,2866,'CWR','ch',None),
 ('2014','Santoku-Style Signature Set with Block (Table Knives)',2576,2331,1885,2520,'CW','ch',None),
 ('6014','Santoku-Style Signature Set with Block (Steak Knives)',None,2656,2235,2877,'CW','ch',None),
])
add('bblock', [
 ('1813','Ultimate Set B-Block (w/ Table or Steak Knife Slots)',2957,2760,2230,2901,'CWR','ch B',None),
 ('1814','Signature Set B-Block (w/ Table or Steak Knife Slots)',2089,1872,1550,2033,'CW','ch B',None),
 ('2014','Santoku-Style Signature Set B-Block (w/ Table or Steak Knife Slots)',2100,1894,1560,2044,'CWR','ch B',None),
 ('2001','Homemaker Set B-Block w/ Petite Chef (w/ Table Knife Slots)',1343,1213,935,1287,'CWR','ch B',None),
 ('1801','Homemaker Set B-Block w/ French Chef (w/ Table Knife Slots)',None,1227,950,1302,'CW','ch B',None),
 ('2007','Galley Set B-Block (w/ Table Knife Slots)',945,852,645,889,'CW','ch B',None),
 ('1845','Essentials Set B-Block (w/ Table Knife Slots)',711,638,465,655,'CWR','ch B',None),
 ('1809','Studio Set B-Block (w/ Table Knife Slots)',567,500,370,529,'CWR','ch B',None),
])
add('upgrade', [
 ('4824','Galley Upgrade (Galley + 6 Table Knives with Homemaker Block)',1246,1120,850,1190,'CWR','ch',None),
 ('4828','Homemaker Upgrade (Homemaker + 8 Table Knives with Signature Block)',1894,1702,1355,1838,'CWR','ch',None),
 ('4830','Signature Upgrade (Signature + 10 Table Knives with Ultimate Block)',2648,2379,1925,2592,'CWR','ch',None),
 ('4820','Galley + 6 Table Knives with Ultimate Block Upgrade',None,1361,1070,1459,'CWR','ch',None),
 ('4821','Galley + 6 Steak Knives with Ultimate Block Upgrade',None,1542,1280,1663,'CWR','ch',None),
 ('4822','Galley + 6 Table Knives with Signature Block Upgrade',None,1283,1015,1373,'CWR','ch',None),
 ('4823','Galley + 6 Steak Knives with Signature Block Upgrade',None,1464,1225,1578,'CWR','ch',None),
 ('4826','Homemaker + 8 Table Knives with Ultimate Block',None,1777,1410,1922,'CWR','ch',None),
 ('4827','Homemaker + 8 Steak Knives with Ultimate Block',None,2023,1690,2200,'CWR','ch',None),
 ('4829','Homemaker + 8 Steak Knives with Signature Block',None,1948,1635,2116,'CWR','ch',None),
 ('4831','Signature + 10 Steak Knives with Ultimate Block',None,2680,2275,2931,'CWR','ch',None),
])
add('homemaker', [
 ('1720','2-3/4" Paring Knife',85,None,None,None,'CWR','',(67,59,40)),
 ('1721','Trimmer',98,82,55,82,'CWR','',None),
 ('1768','Spatula Spreader',97,81,55,81,'CWR','',None),
 ('1729','6-3/4" Petite Carver',142,None,None,None,'CWR','',(110,99,60)),
 ('1726','Turning Fork',75,None,None,None,'CWR','',(58,49,35)),
 ('1722','Butcher Knife',169,None,None,None,'CWR','',(131,116,75)),
 ('1728','7-5/8" Petite Chef',183,None,None,None,'CWR','',(142,128,80)),
 ('1724','9-3/4" Slicer',150,None,None,None,'CWR','',(118,105,70)),
 ('1723','9" Carver',149,None,None,None,'CWR','',(117,103,65)),
 ('1727','Carving Fork',77,None,None,None,'CWR','',(60,51,40)),
 ('1759','Table Knife',56,None,None,None,'CWR','',(43,37,25)),
])
add('tablesets', [
 ('1865','4-Pc. Table Knife Set in Gift Box',230,192,145,203,'CWR','',None),
 ('2065','4-Pc. Steak Knife Set in Gift Box',398,344,290,355,'CWR','',None),
 ('1864','4-Pc. Table Knife Set with Tray',238,199,140,199,'CWR','',None),
 ('1982','4-Pc. Stainless Table Knife Set in Gift Box',318,284,265,295,'','',None),
 ('1869','6-Pc. Table Knife Set in Gift Box',342,288,215,299,'CWR','',None),
 ('1987','6-Pc. Stainless Table Knife Set in Gift Box',474,426,390,437,'','',None),
 ('1860','6-Pc. Table Knife Set with Oak Block',453,409,290,409,'CWR','ch',None),
 ('1866','8-Pc. Table Knife Set in Gift Box',454,384,280,395,'CWR','',None),
 ('1983','8-Pc. Stainless Table Knife Set in Gift Box',630,568,515,579,'','',None),
 ('1863','8-Pc. Table Knife Set with Oak Block',560,500,355,522,'CWR','ch',None),
 ('1867','12-Pc. Table Knife Set in Gift Box',678,576,410,587,'CWR','',None),
 ('1988','12-Pc. Stainless Table Knife Set in Gift Box',942,852,770,863,'','',None),
])
add('giftsets', [
 ('1858','Cheese Knife Combo',229,199,170,210,'CW','D',None),
 ('1822','Club Mates',201,163,140,174,'CWR','D',None),
 ('1853',"Cook's Combo",287,248,195,259,'CWR','D',None),
 ('1849','Culinary Companions',287,247,200,258,'CWR','D',None),
 ('1821','Deli Mates',188,157,140,168,'CWR','D',None),
 ('1838','Entertainer Pack',295,243,215,254,'','',None),
 ('1827','Kitchen Classics',372,324,245,335,'CWR','D',None),
 ('1837','Party Favorites',148,118,125,129,'CWR','D',None),
 ('1837','Party Favorites for Left-Handers',148,118,125,129,'CWR','DLH',None),
 ('1829','Party Pack',136,110,120,121,'C','D',None),
 ('1842','Party Starters',215,184,160,195,'CW','D',None),
 ('1828',"Peel n' Pare Pack",154,126,125,137,'CW','D',None),
 ('2060','Prep & Party Set',208,175,155,186,'CW','D',None),
 ('1820','Salad Mates',189,158,140,169,'CWR','D',None),
 ('1859','Santoku Classics',389,337,265,348,'CW','D',None),
 ('1836',"Santoku-Style Cook's Combo in Deluxe Gift Box",294,255,210,266,'CWR','D',None),
 ('1850','2-Pc. Santoku Set',354,313,230,324,'CWR','D',None),
 ('1855','Dessert Favorites',143,113,115,124,'CWR','D',None),
 ('3822','Santoku-Style Club Mates Set',207,170,150,181,'CWR','D',None),
 ('3849','Petite Culinary Companions',267,228,175,239,'CWR','D',None),
 ('3828','Petite Prep Set',288,252,195,263,'CWR','D',None),
 ('3836',"Petite Santoku-Style Cook's Combo",274,236,185,247,'CWR','D',None),
 ('3852','Santoku-Style Shear Utility Set',259,226,195,237,'CWR','D',None),
 ('3827','Time Saver Set',221,186,160,197,'CWR','D',None),
 ('3826','Welcome Home Set',228,194,170,205,'CWR','D',None),
 ('3908','Shear Entertainer Set',273,242,210,253,'CWR','D',None),
 ('3909','Shear Prep Set',319,284,225,295,'CWR','D',None),
 ('1844',"Carver's Choice Set",None,211,170,222,'CWR','D',None),
 ('1834','Carving Set',None,198,170,209,'CWR','D',None),
 ('1851','Shear Favorites',None,218,190,229,'CWR','D',None),
 ('1852','Shear Utility Set',None,219,190,230,'CWR','D',None),
 ('2130','Wine & Cheese Set',None,162,155,173,'CWR','D',None),
 ('1854',"Bake n' Serve Set (regular Gift Box)",None,199,135,199,'CWR','',None),
 ('1854',"Bake n' Serve Set for Left-Handers (regular Gift Box)",232,199,135,199,'CWR','LH',None),
 ('1831','Snack Pack',None,239,185,250,'CWR','',None),
 # single items in gift box
 ('677','Super Shears in Gift Box',155,137,135,148,'CWR','D',None),
 ('6768','Spatula Spreader in Gift Box',103,81,85,92,'CWR','D',None),
 ('6721','Santoku-Style Trimmer in Gift Box',110,89,95,100,'CWR','D',None),
 ('6738','Hardy Slicer in Gift Box',197,172,150,183,'CWR','D',None),
 ('6766','7" Santoku in Gift Box',190,166,140,177,'CWR','D',None),
 ('6166','5" Petite Santoku in Gift Box',170,147,120,158,'CWR','D',None),
 ('6135','6" Vegetable Knife in Gift Box',180,158,120,169,'CWR','D',None),
 ('6754',"Slice n' Serve in Gift Box",87,70,85,81,'CWR','D',None),
 ('6754',"Slice n' Serve for Left-Handers in Gift Box",87,70,85,81,'CWR','DLH',None),
 ('6755',"Turn n' Serve in Gift Box",82,65,75,76,'CWR','D',None),
 ('6728','7-5/8" Petite Chef in Gift Box',189,166,135,177,'CWR','D',None),
 ('6735','7-1/2" Vegetable Knife in Gift Box',207,181,150,192,'CWR','D',None),
 ('6729','6-3/4" Petite Carver in Gift Box',148,129,105,140,'CWR','D',None),
 ('6121','Trimmer in Gift Box',104,82,85,93,'CWR','D',None),
 ('6159','Steak Knife in Gift Box',104,86,96,97,'CWR','D',None),
 ('6761','Boning Knife in Gift Box',138,117,105,128,'CW','D',None),
 ('6124','7-3/4" Petite Slicer in Gift Box',152,131,115,142,'CW','D',None),
 ('6138','Gourmet Prep Knife in Gift Box',197,172,150,183,'CW','D',None),
 ('6764','Traditional Cheese Knife in Gift Box',None,105,105,116,'CWR','D',None),
])
add('sheath', [
 ('2031','3-Pc. Knife & Sheath Set',381,None,None,None,'CW','',(313,277,185)),
 ('2033','4-Pc. Knife & Sheath Set',484,None,None,None,'CW','',(397,349,235)),
 ('2035','5-Pc. Knife & Sheath Set',695,None,None,None,'CW','',(575,511,350)),
 ('1720','2-3/4" Paring Knife with Sheath',97,None,None,None,'CWR','SH',None),
 ('2120','4" Paring Knife with Sheath',103,None,None,None,'CW','SH',None),
 ('1721','Trimmer with Sheath',110,None,None,None,'CWR','SH',None),
 ('3721','Santoku-Style Trimmer with Sheath',116,None,None,None,'CWR','SH',None),
 ('2159','Steak Knife with Sheath',110,None,None,None,'CWR','SH',None),
 ('1759','Traditional Table Knife with Sheath',68,None,None,None,'CWR','SH',None),
 ('1768','Spatula Spreader with Sheath',110,None,None,None,'CWR','SH',None),
 ('1764','Traditional Cheese Knife with Sheath',131,None,None,None,'CWR','SH',None),
 ('2166','5" Petite Santoku with Sheath',177,None,None,None,'CWR','SH',None),
 ('1729','6-3/4" Petite Carver with Sheath',155,None,None,None,'CWR','SH',None),
 ('1723','9" Carver with Sheath',162,None,None,None,'CWR','SH',None),
 ('2124','7-3/4" Petite Slicer with Sheath',159,None,None,None,'CW','SH',None),
 ('1724','9-3/4" Slicer with Sheath',163,None,None,None,'CWR','SH',None),
 ('1762','Salmon Knife with Sheath',162,None,None,None,'CW','SH',None),
 ('1728','7-5/8" Petite Chef with Sheath',197,None,None,None,'CWR','SH',None),
 ('1725','9-1/4" French Chef with Sheath',214,None,None,None,'CW','SH',None),
 ('1766','7" Santoku with Sheath',198,None,None,None,'CWR','SH',None),
 ('3738','Hardy Slicer with Sheath',205,None,None,None,'CWR','SH',None),
 ('1738','Gourmet Prep Knife with Sheath',205,None,None,None,'CW','SH',None),
 ('4135','4" Vegetable Knife with Sheath',166,None,None,None,'CWR','SH',None),
 ('2135','6" Vegetable Knife with Sheath',188,None,None,None,'CWR','SH',None),
 ('1735','7-1/2" Vegetable Knife with Sheath',215,None,None,None,'CWR','SH',None),
 ('1737','Cleaver With Sheath',275,246,190,246,'CW','',None),
])
add('tools', [
 ('1718','5-Pc. Kitchen Tool Set with Holder',354,None,None,None,'CWR','ch',(265,235,150)),
 ('1719','5-Pc. Kitchen Tool Set (Tools Only)',290,None,None,None,'CWR','',(227,198,110)),
 ('1792','6-Pc. Kitchen Tool Set with Holder',425,None,None,None,'CW','ch',(299,269,190)),
 ('1793','6-Pc. Kitchen Tool Set (Tools Only)',362,None,None,None,'CW','',(266,236,150)),
 ('1712','Basting Spoon',66,None,None,None,'CWR','',(51,43,25)),
 ('1715','Ladle',66,None,None,None,'CWR','',(51,43,30)),
 ('1714','Mix-Stir',66,None,None,None,'CWR','',(51,43,20)),
 ('1713','Slotted Spoon',66,None,None,None,'CWR','',(51,43,25)),
 ('1716','Slotted Turner',66,None,None,None,'CWR','',(51,43,30)),
 ('1160','Potato Masher',81,None,None,None,'CW','',(64,56,40)),
])
add('specialty', [
 ('3738','Hardy Slicer',191,172,120,172,'CWR','',None),
 ('1766','7" Santoku',184,166,110,166,'CWR','',None),
 ('2166','5" Petite Santoku',164,147,90,147,'CWR','',None),
 ('1735','7-1/2" Vegetable Knife',201,181,120,181,'CWR','',None),
 ('2135','6" Vegetable Knife',174,158,90,158,'CWR','',None),
 ('4135','4" Vegetable Knife',153,139,75,139,'CWR','',None),
 ('1738','Gourmet Prep Knife',191,None,None,None,'CW','',(149,134,90)),
 ('1725','9-1/4" French Chef',200,182,125,182,'CW','',None),
 ('1762','Salmon Knife',149,None,None,None,'CW','',(117,104,70)),
 ('2124','7-3/4" Petite Slicer',146,None,None,None,'CW','',(114,101,65)),
 ('1761','Boning Knife',132,None,None,None,'CW','',(103,92,60)),
 ('2159','Steak Knife',98,None,None,None,'CWR','',(75,68,50)),
 ('2120','4" Paring Knife',91,None,None,None,'CW','',(69,61,45)),
 ('3120',"Bird's Beak Paring Knife",91,None,None,None,'CW','',(69,60,45)),
 ('3724','Santoku-Style 10" Slicer',162,None,None,None,'CW','',(125,112,75)),
 ('3729','Santoku-Style 8" Carver',150,None,None,None,'CW','',(118,105,70)),
 ('3721','Santoku-Style Trimmer',104,89,65,89,'CWR','',None),
 ('3720','Santoku-Style 3" Paring Knife',95,None,None,None,'CW','',(74,65,45)),
 ('1764','Traditional Cheese Knife',118,105,75,105,'CWR','',None),
 ('2164','Mini Cheese Knife',105,None,None,None,'CW','',(82,72,55)),
 ('3764','Santoku-Style Cheese Knife',105,None,None,None,'CW','',(82,72,55)),
 ('4120','3" Gourmet Paring Knife',85,None,None,None,'CW','',(67,59,40)),
 ('4720','4" Gourmet Paring Knife',91,None,None,None,'CW','',(70,62,45)),
 ('1737','Cleaver Only',269,237,180,None,'CW','-1',None),
])
add('cookware', [
 ('9922','Accomplished Chef Cookware Set',3423,None,None,None,'CW','',None),
 ('9918','Dedicated Chef Cookware Set',2542,None,None,None,'CW','',None),
 ('1161','Food Press',92,82,60,None,'CW','',None),
 ('9901','Aspiring Chef Cookware Set',1617,None,None,None,'','',None),
 ('277',"Bar Keepers Friend Cleanser",5,None,None,None,'','',None),
 ('278','Handle Mitt',9,None,None,None,'','',None),
 ('287','Cooking Guide',5,None,None,None,'','',None),
 ('938','8" Gourmet Fry Pan',267,None,None,None,'','',None),
 ('930','10" Gourmet Fry Pan',306,None,None,None,'','',None),
 ('932','12" Gourmet Fry Pan',345,None,None,None,'','',None),
 ('931','Griddle',347,None,None,None,'','',None),
 ('936','10 Qt Stock Pot & Cover',792,None,None,None,'','',None),
 ('939','Wok & Cover',800,None,None,None,'','',None),
 ('991','1 Qt Sauce Pan & Cover',359,None,None,None,'','',None),
 ('992','2 Qt Sauce Pan & Cover',396,None,None,None,'','',None),
 ('993','3 Qt Sauce Pan & Cover',432,None,None,None,'','',None),
 ('998','9" Utility Pan & Cover',406,None,None,None,'','',None),
 ('990','11-1/2" Skillet & Cover',600,None,None,None,'','',None),
 ('990P','11-1/2" Skillet (only)',425,None,None,None,'','',None),
 ('990C','Cover - 6.3 Qt. Dutch Oven / Skillet',191,None,None,None,'','',None),
 ('994','4 Qt. Dutch Oven & Cover',471,None,None,None,'','',None),
 ('995','6.3 Qt Dutch Oven Bottom',430,None,None,None,'','',None),
 ('996','High Dome Cover - Dutch Oven/Skillet',273,None,None,None,'','',None),
 ('997','Steamer Insert (fits 3 Qt)',222,None,None,None,'','',None),
 ('999','Double Boiler Insert (fits 3 Qt)',142,None,None,None,'','',None),
 ('858','8" Nonstick Fry Pan',175,None,None,None,'','',None),
 ('850','10" Nonstick Fry Pan',198,None,None,None,'','',None),
 ('852','12" Nonstick Fry Pan',231,None,None,None,'','',None),
 ('860','3-Pc. Nonstick Pan Set',574,None,None,None,'','',None),
])
add('flatware', [
 ('1984','12 5-Pc. Stainless Place Settings w/FREE Storage Chest',1881,1379,1900,1814,'','',None),
 ('1947','5-Pc. Stainless Place Setting with Table Knife',211,191,155,191,'','',None),
 ('1946','4-Pc. Stainless Place Setting',156,136,90,136,'','',None),
 ('1970','6-Pc. Stainless Accessory Set',361,338,200,338,'','',None),
 ('1972','3-Pc. Stainless Serving Set',181,169,105,169,'','',None),
 ('1971','3-Pc. Stainless Hostess Set',181,169,100,169,'','',None),
 ('1959','Individual Stainless Table Knife',78,71,62,71,'','',None),
 ('1950','Individual Stainless Dinner Fork',39,34,25,None,'','',None),
 ('1951','Individual Stainless Teaspoon',39,34,20,None,'','',None),
 ('1952','Individual Stainless Salad Fork',39,34,20,None,'','',None),
 ('1953','Individual Stainless Soup Spoon',39,34,20,None,'','',None),
 ('1960','Stainless Serving Spoon',67,63,35,None,'','',None),
 ('1961','Stainless Slotted Serving Spoon',67,63,35,None,'','',None),
 ('1962','Stainless Serving Fork',67,63,50,None,'','',None),
 ('1963','Stainless Gravy Ladle',67,63,45,None,'','',None),
 ('1964','Stainless Sugar Spoon',56,52,20,None,'','',None),
 ('1965','Stainless Butter Knife',56,52,20,None,'','',None),
])
add('gadgets', [
 ('1506','Can Opener',73,None,None,None,'','',(61,51,40)),
 ('1504','Cheese Knife (soft grip)',98,None,None,None,'','',(76,67,50)),
 ('1503','Ice Cream Scoop',61,None,None,None,'','',(51,39,40)),
 ('1502','Pizza Cutter',73,63,50,63,'','',None),
 ('1501','Vegetable Peeler',57,None,None,None,'','',(44,36,25)),
 ('1507','Wine Opener',67,57,45,57,'','',None),
])
add('access', [
 ('77','Super Shears',149,137,105,137,'CWR','',None),
 ('79','Shears Holster',5,None,None,None,'CW','',(4,3,2)),
 ('84','Knife Sharpener',68,None,None,None,'','',(53,45,30)),
 ('1709','Barbecue Set (Classic only)',239,None,None,None,'','',(184,160,100)),
 ('124','Small Cutting Board',35,None,None,None,'','',(27,21,10)),
 ('125','Medium Cutting Board',38,None,None,None,'','',(30,24,10)),
 ('125R','Red Medium Cutting Board',38,31,15,None,'','',None),
 ('126','Large Cutting Board',42,None,None,None,'','',(33,27,20)),
 ('1904','4-Pc. Cutlery Care Set',165,None,None,None,'','',(129,116,70)),
 ('1905','3-Pc. Cutting Board Set',104,None,None,None,'','',(82,70,40)),
 ('1754',"Slice n' Serve",None,70,50,70,'CWR','',None),
 ('1754',"Slice n' Serve for Left-Handers",81,70,50,70,'CWR','LH',None),
 ('1755',"Turn n' Serve",None,65,40,65,'CWR','',None),
 ('1756','Professional Spatula',None,None,None,None,'CW','',(58,50,35)),
 ('1530P','Brass Plate 1-1/2" x 3" with Adhesive Tape',5,0,14,None,'','',None),
 ('1537S','Silver Plate 1-1/2" x 3" with Adhesive Tape',5,0,10,None,'','',None),
 ('1536PH','Brass Plate 2" x 3" with Holes',5,0,10,None,'','',None),
 ('1536PT','Brass Plate 2" x 3" with Adhesive Tape',5,0,10,None,'','',None),
 ('1536SH','Silver Plate 2" x 3" with Holes',5,0,10,None,'','',None),
 ('1536ST','Silver Plate 2" x 3" with Adhesive Tape',5,0,10,None,'','',None),
 ('FLITZ50','FLITZ Polish',12,0,25,None,'','',None),
 ('1502-1','Blade for Pizza Cutter',43,32,25,None,'','na',None),
 ('1706','Barbecue Fork',93,82,55,None,'','na',None),
 ('1707','Barbecue Turner',93,82,55,None,'','na',None),
 ('1708','Barbecue Tongs',53,43,30,None,'','na',None),
])
add('garden', [
 ('331','5-Pc. Garden Tool Set w/FREE Garden Bag',310,222,290,245,'','',None),
 ('332','4-Pc. Garden Tool Set with Bypass Pruners',276,216,235,241,'','',None),
 ('326','4-Pc. Garden Tool Set with Transplanting Trowel',135,83,130,100,'','',None),
 ('328','3-Pc. Garden Tool Set',107,71,95,82,'','',None),
 ('300','Cultivator',40,27,40,31,'','',None),
 ('304','Garden Trowel',38,25,35,30,'','',None),
 ('302','Transplanting Trowel',36,24,30,28,'','',None),
 ('301','Weeder',31,23,20,24,'','',None),
 ('1527','Bypass Pruners',188,168,135,168,'','',None),
])
add('sporting', [
 ('5725','CUTCO/KA-BAR Explorer',275,249,180,249,'','',None),
 ('5726','CUTCO/KA-BAR Outdoorsman',279,254,185,254,'','',None),
 ('1890','Golf Mate',81,70,55,70,'','out:BK',None),
 ('1886','Pocket Knife in Gift Box',83,72,55,72,'','out:BK,DB',None),
 ('1891','2-3/4" Lockback Knife',132,116,90,116,'','out:BK',None),
 ('1769','Hunting Knife with Sheath in Gift Box (Double-D Edge)',255,232,180,232,'CW','',None),
 ('5718','Drop Point Hunting Knife',137,123,100,123,'','out:BK,H',None),
 ('5719','Clip Point Outdoor Knife',137,123,100,123,'','out:BK,H',None),
 ('5717','Gut Hook Hunting Knife',161,143,120,143,'','out:BK,H',None),
 ('5721',"Fisherman's Solution",132,117,90,117,'','out:BK,H',None),
 ('5718','Camo Drop Point Hunting Knife',147,133,110,133,'','out:GC,PC',None),
 ('5719','Camo Clip Point Outdoor Knife',147,133,110,133,'','out:GC,PC',None),
 ('5717','Camo Gut Hook Hunting Knife',171,153,125,153,'','out:GC,PC',None),
 ('5721',"Camo Fisherman's Solution",137,123,95,123,'','out:GC,PC',None),
 ('1769-2','Hunting Knife Sheath Only',55,49,35,None,'','',None),
 ('5725-2','Sheath for CUTCO/KA-BAR Explorer Knife',26,23,20,None,'','',None),
 ('5726-2','Sheath for CUTCO/KA-BAR Outdoorsman Knife',32,29,25,None,'','',None),
 ('5717-2','Replacement Sheath for 5717, 5718 & 5719',42,37,25,None,'','',None),
 ('5720-2',"Fisherman's Solution Replacement Sheath",36,31,25,None,'','',None),
 ('5720B',"Fisherman's Solution Blade Only",49,37,35,None,'','na',None),
])
add('storage', [
 ('1747','Ultimate Set Oak Block (32-Slot)',508,None,None,None,'','ch',(395,366,290)),
 ('1652','Signature Set Oak Block (24-Slot)',411,None,None,None,'','ch',(319,294,250)),
 ('1748','Homemaker + 8 Set Oak Block (18-Slot)',204,None,None,None,'','ch',(159,142,120)),
 ('1741','Homemaker Set Oak Block (10-Slot)',204,None,None,None,'','ch',(159,142,115)),
 ('1744','Galley + 6 Set Oak Block (13-Slot)',200,None,None,None,'','ch',(155,138,115)),
 ('1743','Galley Set Oak Block (7-Slot)',200,None,None,None,'','ch',(155,138,115)),
 ('1651','Essentials + 5 Set Oak Block (10-Slot)',173,None,None,None,'','ch',(135,119,90)),
 ('1649','Essentials Set Oak Block (5-Slot)',173,None,None,None,'','ch',(135,119,90)),
 ('1751','Studio + 4 Set Oak Block (8-Slot)',173,None,None,None,'','ch',(135,119,85)),
 ('1740','Studio Set Oak Block (4-Slot)',173,None,None,None,'','ch',(135,119,85)),
 ('1746','Space Saver Set Oak Block (5-Slot)',173,None,None,None,'','ch',(135,119,90)),
 ('1749','Gourmet Set Oak Block (5-Slot)',203,None,None,None,'','ch',(158,141,115)),
 ('1752','Table Knife Set Oak Block (6-Slot)',141,None,None,None,'','ch',(109,96,75)),
 ('1753','Table Knife Set Oak Block (8-Slot)',141,None,None,None,'','ch',(109,96,75)),
 ('1711','Kitchen Tool Oak Holder',72,None,None,None,'','ch',(56,47,40)),
 ('1742','5-Pc. Knife & Fork Tray',36,None,None,None,'','',(28,21,15)),
 ('1745','4-Pc. Table Knife Tray',27,None,None,None,'','',(21,15,5)),
 ('1720-2','2-3/4" Paring Knife Sheath',12,11,7,None,'','',None),
 ('2120-2','4" Paring Knife Sheath',12,11,7,None,'','',None),
 ('1721-2','Trimmer Sheath',12,11,7,None,'','',None),
 ('3721-2','Santoku-Style Trimmer Sheath',12,11,7,None,'','',None),
 ('2159-2','Steak Knife Sheath',12,11,7,None,'','',None),
 ('1759-2','Traditional Table Knife Sheath',12,11,7,None,'','',None),
 ('1768-2','Spatula Spreader Sheath',13,12,8,None,'','',None),
 ('1764-2','Traditional Cheese Knife Sheath',13,12,8,None,'','',None),
 ('2166-2','5" Petite Santoku Sheath',13,12,8,None,'','',None),
 ('1729-2','6-3/4" Petite Carver Sheath',13,12,8,None,'','',None),
 ('1723-2','9" Carver Sheath',13,12,8,None,'','',None),
 ('1724-2','7-3/4" Slicer / 9-3/4" Slicer / Salmon Knife Sheath',13,12,8,None,'','',None),
 ('1728-2','7-5/8" Petite Chef Sheath',14,13,9,None,'','',None),
 ('1725-2','9-1/4" French Chef Sheath',14,13,9,None,'','',None),
 ('1766-2','7" Santoku Sheath',14,13,9,None,'','',None),
 ('3738-2','Hardy Slicer / Gourmet Prep Knife Sheath',14,13,9,None,'','',None),
 ('4135-2','4" Vegetable Knife Sheath',13,12,8,None,'','',None),
 ('2135-2','6" Vegetable Knife Sheath',14,13,9,None,'','',None),
 ('1735-2','7-1/2" Vegetable Knife Sheath',14,13,9,None,'','',None),
 ('1737-2','Cleaver Sheath',14,13,9,None,'','',None),
])
add('giftbox', [
 ('1700','Gift Box for 4 Table Knives (1865)',11,0,15,None,'','',None),
 ('2204','Gift Box for 4 Stainless Table Knives (1982)',11,0,15,None,'','',None),
 ('1701','Gift Box for 8 Table Knives (1866)',11,0,20,None,'','',None),
 ('2208','Gift Box for 8 Stainless Table Knives (1983)',11,0,15,None,'','',None),
 ('1702','Gift Box for 12 Table Knives (1867)',11,0,20,None,'','',None),
 ('2202','Gift Box for 12 Stainless Table Knives (1988)',11,0,20,None,'','',None),
 ('2102','Gift Box for 6 Table Knives (1869)',11,0,20,None,'','',None),
 ('2206','Gift Box for 6 Stainless Table Knives (1987)',11,0,15,None,'','',None),
 ('1703','Gift Box for Snack Pack (1831)',11,0,15,None,'','',None),
 ('2028','Gift Box for 4-Pc. Steak Knife Set (2065)',11,0,20,None,'','',None),
 ('2109','Gift Box for Entertainer Pack (1838)',11,0,20,None,'','',None),
 ('1704D','Deluxe Gift Box for Carving Set (1834)',11,0,35,None,'','',None),
 ('1705D','Deluxe Gift Box for Salad Mates / Deli Mates / Prep & Party (1820/1821/2060)',11,0,30,None,'','',None),
 ('2027D','Deluxe Gift Box for Wine & Cheese Set (2130)',11,0,35,None,'','',None),
 ('2106D',"Deluxe Gift Box for Peel n' Pare Pack (1828)",11,0,35,None,'','',None),
 ('2107D','Deluxe Gift Box for Party Pack (1829)',11,0,35,None,'','',None),
 ('2108D','Deluxe Gift Box for Party Favorites / Dessert Favorites (1837/1855)',11,0,30,None,'','',None),
 ('2111D','Deluxe Gift Box for Kitchen Classics / Santoku Classics (1827/1859)',11,0,30,None,'','',None),
 ('2114D','Deluxe Gift Box for Party Starters / Cheese Knife Combo (1842/1858)',11,0,30,None,'','',None),
 ('2115D',"Deluxe Gift Box for Cook's Combo / Carver's Choice / Culinary Companions / SS Cook's Combo",11,0,35,None,'','',None),
 ('2116D','Deluxe Gift Box for 2-Pc. Santoku Set (1850)',11,0,30,None,'','',None),
 ('2117D','Deluxe Gift Box for Shear sets (1851/1852/3852/3908/3909)',11,0,30,None,'','',None),
 ('2119D','Deluxe Gift Box for Club Mates / Petite sets / Time Saver / Welcome Home',11,0,30,None,'','',None),
 ('2025D',"Deluxe Gift Box for Slice n' Serve / Turn n' Serve (1754/1755)",11,0,35,None,'','',None),
 ('2026D','Deluxe Gift Box for Super Shears (77)',11,0,30,None,'','',None),
 ('2029D','Deluxe Gift Box for 1761/1729/2124/1766/1728/1735/2135',11,0,30,None,'','',None),
 ('2103D','Deluxe Gift Box for Gourmet Prep / Hardy Slicer (1738/3738)',11,0,30,None,'','',None),
 ('2118D','Deluxe Gift Box for 1768/1721/3721/1764/2166/2159',11,0,30,None,'','',None),
 ('1580','Foldable Box: 1501/1720/1759/1959/3120/4120/3720/3764',0.80,0,2,None,'','',None),
 ('1581','Foldable Box: 1503/1504/2159/1721/1768/2120/3721/2164/4720/4135',0.80,0,2,None,'','',None),
 ('1582','Foldable Box: 1726/1727/1738/3738/1761/1764/2166/2135',0.80,0,2,None,'','',None),
 ('1583','Foldable Box: 1722/1723/1724/1725/1729/1756/1762/2124/3729/3724',0.80,0,2,None,'','',None),
 ('1584','Foldable Box: 77/1502/1527',0.80,0,2,None,'','',None),
 ('1585','Foldable Box: 1712/1713/1714/1716/1754/1755/82',0.80,0,2,None,'','',None),
 ('1586','Foldable Box: 1737/5726 (also 1854, 2031, 2033)',0.80,0,2,None,'','',None),
 ('1587','Foldable Box: 1728/1735/1766/5718/5719/5721/5717',0.80,0,2,None,'','',None),
 ('1730MT','Foldable Box: 304/5725',0.80,0,2,None,'','',None),
 ('1589','Foldable Box: 1507 Wine Opener',1.50,0,4,None,'','',None),
])
add('partner', [
 ('WM32OSBR','Original Wellness Mat',157,None,None,None,'','mat',None),
 ('WM32ABDA','Bella Wellness Mat',178,None,None,None,'','mat',None),
 ('WM32ATDA','Trellis Wellness Mat',178,None,None,None,'','mat',None),
 ('WM32GRCO','Granite Wellness Mat',168,None,None,None,'','mat',None),
 ('WM32LNDA','Linen Wellness Mat',178,None,None,None,'','mat',None),
 ('WMCOMON','Granite Collection - CompanionMat',94,None,None,None,'','matc',None),
])
add('services', [
 ('ENGRO1','Engraving fee: 1-24 pieces (per piece)',12,0,20,None,'','',None),
 ('ENGRO2','Engraving volume: 25-49 pieces (per piece)',11.75,0,20,None,'','',None),
 ('ENGRO3','Engraving volume: 50-99 pieces (per piece)',11.50,0,20,None,'','',None),
 ('ENGRO4','Engraving volume: 100-149 pieces (per piece)',11.25,0,20,None,'','',None),
 ('ENGRO5','Engraving volume: 150-299 pieces (per piece)',11,0,20,None,'','',None),
 ('ENGRO6','Engraving volume: 300-499 pieces (per piece)',10.75,0,20,None,'','',None),
 ('ENGRO7','Engraving volume: 500-749 pieces (per piece)',10.50,0,20,None,'','',None),
 ('ENGRO8','Engraving volume: 750-999 pieces (per piece)',10,0,20,None,'','',None),
 ('ENGRO9','Engraving volume: 1000-1499 pieces (per piece)',9.50,0,20,None,'','',None),
 ('ENGRO10','Engraving volume: 1500+ pieces (per piece)',8.50,0,20,None,'','',None),
 ('ENGRCHIP','New logo set-up fee',50,0,140,None,'','',None),
 ('BOW','Bow with black elastic string (choose color)',1,0,2,None,'','bow',None),
 ('WRAP','Silver embossed gift wrap',6,0,17,None,'','',None),
 ('CCHW','Hand-written card (card provided by Cutco)',3.50,0,0,None,'','',None),
 ('CCPC','Photocopied card (card provided by Cutco)',1,0,0,None,'','',None),
 ('CCBW','Printed letter - black and white',0.25,0,0,None,'','',None),
 ('CCFC','Printed letter - color',0.75,0,0,None,'','',None),
 ('GIFTCARD','Cutco Gift Card (enter amount; $50 min, $25 steps)',50,None,None,None,'','gc',None),
])

# ---- ratios for estimates ----
DEF_RATIO = {'cookware': (0.90, 0.60), 'partner': (0.90, 0.60), 'sheath': (0.885, 0.60), 'sets': (0.90, 0.69)}
RET_FROM_GIFT = {'sets': 1715/1659, 'bblock': 1343/1287, 'upgrade': 1246/1190, 'giftsets': 1.10, 'access': 1.09}
L21 = json.load(open(__file__.rsplit('/', 1)[0] + '/l21_2026.json'))
items = []; est_notes = []
for cat, base, name, retail, cpo, pts, gift, colors, flags, ref19 in R:
    it = {'b': base, 'name': name, 'c': cat}
    e = []
    if retail is None:
        if gift: retail = round(gift * RET_FROM_GIFT.get(cat, 1.08))
        elif ref19: retail = round(ref19[0] * 1.28)
        e.append('retail')
    it['p'] = retail
    if cat == 'services' and 'gc' in flags:
        it['gc'] = 1; cpo = 0; pts = 0
    cpo_missing = cpo is None
    if cpo is None or pts is None:
        if ref19 and ref19[0]:
            cpo = round(retail * ref19[1] / ref19[0]) if cpo is None else cpo
            pts = round(retail * ref19[2] / ref19[0]) if pts is None else pts
        else:
            rc, rp = DEF_RATIO.get(cat, (0.90, 0.62))
            cpo = round(retail * rc) if cpo is None else cpo
            pts = round(retail * rp) if pts is None else pts
        e.append('cpo' if cpo_missing else 'pts')
    it['cpo'] = cpo; it['pts'] = pts
    if gift is not None: it['g'] = gift
    if colors: it['col'] = colors
    fl = flags.split()
    for f in fl:
        if f == 'ch': it['ch'] = 1
        elif f in ('D', 'SH', 'B', '-1', 'LH', 'DLH'): it['sfx'] = f
        elif f == 'mat': it['o'] = ['matSize', 'matColor']
        elif f == 'matc': it['o'] = ['matColor']
        elif f == 'bow': it['o'] = ['bowColor']
        elif f.startswith('out:'): it['out'] = f[4:].split(',')
        elif f == 'na': it['na'] = 1
        elif f.startswith('wps='): it['wps'] = int(f[4:])
    # ---- exact numbers from the L21 U.S. Price List (March 2026) override everything above ----
    sfx = it.get('sfx', '')
    outc = it.get('out', [None])[0]
    cands = [base + sfx, base + 'C' + sfx] + ([base + outc] if outc else []) + ([base] if not sfx else [])
    hit = next((L21[k] for k in cands if k in L21), None)
    if hit:
        it['p'] = hit['p']; it['cpo'] = hit['cpo']; it['pts'] = hit['pts']; e = []
        if hit.get('wps'): it['wps'] = hit['wps']
        if hit['col'] in ('C/W/R', 'C/W'): it['col'] = hit['col'].replace('/', '')
    if e: it['e'] = e; est_notes.append((cat, base, name, e))
    items.append(it)

# sanity: unique key (base + sfx + cat)
seen = {}
for it in items:
    k = it['b'] + it.get('sfx', '') + (it['out'][0] if it.get('out') else '') + '|' + it['c']
    assert k not in seen, k; seen[k] = 1

header = """/* Product catalog for Festival Orders. GENERATED by tools/build_catalog.py — edit that file, not this one.
   Sources: Cutco Orders app (retail, Sep 2026), CGP Gifting Price List (Aug 2026), Auxiliary Price List (Mar 2026),
   L21 price list 9/2019 (ratios only). Fields: b=base item #, p=retail, g=business/realtor gift price, cpo, pts=point value,
   wps=value when purchased separately (used for the Value total), col=handle colors (C Classic, W Pearl, R Red), ch=cherry-finish block option, sfx=item # suffix after the color letter,
   out=outdoor handle colors, e=estimated fields (no 2026 source yet). Prices can be overridden in the app (Settings). */
"""
CATS = [
 ('sets','Kitchen Cutlery Sets'),('homemaker','Homemaker Pieces'),('tablesets','Table / Steak Knife Sets'),('giftsets','Gift Sets'),
 ('sheath','Knife Sheath Combos'),('tools','Kitchen Tools'),('specialty','Specialty Knives'),('cookware','Cookware'),('flatware','Flatware'),
 ('gadgets','Gadgets'),('access','Accessories'),('garden','Garden Tools'),('sporting','Sporting / Hunting Knives'),('storage','Storage'),
 ('bblock','B-Block Sets'),('upgrade','Block Upgrade Sets'),('giftbox','Gift Boxes'),('partner','Partner Products'),
 ('services','Gifting Services (Business / Realtor)'),('custom','Custom / Other')]
out = header
out += "const CATALOG_VERSION = 'L21 Mar 2026 / Gifting Aug 2026 / Aux Mar 2026';\n"
out += "const CATEGORIES = " + json.dumps([{'id': i, 'name': n} for i, n in CATS]) + ";\n"
out += """const COLOR_NAMES = { C: 'Classic', W: 'Pearl', R: 'Red' };
const OUTDOOR_COLORS = { BK: 'Black', H: 'Orange', DB: 'Blue', GC: 'Green Camo', PC: 'Pink Camo' };
const OPTION_GROUPS = {
  matSize:  { label: 'Mat Size',  choices: ["3' x 2' x 3/4\\"", "6' x 2' x 3/4\\""] },
  matColor: { label: 'Mat Color', choices: ['Light Brown', 'Dark Brown', 'Onyx', 'Silver Leaf'] },
  bowColor: { label: 'Bow Color', choices: ['Black', 'Blue', 'Green', 'Gold', 'Magenta', 'Navy', 'Orange', 'Purple', 'Red', 'Silver', 'Teal', 'Yellow'] }
};
"""
out += "const CATALOG = [\n" + ",\n".join("  " + json.dumps(it, ensure_ascii=False) for it in items) + "\n];\n"
out += """
/* Families: one tile in the picker whose choices resolve to different item numbers (as the Cutco app does for sets).
   dims = option questions; variants = choice values joined by '|' → catalog key (or {key, out}). */
const FAMILIES = [
  { name: 'Homemaker Set', cat: 'sets', img: '2018', dims: [
      { label: 'Chef Knife', choices: ['7-5/8" Petite Chef', '9-1/4" French Chef'] },
      { label: 'Storage / Table Knives', choices: ['Wood Block with 8 Table Knives', 'Basic Wood Block - No Table Knives', 'Trays - No Table Knives'] } ],
    variants: { '7-5/8" Petite Chef|Wood Block with 8 Table Knives': '2018', '9-1/4" French Chef|Wood Block with 8 Table Knives': '1818',
      '7-5/8" Petite Chef|Basic Wood Block - No Table Knives': '2001', '9-1/4" French Chef|Basic Wood Block - No Table Knives': '1801',
      '7-5/8" Petite Chef|Trays - No Table Knives': '2000', '9-1/4" French Chef|Trays - No Table Knives': '1800' } },
  { name: 'Galley Set', cat: 'sets', img: '2008', dims: [ { label: 'Storage / Table Knives', choices: ['Wood Block with 6 Table Knives', 'Basic Wood Block - No Table Knives'] } ],
    variants: { 'Wood Block with 6 Table Knives': '2008', 'Basic Wood Block - No Table Knives': '2007' } },
  { name: 'Essentials Set', cat: 'sets', img: '1945', dims: [ { label: 'Storage / Table Knives', choices: ['Wood Block with 5 Table Knives', 'Basic Wood Block - No Table Knives'] } ],
    variants: { 'Wood Block with 5 Table Knives': '1945', 'Basic Wood Block - No Table Knives': '1845' } },
  { name: 'Studio Set', cat: 'sets', img: '1810', dims: [ { label: 'Storage / Table Knives', choices: ['Wood Block with 4 Table Knives', 'Basic Wood Block - No Table Knives'] } ],
    variants: { 'Wood Block with 4 Table Knives': '1810', 'Basic Wood Block - No Table Knives': '1809' } },
  { name: 'Ultimate Set', cat: 'sets', img: '1813', dims: [ { label: 'Table or Steak', choices: ['Table Knives', 'Steak Knives'] } ], variants: { 'Table Knives': '1813', 'Steak Knives': '6813' } },
  { name: 'Signature Set', cat: 'sets', img: '1814', dims: [ { label: 'Table or Steak', choices: ['Table Knives', 'Steak Knives'] } ], variants: { 'Table Knives': '1814', 'Steak Knives': '6814' } },
  { name: 'Santoku-Style Signature Set', cat: 'sets', img: '2014', dims: [ { label: 'Table or Steak', choices: ['Table Knives', 'Steak Knives'] } ], variants: { 'Table Knives': '2014', 'Steak Knives': '6014' } },
  { name: 'Homemaker Set B-Block (w/ Table Knife Slots)', cat: 'bblock', img: '2001B', dims: [ { label: 'Chef Knife', choices: ['7-5/8" Petite Chef', '9-1/4" French Chef'] } ], variants: { '7-5/8" Petite Chef': '2001B', '9-1/4" French Chef': '1801B' } },
  { name: 'Galley + 6 with Ultimate Block Upgrade', cat: 'upgrade', img: '4820', dims: [ { label: 'Table or Steak', choices: ['Table Knives', 'Steak Knives'] } ], variants: { 'Table Knives': '4820', 'Steak Knives': '4821' } },
  { name: 'Galley + 6 with Signature Block Upgrade', cat: 'upgrade', img: '4822', dims: [ { label: 'Table or Steak', choices: ['Table Knives', 'Steak Knives'] } ], variants: { 'Table Knives': '4822', 'Steak Knives': '4823' } },
  { name: 'Homemaker + 8 with Ultimate Block Upgrade', cat: 'upgrade', img: '4826', dims: [ { label: 'Table or Steak', choices: ['Table Knives', 'Steak Knives'] } ], variants: { 'Table Knives': '4826', 'Steak Knives': '4827' } },
  { name: 'Homemaker + 8 with Signature Block Upgrade', cat: 'upgrade', img: '4828', dims: [ { label: 'Table or Steak', choices: ['Table Knives', 'Steak Knives'] } ], variants: { 'Table Knives': '4828', 'Steak Knives': '4829' } },
  { name: 'Signature + 10 with Ultimate Block Upgrade', cat: 'upgrade', img: '4830', dims: [ { label: 'Table or Steak', choices: ['Table Knives', 'Steak Knives'] } ], variants: { 'Table Knives': '4830', 'Steak Knives': '4831' } },
  { name: 'Drop Point Hunting Knife', cat: 'sporting', img: '5718BK', dims: [ { label: 'Handle', choices: ['Black', 'Orange', 'Green Camo', 'Pink Camo'] } ],
    variants: { 'Black': { key: '5718BK', out: 'BK' }, 'Orange': { key: '5718BK', out: 'H' }, 'Green Camo': { key: '5718GC', out: 'GC' }, 'Pink Camo': { key: '5718GC', out: 'PC' } } },
  { name: 'Clip Point Outdoor Knife', cat: 'sporting', img: '5719BK', dims: [ { label: 'Handle', choices: ['Black', 'Orange', 'Green Camo', 'Pink Camo'] } ],
    variants: { 'Black': { key: '5719BK', out: 'BK' }, 'Orange': { key: '5719BK', out: 'H' }, 'Green Camo': { key: '5719GC', out: 'GC' }, 'Pink Camo': { key: '5719GC', out: 'PC' } } },
  { name: 'Gut Hook Hunting Knife', cat: 'sporting', img: '5717BK', dims: [ { label: 'Handle', choices: ['Black', 'Orange', 'Green Camo', 'Pink Camo'] } ],
    variants: { 'Black': { key: '5717BK', out: 'BK' }, 'Orange': { key: '5717BK', out: 'H' }, 'Green Camo': { key: '5717GC', out: 'GC' }, 'Pink Camo': { key: '5717GC', out: 'PC' } } },
  { name: "Fisherman's Solution", cat: 'sporting', img: '5721BK', dims: [ { label: 'Handle', choices: ['Black', 'Orange', 'Green Camo', 'Pink Camo'] } ],
    variants: { 'Black': { key: '5721BK', out: 'BK' }, 'Orange': { key: '5721BK', out: 'H' }, 'Green Camo': { key: '5721GC', out: 'GC' }, 'Pink Camo': { key: '5721GC', out: 'PC' } } },
  { name: 'Cleaver', cat: 'specialty', img: '1737', dims: [ { label: 'Version', choices: ['With Sheath', 'Cleaver Only'] } ], variants: { 'With Sheath': '1737', 'Cleaver Only': '1737-1' } },
  { name: "Slice n' Serve", cat: 'access', img: '1754', dims: [ { label: 'Version', choices: ['Right-handed', 'Left-handed'] } ], variants: { 'Right-handed': '1754', 'Left-handed': '1754LH' } },
  { name: "Slice n' Serve in Gift Box", cat: 'giftsets', img: '6754D', dims: [ { label: 'Version', choices: ['Right-handed', 'Left-handed'] } ], variants: { 'Right-handed': '6754D', 'Left-handed': '6754DLH' } },
  { name: 'Party Favorites', cat: 'giftsets', img: '1837D', dims: [ { label: 'Version', choices: ['Right-handed', 'Left-handed'] } ], variants: { 'Right-handed': '1837D', 'Left-handed': '1837DLH' } },
  { name: "Bake n' Serve Set (regular Gift Box)", cat: 'giftsets', img: '1854', dims: [ { label: 'Version', choices: ['Right-handed', 'Left-handed'] } ], variants: { 'Right-handed': '1854', 'Left-handed': '1854LH' } },
  { name: 'Medium Cutting Board', cat: 'access', img: '125', dims: [ { label: 'Color', choices: ['White', 'Red'] } ], variants: { 'White': '125', 'Red': '125R' } }
];
const CUSTOMER_TYPES = ['Booth Sale/New Customer','Booth Sale/Customer Re-Order','Event Service Call Lead/New Customer',
  'Event Service Call Lead/Customer Re-Order','Event Free Look Lead/New Customer','Event Free Look Lead/Customer Re-Order','Other'];
const ORDER_TYPES = ['Regular', 'Realtor', 'Business', 'Military', 'GSA'];
const GIFT_ORDER_TYPES = ['Realtor', 'Business'];   // use gifting prices, PPS&I shipping tiers, 6-pay option
const SHIP_METHODS = [
  { id: 'ground', label: 'Ground' }, { id: '2day', label: '2-Day' }, { id: 'next', label: 'Next-Day' }
];
/* Regular orders: ground included; express by product subtotal. 2019 table x1.28 (matches the app's $45/$76 at $4,331). Estimated. */
const EXPRESS_TIERS = [
  { max: 99.99, '2day': 13, next: 26 }, { max: 249.99, '2day': 19, next: 32 }, { max: 499.99, '2day': 26, next: 45 },
  { max: 749.99, '2day': 32, next: 51 }, { max: 999.99, '2day': 38, next: 64 }, { max: Infinity, '2day': 45, next: 76 }
];
/* Business / Realtor (CGP) orders shipping from Olean: P.P.S.&I. charges by product subtotal (Aug 2026 list). */
const PPSI_TIERS = [
  { max: 199.99, ground: 25, '2day': 55, next: 75 }, { max: 499.99, ground: 35, '2day': 70, next: 90 },
  { max: 2499.99, ground: 55, '2day': 85, next: 120 }, { max: 4999.99, ground: 65, '2day': 100, next: 140 },
  { max: 9999.99, ground: 80, '2day': 205, next: 225 }, { max: 14999.99, ground: 115, '2day': 230, next: 250 },
  { max: 19999.99, ground: 170, '2day': 300, next: 320 }, { max: Infinity, ground: 185, '2day': 300, next: 320 }
];
const PAY_METHODS = ['Credit/Debit Card', 'Paper Check / Money Order', 'PayPal'];
/* Multiple payments: minimum product subtotal and admin fee. 6-pay is Business/Realtor only. */
const PAY_PLANS = [
  { n: 1, fee: 0, min: 0 }, { n: 2, fee: 5, min: 70 }, { n: 3, fee: 10, min: 200 }, { n: 5, fee: 20, min: 400 }, { n: 6, fee: 25, min: 600, giftOnly: true }
];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
"""
open(__file__.rsplit('/tools/', 1)[0] + '/catalog.js', 'w').write(out)
print('items', len(items))
print('estimated retail:', [b for c,b,n,e in est_notes if 'retail' in e])
print('estimated cpo/pts count:', sum(1 for c,b,n,e in est_notes if 'cpo' in e))
from collections import Counter
print(Counter(c for c,b,n,e in est_notes if 'cpo' in e))
