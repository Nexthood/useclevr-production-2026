export type CountryCentroid = {
  countryCode: string
  countryName: string
  latitude: number
  longitude: number
  aliases: string[]
}

export const COUNTRY_CENTROIDS: CountryCentroid[] = [
  { countryCode: "US", countryName: "United States", latitude: 37.0902, longitude: -95.7129, aliases: ["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america", "america"] },
  { countryCode: "MX", countryName: "Mexico", latitude: 23.6345, longitude: -102.5528, aliases: ["mexico", "méxico"] },
  { countryCode: "AR", countryName: "Argentina", latitude: -38.4161, longitude: -63.6167, aliases: ["argentina"] },
  { countryCode: "IT", countryName: "Italy", latitude: 41.8719, longitude: 12.5674, aliases: ["italy", "italia"] },
  { countryCode: "AE", countryName: "United Arab Emirates", latitude: 23.4241, longitude: 53.8478, aliases: ["uae", "u.a.e.", "united arab emirates", "emirates"] },
  { countryCode: "DE", countryName: "Germany", latitude: 51.1657, longitude: 10.4515, aliases: ["germany", "deutschland"] },
  { countryCode: "NL", countryName: "Netherlands", latitude: 52.1326, longitude: 5.2913, aliases: ["netherlands", "the netherlands", "holland", "nederland"] },
  { countryCode: "GB", countryName: "United Kingdom", latitude: 55.3781, longitude: -3.436, aliases: ["uk", "u.k.", "united kingdom", "great britain", "britain", "england"] },
  { countryCode: "CA", countryName: "Canada", latitude: 56.1304, longitude: -106.3468, aliases: ["canada"] },
  { countryCode: "BR", countryName: "Brazil", latitude: -14.235, longitude: -51.9253, aliases: ["brazil", "brasil"] },
  { countryCode: "CL", countryName: "Chile", latitude: -35.6751, longitude: -71.543, aliases: ["chile"] },
  { countryCode: "CO", countryName: "Colombia", latitude: 4.5709, longitude: -74.2973, aliases: ["colombia"] },
  { countryCode: "FR", countryName: "France", latitude: 46.2276, longitude: 2.2137, aliases: ["france"] },
  { countryCode: "ES", countryName: "Spain", latitude: 40.4637, longitude: -3.7492, aliases: ["spain", "españa", "espana"] },
  { countryCode: "BE", countryName: "Belgium", latitude: 50.5039, longitude: 4.4699, aliases: ["belgium", "belgië", "belgie"] },
  { countryCode: "CH", countryName: "Switzerland", latitude: 46.8182, longitude: 8.2275, aliases: ["switzerland", "schweiz", "suisse"] },
  { countryCode: "AT", countryName: "Austria", latitude: 47.5162, longitude: 14.5501, aliases: ["austria", "österreich", "osterreich"] },
  { countryCode: "PL", countryName: "Poland", latitude: 51.9194, longitude: 19.1451, aliases: ["poland", "polska"] },
  { countryCode: "SE", countryName: "Sweden", latitude: 60.1282, longitude: 18.6435, aliases: ["sweden", "sverige"] },
  { countryCode: "NO", countryName: "Norway", latitude: 60.472, longitude: 8.4689, aliases: ["norway", "norge"] },
  { countryCode: "DK", countryName: "Denmark", latitude: 56.2639, longitude: 9.5018, aliases: ["denmark", "danmark"] },
  { countryCode: "FI", countryName: "Finland", latitude: 61.9241, longitude: 25.7482, aliases: ["finland", "suomi"] },
  { countryCode: "IE", countryName: "Ireland", latitude: 53.1424, longitude: -7.6921, aliases: ["ireland"] },
  { countryCode: "PT", countryName: "Portugal", latitude: 39.3999, longitude: -8.2245, aliases: ["portugal"] },
  { countryCode: "GR", countryName: "Greece", latitude: 39.0742, longitude: 21.8243, aliases: ["greece", "hellas"] },
  { countryCode: "HU", countryName: "Hungary", latitude: 47.1625, longitude: 19.5033, aliases: ["hungary", "magyarország", "magyarorszag"] },
  { countryCode: "RO", countryName: "Romania", latitude: 45.9432, longitude: 24.9668, aliases: ["romania", "românia"] },
  { countryCode: "AU", countryName: "Australia", latitude: -25.2744, longitude: 133.7751, aliases: ["australia"] },
  { countryCode: "NZ", countryName: "New Zealand", latitude: -40.9006, longitude: 174.886, aliases: ["new zealand"] },
  { countryCode: "JP", countryName: "Japan", latitude: 36.2048, longitude: 138.2529, aliases: ["japan", "nippon"] },
  { countryCode: "CN", countryName: "China", latitude: 35.8617, longitude: 104.1954, aliases: ["china", "prc", "people's republic of china"] },
  { countryCode: "IN", countryName: "India", latitude: 20.5937, longitude: 78.9629, aliases: ["india"] },
  { countryCode: "KR", countryName: "South Korea", latitude: 35.9078, longitude: 127.7669, aliases: ["south korea", "korea"] },
  { countryCode: "SG", countryName: "Singapore", latitude: 1.3521, longitude: 103.8198, aliases: ["singapore"] },
  { countryCode: "HK", countryName: "Hong Kong", latitude: 22.3193, longitude: 114.1694, aliases: ["hong kong"] },
  { countryCode: "TH", countryName: "Thailand", latitude: 15.87, longitude: 100.9925, aliases: ["thailand"] },
  { countryCode: "MY", countryName: "Malaysia", latitude: 4.2105, longitude: 101.9758, aliases: ["malaysia"] },
  { countryCode: "ID", countryName: "Indonesia", latitude: -0.7893, longitude: 113.9213, aliases: ["indonesia"] },
  { countryCode: "VN", countryName: "Vietnam", latitude: 14.0583, longitude: 108.2772, aliases: ["vietnam", "viet nam"] },
  { countryCode: "SA", countryName: "Saudi Arabia", latitude: 23.8859, longitude: 45.0792, aliases: ["saudi arabia", "ksa"] },
  { countryCode: "TR", countryName: "Turkey", latitude: 38.9637, longitude: 35.2433, aliases: ["turkey", "türkiye", "turkiye"] },
  { countryCode: "EG", countryName: "Egypt", latitude: 26.8206, longitude: 30.8025, aliases: ["egypt"] },
  { countryCode: "ZA", countryName: "South Africa", latitude: -30.5595, longitude: 22.9375, aliases: ["south africa"] },
  { countryCode: "NG", countryName: "Nigeria", latitude: 9.082, longitude: 8.6753, aliases: ["nigeria"] },
]

export const COUNTRY_CENTROID_BY_CODE = new Map(COUNTRY_CENTROIDS.map((country) => [country.countryCode, country]))
