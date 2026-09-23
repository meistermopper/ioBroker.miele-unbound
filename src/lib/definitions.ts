export const DEVICE_CATEGORIES: Record<number, { en: string; de: string }> = {
	1: { en: 'Washing Machine', de: 'Waschmaschine' },
	2: { en: 'Tumble Dryer', de: 'Wäschetrockner' },
	7: { en: 'Dishwasher', de: 'Geschirrspüler' },
	8: { en: 'Dishwasher Semi-Prof', de: 'Geschirrspüler (Semi-Prof)' },
	12: { en: 'Oven', de: 'Backofen' },
	13: { en: 'Oven Microwave', de: 'Kombi-Mikrowelle' },
	14: { en: 'Hob Highlight', de: 'Cerankochfeld' },
	15: { en: 'Steam Oven', de: 'Dampfgarer' },
	16: { en: 'Microwave', de: 'Mikrowelle' },
	17: { en: 'Coffee System', de: 'Kaffeevollautomat' },
	18: { en: 'Hood', de: 'Dunstabzugshaube' },
	19: { en: 'Fridge', de: 'Kühlschrank' },
	20: { en: 'Freezer', de: 'Gefrierschrank' },
	21: { en: 'Fridge-Freezer Combination', de: 'Kühl-Gefrierkombination' },
	23: { en: 'Robotic Vacuum Cleaner', de: 'Saugroboter' },
	24: { en: 'Washer-Dryer', de: 'Waschtrockner' },
	25: { en: 'Dish Warmer', de: 'Wärmeschublade' },
	27: { en: 'Hob Induction', de: 'Induktionskochfeld' },
	28: { en: 'Hob Gas', de: 'Gaskochfeld' },
	31: { en: 'Steam Oven Combination', de: 'Dampfbackofen' },
	32: { en: 'Wine Cabinet', de: 'Weinschrank' },
	33: { en: 'Wine Conditioning Unit', de: 'Weintemperierschrank' },
	34: { en: 'Wine Storage Unit', de: 'Weinlagerschrank' },
	39: { en: 'Double Oven', de: 'Doppelbackofen' },
	40: { en: 'Double Steam Oven', de: 'Doppeldampfgarer' },
	41: {
		en: 'Double Steam Oven Combination',
		de: 'Kombi-Doppeldampfbackofen',
	},
	42: { en: 'Double Microwave', de: 'Doppelmikrowelle' },
	43: { en: 'Double Microwave Oven', de: 'Doppelmikrowellenbackofen' },
	45: { en: 'Steam Oven Microwave Combination', de: 'Dampfgarer-Mikrowelle' },
	48: { en: 'Vacuum Drawer', de: 'Vakuumierschublade' },
	67: { en: 'Dialog Oven', de: 'Dialoggarer' },
	68: {
		en: 'Wine Cabinet Freezer Combination',
		de: 'Weinschrank-Gefrierkombination',
	},
};

export const STATUS_MAP: Record<number, { en: string; de: string }> = {
	1: { en: 'Off', de: 'Aus' },
	2: { en: 'Standby', de: 'Standby' },
	3: { en: 'Programmed', de: 'Programmiert' },
	4: { en: 'Waiting to start', de: 'Warten auf Start' },
	5: { en: 'Running', de: 'In Betrieb' },
	6: { en: 'Pause', de: 'Pause' },
	7: { en: 'Program ended', de: 'Programm beendet' },
	8: { en: 'Failure', de: 'Störung' },
	9: { en: 'Program interrupted', de: 'Abgebrochen' },
	10: { en: 'Idle', de: 'Leerlauf' },
	11: { en: 'Rinse hold', de: 'Spülstopp' },
	12: { en: 'Service', de: 'Kundendienst / Service' },
	13: { en: 'Superfreezing', de: 'Superfrost' },
	14: { en: 'Supercooling', de: 'Superkühlen' },
	15: { en: 'Superheating', de: 'Schnellaufheizen' },
	144: { en: 'Default', de: 'Standard' },
	145: { en: 'Locked', de: 'Gesperrt' },
	146: { en: 'Supercooling & Superfreezing', de: 'Superkühlen & Superfrost' },
	255: { en: 'Offline', de: 'Nicht erreichbar' },
};

export const PROGRAM_TYPES: Record<number, { en: string; de: string }> = {
	0: { en: 'Normal operation', de: 'Normalbetrieb' },
	1: { en: 'Own program', de: 'Eigenes Programm' },
	2: { en: 'Automatic program', de: 'Automatikprogramm' },
	3: { en: 'Cleaning & Care program', de: 'Reinigungs-/Pflegeprogramm' },
};

export const DRYING_STEPS: Record<number, { en: string; de: string }> = {
	0: { en: 'Extra dry', de: 'Extratrocken' },
	1: { en: 'Normal plus', de: 'Normal plus' },
	2: { en: 'Normal', de: 'Normal' },
	3: { en: 'Slightly dry', de: 'Leicht trocken' },
	4: { en: 'Hand iron 1', de: 'Bügelfeucht 1' },
	5: { en: 'Hand iron 2', de: 'Bügelfeucht 2' },
	6: { en: 'Machine iron', de: 'Mangelfeucht' },
};

export const PROGRAMS: Record<
	number,
	Record<number, { en: string; de: string }>
> = {
	// Washing Machine & Washer-Dryer (1, 24)
	1: {
		0: { en: 'Off', de: 'Aus' },
		1: { en: 'Cottons', de: 'Baumwolle' },
		3: { en: 'Minimum Iron', de: 'Pflegeleicht' },
		4: { en: 'Delicates', de: 'Feinwäsche' },
		8: { en: 'Woollens', de: 'Wolle' },
		9: { en: 'Silks', de: 'Seide' },
		17: { en: 'Starch', de: 'Stärken' },
		18: { en: 'Rinse', de: 'Spülen' },
		21: { en: 'Drain / Spin', de: 'Abpumpen/Schleudern' },
		22: { en: 'Curtains', de: 'Gardinen' },
		23: { en: 'Shirts', de: 'Oberhemden' },
		24: { en: 'Denim', de: 'Jeans' },
		27: { en: 'Proofing', de: 'Imprägnieren' },
		29: { en: 'Sportswear', de: 'Sportbekleidung' },
		31: { en: 'Automatic Plus', de: 'Automatic Plus' },
		37: { en: 'Outerwear', de: 'Outdoor' },
		39: { en: 'Pillows', de: 'Kopfkissen' },
		50: { en: 'Dark Garments', de: 'Dunkles/Jeans' },
		52: { en: 'Separate Rinse / Starch', de: 'Separates Spülen/Stärken' },
		53: { en: 'First Wash', de: 'Erstwäsche' },
		69: { en: 'Cottons Hygiene', de: 'Baumwolle Hygiene' },
		77: { en: 'Trainers', de: 'Sportschuhe' },
		91: { en: 'Clean Machine', de: 'Maschine reinigen' },
		95: { en: 'Down Duvets', de: 'Daunen' },
		122: { en: 'Express 20', de: 'Express 20' },
		123: { en: 'Denim', de: 'Jeans' },
		129: { en: 'Down-filled Items', de: 'Daunen' },
		133: { en: 'Cottons Eco', de: 'Baumwolle Eco' },
		146: { en: 'QuickPowerWash', de: 'QuickPowerWash' },
		190: { en: 'ECO 40-60', de: 'Eco 40-60' },
		10001: { en: 'Cottons', de: 'Baumwolle' },
		10007: { en: 'ECO 40-60', de: 'Eco 40-60' },
		10016: { en: 'Easy Care', de: 'Pflegeleicht' },
		10022: { en: 'Delicates', de: 'Feinwäsche' },
		10029: { en: 'Express 20', de: 'Express 20' },
		10031: { en: 'QuickPowerWash', de: 'QuickPowerWash' },
		10036: { en: 'Drain / Spin', de: 'Abpumpen/Schleudern' },
		10038: { en: 'Shirts', de: 'Oberhemden' },
		10040: { en: 'Woollens', de: 'Wolle' },
		10042: { en: 'Silks', de: 'Seide' },
		10047: { en: 'Bed Linen', de: 'Bettwäsche' },
		10048: { en: 'Dark Jeans', de: 'Dunkles/Jeans' },
		10049: { en: 'Outdoor Garments', de: 'Outdoor' },
		10050: { en: 'Down Duvets', de: 'Daunen' },
		10052: { en: 'Sportswear', de: 'Sportbekleidung' },
		10053: { en: 'First Wash', de: 'Erstwäsche' },
		10055: { en: 'Curtains', de: 'Gardinen' },
		10056: { en: 'Trainers', de: 'Sportschuhe' },
		10057: { en: 'Proofing', de: 'Imprägnieren' },
		10058: { en: 'Rinse', de: 'Spülen' },
		10059: { en: 'Pre Ironing', de: 'Vorbügeln' },
		10065: { en: 'Cottonrepair', de: 'CottonRepair' },
		10066: { en: 'Trainers Refresh', de: 'Sportschuhe auffrischen' },
		10067: { en: 'Clean Machine', de: 'Maschine reinigen' },
		10068: { en: 'Smartmatic', de: 'SmartMatic' },
		10069: { en: 'Stuffed Toys', de: 'Kuscheltiere' },
		10070: { en: 'Game Pieces', de: 'Spielsachen' },
		10075: { en: 'PowerFresh', de: 'PowerFresh' },
	},
	// Tumble Dryer (2)
	2: {
		0: { en: 'Off', de: 'Aus' },
		1: { en: 'Automatic Plus', de: 'Automatic Plus' },
		2: { en: 'Cottons', de: 'Baumwolle' },
		3: { en: 'Minimum Iron', de: 'Pflegeleicht' },
		4: { en: 'Woollens Handcare', de: 'Wolle Handpflege' },
		5: { en: 'Delicates', de: 'Feinwäsche' },
		6: { en: 'Warm Air', de: 'Warmluft' },
		7: { en: 'Cool Air', de: 'Kaltluft' },
		8: { en: 'Express', de: 'Express' },
		9: { en: 'Cottons Eco', de: 'Baumwolle Eco' },
		10: { en: 'Gentle Smoothing', de: 'Schonend Glätten' },
		11: { en: 'Cottons Hygiene', de: 'Baumwolle Hygiene' },
		12: { en: 'Proofing', de: 'Imprägnieren' },
		13: { en: 'Denim', de: 'Jeans' },
		14: { en: 'Shirts', de: 'Oberhemden' },
		15: { en: 'Sportswear', de: 'Sportbekleidung' },
		16: { en: 'Outerwear', de: 'Outdoor' },
		17: { en: 'Silks Handcare', de: 'Seide Handpflege' },
		19: { en: 'Standard Pillows', de: 'Kopfkissen' },
		20: { en: 'Cottons', de: 'Baumwolle' },
		22: { en: 'Basket Program', de: 'Korbprogramm' },
		23: { en: 'Cottons Hygiene', de: 'Baumwolle Hygiene' },
		24: { en: 'Smoothing', de: 'Glätten' },
		30: { en: 'Minimum Iron', de: 'Pflegeleicht' },
		31: { en: 'Bed Linen', de: 'Bettwäsche' },
		40: { en: 'Woollens Handcare', de: 'Wolle Handpflege' },
		50: { en: 'Delicates', de: 'Feinwäsche' },
		60: { en: 'Warm Air', de: 'Warmluft' },
		66: { en: 'ECO', de: 'Eco' },
		70: { en: 'Cool Air', de: 'Kaltluft' },
		80: { en: 'Express', de: 'Express' },
		90: { en: 'Cottons', de: 'Baumwolle' },
		100: { en: 'Gentle Smoothing', de: 'Schonend Glätten' },
		120: { en: 'Proofing', de: 'Imprägnieren' },
		130: { en: 'Denim', de: 'Jeans' },
		131: { en: 'Gentle Denim', de: 'Schonend Jeans' },
		150: { en: 'Sportswear', de: 'Sportbekleidung' },
		160: { en: 'Outerwear', de: 'Outdoor' },
		170: { en: 'Silks Handcare', de: 'Seide Handpflege' },
		190: { en: 'Standard Pillows', de: 'Kopfkissen' },
		220: { en: 'Basket Program', de: 'Korbprogramm' },
		240: { en: 'Smoothing', de: 'Glätten' },
		10001: { en: 'Cottons', de: 'Baumwolle' },
		10016: { en: 'Minimum Iron', de: 'Pflegeleicht' },
		10022: { en: 'Delicates', de: 'Feinwäsche' },
		10025: { en: 'Warm Air', de: 'Warmluft' },
		10027: { en: 'Cool Air', de: 'Kaltluft' },
		10028: { en: 'Express', de: 'Express' },
		10032: { en: 'Quick Power Dry', de: 'QuickPowerDry' },
		10039: { en: 'Denim', de: 'Jeans' },
		10040: { en: 'Woollens', de: 'Wolle' },
		10044: { en: 'Automatic', de: 'Automatic' },
		10047: { en: 'Bed Linen', de: 'Bettwäsche' },
		10049: { en: 'Outerwear', de: 'Outdoor' },
		10050: { en: 'Downs Duvets', de: 'Daunen' },
		10052: { en: 'Sportswear', de: 'Sportbekleidung' },
		10055: { en: 'Curtains', de: 'Gardinen' },
		10057: { en: 'Proofing', de: 'Imprägnieren' },
		10072: { en: 'Basket Program', de: 'Korbprogramm' },
		10073: { en: 'Smoothing', de: 'Glätten' },
		10076: { en: 'Quick Hygiene', de: 'Schnell Hygiene' },
		10079: { en: 'ECO', de: 'Eco' },
		10080: { en: 'Hygiene 75°C', de: 'Hygiene' },
		10081: { en: 'Woollens Handcare', de: 'Wolle Handpflege' },
		10082: { en: 'Silks Handcare', de: 'Seide Handpflege' },
		10092: { en: 'Pillows Sanitize', de: 'Kopfkissen Hygiene' },
		13901: { en: 'Custom Program 1', de: 'Eigenes Programm 1' },
		13902: { en: 'Custom Program 2', de: 'Eigenes Programm 2' },
		13903: { en: 'Custom Program 3', de: 'Eigenes Programm 3' },
		13904: { en: 'Custom Program 4', de: 'Eigenes Programm 4' },
		13905: { en: 'Custom Program 5', de: 'Eigenes Programm 5' },
		13906: { en: 'Custom Program 6', de: 'Eigenes Programm 6' },
		13907: { en: 'Custom Program 7', de: 'Eigenes Programm 7' },
		13908: { en: 'Custom Program 8', de: 'Eigenes Programm 8' },
		13909: { en: 'Custom Program 9', de: 'Eigenes Programm 9' },
		13910: { en: 'Custom Program 10', de: 'Eigenes Programm 10' },
		13911: { en: 'Custom Program 11', de: 'Eigenes Programm 11' },
		13912: { en: 'Custom Program 12', de: 'Eigenes Programm 12' },
		13913: { en: 'Custom Program 13', de: 'Eigenes Programm 13' },
		13914: { en: 'Custom Program 14', de: 'Eigenes Programm 14' },
		13915: { en: 'Custom Program 15', de: 'Eigenes Programm 15' },
		13916: { en: 'Custom Program 16', de: 'Eigenes Programm 16' },
		13917: { en: 'Custom Program 17', de: 'Eigenes Programm 17' },
		13918: { en: 'Custom Program 18', de: 'Eigenes Programm 18' },
		13919: { en: 'Custom Program 19', de: 'Eigenes Programm 19' },
		13920: { en: 'Custom Program 20', de: 'Eigenes Programm 20' },
		99001: { en: 'Steam Smoothing', de: 'Dampfglätten' },
		99002: { en: 'Bed Linen', de: 'Bettwäsche' },
		99003: { en: 'Cottons Eco', de: 'Baumwolle Eco' },
		99004: { en: 'Shirts', de: 'Oberhemden' },
		99005: { en: 'Large Pillows', de: 'Große Kopfkissen' },
	},
	// Dishwasher (7, 8)
	7: {
		0: { en: 'Off', de: 'Aus' },
		1: { en: 'Intensive 75°C', de: 'Intensiv' },
		2: { en: 'Maintenance Program', de: 'Maschinenpflege' },
		3: { en: 'ECO', de: 'Eco' },
		6: { en: 'Automatic', de: 'Automatic' },
		7: { en: 'Automatic', de: 'Automatic' },
		9: { en: 'SolarSave', de: 'Solarspar' },
		10: { en: 'Gentle', de: 'Schonen' },
		11: { en: 'Extra Quiet', de: 'Extra leise' },
		12: { en: 'Hygiene 75°C', de: 'Hygiene' },
		13: { en: 'QuickPowerWash', de: 'QuickPowerWash' },
		14: { en: 'Pasta / Paella', de: 'Pasta/Paella' },
		17: { en: 'Tall Items 65°C', de: 'Große Teile' },
		19: { en: 'Glasses Warm', de: 'Gläser warm' },
		22: { en: 'ECO', de: 'Eco' },
		26: { en: 'Intensive 75°C', de: 'Intensiv' },
		27: { en: 'Maintenance Program', de: 'Maschinenpflege' },
		28: { en: 'ECO', de: 'Eco' },
		30: { en: 'Normal', de: 'Normal' },
		31: { en: 'Automatic', de: 'Automatic' },
		32: { en: 'Automatic', de: 'Automatic' },
		34: { en: 'SolarSave', de: 'Solarspar' },
		35: { en: 'Gentle', de: 'Schonen' },
		36: { en: 'Extra Quiet', de: 'Extra leise' },
		37: { en: 'Hygiene 75°C', de: 'Hygiene' },
		38: { en: 'QuickPowerWash', de: 'QuickPowerWash' },
		42: { en: 'Tall Items 65°C', de: 'Große Teile' },
		44: { en: 'PowerWash', de: 'PowerWash' },
		200: { en: 'ECO', de: 'ECO' },
		201: { en: 'Auto', de: 'Auto' },
		202: { en: 'Automatic', de: 'Automatic' },
		203: { en: 'ComfortWash', de: 'ComfortWash' },
		204: { en: 'PowerWash', de: 'PowerWash' },
		205: { en: 'Intensive 75°C', de: 'Intensiv 75°C' },
		206: { en: 'Hygiene 75°C', de: 'Hygiene 75°C' },
		207: { en: 'Extra Quiet 50°C', de: 'ExtraLeise 50°C' },
		208: { en: 'SolarSave', de: 'SolarSpar' },
		209: { en: 'ComfortWash 55°C', de: 'ComfortWash 55°C' },
		210: { en: 'Gentle 45°C', de: 'Fein 45°C' },
		211: {
			en: 'Tall items (without upper basket) 65°C',
			de: 'Ohne Oberkorb 65°C',
		},
		212: { en: 'Pasta / Paella', de: 'Pasta / Paella' },
		213: { en: 'Glasses', de: 'Gläser' },
		214: { en: 'Maintenance Program', de: 'Gerätepflege' },
		215: { en: 'Rinse Salt', de: 'Salz spülen' },
	},
	// Oven, Steam Oven, Microwave Combination (12, 13, 15, 31, 39, 40, 41, 42, 43, 45, 67)
	12: {
		0: { en: 'Off', de: 'Aus' },
		1: { en: 'Defrost', de: 'Auftauen' },
		6: { en: 'Eco Fan Heat', de: 'Eco Umluft' },
		7: { en: 'Auto Roast', de: 'Automatikbraten' },
		9: { en: 'Grill', de: 'Grill' },
		10: { en: 'Full Grill', de: 'Großflächengrill' },
		11: { en: 'Economy Grill', de: 'Spargrill' },
		13: { en: 'Fan Plus', de: 'Umluft' },
		14: { en: 'Intensive Bake', de: 'Intensivbacken' },
		19: { en: 'Microwave', de: 'Mikrowelle' },
		20: { en: 'Microwave Auto Roast', de: 'Mikrowelle – Automatikbraten' },
		21: { en: 'Microwave Grill', de: 'Mikrowelle – Grill' },
		22: { en: 'Microwave Fan Plus', de: 'Mikrowelle – Umluft' },
		23: { en: 'Microwave Fan Grill', de: 'Mikrowelle – Umluftgrill' },
		24: { en: 'Conventional Heat', de: 'Ober-/Unterhitze' },
		25: { en: 'Top Heat', de: 'Oberhitze' },
		29: { en: 'Fan Grill', de: 'Umluftgrill' },
		31: { en: 'Bottom Heat', de: 'Unterhitze' },
		35: {
			en: 'Moisture Plus Auto Roast',
			de: 'Feuchtigkeit plus – Automatikbraten',
		},
		40: { en: 'Moisture Plus Fan Plus', de: 'Feuchtigkeit plus – Umluft' },
		48: {
			en: 'Moisture Plus Auto Roast',
			de: 'Feuchtigkeit plus – Automatikbraten',
		},
		49: { en: 'Moisture Plus Fan Plus', de: 'Feuchtigkeit plus – Umluft' },
		50: {
			en: 'Moisture Plus Intensive Bake',
			de: 'Feuchtigkeit plus – Intensivbacken',
		},
		51: {
			en: 'Moisture Plus Conventional Heat',
			de: 'Feuchtigkeit plus – Ober-/Unterhitze',
		},
		53: { en: 'Popcorn', de: 'Popcorn' },
		54: { en: 'Quick Microwave', de: 'Schnell-Mikrowelle' },
		74: {
			en: 'Moisture Plus Intensive Bake',
			de: 'Feuchtigkeit plus – Intensivbacken',
		},
		76: {
			en: 'Moisture Plus Conventional Heat',
			de: 'Feuchtigkeit plus – Ober-/Unterhitze',
		},
		97: { en: 'Custom Program 1', de: 'Eigenes Programm 1' },
		98: { en: 'Custom Program 2', de: 'Eigenes Programm 2' },
		99: { en: 'Custom Program 3', de: 'Eigenes Programm 3' },
		100: { en: 'Custom Program 4', de: 'Eigenes Programm 4' },
		101: { en: 'Custom Program 5', de: 'Eigenes Programm 5' },
		102: { en: 'Custom Program 6', de: 'Eigenes Programm 6' },
		103: { en: 'Custom Program 7', de: 'Eigenes Programm 7' },
		104: { en: 'Custom Program 8', de: 'Eigenes Programm 8' },
		105: { en: 'Custom Program 9', de: 'Eigenes Programm 9' },
		106: { en: 'Custom Program 10', de: 'Eigenes Programm 10' },
		107: { en: 'Custom Program 11', de: 'Eigenes Programm 11' },
		108: { en: 'Custom Program 12', de: 'Eigenes Programm 12' },
		109: { en: 'Custom Program 13', de: 'Eigenes Programm 13' },
		110: { en: 'Custom Program 14', de: 'Eigenes Programm 14' },
		111: { en: 'Custom Program 15', de: 'Eigenes Programm 15' },
		112: { en: 'Custom Program 16', de: 'Eigenes Programm 16' },
		113: { en: 'Custom Program 17', de: 'Eigenes Programm 17' },
		114: { en: 'Custom Program 18', de: 'Eigenes Programm 18' },
		115: { en: 'Custom Program 19', de: 'Eigenes Programm 19' },
		116: { en: 'Custom Program 20', de: 'Eigenes Programm 20' },
		323: { en: 'Pyrolytic Cleaning', de: 'Pyrolyse' },
		326: { en: 'Descale', de: 'Entkalken' },
		327: { en: 'Evaporate Water', de: 'Wasser verdampfen' },
		335: { en: 'Shabbat Program', de: 'Schabbat-Programm' },
		336: { en: 'Yom Tov', de: 'Jom Tov' },
		356: { en: 'Defrost', de: 'Auftauen' },
		357: { en: 'Drying', de: 'Trocknen' },
		358: { en: 'Heat Crockery', de: 'Geschirr wärmen' },
		359: { en: 'Prove Dough', de: 'Teig gehen lassen' },
		360: { en: 'Low Temperature Cooking', de: 'Niedertemperaturgaren' },
		361: { en: 'Steam Cooking', de: 'Dampfgaren' },
		362: { en: 'Keeping Warm', de: 'Warmhalten' },
		364: { en: 'Apple Sponge', de: 'Apfel-Biskuit' },
		365: { en: 'Apple Pie', de: 'Apfelkuchen' },
		367: { en: 'Sponge Base', de: 'Biskuitboden' },
		368: { en: 'Swiss Roll', de: 'Biskuitrolle' },
		369: { en: 'Butter Cake', de: 'Butterkuchen' },
		373: { en: 'Marble Cake', de: 'Marmorkuchen' },
		374: { en: 'Fruit Streusel Cake', de: 'Obst-Streuselkuchen' },
		375: { en: 'Madeira Cake', de: 'Sandkuchen' },
		378: { en: 'Blueberry Muffins', de: 'Blaubeer-Muffins' },
		379: { en: 'Walnut Muffins', de: 'Walnuss-Muffins' },
		382: { en: 'Baguettes', de: 'Baguette' },
		383: { en: 'Flat Bread', de: 'Fladenbrot' },
		384: { en: 'Plaited Loaf', de: 'Hefezopf' },
		385: { en: 'Seeded Loaf', de: 'Saatenbrot' },
		386: { en: 'White Bread Baking Tin', de: 'Weißbrot (Kastenform)' },
		387: { en: 'White Bread On Tray', de: 'Weißbrot (Blech)' },
		394: { en: 'Duck', de: 'Ente' },
		396: { en: 'Chicken Whole', de: 'Hähnchen (ganz)' },
		397: { en: 'Chicken Thighs', de: 'Hähnchenschenkel' },
		401: { en: 'Turkey Whole', de: 'Pute (ganz)' },
		402: { en: 'Turkey Drumsticks', de: 'Putenkeulen' },
		406: { en: 'Veal Fillet Roast', de: 'Kalbsfilet braten' },
		407: {
			en: 'Veal Fillet Low Temperature Cooking',
			de: 'Kalbsfilet (Niedertemperatur)',
		},
		408: { en: 'Veal Knuckle', de: 'Kalbshaxe' },
		409: { en: 'Saddle Of Veal Roast', de: 'Kalbsrücken braten' },
		410: {
			en: 'Saddle Of Veal Low Temperature Cooking',
			de: 'Kalbsrücken (Niedertemperatur)',
		},
		411: { en: 'Braised Veal', de: 'Schmorbraten (Kalb)' },
		415: { en: 'Leg Of Lamb', de: 'Lammkeule' },
		419: { en: 'Saddle Of Lamb Roast', de: 'Lammrücken braten' },
		420: {
			en: 'Saddle Of Lamb Low Temperature Cooking',
			de: 'Lammrücken (Niedertemperatur)',
		},
		422: { en: 'Beef Fillet Roast', de: 'Rinderfilet braten' },
		423: {
			en: 'Beef Fillet Low Temperature Cooking',
			de: 'Rinderfilet (Niedertemperatur)',
		},
		427: { en: 'Braised Beef', de: 'Schmorbraten (Rind)' },
		428: { en: 'Roast Beef Roast', de: 'Roastbeef braten' },
		429: {
			en: 'Roast Beef Low Temperature Cooking',
			de: 'Roastbeef (Niedertemperatur)',
		},
		435: { en: 'Pork Smoked Ribs Roast', de: 'Kasseler braten' },
		436: {
			en: 'Pork Smoked Ribs Low Temperature Cooking',
			de: 'Kasseler (Niedertemperatur)',
		},
		443: { en: 'Ham Roast', de: 'Schinkenbraten' },
		449: { en: 'Pork Fillet Roast', de: 'Schweinefilet braten' },
		450: {
			en: 'Pork Fillet Low Temperature Cooking',
			de: 'Schweinefilet (Niedertemperatur)',
		},
		454: { en: 'Saddle Of Venison', de: 'Hirschrücken' },
		455: { en: 'Rabbit', de: 'Kaninchen' },
		456: { en: 'Saddle Of Roebuck', de: 'Rehrücken' },
		461: { en: 'Salmon Fillet', de: 'Lachsfilet' },
		464: { en: 'Potato Cheese Gratin', de: 'Kartoffel-Käse-Gratin' },
		486: { en: 'Trout', de: 'Forelle' },
		491: { en: 'Carp', de: 'Karpfen' },
		492: { en: 'Salmon Trout', de: 'Lachsforelle' },
		496: { en: 'Springform Tin 15cm', de: 'Springform 15 cm' },
		497: { en: 'Springform Tin 20cm', de: 'Springform 20 cm' },
		498: { en: 'Springform Tin 25cm', de: 'Springform 25 cm' },
		499: { en: 'Fruit Flan Puff Pastry', de: 'Obstkuchen (Blätterteig)' },
		500: {
			en: 'Fruit Flan Short Crust Pastry',
			de: 'Obstkuchen (Mürbeteig)',
		},
		501: { en: 'Sachertorte', de: 'Sachertorte' },
		502: {
			en: 'Chocolate Hazlenut Cake One Large',
			de: 'Schoko-Nuss-Kuchen (groß)',
		},
		503: {
			en: 'Chocolate Hazlenut Cake Several Small',
			de: 'Schoko-Nuss-Kuchen (klein)',
		},
		504: { en: 'Stollen', de: 'Stollen' },
		505: { en: 'Drop Cookies 1 Tray', de: 'Spritzgebäck (1 Blech)' },
		506: { en: 'Drop Cookies 2 Trays', de: 'Spritzgebäck (2 Bleche)' },
		507: { en: 'Linzer Augen 1 Tray', de: 'Linzer Augen (1 Blech)' },
		508: { en: 'Linzer Augen 2 Trays', de: 'Linzer Augen (2 Bleche)' },
		509: { en: 'Almond Macaroons 1 Tray', de: 'Mandelmakronen (1 Blech)' },
		510: {
			en: 'Almond Macaroons 2 Trays',
			de: 'Mandelmakronen (2 Bleche)',
		},
		512: {
			en: 'Biscuits Short Crust Pastry 1 Tray',
			de: 'Mürbeteigplätzchen (1 Blech)',
		},
		513: {
			en: 'Biscuits Short Crust Pastry 2 Trays',
			de: 'Mürbeteigplätzchen (2 Bleche)',
		},
		514: { en: 'Vanilla Biscuits 1 Tray', de: 'Vanillekipferl (1 Blech)' },
		515: {
			en: 'Vanilla Biscuits 2 Trays',
			de: 'Vanillekipferl (2 Bleche)',
		},
		516: { en: 'Choux Buns', de: 'Windbeutel' },
		518: { en: 'Spelt Bread', de: 'Dinkelbrot' },
		519: { en: 'Walnut Bread', de: 'Walnussbrot' },
		520: { en: 'Mixed Rye Bread', de: 'Roggenmischbrot' },
		522: { en: 'Dark Mixed Grain Bread', de: 'Dunkles Mehrkornbrot' },
		525: { en: 'Multigrain Rolls', de: 'Mehrkornbrötchen' },
		526: { en: 'Rye Rolls', de: 'Roggenbrötchen' },
		527: { en: 'White Rolls', de: 'Weiße Brötchen' },
		528: { en: 'Tart Flambe', de: 'Flammkuchen' },
		529: {
			en: 'Pizza Yeast Dough Baking Tray',
			de: 'Pizza Hefeteig (Blech)',
		},
		530: {
			en: 'Pizza Yeast Dough Round Baking Tine',
			de: 'Pizza Hefeteig (rund)',
		},
		531: {
			en: 'Pizza Oil Cheese Dough Baking Tray',
			de: 'Pizza Öl-Käse-Teig (Blech)',
		},
		532: {
			en: 'Pizza Oil Cheese Dough Round Baking Tine',
			de: 'Pizza Öl-Käse-Teig (rund)',
		},
		533: { en: 'Quiche Lorraine', de: 'Quiche Lorraine' },
		534: {
			en: 'Savoury Flan Puff Pastry',
			de: 'Herzhafter Kuchen (Blätterteig)',
		},
		535: {
			en: 'Savoury Flan Short Crust Pastry',
			de: 'Herzhafter Kuchen (Mürbeteig)',
		},
		536: { en: 'Osso Buco', de: 'Osso Buco' },
		539: { en: 'Beef Hash', de: 'Rinderhackgericht' },
		543: { en: 'Pork With Crackling', de: 'Krustenbraten' },
		550: { en: 'Potato Gratin', de: 'Kartoffelgratin' },
		551: { en: 'Cheese Souffle', de: 'Käsesoufflé' },
		554: { en: 'Baiser One Large', de: 'Baiser (groß)' },
		555: { en: 'Baiser Several Small', de: 'Baiser (mehrere kleine)' },
		556: { en: 'Lemon Meringue Pie', de: 'Zitronen-Baiser-Torte' },
		557: { en: 'Viennese Apple Strudel', de: 'Wiener Apfelstrudel' },
		621: { en: 'Prove 15 Min', de: 'Teig gehen (15 min)' },
		622: { en: 'Prove 30 Min', de: 'Teig gehen (30 min)' },
		623: { en: 'Prove 45 Min', de: 'Teig gehen (45 min)' },
		624: { en: 'Belgian Sponge Cake', de: 'Belgischer Biskuit' },
		625: { en: 'Goose Unstuffed', de: 'Gans (ungefüllt)' },
		634: {
			en: 'Rack Of Lamb With Vegetables',
			de: 'Lammkarree mit Gemüse',
		},
		635: { en: 'Yorkshire Pudding', de: 'Yorkshire Pudding' },
		636: { en: 'Meat Loaf', de: 'Hackbraten' },
		647: { en: 'Defrost Meat', de: 'Fleisch auftauen' },
		654: { en: 'Defrost Vegetables', de: 'Gemüse auftauen' },
		661: { en: 'Heating Bakes Gratins', de: 'Aufläufe/Gratins' },
		671: { en: 'Heating Vegetables', de: 'Gemüse erwärmen' },
		695: { en: 'Swiss Farmhouse Bread', de: 'Schweizer Bauernbrot' },
		696: { en: 'Plaited Swiss Loaf', de: 'Schweizer Zopf' },
		697: { en: 'Tiger Bread', de: 'Tigerbrot' },
		698: { en: 'Ginger Loaf', de: 'Ingwerkuchen' },
		699: { en: 'Goose Stuffed', de: 'Gans (gefüllt)' },
		700: { en: 'Beef Wellington', de: 'Beef Wellington' },
		701: { en: 'Pork Belly', de: 'Schweinebauch' },
		702: {
			en: 'Pikeperch Fillet With Vegetables',
			de: 'Zanderfilet mit Gemüse',
		},
		17003: { en: 'Off', de: 'Off' },
		99001: { en: 'Steam Bake', de: 'Dampfbacken' },
	},
	// Coffee System (17)
	17: {
		0: { en: 'Off', de: 'Aus' },
		17004: { en: 'Check Appliance', de: 'Gerät prüfen' },
		24000: { en: 'Ristretto', de: 'Ristretto' },
		24001: { en: 'Espresso', de: 'Espresso' },
		24002: { en: 'Coffee', de: 'Kaffee' },
		24003: { en: 'Long Coffee', de: 'Langer Kaffee' },
		24004: { en: 'Cappuccino', de: 'Cappuccino' },
		24005: { en: 'Cappuccino Italiano', de: 'Cappuccino Italiano' },
		24006: { en: 'Latte Macchiato', de: 'Latte Macchiato' },
		24007: { en: 'Espresso Macchiato', de: 'Espresso Macchiato' },
		24008: { en: 'Café au Lait', de: 'Café au Lait' },
		24009: { en: 'Caffè Latte', de: 'Caffè Latte' },
		24012: { en: 'Flat White', de: 'Flat White' },
		24013: { en: 'Very Hot Water', de: 'Sehr heißes Wasser' },
		24014: { en: 'Hot Water', de: 'Heißwasser' },
		24015: { en: 'Hot Milk', de: 'Heiße Milch' },
		24016: { en: 'Milk Foam', de: 'Milchschaum' },
		24017: { en: 'Black Tea', de: 'Schwarzer Tee' },
		24018: { en: 'Herbal Tea', de: 'Kräutertee' },
		24019: { en: 'Fruit Tea', de: 'Früchtetee' },
		24020: { en: 'Green Tea', de: 'Grüner Tee' },
		24021: { en: 'White Tea', de: 'Weißer Tee' },
		24022: { en: 'Japanese Tea', de: 'Japanischer Tee' },
		24032: { en: 'Ristretto', de: 'Ristretto' },
		24033: { en: 'Espresso', de: 'Espresso' },
		24034: { en: 'Coffee', de: 'Kaffee' },
		24035: { en: 'Long Coffee', de: 'Langer Kaffee' },
		24036: { en: 'Cappuccino', de: 'Cappuccino' },
		24037: { en: 'Cappuccino Italiano', de: 'Cappuccino Italiano' },
		24038: { en: 'Latte Macchiato', de: 'Latte Macchiato' },
		24039: { en: 'Espresso Macchiato', de: 'Espresso Macchiato' },
		24040: { en: 'Café au Lait', de: 'Café au Lait' },
		24041: { en: 'Caffè Latte', de: 'Caffè Latte' },
		24044: { en: 'Flat White', de: 'Flat White' },
		24045: { en: 'Very Hot Water', de: 'Sehr heißes Wasser' },
		24046: { en: 'Hot Water', de: 'Heißwasser' },
		24047: { en: 'Hot Milk', de: 'Heiße Milch' },
		24048: { en: 'Milk Foam', de: 'Milchschaum' },
		24049: { en: 'Black Tea', de: 'Schwarzer Tee' },
		24050: { en: 'Herbal Tea', de: 'Kräutertee' },
		24051: { en: 'Fruit Tea', de: 'Früchtetee' },
		24052: { en: 'Green Tea', de: 'Grüner Tee' },
		24053: { en: 'White Tea', de: 'Weißer Tee' },
		24064: { en: 'Ristretto', de: 'Ristretto' },
		24065: { en: 'Espresso', de: 'Espresso' },
		24066: { en: 'Coffee', de: 'Kaffee' },
		24067: { en: 'Long Coffee', de: 'Langer Kaffee' },
		24068: { en: 'Cappuccino', de: 'Cappuccino' },
		24069: { en: 'Cappuccino Italiano', de: 'Cappuccino Italiano' },
		24070: { en: 'Latte Macchiato', de: 'Latte Macchiato' },
		24071: { en: 'Espresso Macchiato', de: 'Espresso Macchiato' },
		24072: { en: 'Café au Lait', de: 'Café au Lait' },
		24073: { en: 'Caffè Latte', de: 'Caffè Latte' },
		24076: { en: 'Flat White', de: 'Flat White' },
		24077: { en: 'Very Hot Water', de: 'Sehr heißes Wasser' },
		24078: { en: 'Hot Water', de: 'Heißwasser' },
		24079: { en: 'Hot Milk', de: 'Heiße Milch' },
		24080: { en: 'Milk Foam', de: 'Milchschaum' },
		24081: { en: 'Black Tea', de: 'Schwarzer Tee' },
		24082: { en: 'Herbal Tea', de: 'Kräutertee' },
		24083: { en: 'Fruit Tea', de: 'Früchtetee' },
		24084: { en: 'Green Tea', de: 'Grüner Tee' },
		24085: { en: 'White Tea', de: 'Weißer Tee' },
		24086: { en: 'Japanese Tea', de: 'Japanischer Tee' },
		24096: { en: 'Ristretto', de: 'Ristretto' },
		24097: { en: 'Espresso', de: 'Espresso' },
		24098: { en: 'Coffee', de: 'Kaffee' },
		24099: { en: 'Long Coffee', de: 'Langer Kaffee' },
		24100: { en: 'Cappuccino', de: 'Cappuccino' },
		24101: { en: 'Cappuccino Italiano', de: 'Cappuccino Italiano' },
		24102: { en: 'Latte Macchiato', de: 'Latte Macchiato' },
		24104: { en: 'Café au Lait', de: 'Café au Lait' },
		24105: { en: 'Caffè Latte', de: 'Caffè Latte' },
		24108: { en: 'Flat White', de: 'Flat White' },
		24109: { en: 'Very Hot Water', de: 'Sehr heißes Wasser' },
		24110: { en: 'Hot Water', de: 'Heißwasser' },
		24111: { en: 'Hot Milk', de: 'Heiße Milch' },
		24112: { en: 'Milk Foam', de: 'Milchschaum' },
		24113: { en: 'Black Tea', de: 'Schwarzer Tee' },
		24114: { en: 'Herbal Tea', de: 'Kräutertee' },
		24115: { en: 'Fruit Tea', de: 'Früchtetee' },
		24116: { en: 'Green Tea', de: 'Grüner Tee' },
		24117: { en: 'White Tea', de: 'Weißer Tee' },
		24118: { en: 'Japanese Tea', de: 'Japanischer Tee' },
		24128: { en: 'Ristretto', de: 'Ristretto' },
		24129: { en: 'Espresso', de: 'Espresso' },
		24130: { en: 'Coffee', de: 'Kaffee' },
		24131: { en: 'Long Coffee', de: 'Langer Kaffee' },
		24132: { en: 'Cappuccino', de: 'Cappuccino' },
		24133: { en: 'Cappuccino Italiano', de: 'Cappuccino Italiano' },
		24134: { en: 'Latte Macchiato', de: 'Latte Macchiato' },
		24135: { en: 'Espresso Macchiato', de: 'Espresso Macchiato' },
		24136: { en: 'Café au Lait', de: 'Café au Lait' },
		24137: { en: 'Caffè Latte', de: 'Caffè Latte' },
		24140: { en: 'Flat White', de: 'Flat White' },
		24141: { en: 'Very Hot Water', de: 'Sehr heißes Wasser' },
		24142: { en: 'Hot Water', de: 'Heißwasser' },
		24143: { en: 'Hot Milk', de: 'Heiße Milch' },
		24144: { en: 'Milk Foam', de: 'Milchschaum' },
		24145: { en: 'Black Tea', de: 'Schwarzer Tee' },
		24146: { en: 'Herbal Tea', de: 'Kräutertee' },
		24147: { en: 'Fruit Tea', de: 'Früchtetee' },
		24148: { en: 'Green Tea', de: 'Grüner Tee' },
		24149: { en: 'White Tea', de: 'Weißer Tee' },
		24150: { en: 'Japanese Tea', de: 'Japanischer Tee' },
		24400: { en: 'Coffee Pot', de: 'Kaffeekanne' },
		24407: { en: 'Barista Assistant', de: 'Barista-Assistent' },
		24750: { en: 'Appliance Rinse', de: 'Gerätespülung' },
		24751: { en: 'Descaling', de: 'Entkalken' },
		24753: { en: 'Brewing Unit Degrease', de: 'Brüheinheit entfetten' },
		24754: { en: 'Milk Pipework Rinse', de: 'Milchleitung spülen' },
		24758: { en: 'Intermediate Rinsing', de: 'Zwischenspülung' },
		24759: { en: 'Appliance Rinse', de: 'Gerätespülung' },
		24773: { en: 'Appliance Rinse', de: 'Gerätespülung' },
		24778: { en: 'Automatic Maintenance', de: 'Automatische Pflege' },
		24787: { en: 'Appliance Rinse', de: 'Gerätespülung' },
		24788: { en: 'Appliance Rinse', de: 'Gerätespülung' },
		24789: { en: 'Milk Pipework Clean', de: 'Milchleitung reinigen' },
		29054: { en: 'Japanese Tea', de: 'Japanischer Tee' },
	},
	// Dish Warmer & Drawers (25, 48)
	25: {
		0: { en: 'Off', de: 'Aus' },
		1: { en: 'Warm Cups Glasses', de: 'Tassen/Gläser wärmen' },
		2: { en: 'Warm Dishes Plates', de: 'Geschirr/Teller wärmen' },
		3: { en: 'Keep Warm', de: 'Warmhalten' },
		4: { en: 'Slow Roasting', de: 'Niedertemperaturgaren' },
	},
};

export const PHASES: Record<
	number,
	Record<number, { en: string; de: string }>
> = {
	// Washing Machine (1, 24)
	1: {
		0: { en: 'Not running', de: 'Nicht aktiv' },
		1: { en: 'Pre-wash', de: 'Vorwäsche' },
		2: { en: 'Soak', de: 'Einweichen' },
		3: { en: 'Main wash', de: 'Hauptwäsche' },
		4: { en: 'Rinse', de: 'Spülen' },
		5: { en: 'Rinse hold', de: 'Spülstopp' },
		6: { en: 'Spin', de: 'Schleudern' },
		7: { en: 'Drain', de: 'Abpumpen' },
		8: { en: 'Anti-crease', de: 'Knitterschutz' },
		9: { en: 'Finished', de: 'Fertig' },
	},
	// Tumble Dryer (2)
	2: {
		0: { en: 'Not running', de: 'Nicht aktiv' },
		1: { en: 'Drying', de: 'Trocknen' },
		2: { en: 'Cooling down', de: 'Abkühlen' },
		3: { en: 'Anti-crease', de: 'Knitterschutz' },
		4: { en: 'Finished', de: 'Fertig' },
	},
	// Dishwasher (7, 8) - generic indices 0-6
	7: {
		0: { en: 'Not running', de: 'Nicht aktiv' },
		1: { en: 'Pre-wash', de: 'Vorspülen' },
		2: { en: 'Cleaning', de: 'Reinigen' },
		3: { en: 'Interim rinse', de: 'Zwischenspülen' },
		4: { en: 'Final rinse', de: 'Klarspülen' },
		5: { en: 'Drying', de: 'Trocknen' },
		6: { en: 'Finished', de: 'Fertig' },
		// Miele API raw phase IDs (local-unbound protocol)
		1793: { en: 'Pre-wash', de: 'Vorspülen' },
		1794: { en: 'Soaking', de: 'Einweichen' },
		1795: { en: 'Main wash', de: 'Hauptwäsche' },
		1796: { en: 'Interim rinse', de: 'Zwischenspülen' },
		1797: { en: 'Final rinse', de: 'Klarspülen' },
		1798: { en: 'Drying', de: 'Trocknen' },
		1799: { en: 'Finished', de: 'Fertig' },
		1800: { en: 'Finished', de: 'Fertig' },
	},
	// Oven (12)
	12: {
		0: { en: 'Not running', de: 'Nicht aktiv' },
		1: { en: 'Heating up', de: 'Aufheizen' },
		2: { en: 'Cooking', de: 'Garen / Backen' },
		3: { en: 'Cooling down', de: 'Abkühlen' },
		4: { en: 'Finished', de: 'Fertig' },
	},
};

export function getDeviceCategory(
	type: number,
	lang: 'de' | 'en' = 'de',
): string {
	const cat = DEVICE_CATEGORIES[type];
	if (cat) {
		return cat[lang] || cat.de;
	}
	return lang === 'de'
		? `Unbekanntes Gerät (${type})`
		: `Unknown Device (${type})`;
}

export function getStatusText(
	status: number,
	lang: 'de' | 'en' = 'de',
): string {
	const s = STATUS_MAP[status];
	if (s) {
		return s[lang] || s.de;
	}
	return lang === 'de' ? `Status ${status}` : `Status ${status}`;
}

export function getProgramTypeText(
	type: number,
	lang: 'de' | 'en' = 'de',
): string {
	const p = PROGRAM_TYPES[type];
	if (p) {
		return p[lang] || p.de;
	}
	return String(type);
}

export function getDryingStepText(
	step: number,
	lang: 'de' | 'en' = 'de',
): string {
	const d = DRYING_STEPS[step];
	if (d) {
		return d[lang] || d.de;
	}
	return String(step);
}

export function resolveProgramDeviceType(deviceType: number): number {
	if (deviceType === 8) {
		return 7;
	}
	if ([13, 15, 16, 31, 39, 40, 41, 42, 43, 45, 67].includes(deviceType)) {
		return 12;
	}
	if (deviceType === 48) {
		return 25;
	}
	return deviceType;
}

export function resolvePhaseDeviceType(deviceType: number): number {
	if (deviceType === 24) {
		return 1;
	}
	if (deviceType === 8) {
		return 7;
	}
	if ([13, 15, 16, 31, 39, 40, 41, 42, 43, 45, 67].includes(deviceType)) {
		return 12;
	}
	return deviceType;
}

export function getProgramText(
	deviceType: number,
	programId: number,
	lang: 'de' | 'en' = 'de',
): string {
	let dt = deviceType;
	if (dt === 24) {
		if (PROGRAMS[1]?.[programId])
			return PROGRAMS[1][programId][lang] || PROGRAMS[1][programId].de;
		if (PROGRAMS[2]?.[programId])
			return PROGRAMS[2][programId][lang] || PROGRAMS[2][programId].de;
		dt = 1;
	} else {
		dt = resolveProgramDeviceType(dt);
	}
	const table = PROGRAMS[dt];
	if (table && table[programId]) {
		return table[programId][lang] || table[programId].de;
	}
	return programId ? `Program ${programId}` : '';
}

export function getProgramPhaseText(
	deviceType: number,
	phaseId: number,
	lang: 'de' | 'en' = 'de',
): string {
	const dt = resolvePhaseDeviceType(deviceType);
	const table = PHASES[dt];
	if (table && table[phaseId]) {
		return table[phaseId][lang] || table[phaseId].de;
	}
	return phaseId ? `Phase ${phaseId}` : '';
}

export function timeToMinutes(arr?: unknown): number | null {
	if (!Array.isArray(arr) || arr.length < 2) {
		return null;
	}
	const h = Number(arr[0]) || 0;
	const m = Number(arr[1]) || 0;
	return h * 60 + m;
}

export function timeToHHMM(arr?: unknown): string {
	if (!Array.isArray(arr) || arr.length < 2) {
		return '';
	}
	const h = Number(arr[0]) || 0;
	const m = Number(arr[1]) || 0;
	return `${h}:${String(m).padStart(2, '0')}`;
}

export function tempToCelsius(raw?: unknown): number | null {
	if (raw === null || raw === undefined || raw === -32768) {
		return null;
	}
	const num = Number(raw);
	if (Number.isNaN(num) || num === -32768) {
		return null;
	}
	return Math.round((num / 100) * 10) / 10;
}
