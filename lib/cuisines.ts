/** Cuisine options for recipes — every Indian state + UT, popular regional
 *  styles, and international cuisines. Shared by the customer filter and the
 *  staff recipe builder so tagging and browsing stay consistent. */

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  // Union territories
  "Andaman & Nicobar", "Chandigarh", "Dadra & Nagar Haveli", "Delhi",
  "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
  // Popular regional styles
  "Hyderabadi", "Awadhi", "Mughlai", "Chettinad", "Malabar", "Konkan",
  "Home Style",
];

export const INTERNATIONAL_CUISINES = [
  "Italian", "Chinese", "Continental", "Thai", "Mexican", "Lebanese",
  "Japanese", "Korean",
];

export const ALL_CUISINES = [...INDIAN_STATES, ...INTERNATIONAL_CUISINES];
