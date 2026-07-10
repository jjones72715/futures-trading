import { BASE, CARD_PRODUCTS_TABLE, BANKS_TABLE } from '../../src/apps/creditcards/config/tables.js';

// TEMPORARY one-time-use function — delete after confirming a successful run.
// Runs the FM cards CSV upsert server-side (Netlify has normal internet
// access; the dev sandbox that generated this data does not).

const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';
const TOKEN = process.env.AIRTABLE_API_KEY;

const CARDS = [
  {
    "name": "American Express Platinum Card®",
    "slug": "AmxPlat",
    "fmValue": 2605,
    "welcomeBonus": "As high as 175K points",
    "type": "Personal"
  },
  {
    "name": "Chase Sapphire Preferred® Card",
    "slug": "CSP",
    "fmValue": 1395,
    "welcomeBonus": "100K Points",
    "type": "Personal"
  },
  {
    "name": "Wells Fargo Premier Autograph Visa Infinite",
    "slug": "WellsFargoPremier",
    "fmValue": 1277,
    "welcomeBonus": "100K points",
    "type": "Personal"
  },
  {
    "name": "American Express® Gold Card",
    "slug": "AmxGoldCard",
    "fmValue": 1276,
    "welcomeBonus": "As high as 100K points",
    "type": "Personal"
  },
  {
    "name": "Chase Sapphire Reserve® Card",
    "slug": "CSR",
    "fmValue": 1169,
    "welcomeBonus": "100K Points",
    "type": "Personal"
  },
  {
    "name": "The Platinum Card® from American Express Exclusively for Morgan Stanley",
    "slug": "AmxPlatMS",
    "fmValue": 1132,
    "welcomeBonus": "80K Points",
    "type": "Personal"
  },
  {
    "name": "The Platinum Card® from American Express for Schwab",
    "slug": "AmxPlatSchwab",
    "fmValue": 1132,
    "welcomeBonus": "80K points",
    "type": "Personal"
  },
  {
    "name": "Marriott Bonvoy Boundless® Credit Card",
    "slug": "MRPlus",
    "fmValue": 1094,
    "welcomeBonus": "125K points + 50K Free Night Certificate + $100 airfare credit",
    "type": "Personal"
  },
  {
    "name": "Atmos™ Rewards Ascent Visa Signature® Card",
    "slug": "AtmosAscent",
    "fmValue": 1079,
    "welcomeBonus": "85K points + Companion Fare",
    "type": "Personal"
  },
  {
    "name": "Citi® / AAdvantage® Platinum Select® World Elite Mastercard®",
    "slug": "AAplat",
    "fmValue": 1061,
    "welcomeBonus": "80K Miles",
    "type": "Personal"
  },
  {
    "name": "Atmos™ Rewards Summit Visa Infinite® Card",
    "slug": "AtmosSummit",
    "fmValue": 1047,
    "welcomeBonus": "100K points + 25K Companion Award",
    "type": "Personal"
  },
  {
    "name": "Delta SkyMiles® Gold American Express Card",
    "slug": "DLgold",
    "fmValue": 988,
    "welcomeBonus": "Up to 90K miles",
    "type": "Personal"
  },
  {
    "name": "Capital One Venture Rewards Credit Card",
    "slug": "C1VR",
    "fmValue": 985,
    "welcomeBonus": "75K Miles",
    "type": "Personal"
  },
  {
    "name": "Capital One Venture X Rewards Credit Card",
    "slug": "VentureX",
    "fmValue": 950,
    "welcomeBonus": "75K Miles",
    "type": "Personal"
  },
  {
    "name": "UBS Visa Infinite",
    "slug": "UBSinf",
    "fmValue": 924,
    "welcomeBonus": "125K points",
    "type": "Personal"
  },
  {
    "name": "Hilton Honors American Express Aspire Card",
    "slug": "AmxHiltonAspire",
    "fmValue": 901,
    "welcomeBonus": "175K Points + free night certificate",
    "type": "Personal"
  },
  {
    "name": "Citi Strata Elite℠ Card",
    "slug": "CitiStrataElite",
    "fmValue": 899,
    "welcomeBonus": "75K Points",
    "type": "Personal"
  },
  {
    "name": "Barclays JetBlue Plus Mastercard",
    "slug": "B6plus",
    "fmValue": 793,
    "welcomeBonus": "70K Points",
    "type": "Personal"
  },
  {
    "name": "Delta SkyMiles® Platinum American Express Card",
    "slug": "DLplat",
    "fmValue": 758,
    "welcomeBonus": "Up to 100K miles",
    "type": "Personal"
  },
  {
    "name": "Citi Strata Premier℠ Card",
    "slug": "TYpremier",
    "fmValue": 741,
    "welcomeBonus": "60K Points",
    "type": "Personal"
  },
  {
    "name": "Virgin Red Rewards Mastercard®",
    "slug": "VirginRed",
    "fmValue": 737,
    "welcomeBonus": "60K Points",
    "type": "Personal"
  },
  {
    "name": "Wells Fargo Autograph Journey℠ Card",
    "slug": "WellsFargoAutographJourney",
    "fmValue": 717,
    "welcomeBonus": "60K points",
    "type": "Personal"
  },
  {
    "name": "Delta SkyMiles® Reserve American Express Card",
    "slug": "DLrsv",
    "fmValue": 712,
    "welcomeBonus": "Up to 125K miles",
    "type": "Personal"
  },
  {
    "name": "Barclays JetBlue Premier Mastercard",
    "slug": "JetBluePremier",
    "fmValue": 711,
    "welcomeBonus": "100K Points",
    "type": "Personal"
  },
  {
    "name": "Aeroplan® Credit Card",
    "slug": "Aeroplan",
    "fmValue": 694,
    "welcomeBonus": "60K Points",
    "type": "Personal"
  },
  {
    "name": "IHG One Rewards Premier Credit Card",
    "slug": "IHGPrem",
    "fmValue": 687,
    "welcomeBonus": "140K points",
    "type": "Personal"
  },
  {
    "name": "Marriott Bonvoy Bevy® American Express® Card",
    "slug": "BonvoyBevy",
    "fmValue": 680,
    "welcomeBonus": "Up to 135K Points",
    "type": "Personal"
  },
  {
    "name": "The Hawaiian Airlines® Bank of Hawaii World Elite Mastercard®",
    "slug": "BOHHA",
    "fmValue": 663,
    "welcomeBonus": "60K Points",
    "type": "Personal"
  },
  {
    "name": "Marriott Bonvoy® Brilliant® American Express® Card",
    "slug": "SPGLux",
    "fmValue": 650,
    "welcomeBonus": "Up to 150K Points",
    "type": "Personal"
  },
  {
    "name": "Chase British Airways Visa Signature® Card",
    "slug": "BA",
    "fmValue": 630,
    "welcomeBonus": "75K Avios",
    "type": "Personal"
  },
  {
    "name": "Chase Iberia Visa Signature® Card",
    "slug": "IB",
    "fmValue": 630,
    "welcomeBonus": "75K Avios",
    "type": "Personal"
  },
  {
    "name": "Chase Aer Lingus Visa Signature® Card",
    "slug": "EI",
    "fmValue": 630,
    "welcomeBonus": "75K Avios",
    "type": "Personal"
  },
  {
    "name": "United℠ Explorer Card",
    "slug": "UA",
    "fmValue": 596,
    "welcomeBonus": "50K miles",
    "type": "Personal"
  },
  {
    "name": "Chase World of Hyatt Credit Card",
    "slug": "WOH",
    "fmValue": 565,
    "welcomeBonus": "Up to 60K points",
    "type": "Personal"
  },
  {
    "name": "Hilton Honors American Express Surpass® Card",
    "slug": "hilton-honors-american-express-surpass-card",
    "fmValue": 544,
    "welcomeBonus": "130K Points",
    "type": "Personal"
  },
  {
    "name": "Southwest Rapid Rewards® Premier Credit Card",
    "slug": "SWprem",
    "fmValue": 539,
    "welcomeBonus": "55K points",
    "type": "Personal"
  },
  {
    "name": "Air France KLM Visa Signature® Credit Card",
    "slug": "AFKLM",
    "fmValue": 538,
    "welcomeBonus": "50K miles + 100XP",
    "type": "Personal"
  },
  {
    "name": "Royal Caribbean® Royal ONE Plus™ Credit Card",
    "slug": "RoyalCaribbeanRoyalOnePlus",
    "fmValue": 538,
    "welcomeBonus": "70K points",
    "type": "Personal"
  },
  {
    "name": "Southwest Rapid Rewards® Plus Credit Card",
    "slug": "SWplus",
    "fmValue": 533,
    "welcomeBonus": "50K points",
    "type": "Personal"
  },
  {
    "name": "Amtrak Guest Rewards® Preferred Mastercard®",
    "slug": "AMKworld",
    "fmValue": 533,
    "welcomeBonus": "Up to 30K points",
    "type": "Personal"
  },
  {
    "name": "Bank of America Premium Rewards",
    "slug": "boaPR",
    "fmValue": 531,
    "welcomeBonus": "60K points",
    "type": "Personal"
  },
  {
    "name": "United Quest℠ Card",
    "slug": "UAQ",
    "fmValue": 528,
    "welcomeBonus": "60K Miles + 500 PQP",
    "type": "Personal"
  },
  {
    "name": "Southwest Rapid Rewards® Priority Credit Card",
    "slug": "SWpriority",
    "fmValue": 515,
    "welcomeBonus": "60K points",
    "type": "Personal"
  },
  {
    "name": "Lufthansa Miles & More® Premier World MasterCard®  issued by Barclays",
    "slug": "LH",
    "fmValue": 507,
    "welcomeBonus": "50K Miles",
    "type": "Personal"
  },
  {
    "name": "Bilt Palladium Card",
    "slug": "BiltPalladium",
    "fmValue": 505,
    "welcomeBonus": "50K points + $300 Bilt Cash",
    "type": "Personal"
  },
  {
    "name": "Frontier Airlines World MasterCard®",
    "slug": "F9",
    "fmValue": 480,
    "welcomeBonus": "60K miles",
    "type": "Personal"
  },
  {
    "name": "Citi® / AAdvantage® Globe™ Mastercard®",
    "slug": "AAGlobe",
    "fmValue": 472,
    "welcomeBonus": "60K Miles",
    "type": "Personal"
  },
  {
    "name": "Bank of America Premium Rewards Elite",
    "slug": "BOAPremiumRewardsElite",
    "fmValue": 450,
    "welcomeBonus": "75K points",
    "type": "Personal"
  },
  {
    "name": "Fairwinds Visa Signature® Credit Card",
    "slug": "FairwindsVisa",
    "fmValue": 450,
    "welcomeBonus": "60K Points",
    "type": "Personal"
  },
  {
    "name": "avianca lifemiles American Express® Elite Card",
    "slug": "AviancaEliteCard",
    "fmValue": 450,
    "welcomeBonus": "Up to 100K miles",
    "type": "Personal"
  },
  {
    "name": "Marriott Bonvoy Bold® Credit Card",
    "slug": "MRBold",
    "fmValue": 439,
    "welcomeBonus": "60K Points",
    "type": "Personal"
  },
  {
    "name": "IHG One Rewards Traveler Credit Card",
    "slug": "IHGTrav",
    "fmValue": 434,
    "welcomeBonus": "80K points",
    "type": "Personal"
  },
  {
    "name": "Wells Fargo Choice Privileges Mastercard",
    "slug": "Choice",
    "fmValue": 427,
    "welcomeBonus": "60K Points",
    "type": "Personal"
  },
  {
    "name": "American Express® Green Card",
    "slug": "AmxGreen",
    "fmValue": 424,
    "welcomeBonus": "40K points",
    "type": "Personal"
  },
  {
    "name": "HSBC Premier World Mastercard® credit card",
    "slug": "HSBCPW",
    "fmValue": 416,
    "welcomeBonus": "50K points",
    "type": "Personal"
  },
  {
    "name": "Hilton Honors American Express Card",
    "slug": "AmxHilton",
    "fmValue": 409,
    "welcomeBonus": "100K Points + $100 statement credit",
    "type": "Personal"
  },
  {
    "name": "Royal Caribbean® Royal ONE™ Credit Card",
    "slug": "RoyalCaribbeanRoyalOne",
    "fmValue": 408,
    "welcomeBonus": "45K points",
    "type": "Personal"
  },
  {
    "name": "Amtrak Guest Rewards Mastercard",
    "slug": "AMKplat",
    "fmValue": 379,
    "welcomeBonus": "Up to 20K points",
    "type": "Personal"
  },
  {
    "name": "UBS Visa Signature",
    "slug": "UBSsig",
    "fmValue": 374,
    "welcomeBonus": "50K points",
    "type": "Personal"
  },
  {
    "name": "United Gateway℠ Card",
    "slug": "UAgateway",
    "fmValue": 372,
    "welcomeBonus": "30K Miles",
    "type": "Personal"
  },
  {
    "name": "avianca lifemiles American Express® Card",
    "slug": "AviancaCard",
    "fmValue": 367,
    "welcomeBonus": "40K miles",
    "type": "Personal"
  },
  {
    "name": "TAP Miles&Go American Express Card",
    "slug": "TAPMilesCard",
    "fmValue": 354,
    "welcomeBonus": "40K miles + 15K status miles",
    "type": "Personal"
  },
  {
    "name": "Korean Air SKYPASS Visa issued by US Bank",
    "slug": "KE",
    "fmValue": 353,
    "welcomeBonus": "40K miles",
    "type": "Personal"
  },
  {
    "name": "Best Western Rewards® Premium Visa Signature® Card",
    "slug": "BestWesternPremium",
    "fmValue": 343,
    "welcomeBonus": "80K points",
    "type": "Personal"
  },
  {
    "name": "Marriott Bonvoy Bountiful™ Card",
    "slug": "BonvoyBountiful",
    "fmValue": 342,
    "welcomeBonus": "85K points",
    "type": "Personal"
  },
  {
    "name": "Citi® / AAdvantage® Executive World Elite Mastercard®",
    "slug": "AAexec",
    "fmValue": 328,
    "welcomeBonus": "75K miles",
    "type": "Personal"
  },
  {
    "name": "Emirates Skywards Rewards World Elite Mastercard",
    "slug": "Emirates",
    "fmValue": 303,
    "welcomeBonus": "40K Miles + 1 Year Silver status",
    "type": "Personal"
  },
  {
    "name": "Disney® Inspire Visa® Card",
    "slug": "DisneyInspire",
    "fmValue": 300,
    "welcomeBonus": "$200 Cash Back + $300 Disney Gift Card",
    "type": "Personal"
  },
  {
    "name": "Allegiant Allways Rewards Visa® Credit Card",
    "slug": "Allegiant",
    "fmValue": 299,
    "welcomeBonus": "40K miles",
    "type": "Personal"
  },
  {
    "name": "Citi Double Cash® Card",
    "slug": "DC",
    "fmValue": 299,
    "welcomeBonus": "20K points",
    "type": "Personal"
  },
  {
    "name": "Chase Freedom Unlimited®",
    "slug": "CFU",
    "fmValue": 296,
    "welcomeBonus": "$200 cash back*",
    "type": "Personal"
  },
  {
    "name": "Chase Freedom Flex®",
    "slug": "CFF",
    "fmValue": 292,
    "welcomeBonus": "$200 cash back*",
    "type": "Personal"
  },
  {
    "name": "Wells Fargo Choice Privileges Mastercard Select",
    "slug": "ChoiceSelect",
    "fmValue": 285,
    "welcomeBonus": "60K Points",
    "type": "Personal"
  },
  {
    "name": "Capital One VentureOne Rewards Credit Card",
    "slug": "C1V1",
    "fmValue": 284,
    "welcomeBonus": "20K miles",
    "type": "Personal"
  },
  {
    "name": "Citi Strata℠ Card",
    "slug": "CitiStrata",
    "fmValue": 284,
    "welcomeBonus": "20K Points",
    "type": "Personal"
  },
  {
    "name": "AT&T Points Plus Card",
    "slug": "ATTPointsPlus",
    "fmValue": 284,
    "welcomeBonus": "$200 statement credit",
    "type": "Personal"
  },
  {
    "name": "Qatar Airways Privilege Club Signature Card",
    "slug": "qatarsignature",
    "fmValue": 281,
    "welcomeBonus": "Up to 40K Avios",
    "type": "Personal"
  },
  {
    "name": "Carnival® World Mastercard®",
    "slug": "Carnival",
    "fmValue": 279,
    "welcomeBonus": "30K Fun Points",
    "type": "Personal"
  },
  {
    "name": "PenFed Pathfinder Rewards",
    "slug": "PENFEDPR",
    "fmValue": 275,
    "welcomeBonus": "50K Points",
    "type": "Personal"
  },
  {
    "name": "Cathay Pacific Visa Signature card",
    "slug": "CX",
    "fmValue": 263,
    "welcomeBonus": "38K Miles",
    "type": "Personal"
  },
  {
    "name": "Wells Fargo Autograph℠ Card",
    "slug": "WellsFargoAutograph",
    "fmValue": 263,
    "welcomeBonus": "20K points",
    "type": "Personal"
  },
  {
    "name": "United Club℠ Card",
    "slug": "UACI",
    "fmValue": 255,
    "welcomeBonus": "80K Miles",
    "type": "Personal"
  },
  {
    "name": "Emirates Skywards Premium World Elite Mastercard",
    "slug": "EmiratesPremium",
    "fmValue": 248,
    "welcomeBonus": "70K Miles + 1 Year Gold status",
    "type": "Personal"
  },
  {
    "name": "Priceline VIP Rewards™ Visa® Card",
    "slug": "Priceline",
    "fmValue": 240,
    "welcomeBonus": "$200 + 5k points",
    "type": "Personal"
  },
  {
    "name": "Capital One Savor Cash Rewards Credit Card",
    "slug": "CapitalOneSavor",
    "fmValue": 240,
    "welcomeBonus": "$250 Cash Back",
    "type": "Personal"
  },
  {
    "name": "Korean Air SKYPASS Select Visa issued by US Bank",
    "slug": "KESelect",
    "fmValue": 240,
    "welcomeBonus": "60K miles",
    "type": "Personal"
  },
  {
    "name": "First Tech Odyssey Rewards World Elite Mastercard®",
    "slug": "FirstTechOdyssey",
    "fmValue": 237,
    "welcomeBonus": "$300 cash back",
    "type": "Personal"
  },
  {
    "name": "Bank of America Travel Rewards",
    "slug": "boaTR",
    "fmValue": 234,
    "welcomeBonus": "25K points worth $250",
    "type": "Personal"
  },
  {
    "name": "Turkish Airlines Miles&Smiles Premier Visa Signature® Credit Card",
    "slug": "Turkish",
    "fmValue": 229,
    "welcomeBonus": "Up to 40K Miles",
    "type": "Personal"
  },
  {
    "name": "U.S. Bank Cash+®",
    "slug": "USBCP",
    "fmValue": 229,
    "welcomeBonus": "$250 Cash Back",
    "type": "Personal"
  },
  {
    "name": "Disney® Premier Visa® Card",
    "slug": "Disney",
    "fmValue": 221,
    "welcomeBonus": "$100 Cash Back + $200 Disney Gift Card",
    "type": "Personal"
  },
  {
    "name": "Best Western Rewards® Visa Signature® Card",
    "slug": "BestWestern",
    "fmValue": 216,
    "welcomeBonus": "40K points",
    "type": "Personal"
  },
  {
    "name": "Wells Fargo One Key™ Mastercard",
    "slug": "OneKey",
    "fmValue": 208,
    "welcomeBonus": "$250 OneKeyCash",
    "type": "Personal"
  },
  {
    "name": "American Airlines AAdvantage® MileUp® Card",
    "slug": "AAmileup",
    "fmValue": 202,
    "welcomeBonus": "15K miles",
    "type": "Personal"
  },
  {
    "name": "Wyndham Rewards Earner Plus Card",
    "slug": "WyndhamEarnerPlus",
    "fmValue": 195,
    "welcomeBonus": "Up to 100K Points",
    "type": "Personal"
  },
  {
    "name": "Wells Fargo Active Cash Card",
    "slug": "WFAC",
    "fmValue": 195,
    "welcomeBonus": "$200 Cash Back",
    "type": "Personal"
  },
  {
    "name": "Wyndham Rewards Earner Premier Card",
    "slug": "WyndhamEarnerPremier",
    "fmValue": 192,
    "welcomeBonus": "Up to 120K Points",
    "type": "Personal"
  },
  {
    "name": "Capital One Quicksilver Cash Rewards Credit Card",
    "slug": "C1QS",
    "fmValue": 192,
    "welcomeBonus": "$200 Cash Back",
    "type": "Personal"
  },
  {
    "name": "Holland America Line Rewards Visa® Card",
    "slug": "HollandAmerica",
    "fmValue": 190,
    "welcomeBonus": "20K Points",
    "type": "Personal"
  },
  {
    "name": "Princess® Rewards Visa® Card",
    "slug": "PrincessCruises",
    "fmValue": 190,
    "welcomeBonus": "20K Points",
    "type": "Personal"
  },
  {
    "name": "Breeze Easy™ Visa® credit card",
    "slug": "Breeze",
    "fmValue": 190,
    "welcomeBonus": "30K Points + Breezy 1 Status",
    "type": "Personal"
  },
  {
    "name": "Discover it®",
    "slug": "DI",
    "fmValue": 190,
    "welcomeBonus": "$200 Back + First Year Double",
    "type": "Personal"
  },
  {
    "name": "Evergreen® by FNBO Credit Card",
    "slug": "FNBOEvergreen",
    "fmValue": 189,
    "welcomeBonus": "$200 Back",
    "type": "Personal"
  },
  {
    "name": "Morgan Stanley Blue Cash Preferred® American Express Card",
    "slug": "AmxMSBCP",
    "fmValue": 187,
    "welcomeBonus": "$250 back",
    "type": "Personal"
  },
  {
    "name": "TD First Class Visa Signature® Card",
    "slug": "TDfcv",
    "fmValue": 187,
    "welcomeBonus": "25K points",
    "type": "Personal"
  },
  {
    "name": "Schwab Investor Card® from American Express",
    "slug": "AmxSchwabIn",
    "fmValue": 184,
    "welcomeBonus": "$200 Cash Back as a statement credit",
    "type": "Personal"
  },
  {
    "name": "Bank of America Unlimited Cash Rewards",
    "slug": "boaUR",
    "fmValue": 184,
    "welcomeBonus": "$200 cash bonus + 2% cashback for one year",
    "type": "Personal"
  },
  {
    "name": "Bank of America Customized Cash Rewards",
    "slug": "boaCR",
    "fmValue": 179,
    "welcomeBonus": "$200 Cash Back + 6% back in category of your choice",
    "type": "Personal"
  },
  {
    "name": "Norwegian Cruise Line® World Mastercard®",
    "slug": "NCL",
    "fmValue": 179,
    "welcomeBonus": "20K Points",
    "type": "Personal"
  },
  {
    "name": "PNC Cash Rewards® Visa® Credit Card",
    "slug": "PNCCashRewards",
    "fmValue": 179,
    "welcomeBonus": "$200 Cash Back",
    "type": "Personal"
  },
  {
    "name": "TD Cash Visa Credit Card",
    "slug": "TDc",
    "fmValue": 179,
    "welcomeBonus": "$200 Cash Back",
    "type": "Personal"
  },
  {
    "name": "USAA Cashback Rewards Plus American Express® Credit Card",
    "slug": "USAACashbackRewardsPlus",
    "fmValue": 179,
    "welcomeBonus": "$200 cash back",
    "type": "Personal"
  },
  {
    "name": "USAA Eagle Adapt™ Credit Card",
    "slug": "USAAEagleAdapt",
    "fmValue": 179,
    "welcomeBonus": "$200 cash back",
    "type": "Personal"
  },
  {
    "name": "U.S. Bank Altitude® Go Visa Signature® Card",
    "slug": "USBGO",
    "fmValue": 179,
    "welcomeBonus": "20K points",
    "type": "Personal"
  },
  {
    "name": "U.S. Bank Altitude® Connect Visa Signature® Card",
    "slug": "USBCO",
    "fmValue": 179,
    "welcomeBonus": "20K points",
    "type": "Personal"
  },
  {
    "name": "Wyndham Rewards Earner",
    "slug": "WyndhamEarner",
    "fmValue": 177,
    "welcomeBonus": "Up to 75K Points",
    "type": "Personal"
  },
  {
    "name": "Wells Fargo One Key+™ Mastercard",
    "slug": "OneKeyPlus",
    "fmValue": 177,
    "welcomeBonus": "$350 OneKeyCash",
    "type": "Personal"
  },
  {
    "name": "USAA Eagle Navigator® Visa Signature® Credit Card",
    "slug": "USAAEagleNavigator",
    "fmValue": 172,
    "welcomeBonus": "30K Points",
    "type": "Personal"
  },
  {
    "name": "BECU Cash Back Visa credit card",
    "slug": "BECUCash",
    "fmValue": 168,
    "welcomeBonus": "$200 Cash Back",
    "type": "Personal"
  },
  {
    "name": "Blue Cash Everyday® Card from American Express",
    "slug": "AmxBCE",
    "fmValue": 158,
    "welcomeBonus": "Up to $200 back",
    "type": "Personal"
  },
  {
    "name": "Avelo Airlines World Elite Mastercard",
    "slug": "AveloCard",
    "fmValue": 140,
    "welcomeBonus": "25K Points",
    "type": "Personal"
  },
  {
    "name": "First Tech Choice Rewards World Mastercard®",
    "slug": "FirstTechChoice",
    "fmValue": 137,
    "welcomeBonus": "$200 cash back",
    "type": "Personal"
  },
  {
    "name": "Amazon Prime Visa",
    "slug": "AmazonPrimeVisa",
    "fmValue": 135,
    "welcomeBonus": "$150 Amazon Gift Card",
    "type": "Personal"
  },
  {
    "name": "Amazon Visa",
    "slug": "AmazonVisa",
    "fmValue": 135,
    "welcomeBonus": "$150 Amazon Gift Card",
    "type": "Personal"
  },
  {
    "name": "Booking.com Genius Rewards Visa Signature® Credit Card",
    "slug": "BookingCom",
    "fmValue": 134,
    "welcomeBonus": "$150 in Booking.com credits",
    "type": "Personal"
  },
  {
    "name": "Disney® Visa® Card",
    "slug": "DisneyNF",
    "fmValue": 130,
    "welcomeBonus": "$50 Cash Back + $100 Disney Gift Card",
    "type": "Personal"
  },
  {
    "name": "Discover it® for Students",
    "slug": "DIS",
    "fmValue": 120,
    "welcomeBonus": "$100 + $20/year",
    "type": "Personal"
  },
  {
    "name": "Verizon Visa Card",
    "slug": "Verizon",
    "fmValue": 119,
    "welcomeBonus": "Up to $150 in statement credits",
    "type": "Personal"
  },
  {
    "name": "JetBlue Card",
    "slug": "B6",
    "fmValue": 112,
    "welcomeBonus": "10K Points",
    "type": "Personal"
  },
  {
    "name": "Korean Air SKYPASS SkyBlue Visa issued by US Bank",
    "slug": "KEBlue",
    "fmValue": 112,
    "welcomeBonus": "10K miles",
    "type": "Personal"
  },
  {
    "name": "Caesars Rewards® Prestige Visa Signature® Card",
    "slug": "CaesarsRewardsPrestigeCard",
    "fmValue": 105,
    "welcomeBonus": "20K Reward Credits + 2.5K Tier Credits",
    "type": "Personal"
  },
  {
    "name": "Discover it Miles - Double Miles your first year",
    "slug": "DIM",
    "fmValue": 100,
    "welcomeBonus": "$100 + First Year Double",
    "type": "Personal"
  },
  {
    "name": "PenFed Platinum Rewards",
    "slug": "PENFEDPLAT",
    "fmValue": 100,
    "welcomeBonus": "15K Points",
    "type": "Personal"
  },
  {
    "name": "Delta SkyMiles® Blue American Express Card",
    "slug": "DLblue",
    "fmValue": 96,
    "welcomeBonus": "10K miles",
    "type": "Personal"
  },
  {
    "name": "Capital One Quicksilver Rewards for Students Credit Card",
    "slug": "CapitalOneQuicksilverStudent",
    "fmValue": 95,
    "welcomeBonus": "$100 Cash Back",
    "type": "Personal"
  },
  {
    "name": "Capital One Savor Student Cash Rewards Credit Card",
    "slug": "CapitalOneSavorStudent",
    "fmValue": 94,
    "welcomeBonus": "$100 Cash Back",
    "type": "Personal"
  },
  {
    "name": "Upromise World MasterCard® issued by Barclays",
    "slug": "Upromise",
    "fmValue": 91,
    "welcomeBonus": "$100 Cash back",
    "type": "Personal"
  },
  {
    "name": "AARP® Essential Rewards Mastercard®",
    "slug": "AARPER",
    "fmValue": 90,
    "welcomeBonus": "$100 Cash Back",
    "type": "Personal"
  },
  {
    "name": "AARP® Travel Rewards Mastercard®",
    "slug": "AARPTR",
    "fmValue": 90,
    "welcomeBonus": "$100 Cash Back",
    "type": "Personal"
  },
  {
    "name": "Affinity Cash Rewards Visa® Signature Credit Card",
    "slug": "AffinityCR",
    "fmValue": 87,
    "welcomeBonus": "$150 cash back",
    "type": "Personal"
  },
  {
    "name": "Caesars Rewards® Visa Signature® Card",
    "slug": "CaesarsRewardsCard",
    "fmValue": 79,
    "welcomeBonus": "10K Reward Credits + 2.5K Tier Credits",
    "type": "Personal"
  },
  {
    "name": "LATAM Airlines World Elite Mastercard",
    "slug": "latamworldelite",
    "fmValue": 79,
    "welcomeBonus": "40K Miles",
    "type": "Personal"
  },
  {
    "name": "Rakuten American Express® Card",
    "slug": "RakutenAmex",
    "fmValue": 79,
    "welcomeBonus": "$100 cash back",
    "type": "Personal"
  },
  {
    "name": "MGM Rewards World Elite Mastercard®",
    "slug": "MGMCard",
    "fmValue": 79,
    "welcomeBonus": "10K points + 10K tier credits",
    "type": "Personal"
  },
  {
    "name": "LATAM Airlines Mastercard",
    "slug": "latam",
    "fmValue": 65,
    "welcomeBonus": "15K Miles",
    "type": "Personal"
  },
  {
    "name": "MGM Rewards Iconic World Elite Mastercard®",
    "slug": "MGMIconicCard",
    "fmValue": 46,
    "welcomeBonus": "30K points + $200 Resort Credit + 15K tier credits",
    "type": "Personal"
  },
  {
    "name": "Instacart Mastercard®",
    "slug": "Instacart",
    "fmValue": 45,
    "welcomeBonus": "$50 Instacart credit",
    "type": "Personal"
  },
  {
    "name": "Sam's Club Mastercard",
    "slug": "SamsClub",
    "fmValue": 29,
    "welcomeBonus": "$30 Statement Credit",
    "type": "Personal"
  },
  {
    "name": "Chase Freedom Rise",
    "slug": "ChaseFreedomRise",
    "fmValue": 25,
    "welcomeBonus": "$25 cash back",
    "type": "Personal"
  },
  {
    "name": "Bilt Blue Card",
    "slug": "BiltBlue",
    "fmValue": 25,
    "welcomeBonus": "$100 Bilt Cash",
    "type": "Personal"
  },
  {
    "name": "HSBC Elite Credit Card",
    "slug": "HSBCPWE",
    "fmValue": 21,
    "welcomeBonus": "60K points",
    "type": "Personal"
  },
  {
    "name": "Chase Slate Edge",
    "slug": "CSE",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "DoorDash Rewards Mastercard®",
    "slug": "DoorDash",
    "fmValue": 0,
    "welcomeBonus": "Free DashPass",
    "type": "Personal"
  },
  {
    "name": "Citi Custom Cash® Card",
    "slug": "CustomCash",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "Citizens Summit™ World Mastercard®",
    "slug": "CITCBP",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "Robinhood Gold Card",
    "slug": "Robinhood",
    "fmValue": 0,
    "welcomeBonus": "Waitlist only",
    "type": "Personal"
  },
  {
    "name": "Bread Rewards™ American Express® Credit Card",
    "slug": "Bread",
    "fmValue": 0,
    "welcomeBonus": "No welcome offer",
    "type": "Personal"
  },
  {
    "name": "Fidelity Rewards Visa",
    "slug": "FRV",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "Shop Your Way 5321 Visa",
    "slug": "ShopYourWay",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "Getaway by FNBO® Credit Card",
    "slug": "FNBOGetaway",
    "fmValue": 0,
    "welcomeBonus": "0% APR",
    "type": "Personal"
  },
  {
    "name": "Huntington Voice",
    "slug": "Voice",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "Nibbles Mastercard",
    "slug": "Nibbles",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "SoFi Smart Card",
    "slug": "SoFiSmartCard",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "SoFi Credit Card",
    "slug": "SoFiCreditCard",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "Venmo Credit Card",
    "slug": "Venmo",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "Paypal Cashback Mastercard",
    "slug": "Paypal",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "Synchrony Premier World Mastercard",
    "slug": "SynchronyPremier",
    "fmValue": 0,
    "welcomeBonus": "No Welcome Offer",
    "type": "Personal"
  },
  {
    "name": "U.S. Bank Smartly™ Visa Signature® Card",
    "slug": "USBankSmartly",
    "fmValue": 0,
    "welcomeBonus": "None",
    "type": "Personal"
  },
  {
    "name": "The Business Platinum Card® from American Express",
    "slug": "AmxPlatBiz",
    "fmValue": 4163,
    "welcomeBonus": "As high as 300K points",
    "type": "Business"
  },
  {
    "name": "American Express® Business Gold Card",
    "slug": "AmxGoldBiz",
    "fmValue": 2493,
    "welcomeBonus": "As high as 200K points",
    "type": "Business"
  },
  {
    "name": "Sapphire Reserve for Business℠ Card",
    "slug": "ChaseSapphireReserveBusiness",
    "fmValue": 2185,
    "welcomeBonus": "200K points",
    "type": "Business"
  },
  {
    "name": "Capital One Venture X Business Card",
    "slug": "VentureXBiz",
    "fmValue": 1985,
    "welcomeBonus": "150K Miles",
    "type": "Business"
  },
  {
    "name": "Capital One Spark Cash Plus",
    "slug": "C1SCPlusbiz",
    "fmValue": 1520,
    "welcomeBonus": "$2,000+ Cash Back",
    "type": "Business"
  },
  {
    "name": "Ink Business Unlimited® Credit Card",
    "slug": "CIBU",
    "fmValue": 1432,
    "welcomeBonus": "$1,000 cash back*",
    "type": "Business"
  },
  {
    "name": "Ink Business Cash® Credit Card",
    "slug": "CIC",
    "fmValue": 1372,
    "welcomeBonus": "$1,000 cash back*",
    "type": "Business"
  },
  {
    "name": "Capital One Venture Business",
    "slug": "CapitalOneVentureBusiness",
    "fmValue": 1335,
    "welcomeBonus": "100K Miles",
    "type": "Business"
  },
  {
    "name": "Ink Business Preferred® Credit Card",
    "slug": "CIBP",
    "fmValue": 1277,
    "welcomeBonus": "100K points",
    "type": "Business"
  },
  {
    "name": "Atmos™ Rewards Business Visa Card",
    "slug": "AtmosBusiness",
    "fmValue": 1061,
    "welcomeBonus": "85K points + Companion Fare",
    "type": "Business"
  },
  {
    "name": "United℠ Business Card",
    "slug": "UABizCard",
    "fmValue": 1060,
    "welcomeBonus": "100K Miles + 2,000 PQP",
    "type": "Business"
  },
  {
    "name": "Marriott Bonvoy Business® American Express® Card",
    "slug": "SPGBiz",
    "fmValue": 1030,
    "welcomeBonus": "150K Points + $125 statement credit",
    "type": "Business"
  },
  {
    "name": "Delta SkyMiles® Gold Business American Express Card",
    "slug": "DLgoldBiz",
    "fmValue": 993,
    "welcomeBonus": "90K miles",
    "type": "Business"
  },
  {
    "name": "UBS Visa Infinite Business",
    "slug": "UBSinfbiz",
    "fmValue": 924,
    "welcomeBonus": "125K points",
    "type": "Business"
  },
  {
    "name": "Capital One Spark Cash",
    "slug": "C1SCbiz",
    "fmValue": 890,
    "welcomeBonus": "$1,000 Cash Back",
    "type": "Business"
  },
  {
    "name": "Citi® / AAdvantage Business™ World Elite Mastercard®",
    "slug": "AAplatbiz",
    "fmValue": 842,
    "welcomeBonus": "65K miles",
    "type": "Business"
  },
  {
    "name": "Delta SkyMiles® Platinum Business American Express Card",
    "slug": "DLplatBiz",
    "fmValue": 744,
    "welcomeBonus": "100K miles",
    "type": "Business"
  },
  {
    "name": "Chase Ink Business Premier® Credit Card",
    "slug": "InkBizPremier",
    "fmValue": 695,
    "welcomeBonus": "$1,000 Cash Back",
    "type": "Business"
  },
  {
    "name": "Capital One VentureOne Business",
    "slug": "CapitalOneVentureOneBusiness",
    "fmValue": 683,
    "welcomeBonus": "50K Miles",
    "type": "Business"
  },
  {
    "name": "IHG One Rewards Premier Business Credit Card",
    "slug": "IHGBusiness",
    "fmValue": 674,
    "welcomeBonus": "140K points",
    "type": "Business"
  },
  {
    "name": "The American Express Graphite™ Business Cash Unlimited Card",
    "slug": "AmexGraphiteBusinessCashUnlimited",
    "fmValue": 655,
    "welcomeBonus": "$1,500 back",
    "type": "Business"
  },
  {
    "name": "Capital One Spark Cash Select",
    "slug": "C1SCSbiz",
    "fmValue": 654,
    "welcomeBonus": "$750 Cash Back",
    "type": "Business"
  },
  {
    "name": "Southwest® Rapid Rewards® Performance Business Credit Card",
    "slug": "SWbizP",
    "fmValue": 651,
    "welcomeBonus": "80K points",
    "type": "Business"
  },
  {
    "name": "U.S. Bank Business Altitude® Connect Visa Signature® Card",
    "slug": "USBankBizAltitude",
    "fmValue": 624,
    "welcomeBonus": "75K points",
    "type": "Business"
  },
  {
    "name": "U.S. Bank Triple Cash Rewards Visa ® Business Card",
    "slug": "USBtriplecashbiz",
    "fmValue": 624,
    "welcomeBonus": "$750 Cash Back",
    "type": "Business"
  },
  {
    "name": "Chase World of Hyatt Business Credit Card",
    "slug": "WOHBiz",
    "fmValue": 621,
    "welcomeBonus": "60K points",
    "type": "Business"
  },
  {
    "name": "Delta SkyMiles® Reserve Business American Express Card",
    "slug": "DLrsvBiz",
    "fmValue": 620,
    "welcomeBonus": "125Kmiles",
    "type": "Business"
  },
  {
    "name": "Southwest® Rapid Rewards® Premier Business Credit Card",
    "slug": "SWbiz",
    "fmValue": 577,
    "welcomeBonus": "60K points",
    "type": "Business"
  },
  {
    "name": "United Club℠ Business Card",
    "slug": "UAclubbiz",
    "fmValue": 548,
    "welcomeBonus": "100K Miles + 2,000 PQP",
    "type": "Business"
  },
  {
    "name": "Hilton Honors American Express Business Card",
    "slug": "AmxHiltonBiz",
    "fmValue": 527,
    "welcomeBonus": "130K Points",
    "type": "Business"
  },
  {
    "name": "The Hawaiian Airlines® Business MasterCard® issued by Barclays",
    "slug": "HAbiz",
    "fmValue": 479,
    "welcomeBonus": "50K Miles",
    "type": "Business"
  },
  {
    "name": "JetBlue Business Card",
    "slug": "B6biz",
    "fmValue": 479,
    "welcomeBonus": "50K Points",
    "type": "Business"
  },
  {
    "name": "U.S. Bank Business Leverage® Visa Signature® Card",
    "slug": "USBLBiz",
    "fmValue": 474,
    "welcomeBonus": "60K Points",
    "type": "Business"
  },
  {
    "name": "Korean Air SKYPASS Business Visa issued by US Bank",
    "slug": "KEbiz",
    "fmValue": 465,
    "welcomeBonus": "50K miles",
    "type": "Business"
  },
  {
    "name": "U.S. Bank Business Altitude Power World Elite Mastercard",
    "slug": "USBAltitudePower",
    "fmValue": 445,
    "welcomeBonus": "75K points",
    "type": "Business"
  },
  {
    "name": "Wells Fargo Signify Business Cash℠ Card",
    "slug": "WellsFargoSignify",
    "fmValue": 445,
    "welcomeBonus": "$500 Cash Back",
    "type": "Business"
  },
  {
    "name": "Business Advantage Unlimited Cash Rewards credit card",
    "slug": "boaURBiz",
    "fmValue": 420,
    "welcomeBonus": "$500 statement credit",
    "type": "Business"
  },
  {
    "name": "BOA Business Advantage Travel Rewards World Mastercard",
    "slug": "boaTRbiz",
    "fmValue": 420,
    "welcomeBonus": "50K points",
    "type": "Business"
  },
  {
    "name": "Fairwinds Business Cash Visa® Credit Card",
    "slug": "FairwindsBusinessCash",
    "fmValue": 420,
    "welcomeBonus": "Up to $2,000 cash back",
    "type": "Business"
  },
  {
    "name": "Fairwinds Business Rewards Visa® Credit Card",
    "slug": "FairwindsBusinessRewards",
    "fmValue": 420,
    "welcomeBonus": "Up to 200K Points",
    "type": "Business"
  },
  {
    "name": "Business Advantage Customized Cash Rewards credit card",
    "slug": "boacustomcashbusiness",
    "fmValue": 395,
    "welcomeBonus": "$500 statement credit",
    "type": "Business"
  },
  {
    "name": "UBS Visa Signature Business",
    "slug": "UBSsigbiz",
    "fmValue": 374,
    "welcomeBonus": "50K points",
    "type": "Business"
  },
  {
    "name": "TD Business Solutions Visa",
    "slug": "TDbiz",
    "fmValue": 367,
    "welcomeBonus": "$400 Cash Back",
    "type": "Business"
  },
  {
    "name": "Intuit Business Credit Card",
    "slug": "IntuitBusinessCard",
    "fmValue": 267,
    "welcomeBonus": "$300 Cash Back",
    "type": "Business"
  },
  {
    "name": "The Blue Business® Plus Credit Card from American Express",
    "slug": "AmxBBP",
    "fmValue": 233,
    "welcomeBonus": "15K points + 0% APR for 12 months",
    "type": "Business"
  },
  {
    "name": "The American Express Blue Business Cash™ Card",
    "slug": "AmxBBC",
    "fmValue": 217,
    "welcomeBonus": "$250 back + 0% APR for 12 months",
    "type": "Business"
  },
  {
    "name": "Brex Cash",
    "slug": "Brex",
    "fmValue": 208,
    "welcomeBonus": "$250 Amazon gift card",
    "type": "Business"
  },
  {
    "name": "BOA Platinum Plus Business Mastercard",
    "slug": "boaPLbiz",
    "fmValue": 207,
    "welcomeBonus": "$300 Cash Back",
    "type": "Business"
  },
  {
    "name": "Evergreen® by FNBO Business Edition® Credit Card",
    "slug": "FNBOBiz",
    "fmValue": 189,
    "welcomeBonus": "$200 Cash Back",
    "type": "Business"
  },
  {
    "name": "Business Green Rewards Card from American Express",
    "slug": "AmxGreenBiz",
    "fmValue": 91,
    "welcomeBonus": "15K points",
    "type": "Business"
  },
  {
    "name": "Wyndham Rewards Earner Business Card",
    "slug": "WyndhamEarnerBiz",
    "fmValue": 80,
    "welcomeBonus": "Up to 100K Points",
    "type": "Business"
  },
  {
    "name": "Sam's Club Business Mastercard",
    "slug": "SamsClubBusiness",
    "fmValue": 29,
    "welcomeBonus": "$30 Statement Credit",
    "type": "Business"
  },
  {
    "name": "Amazon Prime Business Card",
    "slug": "AmazonPrimeBusiness",
    "fmValue": 27,
    "welcomeBonus": "$100 Amazon Gift Card (or more?)",
    "type": "Business"
  },
  {
    "name": "Costco Anywhere Business Visa",
    "slug": "Costcobiz",
    "fmValue": 0,
    "welcomeBonus": "No Welcome Offer",
    "type": "Business"
  },
  {
    "name": "UBS Cash Rewards Visa Business",
    "slug": "UBScrbiz",
    "fmValue": 4163,
    "welcomeBonus": "None (call to apply)",
    "type": "Business"
  }
];

// Slug/name-based issuer detection per the household's mapping rules.
// Order matters — first matching rule wins.
function detectIssuer(name, slug) {
  if (name.includes('American Express') || slug.startsWith('Amx')) return 'American Express';
  if (name.includes('Chase') || ['CSP', 'CSR', 'CFU', 'CFF', 'WOH', 'UA', 'BA', 'IB', 'EI', 'CIBU', 'CIC', 'CIBP', 'InkBizPremier', 'ChaseSapphireReserveBusiness', 'WOHBiz', 'UABizCard', 'UAclubbiz', 'UACI'].includes(slug)) return 'Chase';
  if (name.includes('Capital One') || slug.startsWith('C1') || slug.startsWith('CapitalOne') || slug.startsWith('Venture')) return 'Capital One';
  if (name.includes('Citi') || slug.startsWith('AA') || slug.startsWith('TY') || slug.startsWith('Citi')) return 'Citi';
  if (name.includes('Bank of America') || slug.startsWith('boa') || slug.startsWith('BOA') || ['boaPR', 'boaTR', 'boaUR', 'boaCR', 'boaTRbiz', 'boaURBiz', 'boaPLbiz', 'boacustomcashbusiness', 'BOAPremiumRewardsElite', 'BOHHA', 'RoyalCaribbeanRoyalOne', 'RoyalCaribbeanRoyalOnePlus'].includes(slug)) return 'Bank of America';
  if (name.includes('Wells Fargo') || slug.startsWith('WellsFargo') || slug.startsWith('OneKey') || slug.startsWith('WFAC')) return 'Wells Fargo';
  if (name.includes('Barclays') || ['LH', 'B6', 'B6plus', 'B6biz', 'JetBluePremier', 'Upromise', 'HAbiz', 'NCL', 'HollandAmerica', 'PrincessCruises', 'Carnival', 'Emirates', 'EmiratesPremium', 'Turkish', 'VirginRed'].includes(slug)) return 'Barclays';
  if (name.includes('Discover') || slug.startsWith('DI')) return 'Discover';
  if (name.includes('U.S. Bank') || slug.startsWith('USB') || slug.startsWith('USBCP') || ['KE', 'KESelect', 'KEBlue', 'KEbiz'].includes(slug)) return 'U.S. Bank';
  if (name.includes('Bilt') || slug.startsWith('Bilt')) return 'Cardless';
  if (name.includes('USAA')) return 'USAA';
  if (name.includes('UBS') || slug.startsWith('UBS')) return 'UBS';
  if (name.includes('HSBC') || slug.startsWith('HSBC')) return 'HSBC';
  if (name.includes('TD ') || slug.startsWith('TD')) return 'TD Bank';
  if (name.includes('PNC') || slug.startsWith('PNC')) return 'PNC';
  if (name.includes('Brex')) return 'Brex';
  if (name.includes('Intuit')) return 'Intuit';
  if (name.includes('SoFi') || slug.startsWith('SoFi')) return 'SoFi';
  if (name.includes('Synchrony')) return 'Synchrony';
  if (name.includes('Huntington') || slug.startsWith('Voice')) return 'Huntington';
  if (name.includes('PenFed') || slug.startsWith('PENFED')) return 'PenFed';
  if (name.includes('FNBO') || slug.startsWith('FNBO')) return 'FNBO';
  if (name.includes('First Tech') || slug.startsWith('FirstTech')) return 'First Tech';
  if (name.includes('BECU')) return 'BECU';
  if (name.includes('Fairwinds')) return 'Fairwinds';
  return 'Other';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllRecords(tableId, fields) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams();
    fields.forEach(f => params.append('fields[]', f));
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);
    const res = await fetch(`${AIRTABLE_BASE_URL}/${BASE}/${tableId}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Airtable list failed for ${tableId}: ${res.status} ${await res.text()}`);
    const data = await res.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return records;
}

async function patchRecord(tableId, id, fields) {
  const res = await fetch(`${AIRTABLE_BASE_URL}/${BASE}/${tableId}/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`PATCH ${id} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createRecord(tableId, fields) {
  const res = await fetch(`${AIRTABLE_BASE_URL}/${BASE}/${tableId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export const handler = async () => {
  if (!TOKEN) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'AIRTABLE_API_KEY is not set in this Netlify site environment variables.' }),
    };
  }

  try {
    const bankRecords = await fetchAllRecords(BANKS_TABLE, ['Bank Name']);
    const banksByName = new Map(bankRecords.map(r => [r.fields['Bank Name'], r.id]));

    const productRecords = await fetchAllRecords(CARD_PRODUCTS_TABLE, ['FM Slug']);
    const productsBySlug = new Map();
    productRecords.forEach(r => {
      const slug = (r.fields['FM Slug'] || '').trim();
      if (slug) productsBySlug.set(slug, r.id);
    });

    const today = new Date().toISOString().split('T')[0];
    const results = [];
    let updated = 0;
    let created = 0;
    let fellThroughToOther = 0;

    for (const card of CARDS) {
      const issuerName = detectIssuer(card.name, card.slug);
      if (issuerName === 'Other') fellThroughToOther++;
      const bankId = banksByName.get(issuerName);

      const existingId = productsBySlug.get(card.slug);
      try {
        if (existingId) {
          await patchRecord(CARD_PRODUCTS_TABLE, existingId, {
            'FM Value Estimate': card.fmValue,
            'FM Last Updated': today,
            'Welcome Bonus': card.welcomeBonus,
            'Personal/Business': card.type,
          });
          updated++;
          results.push({ action: 'UPDATED', name: card.name, slug: card.slug, value: card.fmValue, issuer: issuerName });
        } else {
          const fields = {
            'Product Name': card.name,
            'FM Slug': card.slug,
            'FM Value Estimate': card.fmValue,
            'FM Last Updated': today,
            'Welcome Bonus': card.welcomeBonus,
            'Personal/Business': card.type,
          };
          if (bankId) fields['Issuer'] = [bankId];
          const result = await createRecord(CARD_PRODUCTS_TABLE, fields);
          productsBySlug.set(card.slug, result.id);
          created++;
          results.push({ action: 'CREATED', name: card.name, slug: card.slug, value: card.fmValue, issuer: issuerName });
        }
      } catch (e) {
        results.push({ action: 'ERROR', name: card.name, slug: card.slug, error: e.message });
      }

      await sleep(250);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: { total: CARDS.length, updated, created, fellThroughToOther },
        results,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
