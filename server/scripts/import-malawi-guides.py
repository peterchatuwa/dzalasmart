"""Build places.json and crop-calendars.json from the Malawi guide workbooks."""

import json
import re
from pathlib import Path

import openpyxl

DOWNLOADS = Path(r"C:\Users\peter\Downloads\Zammunda")
OUT = Path(__file__).resolve().parents[1] / "data"
PLACES = DOWNLOADS / "DATA FOR ADDs, DISTRICT, EPAS FOR ZAMUNDA.xlsx"

DISTRICT_FIX = {
    "Karong": "Karonga",
    "Chtipa": "Chitipa",
    "Mmachiga": "Machinga",
    "Nkhatabay": "Nkhata Bay",
    "Lilongwe West": "Lilongwe",
    "Lilongwe East": "Lilongwe",
    "Mzimba South": "Mzimba",
    "Mzimba North": "Mzimba",
    "Dowa West": "Dowa",
    "Dowa East": "Dowa",
}

REGIONS = {
    "Northern Region": ["Chitipa", "Karonga", "Rumphi", "Mzimba", "Nkhata Bay", "Likoma"],
    "Central Region": ["Kasungu", "Nkhotakota", "Ntchisi", "Dowa", "Salima", "Lilongwe", "Mchinji", "Dedza", "Ntcheu"],
    "Southern Region": [
        "Mangochi", "Machinga", "Zomba", "Chiradzulu", "Blantyre", "Mwanza", "Neno",
        "Thyolo", "Mulanje", "Phalombe", "Chikwawa", "Nsanje", "Balaka",
    ],
}

LOW = ["Nsanje", "Chikwawa", "Neno", "Balaka", "Salima", "Nkhotakota", "Karonga", "Mangochi"]
MEDIUM = [
    "Lilongwe", "Dedza", "Dowa", "Ntchisi", "Kasungu", "Mchinji", "Zomba", "Machinga",
    "Blantyre", "Chiradzulu", "Thyolo", "Phalombe", "Mzimba",
]
HIGH = ["Rumphi", "Chitipa", "Nkhata Bay", "Ntcheu", "Mulanje"]

SCHEDULES = {
    "maize": DOWNLOADS / "productionsheets" / "Malawi_Maize_Master_Production_Sheet.xlsx",
    "soya": DOWNLOADS / "productionsheets" / "Malawi_Soybean_Master_Production_Sheet.xlsx",
    "groundnut": DOWNLOADS / "productionsheets" / "Malawi_Groundnut_Master_Production_Sheet.xlsx",
    "rice": DOWNLOADS / "productionsheets" / "Malawi_Rice_Master_Production_Sheet.xlsx",
    "tobacco": DOWNLOADS / "productionsheets" / "Malawi_Tobacco_Master_Production_Sheet.xlsx",
}

VARIETIES = {
    "maize": [
        {"altitude": "low", "districts": LOW, "varieties": "SC 301, SC 419 or Peacock 10"},
        {"altitude": "medium", "districts": MEDIUM, "varieties": "SC 555, SC 529, MH 26 or Falcon M601"},
        {"altitude": "high", "districts": HIGH, "varieties": "SC 719, SC 727 or MH 34"},
    ],
    "soya": [
        {"altitude": "low", "districts": LOW, "varieties": "Tikolore"},
        {"altitude": "medium", "districts": MEDIUM, "varieties": "Makwacha or Nasoko"},
        {"altitude": "high", "districts": HIGH, "varieties": "Soprano"},
    ],
    "groundnut": [
        {"altitude": "low", "districts": LOW, "varieties": "CG 7, Kakoma or Chitala"},
        {"altitude": "medium", "districts": MEDIUM, "varieties": "CG 7, CG 9, CG 11, Nsinjiro or Baka"},
        {"altitude": "high", "districts": HIGH, "varieties": "Nsinjiro, CG 9 or Baka"},
    ],
    "rice": [
        {"altitude": "low", "districts": LOW + ["Machinga", "Zomba"], "varieties": "Kilombero, Faya or NERICA 4"},
        {"altitude": "medium", "districts": MEDIUM, "varieties": "NERICA 1, NERICA 2 or Makassane"},
        {"altitude": "high", "districts": HIGH, "varieties": "NERICA 7"},
    ],
    "tobacco": [
        {"altitude": "low", "districts": LOW, "varieties": "Drought-tolerant Burley"},
        {"altitude": "medium", "districts": MEDIUM, "varieties": "Kutsaga T71, KM10 or Burley BRK"},
        {"altitude": "high", "districts": HIGH, "varieties": "Flue-cured Virginia or late Burley"},
    ],
}


def clean_name(value):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text


def canonical_district(value):
    name = clean_name(value)
    if not name or name.upper() == "DISTRICT" or "total" in name.lower():
        return None
    return DISTRICT_FIX.get(name, name)


def region_for(district):
    for region, names in REGIONS.items():
        if district in names:
            return region
    return None


def load_places():
    wb = openpyxl.load_workbook(PLACES, read_only=True, data_only=True)
    ws = wb.active
    districts = {}
    for index, row in enumerate(ws.iter_rows(values_only=True)):
        if index < 2 or not row:
            continue
        district = canonical_district(row[2] if len(row) > 2 else None)
        region = region_for(district) if district else None
        if not region:
            continue
        epa = clean_name(row[3] if len(row) > 3 else None)
        section = clean_name(row[4] if len(row) > 4 else None)
        add = clean_name(row[1] if len(row) > 1 else None)
        if not epa or epa.upper() in {"NAME OF EPA", "EPA", "NONE"}:
            continue
        if section.upper() in {"NAME OF SECTION", "SECTION", "NONE"} or "total" in section.lower():
            section = ""
        bucket = districts.setdefault(district, {"region": region, "add": add if add and add != "ADD" else "", "epas": {}})
        if add and add != "ADD" and not bucket["add"]:
            bucket["add"] = add
        sections = bucket["epas"].setdefault(epa, [])
        if section and section not in sections:
            sections.append(section)
    wb.close()
    for district in districts.values():
        district["epas"] = {
            epa: sections
            for epa, sections in sorted(district["epas"].items(), key=lambda item: item[0].lower())
        }
    return districts


def parse_window(text):
    cleaned = text.replace("–", "-").replace("—", "-")
    match = re.search(r"days?\s*(-?\d+)\s*(?:to|-)\s*(-?\d+)", cleaned, re.I)
    if match:
        return int(match.group(1)), int(match.group(2).rstrip("+"))
    match = re.search(r"day\s*(-?\d+)", cleaned, re.I)
    if match:
        day = int(match.group(1))
        return day, day
    if "post-harvest" in cleaned.lower():
        return 141, 170
    return None


def action_types(text):
    lowered = text.lower()
    found = []
    if any(word in lowered for word in ("weed", "earthing", "earth up", "re-ridge")):
        found.append("weeding")
    if any(word in lowered for word in ("fertil", "urea", "npk", "gypsum", "basal", "nitrogen", "compound", "can ")):
        found.append("fertilizing")
    if any(word in lowered for word in ("harvest", "thresh", "store", "sun-dry", "curing", "reaping", "lifting")):
        found.append("harvesting")
    if any(word in lowered for word in ("scout", "armyworm", "pest", "disease", "aphid", "blast", "borer", "rust")):
        found.append("scouting")
    if any(word in lowered for word in ("irrigat", "water depth", "keep soil moist", "saturated", "flood")):
        found.append("irrigation")
    if not found:
        found.append("field_work")
    return list(dict.fromkeys(found))


def short_label(kind, text, counts):
    counts[kind] = counts.get(kind, 0) + 1
    number = counts[kind]
    if kind == "weeding":
        names = ["First weeding", "Second weeding", "Third weeding", "Later weeding"]
        return names[min(number, len(names)) - 1]
    if kind == "fertilizing":
        lowered = text.lower()
        if "gypsum" in lowered:
            return "Apply gypsum"
        if "basal" in lowered or "npk" in lowered or "compound" in lowered:
            return "Apply basal fertiliser"
        return "Top-dress with nitrogen"
    if kind == "harvesting":
        return "Dry and store" if any(word in text.lower() for word in ("store", "dry", "thresh")) else "Harvest"
    if kind == "scouting":
        return "Scout the crop"
    if kind == "irrigation":
        return "Check the water"
    clause = re.split(r"[.:]", text, maxsplit=1)[0].strip()
    return clause[:72]


def schedule_cells(row):
    return [clean_name(cell) for cell in row if clean_name(cell)]


def load_calendar(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = next(
        (wb[name] for name in wb.sheetnames if re.search(r"schedule|daily|operation|activity", name, re.I)),
        None,
    )
    tasks = []
    counts = {}
    if sheet:
        for row in sheet.iter_rows(values_only=True):
            cells = schedule_cells(row or [])
            window = None
            day_text = ""
            for cell in cells:
                parsed = parse_window(cell)
                if parsed and len(cell) < 48:
                    window = parsed
                    day_text = cell
                    break
            details = [cell for cell in cells if cell != day_text and len(cell) > 40]
            if not window or not details:
                continue
            start, end = window
            if end < start:
                start, end = end, start
            detail = details[0][:280]
            for kind in action_types(detail):
                if kind == "irrigation" and end - start > 7:
                    continue
                tasks.append({
                    "from": start,
                    "to": end,
                    "type": kind,
                    "label": short_label(kind, detail, counts),
                    "detail": detail,
                })
    wb.close()
    return tasks


MARGIN_FILE = DOWNLOADS / "Copy of GROSS MARGINS 2025-26.xlsx"
SEED_FILE = DOWNLOADS / "attachments(1)" / "Malawi_All_Crops_Seed_Requirements_Master.xlsx"
AGRONOMY_FILE = DOWNLOADS / "attachments(1)" / "Malawi_All_Crops_Agronomic_Seed_Master.xlsx"
OFFTAKE_FILE = DOWNLOADS / "attachments(1)" / "Malawi_All_Crops_Livestock_Offtake_Logistics_Master.xlsx"

CROP_NAMES = {
    "maize": "maize",
    "rice": "rice",
    "rice-paddy": "rice",
    "soybean": "soya",
    "soybeans": "soya",
    "soya beans": "soya",
    "soya": "soya",
    "groundnut": "groundnut",
    "groundnuts": "groundnut",
    "groundnuts-shelled": "groundnut",
    "tobacco": "tobacco",
    "beans": "bean",
    "common beans": "bean",
    "pure beans": "bean",
    "cotton": "cotton",
}

MARGIN_DISTRICTS = {
    "CHITIPA DISTRICT": "Chitipa",
    "KARONGA DISTRICT": "Karonga",
    "RUMPHI DISTRICT": "Rumphi",
    "NKHATABAY DISTRICT": "Nkhata Bay",
    "MZIMBA NORTH DISTRICT": "Mzimba North",
    "MZIMBA SOUTH DISTRICT": "Mzimba South",
    "LIKOMA DISTRICT": "Likoma",
    "KASUNGU DISTRICT": "Kasungu",
    "DOWA WEST DISTRICT": "Dowa West",
    "DOWA EAST DISTRICT": "Dowa East",
    "NTCHISI DISTRICT": "Ntchisi",
    "MCHINJI DISTRICT": "Mchinji",
    "NKHOTAKOTA DISTRICT": "Nkhotakota",
    "SALIMA DISTRICT": "Salima",
    "LILONGWE EAST DISTRICT": "Lilongwe East",
    "LILONGWE WEST DISTRICT": "Lilongwe West",
    "DEDZA DISTRICT": "Dedza",
    "NTCHEU DISTRICT": "Ntcheu",
    "BALAKA DISTRICT": "Balaka",
    "MANGOCHI DISTRICT": "Mangochi",
    "MACHINGA DISTRICT": "Machinga",
    "ZOMBA DISTRICT": "Zomba",
    "MWANZA DISTRICT": "Mwanza",
    "NENO DISTRICT": "Neno",
    "BLANTYRE DISTRICT": "Blantyre",
    "CHIRADZULO DISTRICT": "Chiradzulu",
    "THYOLO DISTRICT": "Thyolo",
    "MULANJE DISTRICT": "Mulanje",
    "PHALOMBE DISTRICT": "Phalombe",
    "CHIKWAWA DISTRICT": "Chikwawa",
    "NSANJE DISTRICT": "Nsanje",
    "NATIONAL": "National",
}


def crop_key(name):
    text = re.sub(r"\(.*?\)", "", clean_name(name).lower()).strip()
    return CROP_NAMES.get(text, "")


def parse_amount(text):
    raw = clean_name(text).replace(",", "")
    numbers = [float(item) for item in re.findall(r"\d+(?:\.\d+)?", raw)]
    if not numbers:
        return None, ""
    amount = sum(numbers[:2]) / min(len(numbers), 2)
    unit = "kg"
    lowered = raw.lower()
    if "mats" in lowered:
        unit = "mats"
    elif re.search(r"\bg\b", lowered):
        unit = "g"
    return round(amount, 2), unit


def finite(value):
    if isinstance(value, (int, float)) and value == value and value > 0:
        return round(float(value), 2)
    return None


def load_margins():
    wb = openpyxl.load_workbook(MARGIN_FILE, read_only=True, data_only=True)
    ws = wb["GROSS MARGIN SUMMARIES 25.26"]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    header = rows[2]
    columns = []
    for index, label in enumerate(header):
        district = MARGIN_DISTRICTS.get(clean_name(label).upper())
        if district:
            columns.append((district, index))
    margins = {}
    for row in rows[4:]:
        key = crop_key(row[1] if len(row) > 1 else "")
        if not key:
            continue
        for district, start in columns:
            yield_kg = finite(row[start] if start < len(row) else None)
            price = finite(row[start + 1] if start + 1 < len(row) else None)
            cost = finite(row[start + 3] if start + 3 < len(row) else None)
            margin = row[start + 4] if start + 4 < len(row) else None
            break_even_yield = finite(row[start + 5] if start + 5 < len(row) else None)
            break_even_price = finite(row[start + 6] if start + 6 < len(row) else None)
            if not yield_kg or not price:
                continue
            margins.setdefault(key, {})[district] = {
                "yieldKgHa": yield_kg,
                "priceMwk": price,
                "costMwk": cost,
                "marginMwk": round(float(margin), 2) if isinstance(margin, (int, float)) and margin == margin else None,
                "breakEvenYield": break_even_yield,
                "breakEvenPrice": break_even_price,
            }
    return margins


def load_seed():
    wb = openpyxl.load_workbook(SEED_FILE, read_only=True, data_only=True)
    ws = wb["Master Seed Requirements"]
    seed = {}
    for index, row in enumerate(ws.iter_rows(values_only=True)):
        if index == 0 or not row or not row[0]:
            continue
        district = canonical_district(row[0]) or clean_name(row[0])
        key = crop_key(row[2])
        amount, unit = parse_amount(row[4])
        if not district or not key or not amount:
            continue
        seed.setdefault(key, {})[district] = {
            "variety": clean_name(row[3]),
            "perHa": amount,
            "unit": unit,
        }
    wb.close()
    return seed


def load_inputs():
    wb = openpyxl.load_workbook(AGRONOMY_FILE, read_only=True, data_only=True)
    ws = wb["Fertilizer & Chemicals"]
    groups = {"Grains & Cereals": ["maize", "rice"], "Legumes & Oilseeds": ["soya", "groundnut", "bean"]}
    inputs = {key: [] for names in groups.values() for key in names}
    for index, row in enumerate(ws.iter_rows(values_only=True)):
        if index == 0 or not row or not row[0]:
            continue
        crops = groups.get(clean_name(row[0]), [])
        item = {
            "type": clean_name(row[1]),
            "specification": clean_name(row[2]),
            "perHa": clean_name(row[4]),
        }
        for key in crops:
            inputs[key].append(item)
    suppliers = []
    sheet = wb["Agro-Input Suppliers"]
    for index, row in enumerate(sheet.iter_rows(values_only=True)):
        if index == 0 or not row or not row[1]:
            continue
        districts = [canonical_district(part) or clean_name(part) for part in re.split(r"&|,", clean_name(row[1]))]
        districts = [name for name in districts if name and "total" not in name.lower()]
        epas = [clean_name(part) for part in clean_name(row[2]).split(",") if clean_name(part)]
        suppliers.append({
            "districts": districts,
            "epas": epas,
            "suppliers": clean_name(row[3]),
        })
    wb.close()
    return inputs, suppliers


def load_offtake():
    wb = openpyxl.load_workbook(OFFTAKE_FILE, read_only=True, data_only=True)
    ws = wb["Crops Offtake & Logistics"]
    offtake = {}
    for index, row in enumerate(ws.iter_rows(values_only=True)):
        if index == 0 or not row or not row[1]:
            continue
        key = crop_key(row[1])
        if not key or key in offtake:
            continue
        offtake[key] = {
            "yieldPerHa": clean_name(row[3]),
            "transport": clean_name(row[5]),
            "buyers": clean_name(row[6]),
            "avoid": clean_name(row[7]),
            "booking": clean_name(row[8]),
        }
    wb.close()
    return offtake


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    places = load_places()
    calendars = {}
    for key, path in SCHEDULES.items():
        calendars[key] = {"bands": VARIETIES[key], "tasks": load_calendar(path)}
    inputs, suppliers = load_inputs()
    guides = {
        "margins": load_margins(),
        "seed": load_seed(),
        "inputs": inputs,
        "suppliers": suppliers,
        "offtake": load_offtake(),
    }
    (OUT / "places.json").write_text(json.dumps(places, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "crop-calendars.json").write_text(json.dumps(calendars, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "farm-guides.json").write_text(json.dumps(guides, ensure_ascii=False, indent=2), encoding="utf-8")
    epa_count = sum(len(item["epas"]) for item in places.values())
    print(f"districts {len(places)} epas {epa_count}")
    for key, calendar in calendars.items():
        print(f"{key} tasks {len(calendar['tasks'])}")
    print("margin crops", {key: len(rows) for key, rows in guides["margins"].items()})
    print("seed crops", {key: len(rows) for key, rows in guides["seed"].items()})
    print("suppliers", len(guides["suppliers"]), "offtake", list(guides["offtake"]))


if __name__ == "__main__":
    main()
