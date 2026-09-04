export const REGION_DISTRICTS = {
  "Northern Region": ["Chitipa", "Karonga", "Rumphi", "Mzimba", "Nkhata Bay", "Likoma"],
  "Central Region": ["Kasungu", "Nkhotakota", "Ntchisi", "Dowa", "Salima", "Lilongwe", "Mchinji", "Dedza", "Ntcheu"],
  "Southern Region": ["Mangochi", "Machinga", "Zomba", "Chiradzulu", "Blantyre", "Mwanza", "Neno", "Thyolo", "Mulanje", "Phalombe", "Chikwawa", "Nsanje", "Balaka"],
};

export const DISTRICT_COORDS = {
  Chitipa: [-9.70, 33.27],
  Karonga: [-9.93, 33.93],
  Rumphi: [-11.02, 33.86],
  Mzimba: [-11.90, 33.60],
  "Nkhata Bay": [-11.61, 34.30],
  Likoma: [-12.07, 34.73],
  Kasungu: [-13.03, 33.48],
  Ntchisi: [-13.37, 34.00],
  Nkhotakota: [-12.92, 34.30],
  Dowa: [-13.65, 33.93],
  Salima: [-13.78, 34.43],
  Lilongwe: [-13.98, 33.78],
  Mchinji: [-13.80, 32.88],
  Dedza: [-14.38, 34.33],
  Ntcheu: [-14.82, 34.63],
  Mangochi: [-14.48, 35.26],
  Machinga: [-15.15, 35.52],
  Balaka: [-14.98, 34.95],
  Zomba: [-15.39, 35.32],
  Neno: [-15.40, 34.65],
  Blantyre: [-15.79, 35.00],
  Chiradzulu: [-15.70, 35.14],
  Mwanza: [-15.60, 34.52],
  Thyolo: [-16.07, 35.14],
  Mulanje: [-16.03, 35.50],
  Phalombe: [-15.80, 35.66],
  Chikwawa: [-16.03, 34.79],
  Nsanje: [-16.92, 35.26],
  Mzuzu: [-11.45, 34.02],
};

export const ALERT_DISTRICTS = [
  "Karonga", "Mzuzu", "Rumphi", "Lilongwe", "Kasungu", "Salima", "Blantyre", "Chikwawa", "Nsanje",
];

export const DISTRICT_EPAS = {
  Chitipa: ["Misuku", "Kameme", "Bulambia", "Kavukuku", "Kalenje"],
  Karonga: ["Central", "North", "South", "Nyungwe", "Mpingu"],
  Rumphi: ["Mwazisi", "Mhuju", "Bolero", "Ntchenachena", "Katowo"],
  Mzimba: ["Manyamula", "Vibangalala", "Ekwendeni", "Champhira", "Luwawa", "Mbawa", "Msuzi"],
  "Nkhata Bay": ["Chikwina", "Mpaji", "Kalwe", "Chintheche"],
  Likoma: ["Likoma Island", "Chizumulu"],
  Kasungu: ["Kaluluma", "Chamama", "Lisasadzi", "Chulu", "Santhe", "Linyangwa", "Mwase"],
  Ntchisi: ["Kalira", "Malomo", "Kansonga", "Chipuka", "Nthondo"],
  Mchinji: ["Kalulu", "Mkanda", "Mikundi", "Chioshya", "Msitu"],
  Lilongwe: ["Mitundu", "Chitedze", "Mpingu", "Chileka", "Nkhoma", "Nathenje", "Kanyama"],
  Dedza: ["Linthipe", "Kaphuka", "Mayani", "Chafumbwa", "Golomoti", "Mtakataka"],
  Ntcheu: ["Kandeu", "Njolomole", "Tsangano", "Manjawira", "Bilira"],
  Dowa: ["Madisi", "Mponela", "Chikalema", "Mndolera", "Nalunga"],
  Nkhotakota: ["Linga", "Mwansambo", "Zidyana", "Mtosa"],
  Salima: ["Chinguluwe", "Khombedza", "Kalonga", "Mchoka"],
  Blantyre: ["Lirangwe", "Lunzu", "Mtonda", "Kunthembwe"],
  Chiradzulu: ["Thumbwe", "Mbulumbuzi", "Namitambo"],
  Thyolo: ["Dwale", "Khonjeni", "Matapwata", "Masambanjati"],
  Mulanje: ["Mpouma", "Thuchila", "Tamani", "Kamwendo"],
  Zomba: ["Central", "Malosa", "Thondwe", "Chingale"],
  Machinga: ["Nsanama", "Nyambi", "Chikweo", "Domasi"],
  Balaka: ["Bazale", "Utale", "Rivirivi", "Phalula"],
  Chikwawa: ["Mitole", "Mbewe", "Livunzu", "Ngabu", "Kalemba"],
  Nsanje: ["Makhanga", "Mpatsa", "Nyachilenda", "Ndamera"],
  Mangochi: ["Namwera", "Malombe", "Nankumba", "Katema", "Mtakuja"],
  Mwanza: ["Mwanza Central", "Thambani"],
  Neno: ["Neno Central", "Mkanda", "Lisungwi"],
  Phalombe: ["Naminjiwa", "Nkhulambe", "Phalombe Central", "Chitakale"],
};

export function regionForDistrict(district) {
  if (district === "Mzuzu") return "Northern Region";
  return Object.keys(REGION_DISTRICTS).find((region) =>
    REGION_DISTRICTS[region].includes(district)
  ) || null;
}

export function listDistricts() {
  return Object.entries(REGION_DISTRICTS).flatMap(([region, districts]) =>
    districts.map((name) => ({
      name,
      region,
      epas: DISTRICT_EPAS[name] || [],
    }))
  );
}

export function assertPlace(district, epa) {
  const region = regionForDistrict(district);
  if (!region) {
    const error = new Error("Unknown district");
    error.status = 400;
    throw error;
  }
  if (epa && !(DISTRICT_EPAS[district] || []).includes(epa)) {
    const error = new Error("Unknown EPA for that district");
    error.status = 400;
    throw error;
  }
  return region;
}
