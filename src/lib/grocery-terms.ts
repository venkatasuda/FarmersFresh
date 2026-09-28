/**
 * Regional grocery words → the English term the catalogue is named in, so
 * voice/typed search in Hindi/Telugu/Tamil (script or romanised) still finds the
 * product. Keys are lowercased. A starter set of common items — extend freely.
 */
const MAP: Record<string, string> = {};
function add(english: string, ...aliases: string[]) {
  for (const a of aliases) MAP[a.toLowerCase()] = english;
}

add("coriander", "dhaniya", "धनिया", "kothimeera", "కొత్తిమీర", "kottamalli", "கொத்தமல்லி");
add("onion", "pyaaz", "pyaz", "प्याज़", "प्याज", "ullipaya", "ఉల్లిపాయ", "vengayam", "வெங்காயம்");
add("tomato", "tamatar", "टमाटर", "tamata", "టమాటా", "thakkali", "தக்காளி");
add("potato", "aloo", "आलू", "bangaladumpa", "బంగాళాదుంప", "urulaikizhangu", "உருளைக்கிழங்கு");
add("ginger", "adrak", "अदरक", "allam", "అల్లం", "inji", "இஞ்சி");
add("garlic", "lehsun", "लहसुन", "velluli", "వెల్లుల్లి", "poondu", "பூண்டு");
add("rice", "chawal", "चावल", "biyyam", "బియ్యం", "arisi", "அரிசி");
add("milk", "doodh", "दूध", "paalu", "పాలు", "paal", "பால்");
add("egg", "anda", "अंडा", "gudlu", "గుడ్లు", "muttai", "முட்டை");
add("chicken", "murgi", "मुर्गी", "kodi", "కోడి", "kozhi", "கோழி");
add("mutton", "gosht", "मटन", "मांस", "mamsam", "మాంసం");
add("chilli", "mirch", "mirchi", "मिर्च", "karam", "కారం", "molagai", "மிளகாய்");
add("turmeric", "haldi", "हल्दी", "pasupu", "పసుపు", "manjal", "மஞ்சள்");
add("paneer", "पनीर");
add("curd", "dahi", "दही", "perugu", "పెరుగు", "thayir", "தயிர்");
add("flour", "atta", "आटा", "gothumai", "గోధుమ");
add("lentils", "dal", "daal", "दाल", "pappu", "పప్పు", "paruppu", "பருப்பு");
add("okra", "bhindi", "भिंडी", "bendakaya", "బెండకాయ", "vendakkai", "வெண்டைக்காய்");
add("cauliflower", "gobhi", "gobi", "गोभी", "cauliflower");
add("spinach", "palak", "पालक", "paalakura", "பசலைக்கீரை");
add("lemon", "nimbu", "नींबू", "nimmakaya", "నిమ్మకాయ", "elumichai", "எலுமிச்சை");

/** Translate a spoken/typed regional word to its English search term, or return
 *  the input unchanged. */
export function toSearchTerm(said: string): string {
  const key = said.trim().toLowerCase();
  return MAP[key] ?? said.trim();
}

export const VOICE_LANGS = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिंदी" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "mr-IN", label: "मराठी" },
  { code: "bn-IN", label: "বাংলা" },
];
