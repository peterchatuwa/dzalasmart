export const REGION_DISTRICTS = {
  "Northern Region": ["Chitipa", "Karonga", "Rumphi", "Mzimba", "Nkhata Bay", "Likoma"],
  "Central Region": ["Kasungu", "Nkhotakota", "Ntchisi", "Dowa", "Salima", "Lilongwe", "Mchinji", "Dedza", "Ntcheu"],
  "Southern Region": ["Mangochi", "Machinga", "Zomba", "Chiradzulu", "Blantyre", "Mwanza", "Neno", "Thyolo", "Mulanje", "Phalombe", "Chikwawa", "Nsanje", "Balaka"],
};

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
