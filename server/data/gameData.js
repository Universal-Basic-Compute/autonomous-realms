/**
 * Game data converted from markdown documentation to structured JSON format
 * This file contains terrain types, resources, actions, and cultural developments
 */

const terrainTypes = {
  plains: [
    { code: "P-BAS", name: "Basic grassland", description: "Simple grassland with minimal features" },
    { code: "P-LUS", name: "Lush grassland", description: "Rich grassland with abundant plant life" },
    { code: "P-TAL", name: "Tall grass prairie", description: "Prairie with high grasses swaying in the wind" },
    { code: "P-FLW", name: "Flower-dotted meadow", description: "Meadow filled with colorful wildflowers" },
    { code: "P-DRY", name: "Dry savanna", description: "Arid grassland with sparse vegetation" },
    { code: "P-SCR", name: "Scrubland", description: "Dry area with scattered shrubs and small plants" },
    { code: "P-STN", name: "Stony plain", description: "Grassland with numerous stones and rocks" },
    { code: "P-BUR", name: "Burned grassland", description: "Recently burned area with new growth emerging" },
    { code: "P-FRT", name: "Fertile plain", description: "Exceptionally fertile grassland with rich soil" },
    { code: "P-RCH", name: "Rich soil plain", description: "Plain with dark, nutrient-rich soil" }
  ],
  forest: [
    { code: "F-OAK", name: "Oak forest", description: "Forest dominated by oak trees" },
    { code: "F-PIN", name: "Pine forest", description: "Forest of tall pine trees with needle-covered ground" },
    { code: "F-SPR", name: "Spruce forest", description: "Dense forest of spruce trees" },
    { code: "F-BIR", name: "Birch forest", description: "Light forest with distinctive white-barked birch trees" },
    { code: "F-JUN", name: "Jungle/Tropical forest", description: "Dense, lush tropical forest with diverse plant life" },
    { code: "F-PAL", name: "Palm grove", description: "Cluster of palm trees in a warm climate" },
    { code: "F-BAM", name: "Bamboo forest", description: "Forest of tall bamboo stalks" },
    { code: "F-RED", name: "Redwood forest", description: "Majestic forest of towering redwood trees" },
    { code: "F-MIX", name: "Mixed forest", description: "Forest with a variety of tree species" },
    { code: "F-AUT", name: "Autumn forest", description: "Forest with trees displaying fall colors" },
    { code: "F-EVR", name: "Evergreen forest", description: "Forest of trees that remain green year-round" },
    { code: "F-DES", name: "Dead forest", description: "Forest of dead or dying trees" },
    { code: "F-RGR", name: "Regrowth forest", description: "Young forest growing back after disturbance" },
    { code: "F-ANC", name: "Ancient forest", description: "Old-growth forest with massive, ancient trees" },
    { code: "F-ENC", name: "Enchanted forest", description: "Forest with a magical, mysterious atmosphere" },
    { code: "F-MAN", name: "Mangrove forest", description: "Coastal forest with roots extending into saltwater" },
    { code: "F-THN", name: "Thin forest", description: "Sparse forest with widely spaced trees" }
  ],
  desert: [
    { code: "D-SND", name: "Sandy desert", description: "Arid region covered in sand dunes" },
    { code: "D-ROC", name: "Rocky desert", description: "Dry, barren area covered with rocks and stones" },
    { code: "D-DUN", name: "Sand dunes", description: "Desert with large, shifting sand formations" },
    { code: "D-FLT", name: "Flat desert", description: "Level, expansive desert plain" },
    { code: "D-SAL", name: "Salt flat", description: "Dried lake bed covered in salt deposits" },
    { code: "D-CRK", name: "Cracked earth", description: "Dry ground with a pattern of deep cracks" },
    { code: "D-CYN", name: "Desert canyon", description: "Deep ravine carved through desert terrain" },
    { code: "D-OAS", name: "Oasis", description: "Fertile area with water and vegetation in the desert" },
    { code: "D-MSA", name: "Mesa", description: "Elevated area with a flat top and steep sides" },
    { code: "D-RDG", name: "Ridge", description: "Elevated, narrow strip of land in desert terrain" },
    { code: "D-CAC", name: "Cactus-dotted desert", description: "Desert with various cacti species" },
    { code: "D-BDL", name: "Badlands", description: "Heavily eroded, dry terrain with minimal vegetation" }
  ],
  mountains: [
    { code: "M-LOW", name: "Low mountains", description: "Range of smaller mountains or large hills" },
    { code: "M-HIG", name: "High mountains", description: "Tall mountain range with dramatic peaks" },
    { code: "M-PEA", name: "Snowy peaks", description: "Mountains with snow-covered summits" },
    { code: "M-VOL", name: "Volcanic mountain", description: "Mountain formed by volcanic activity" },
    { code: "M-FOO", name: "Mountain foothills", description: "Gentle slopes at the base of mountains" },
    { code: "M-CLF", name: "Cliffs", description: "Steep rock faces and vertical drops" },
    { code: "M-HIL", name: "Hills", description: "Rolling elevated terrain" },
    { code: "M-VAL", name: "Mountain valley", description: "Low area between mountains" },
    { code: "M-PLT", name: "Plateau", description: "Elevated flat area surrounded by steep drops" },
    { code: "M-MES", name: "Mesa", description: "Isolated flat-topped hill with steep sides" },
    { code: "M-BLU", name: "Bluffs", description: "Steep headland or cliff with broad face" },
    { code: "M-TOR", name: "Tor", description: "Isolated rock outcrop rising abruptly" },
    { code: "M-RID", name: "Mountain ridge", description: "Narrow elevated crest between peaks" },
    { code: "M-SLO", name: "Slopes", description: "Inclined mountain sides" },
    { code: "M-CRA", name: "Craggy mountains", description: "Rugged mountains with many crags and cliffs" },
    { code: "M-WEA", name: "Weathered mountains", description: "Mountains worn down by erosion" },
    { code: "M-GLR", name: "Glacier", description: "Slow-moving mass of ice in mountains" }
  ],
  water: [
    { code: "W-RIV", name: "River", description: "Flowing body of water moving through the landscape" },
    { code: "W-STR", name: "Stream", description: "Small, narrow flowing body of water" },
    { code: "W-LAK", name: "Lake", description: "Large body of still water surrounded by land" },
    { code: "W-PON", name: "Pond", description: "Small body of still water" },
    { code: "W-OCE", name: "Ocean", description: "Vast body of saltwater" },
    { code: "W-SEA", name: "Sea", description: "Large body of saltwater partially enclosed by land" },
    { code: "W-BAY", name: "Bay", description: "Recessed coastline forming a wide inlet" },
    { code: "W-LAG", name: "Lagoon", description: "Shallow body of water separated from larger water body" },
    { code: "W-EST", name: "Estuary", description: "Partially enclosed coastal water body with fresh and salt water" },
    { code: "W-MRS", name: "Marsh", description: "Wetland dominated by herbaceous plants" },
    { code: "W-SWP", name: "Swamp", description: "Wetland dominated by trees and woody plants" },
    { code: "W-BOG", name: "Bog", description: "Wetland with acidic, peat-accumulating conditions" },
    { code: "W-FEN", name: "Fen", description: "Low, flat, marshy land with peaty soil" },
    { code: "W-DEL", name: "Delta", description: "Landform at river mouth formed by sediment deposition" },
    { code: "W-ICE", name: "Frozen water", description: "Water body covered with ice" },
    { code: "W-HOT", name: "Hot spring", description: "Spring produced by emergence of geothermally heated water" },
    { code: "W-WAT", name: "Waterfall", description: "Water falling from height over a vertical drop" },
    { code: "W-RPD", name: "Rapids", description: "Fast-flowing, turbulent section of river" },
    { code: "W-SHL", name: "Shallow water", description: "Water area with minimal depth" }
  ],
  tundra: [
    { code: "T-SNO", name: "Snow field", description: "Flat area covered in snow" },
    { code: "T-ICE", name: "Ice field", description: "Flat area covered in ice" },
    { code: "T-FRZ", name: "Frozen ground", description: "Permafrost terrain with frozen soil" },
    { code: "T-TUN", name: "Tundra", description: "Cold, treeless plain with frozen subsoil" },
    { code: "T-TAI", name: "Taiga border", description: "Transition between tundra and boreal forest" },
    { code: "T-ROC", name: "Rocky tundra", description: "Tundra with exposed rocks and minimal soil" },
    { code: "T-LCH", name: "Lichen-covered ground", description: "Tundra covered with lichen growth" },
    { code: "T-DVS", name: "Divided snow", description: "Patchy snow cover with exposed ground" },
    { code: "T-ICM", name: "Ice melt areas", description: "Areas where ice is melting, creating pools" },
    { code: "T-POL", name: "Polar desert", description: "Extremely cold, dry area with minimal precipitation" }
  ],
  rocky: [
    { code: "R-BLD", name: "Boulder field", description: "Area covered with large rocks and boulders" },
    { code: "R-SCR", name: "Scree", description: "Accumulation of broken rock fragments on slope" },
    { code: "R-KAR", name: "Karst", description: "Landscape formed by dissolution of soluble rocks" },
    { code: "R-CRG", name: "Crag", description: "Rugged, steep rock formation" },
    { code: "R-OUT", name: "Outcrop", description: "Exposed bedrock protruding from surrounding soil" },
    { code: "R-CAV", name: "Cave entrance", description: "Opening to underground cavern system" },
    { code: "R-STO", name: "Stony ground", description: "Area covered with numerous small stones" },
    { code: "R-GRN", name: "Granite formation", description: "Area with exposed granite rock" },
    { code: "R-SND", name: "Sandstone formation", description: "Area with exposed sandstone rock" },
    { code: "R-BAS", name: "Basalt formation", description: "Area with exposed basalt rock" },
    { code: "R-LST", name: "Limestone area", description: "Region with limestone rock formations" },
    { code: "R-MRB", name: "Marble deposit", description: "Area with marble stone formations" },
    { code: "R-MET", name: "Meteorite impact site", description: "Location where meteorite struck the ground" }
  ],
  farmland: [
    { code: "A-FLD", name: "Field", description: "Generic cultivated land" },
    { code: "A-CRP", name: "Cropland", description: "Land used for growing crops" },
    { code: "A-WHT", name: "Wheat field", description: "Field planted with wheat" },
    { code: "A-CRN", name: "Corn field", description: "Field planted with corn/maize" },
    { code: "A-RCE", name: "Rice paddy", description: "Flooded field for growing rice" },
    { code: "A-VIN", name: "Vineyard", description: "Area planted with grapevines" },
    { code: "A-ORC", name: "Orchard", description: "Area planted with fruit trees" },
    { code: "A-OLV", name: "Olive grove", description: "Area planted with olive trees" },
    { code: "A-PLT", name: "Plantation", description: "Large estate growing single crop" },
    { code: "A-GRD", name: "Garden", description: "Small cultivated area with diverse plants" },
    { code: "A-PST", name: "Pasture", description: "Grassland used for grazing livestock" },
    { code: "A-FLW", name: "Fallow field", description: "Previously cultivated field left to rest" },
    { code: "A-IRG", name: "Irrigated field", description: "Field with irrigation systems" },
    { code: "A-TRC", name: "Terraced field", description: "Field built in steps on slope" }
  ],
  special: [
    { code: "S-CRY", name: "Crystal formation", description: "Area with natural crystal growths" },
    { code: "S-MIS", name: "Mist-covered terrain", description: "Area perpetually shrouded in mist" },
    { code: "S-GLW", name: "Glowing terrain", description: "Ground that emits a mysterious glow" },
    { code: "S-ENC", name: "Enchanted ground", description: "Area with magical properties" },
    { code: "S-CRS", name: "Cursed land", description: "Area affected by negative magical influence" },
    { code: "S-ANC", name: "Ancient power site", description: "Location with concentrated magical energy" },
    { code: "S-BUR", name: "Burning ground", description: "Area with perpetually burning earth" },
    { code: "S-FRZ", name: "Perpetually frozen", description: "Area that remains frozen regardless of climate" },
    { code: "S-FLT", name: "Floating terrain", description: "Land mass hovering above the ground" },
    { code: "S-DIS", name: "Distorted reality", description: "Area where physical laws are altered" },
    { code: "S-SHD", name: "Shadow realm", description: "Area touched by shadow dimension" },
    { code: "S-ETH", name: "Ethereal plane intersection", description: "Where material world meets ethereal plane" }
  ],
  wasteland: [
    { code: "L-BLI", name: "Blighted land", description: "Area affected by magical or natural blight" },
    { code: "L-ASH", name: "Ash-covered", description: "Land covered in volcanic or fire ash" },
    { code: "L-POL", name: "Polluted area", description: "Area contaminated by harmful substances" },
    { code: "L-TOX", name: "Toxic wasteland", description: "Highly poisonous environment" },
    { code: "L-RAD", name: "Irradiated zone", description: "Area affected by magical or natural radiation" },
    { code: "L-COR", name: "Corrupted land", description: "Land twisted by dark forces" },
    { code: "L-BRN", name: "Burned area", description: "Recently burned landscape" },
    { code: "L-SCR", name: "Scorched earth", description: "Land burned to complete desolation" },
    { code: "L-RUI", name: "Ruined landscape", description: "Once-thriving area now destroyed" },
    { code: "L-BAR", name: "Barren land", description: "Land incapable of supporting life" },
    { code: "L-DES", name: "Deserted land", description: "Abandoned area once inhabited" },
    { code: "L-ERS", name: "Eroded terrain", description: "Land severely damaged by erosion" }
  ],
  modifiers: {
    elevation: [
      { code: "E-DEP", name: "Depression", description: "Area lower than surrounding terrain" },
      { code: "E-FLT", name: "Flat", description: "Level terrain without significant elevation changes" },
      { code: "E-SLI", name: "Slight elevation", description: "Gently raised above surrounding area" },
      { code: "E-MOD", name: "Moderate elevation", description: "Noticeably higher than surroundings" },
      { code: "E-HIG", name: "High elevation", description: "Significantly elevated terrain" },
      { code: "E-VRY", name: "Very high elevation", description: "Extremely high terrain" },
      { code: "E-EXT", name: "Extreme elevation", description: "Among the highest points in the region" },
      { code: "E-SLP", name: "Sloped", description: "Terrain with consistent incline" },
      { code: "E-TER", name: "Terraced", description: "Terrain with step-like levels" },
      { code: "E-INC", name: "Inclined", description: "Gradually rising terrain" }
    ],
    moisture: [
      { code: "H-ARD", name: "Arid", description: "Extremely dry conditions" },
      { code: "H-DRY", name: "Dry", description: "Below average moisture" },
      { code: "H-NRM", name: "Normal moisture", description: "Average moisture levels" },
      { code: "H-WET", name: "Wet", description: "Above average moisture" },
      { code: "H-DAM", name: "Damp", description: "Consistently moist conditions" },
      { code: "H-FLD", name: "Flood-prone", description: "Area that regularly floods" },
      { code: "H-SAT", name: "Saturated", description: "Ground completely soaked with water" },
      { code: "H-MRY", name: "Miry", description: "Very muddy conditions" },
      { code: "H-BOG", name: "Boggy", description: "Soft, spongy ground with high moisture" },
      { code: "H-SWY", name: "Swampy", description: "Waterlogged terrain with standing water" }
    ],
    fertility: [
      { code: "F-BAR", name: "Barren", description: "Unable to support plant life" },
      { code: "F-POO", name: "Poor", description: "Minimal soil nutrients" },
      { code: "F-AVG", name: "Average fertility", description: "Normal growing conditions" },
      { code: "F-GOO", name: "Good", description: "Above average soil quality" },
      { code: "F-RIC", name: "Rich", description: "Highly fertile soil" },
      { code: "F-LUX", name: "Luxuriant", description: "Exceptionally fertile conditions" },
      { code: "F-PRO", name: "Prolific", description: "Supports abundant plant growth" },
      { code: "F-SUP", name: "Superb fertility", description: "Among the most fertile soils" },
      { code: "F-MAG", name: "Magical fertility", description: "Supernaturally enhanced growing conditions" },
      { code: "F-DEP", name: "Depleted", description: "Once fertile soil now exhausted" }
    ],
    resources: [
      { code: "R-ORE", name: "Ore-bearing", description: "Contains metal ore deposits" },
      { code: "R-GEM", name: "Gem-bearing", description: "Contains gemstone deposits" },
      { code: "R-CRY", name: "Crystal-rich", description: "Rich in crystal formations" },
      { code: "R-MET", name: "Metal-rich", description: "High concentration of metals" },
      { code: "R-CLY", name: "Clay deposit", description: "Contains usable clay" },
      { code: "R-SLT", name: "Salt deposit", description: "Contains harvestable salt" },
      { code: "R-COL", name: "Coal seam", description: "Contains coal deposits" },
      { code: "R-SUL", name: "Sulfur deposit", description: "Contains sulfur deposits" },
      { code: "R-HRB", name: "Herb-rich", description: "Abundant in useful herbs" },
      { code: "R-MED", name: "Medicinal plants", description: "Contains healing plants" },
      { code: "R-FRT", name: "Fruit-bearing", description: "Natural fruit sources" },
      { code: "R-OIL", name: "Oil deposit", description: "Contains natural oil" },
      { code: "R-GAS", name: "Natural gas", description: "Contains natural gas" },
      { code: "R-SOF", name: "Soft soil", description: "Easily workable ground" },
      { code: "R-HST", name: "Historical artifacts", description: "Contains ancient items" }
    ],
    features: [
      { code: "X-TRE", name: "Scattered trees", description: "Individual trees across the landscape" },
      { code: "X-BSH", name: "Bushes", description: "Areas with shrubs and bushes" },
      { code: "X-BLD", name: "Boulders", description: "Large rocks scattered in the area" },
      { code: "X-RCK", name: "Rocks", description: "Smaller rocks throughout the area" },
      { code: "X-CFM", name: "Rock formation", description: "Distinctive rock arrangement" },
      { code: "X-SGN", name: "Standing stones", description: "Upright stones, possibly arranged" },
      { code: "X-RUI", name: "Ruins", description: "Remains of ancient structures" },
      { code: "X-TMB", name: "Ancient tomb", description: "Burial site from past civilization" },
      { code: "X-ARC", name: "Archaeological site", description: "Location with historical artifacts" },
      { code: "X-ANM", name: "Animal den", description: "Home to wild animals" },
      { code: "X-SPR", name: "Spring", description: "Natural water source from ground" },
      { code: "X-FOG", name: "Foggy area", description: "Area frequently covered in fog" },
      { code: "X-CVE", name: "Cave entrance", description: "Opening to underground cave" },
      { code: "X-HOL", name: "Hollow/depression", description: "Sunken area in terrain" },
      { code: "X-MND", name: "Mound", description: "Raised earth formation" },
      { code: "X-BRW", name: "Burrow", description: "Animal-created underground passages" }
    ],
    animals: [
      { code: "A-DEE", name: "Deer", description: "Area inhabited by deer" },
      { code: "A-RAB", name: "Rabbits", description: "Area with rabbit population" },
      { code: "A-FOX", name: "Foxes", description: "Territory with foxes" },
      { code: "A-WOL", name: "Wolves", description: "Wolf hunting grounds" },
      { code: "A-BEA", name: "Bears", description: "Area frequented by bears" },
      { code: "A-BOA", name: "Wild boars", description: "Boar habitat" },
      { code: "A-BIR", name: "Birds/songbirds", description: "Area with diverse bird life" },
      { code: "A-EAG", name: "Eagles", description: "Eagle nesting or hunting area" },
      { code: "A-HAW", name: "Hawks", description: "Hawk territory" },
      { code: "A-OWL", name: "Owls", description: "Owl habitat" },
      { code: "A-SQU", name: "Squirrels", description: "Area with squirrel population" },
      { code: "A-BAT", name: "Bats", description: "Bat roosting area" },
      { code: "A-BEE", name: "Bees/beehives", description: "Wild bee colonies" },
      { code: "A-BUT", name: "Butterflies", description: "Area with butterfly populations" },
      { code: "A-FIS", name: "Fish", description: "Waters with fish" },
      { code: "A-FRO", name: "Frogs", description: "Frog habitat" },
      { code: "A-TUR", name: "Turtles", description: "Area with turtles" },
      { code: "A-SNA", name: "Snakes", description: "Snake habitat" },
      { code: "A-LIZ", name: "Lizards", description: "Area with lizard population" },
      { code: "A-CRO", name: "Crocodiles", description: "Crocodile territory" },
      { code: "A-ELK", name: "Elk/moose", description: "Elk or moose habitat" },
      { code: "A-GOA", name: "Mountain goats", description: "Mountain goat territory" },
      { code: "A-FAL", name: "Falcons", description: "Falcon hunting grounds" },
      { code: "A-CRA", name: "Crabs", description: "Area with crab population" },
      { code: "A-SEA", name: "Seabirds", description: "Coastal birds habitat" }
    ],
    weather: [
      { code: "W-FOG", name: "Frequently foggy", description: "Area often covered in fog" },
      { code: "W-WIN", name: "Windy", description: "Consistently windy conditions" },
      { code: "W-CAL", name: "Calm", description: "Protected from strong winds" },
      { code: "W-STO", name: "Storm-prone", description: "Frequent storms" },
      { code: "W-LGT", name: "Lightning-prone", description: "Area with frequent lightning strikes" },
      { code: "W-RAI", name: "Rainy", description: "Higher than average rainfall" },
      { code: "W-DRO", name: "Drought-prone", description: "Susceptible to dry periods" },
      { code: "W-SNO", name: "Snowy", description: "Frequent snow conditions" },
      { code: "W-BLZ", name: "Blizzard-prone", description: "Subject to severe snow storms" },
      { code: "W-MLD", name: "Mild climate", description: "Moderate, comfortable weather" },
      { code: "W-EXT", name: "Extreme weather", description: "Severe weather conditions" },
      { code: "W-UNP", name: "Unpredictable weather", description: "Rapidly changing conditions" }
    ],
    cultural: [
      { code: "C-SAC", name: "Sacred ground", description: "Revered by local culture" },
      { code: "C-CUR", name: "Cursed ground", description: "Believed to bring misfortune" },
      { code: "C-BAT", name: "Battlefield", description: "Site of historical conflict" },
      { code: "C-GRA", name: "Graveyard", description: "Burial ground" },
      { code: "C-RIT", name: "Ritual site", description: "Location for ceremonies" },
      { code: "C-SET", name: "Ancient settlement", description: "Remains of past habitation" },
      { code: "C-MEE", name: "Meeting ground", description: "Traditional gathering place" },
      { code: "C-BND", name: "Boundary marker", description: "Territorial division" },
      { code: "C-TRA", name: "Trade route", description: "Path used for commerce" },
      { code: "C-FAR", name: "Farming tradition", description: "Area with agricultural history" },
      { code: "C-MNE", name: "Mining tradition", description: "Area with mining history" },
      { code: "C-HUN", name: "Hunting ground", description: "Traditional hunting area" },
      { code: "C-FSH", name: "Fishing spot", description: "Traditional fishing location" }
    ]
  }
};

const resources = {
  natural: [
    // Plant-Based
    { code: "R-NAT-001", name: "Wild Grasses", category: "Plant-Based", description: "Various grass species growing naturally" },
    { code: "R-NAT-002", name: "Reeds", category: "Plant-Based", description: "Tall water plants with hollow stems" },
    { code: "R-NAT-003", name: "Bark", category: "Plant-Based", description: "Outer covering of tree trunks" },
    { code: "R-NAT-004", name: "Leaves", category: "Plant-Based", description: "Foliage from various plants" },
    { code: "R-NAT-005", name: "Roots", category: "Plant-Based", description: "Underground plant parts" },
    { code: "R-NAT-006", name: "Sap/Resin", category: "Plant-Based", description: "Sticky substance from trees" },
    { code: "R-NAT-007", name: "Seeds", category: "Plant-Based", description: "Plant reproductive structures" },
    { code: "R-NAT-008", name: "Flowers", category: "Plant-Based", description: "Reproductive structures of flowering plants" },
    { code: "R-NAT-009", name: "Moss/Lichen", category: "Plant-Based", description: "Small flowerless plants" },
    { code: "R-NAT-010", name: "Fungus/Mushrooms", category: "Plant-Based", description: "Spore-producing organisms" },
    { code: "R-NAT-011", name: "Plant Fibers", category: "Plant-Based", description: "Stringy plant material" },
    { code: "R-NAT-012", name: "Thorns", category: "Plant-Based", description: "Sharp plant projections" },
    { code: "R-NAT-013", name: "Deadwood", category: "Plant-Based", description: "Wood from dead trees" },
    { code: "R-NAT-014", name: "Green Wood", category: "Plant-Based", description: "Fresh, unseasoned wood" },
    { code: "R-NAT-015", name: "Herbs", category: "Plant-Based", description: "Plants with medicinal or culinary uses" },
    { code: "R-NAT-016", name: "Vines", category: "Plant-Based", description: "Climbing or trailing plants" },
    
    // Mineral-Based
    { code: "R-NAT-020", name: "River Clay", category: "Mineral-Based", description: "Clay deposits from riverbeds" },
    { code: "R-NAT-021", name: "Stone (General)", category: "Mineral-Based", description: "Various rock types" },
    { code: "R-NAT-022", name: "Flint", category: "Mineral-Based", description: "Hard sedimentary cryptocrystalline form of quartz" },
    { code: "R-NAT-023", name: "Chalk", category: "Mineral-Based", description: "Soft white limestone" },
    { code: "R-NAT-024", name: "Ochre/Pigments", category: "Mineral-Based", description: "Natural earth pigments" },
    { code: "R-NAT-025", name: "Sand", category: "Mineral-Based", description: "Granular material of rock fragments" },
    { code: "R-NAT-026", name: "Gravel", category: "Mineral-Based", description: "Small rocks and pebbles" },
    { code: "R-NAT-027", name: "Salt", category: "Mineral-Based", description: "Mineral composed of sodium chloride" },
    { code: "R-NAT-028", name: "Sulfur", category: "Mineral-Based", description: "Yellow crystalline mineral" },
    { code: "R-NAT-029", name: "Obsidian", category: "Mineral-Based", description: "Naturally occurring volcanic glass" },
    { code: "R-NAT-030", name: "Quartz Crystal", category: "Mineral-Based", description: "Crystalline mineral" },
    { code: "R-NAT-031", name: "Copper Ore", category: "Mineral-Based", description: "Rock containing copper minerals" },
    { code: "R-NAT-032", name: "Tin Ore", category: "Mineral-Based", description: "Rock containing tin minerals" },
    { code: "R-NAT-033", name: "Iron Ore", category: "Mineral-Based", description: "Rock containing iron minerals" },
    { code: "R-NAT-034", name: "Charcoal (Natural)", category: "Mineral-Based", description: "Remains of fire-burned wood" },
    { code: "R-NAT-035", name: "Mica", category: "Mineral-Based", description: "Shiny silicate minerals" },
    
    // Animal-Based
    { code: "R-NAT-040", name: "Bone", category: "Animal-Based", description: "Skeletal remains" },
    { code: "R-NAT-041", name: "Antler", category: "Animal-Based", description: "Bony projections from deer/elk" },
    { code: "R-NAT-042", name: "Leather/Hide", category: "Animal-Based", description: "Animal skin" },
    { code: "R-NAT-043", name: "Sinew", category: "Animal-Based", description: "Animal tendon tissue" },
    { code: "R-NAT-044", name: "Feathers", category: "Animal-Based", description: "Bird plumage" },
    { code: "R-NAT-045", name: "Teeth", category: "Animal-Based", description: "Animal teeth" },
    { code: "R-NAT-046", name: "Claws", category: "Animal-Based", description: "Animal claws or talons" },
    { code: "R-NAT-047", name: "Fur/Pelt", category: "Animal-Based", description: "Animal fur with skin" },
    { code: "R-NAT-048", name: "Animal Fat", category: "Animal-Based", description: "Fatty tissue from animals" },
    { code: "R-NAT-049", name: "Shell", category: "Animal-Based", description: "Hard outer covering of mollusks" },
    { code: "R-NAT-050", name: "Ivory", category: "Animal-Based", description: "Dentine from animal tusks" },
    { code: "R-NAT-051", name: "Horn", category: "Animal-Based", description: "Permanent outgrowths on animal heads" },
    { code: "R-NAT-052", name: "Gut/Intestine", category: "Animal-Based", description: "Animal intestinal tissue" },
    { code: "R-NAT-053", name: "Hair/Wool", category: "Animal-Based", description: "Animal hair fibers" }
  ],
  food: [
    // Gathered Foods
    { code: "R-FOD-001", name: "Wild Berries", category: "Gathered Foods", description: "Small fruits gathered from wild plants" },
    { code: "R-FOD-002", name: "Edible Roots", category: "Gathered Foods", description: "Underground plant parts safe for consumption" },
    { code: "R-FOD-003", name: "Nuts", category: "Gathered Foods", description: "Hard-shelled tree fruits with edible kernels" },
    { code: "R-FOD-004", name: "Wild Fruits", category: "Gathered Foods", description: "Fruits from uncultivated plants" },
    { code: "R-FOD-005", name: "Edible Seeds", category: "Gathered Foods", description: "Seeds safe for human consumption" },
    { code: "R-FOD-006", name: "Edible Leaves", category: "Gathered Foods", description: "Leaves that can be eaten" },
    { code: "R-FOD-007", name: "Edible Flowers", category: "Gathered Foods", description: "Flowers safe for consumption" },
    { code: "R-FOD-008", name: "Edible Fungi", category: "Gathered Foods", description: "Non-toxic mushrooms and fungi" },
    { code: "R-FOD-009", name: "Bird Eggs", category: "Gathered Foods", description: "Eggs collected from bird nests" },
    { code: "R-FOD-010", name: "Honey", category: "Gathered Foods", description: "Sweet substance produced by bees" },
    { code: "R-FOD-011", name: "Water", category: "Gathered Foods", description: "Fresh drinking water" },
    { code: "R-FOD-012", name: "Tree Sap", category: "Gathered Foods", description: "Sweet liquid from certain trees" },
    
    // Hunted/Fished Foods
    { code: "R-FOD-020", name: "Small Game Meat", category: "Hunted Foods", description: "Meat from smaller animals" },
    { code: "R-FOD-021", name: "Large Game Meat", category: "Hunted Foods", description: "Meat from larger animals" },
    { code: "R-FOD-022", name: "Bird Meat", category: "Hunted Foods", description: "Meat from wild birds" },
    { code: "R-FOD-023", name: "River Fish", category: "Fished Foods", description: "Fish caught in rivers" },
    { code: "R-FOD-024", name: "Lake Fish", category: "Fished Foods", description: "Fish caught in lakes" },
    { code: "R-FOD-025", name: "Ocean Fish", category: "Fished Foods", description: "Fish caught in oceans" },
    { code: "R-FOD-026", name: "Shellfish", category: "Fished Foods", description: "Aquatic creatures with shells" },
    { code: "R-FOD-027", name: "Turtle/Reptile Meat", category: "Hunted Foods", description: "Meat from turtles and reptiles" },
    { code: "R-FOD-028", name: "Marine Mammals", category: "Hunted Foods", description: "Meat from sea mammals" },
    { code: "R-FOD-029", name: "Insect Protein", category: "Gathered Foods", description: "Edible insects" },
    
    // Cultivated Foods
    { code: "R-FOD-040", name: "Wild Grain", category: "Cultivated Foods", description: "Grain from wild grasses" },
    { code: "R-FOD-041", name: "Cultivated Grain", category: "Cultivated Foods", description: "Grain from planted crops" },
    { code: "R-FOD-042", name: "Root Vegetables", category: "Cultivated Foods", description: "Vegetables grown underground" },
    { code: "R-FOD-043", name: "Legumes", category: "Cultivated Foods", description: "Plants with seed pods" },
    { code: "R-FOD-044", name: "Garden Greens", category: "Cultivated Foods", description: "Leafy vegetables from gardens" },
    { code: "R-FOD-045", name: "Domesticated Fruit", category: "Cultivated Foods", description: "Fruit from cultivated plants" },
    
    // Preserved Foods
    { code: "R-FOD-060", name: "Dried Meat (Jerky)", category: "Preserved Foods", description: "Meat preserved by drying" },
    { code: "R-FOD-061", name: "Smoked Fish", category: "Preserved Foods", description: "Fish preserved by smoking" },
    { code: "R-FOD-062", name: "Dried Fruits", category: "Preserved Foods", description: "Fruits preserved by drying" },
    { code: "R-FOD-063", name: "Dried Vegetables", category: "Preserved Foods", description: "Vegetables preserved by drying" },
    { code: "R-FOD-064", name: "Salted Meat", category: "Preserved Foods", description: "Meat preserved with salt" },
    { code: "R-FOD-065", name: "Fermented Foods", category: "Preserved Foods", description: "Foods preserved through fermentation" },
    { code: "R-FOD-066", name: "Rendered Fat", category: "Preserved Foods", description: "Animal fat processed for preservation" },
    { code: "R-FOD-067", name: "Preserved Eggs", category: "Preserved Foods", description: "Eggs preserved for longer storage" },
    { code: "R-FOD-068", name: "Pemmican", category: "Preserved Foods", description: "Concentrated mixture of fat and protein" }
  ],
  materials: [
    // Fiber-Based
    { code: "R-MAT-001", name: "Cordage/Rope", category: "Fiber-Based", description: "Twisted fibers forming strong cord" },
    { code: "R-MAT-002", name: "Thread", category: "Fiber-Based", description: "Thin strand of fiber for sewing" },
    { code: "R-MAT-003", name: "Twine", category: "Fiber-Based", description: "Light string or cord" },
    { code: "R-MAT-004", name: "Woven Mats", category: "Fiber-Based", description: "Flat material made by weaving fibers" },
    { code: "R-MAT-005", name: "Woven Baskets", category: "Fiber-Based", description: "Containers made from woven material" },
    { code: "R-MAT-006", name: "Simple Cloth", category: "Fiber-Based", description: "Basic woven textile" },
    { code: "R-MAT-007", name: "Bark Cloth", category: "Fiber-Based", description: "Fabric made from tree bark" },
    { code: "R-MAT-008", name: "Felt", category: "Fiber-Based", description: "Non-woven fabric made by matting fibers" },
    { code: "R-MAT-009", name: "Hide Lashings", category: "Fiber-Based", description: "Strips of hide used for binding" },
    { code: "R-MAT-010", name: "Wattle", category: "Fiber-Based", description: "Interwoven branches for construction" },
    
    // Wood-Based
    { code: "R-MAT-020", name: "Cut Timber", category: "Wood-Based", description: "Trees cut for construction" },
    { code: "R-MAT-021", name: "Split Wood", category: "Wood-Based", description: "Wood split along grain" },
    { code: "R-MAT-022", name: "Carved Wood", category: "Wood-Based", description: "Wood shaped by carving" },
    { code: "R-MAT-023", name: "Wood Planks", category: "Wood-Based", description: "Flat pieces of sawn wood" },
    { code: "R-MAT-024", name: "Wood Pegs", category: "Wood-Based", description: "Cylindrical wooden fasteners" },
    { code: "R-MAT-025", name: "Charcoal (Processed)", category: "Wood-Based", description: "Wood burned in low oxygen" },
    { code: "R-MAT-026", name: "Pitch/Tar", category: "Wood-Based", description: "Sticky substance from heated wood" },
    { code: "R-MAT-027", name: "Wooden Boards", category: "Wood-Based", description: "Flat pieces of processed wood" },
    { code: "R-MAT-028", name: "Wooden Poles", category: "Wood-Based", description: "Long cylindrical pieces of wood" },
    { code: "R-MAT-029", name: "Wooden Frames", category: "Wood-Based", description: "Structural wood assemblies" },
    
    // Stone/Earth-Based
    { code: "R-MAT-040", name: "Cut Stone", category: "Stone/Earth-Based", description: "Stone shaped for construction" },
    { code: "R-MAT-041", name: "Shaped Stone", category: "Stone/Earth-Based", description: "Stone worked into specific forms" },
    { code: "R-MAT-042", name: "Fired Clay", category: "Stone/Earth-Based", description: "Clay hardened by heat" },
    { code: "R-MAT-043", name: "Dried Mud Brick", category: "Stone/Earth-Based", description: "Building blocks made from mud" },
    { code: "R-MAT-044", name: "Mortar", category: "Stone/Earth-Based", description: "Binding material for construction" },
    { code: "R-MAT-045", name: "Plaster", category: "Stone/Earth-Based", description: "Material for coating walls" },
    { code: "R-MAT-046", name: "Tempered Clay", category: "Stone/Earth-Based", description: "Clay mixed with additives" },
    { code: "R-MAT-047", name: "Worked Flint", category: "Stone/Earth-Based", description: "Flint shaped for tools" },
    { code: "R-MAT-048", name: "Ground Pigment", category: "Stone/Earth-Based", description: "Minerals ground for coloring" },
    { code: "R-MAT-049", name: "Shaped Obsidian", category: "Stone/Earth-Based", description: "Volcanic glass worked for tools" },
    { code: "R-MAT-050", name: "Crushed Minerals", category: "Stone/Earth-Based", description: "Minerals broken into small pieces" },
    
    // Animal-Based
    { code: "R-MAT-060", name: "Cured Hide", category: "Animal-Based", description: "Animal skin preserved for use" },
    { code: "R-MAT-061", name: "Processed Leather", category: "Animal-Based", description: "Hide treated for durability" },
    { code: "R-MAT-062", name: "Rawhide", category: "Animal-Based", description: "Untanned animal hide" },
    { code: "R-MAT-063", name: "Polished Bone", category: "Animal-Based", description: "Bone smoothed for use" },
    { code: "R-MAT-064", name: "Split Bone", category: "Animal-Based", description: "Bone divided for tools" },
    { code: "R-MAT-065", name: "Worked Antler", category: "Animal-Based", description: "Antler shaped for use" },
    { code: "R-MAT-066", name: "Worked Shell", category: "Animal-Based", description: "Shell shaped for use" },
    { code: "R-MAT-067", name: "Processed Sinew", category: "Animal-Based", description: "Animal tendon prepared for use" },
    { code: "R-MAT-068", name: "Boiled Hide Glue", category: "Animal-Based", description: "Adhesive from animal hide" },
    { code: "R-MAT-069", name: "Fish Glue", category: "Animal-Based", description: "Adhesive from fish parts" },
    { code: "R-MAT-070", name: "Stretched Gut", category: "Animal-Based", description: "Animal intestine prepared for use" },
    { code: "R-MAT-071", name: "Rendered Tallow", category: "Animal-Based", description: "Processed animal fat" }
  ],
  tools: [
    // Cutting Tools
    { code: "R-TOL-001", name: "Stone Knife", category: "Cutting Tools", description: "Cutting tool made from stone" },
    { code: "R-TOL-002", name: "Stone Scraper", category: "Cutting Tools", description: "Tool for scraping hides" },
    { code: "R-TOL-003", name: "Stone Axe", category: "Cutting Tools", description: "Chopping tool with stone head" },
    { code: "R-TOL-004", name: "Flint Blade", category: "Cutting Tools", description: "Sharp cutting edge made from flint" },
    { code: "R-TOL-005", name: "Obsidian Blade", category: "Cutting Tools", description: "Extremely sharp volcanic glass blade" },
    { code: "R-TOL-006", name: "Bone Awl", category: "Cutting Tools", description: "Pointed tool for making holes" },
    { code: "R-TOL-007", name: "Shell Knife", category: "Cutting Tools", description: "Cutting tool made from shell" },
    { code: "R-TOL-008", name: "Wooden Wedge", category: "Cutting Tools", description: "Tool for splitting wood" },
    { code: "R-TOL-009", name: "Stone Adze", category: "Cutting Tools", description: "Tool for shaping wood" },
    { code: "R-TOL-010", name: "Bone Needle", category: "Cutting Tools", description: "Tool for sewing" },
    
    // Pounding/Grinding Tools
    { code: "R-TOL-020", name: "Hammerstone", category: "Pounding Tools", description: "Stone used for striking" },
    { code: "R-TOL-021", name: "Stone Mortar and Pestle", category: "Pounding Tools", description: "Tools for grinding materials" },
    { code: "R-TOL-022", name: "Grinding Stone", category: "Pounding Tools", description: "Stone for processing grains" },
    { code: "R-TOL-023", name: "Wooden Mallet", category: "Pounding Tools", description: "Wooden hammer for striking" },
    { code: "R-TOL-024", name: "Stone Hammer", category: "Pounding Tools", description: "Hafted stone for striking" },
    { code: "R-TOL-025", name: "Bone Pounder", category: "Pounding Tools", description: "Tool made from large bone" },
    { code: "R-TOL-026", name: "Antler Hammer", category: "Pounding Tools", description: "Hammer made from antler" },
    { code: "R-TOL-027", name: "Grinding Slab", category: "Pounding Tools", description: "Flat stone for grinding" },
    
    // Digging Tools
    { code: "R-TOL-040", name: "Digging Stick", category: "Digging Tools", description: "Simple tool for digging soil" },
    { code: "R-TOL-041", name: "Stone-tipped Spade", category: "Digging Tools", description: "Digging tool with stone edge" },
    { code: "R-TOL-042", name: "Antler Pick", category: "Digging Tools", description: "Digging tool made from antler" },
    { code: "R-TOL-043", name: "Shell Scoop", category: "Digging Tools", description: "Tool for moving soil" },
    { code: "R-TOL-044", name: "Bone Shovel", category: "Digging Tools", description: "Shovel made from large bone" },
    { code: "R-TOL-045", name: "Wooden Hoe", category: "Digging Tools", description: "Tool for breaking soil" },
    
    // Fire Tools
    { code: "R-TOL-060", name: "Fire Drill", category: "Fire Tools", description: "Tool for creating fire by friction" },
    { code: "R-TOL-061", name: "Fire Bow", category: "Fire Tools", description: "Bow-driven fire starting tool" },
    { code: "R-TOL-062", name: "Fire Plow", category: "Fire Tools", description: "Friction-based fire starter" },
    { code: "R-TOL-063", name: "Strike-a-Light", category: "Fire Tools", description: "Tool for creating sparks" },
    { code: "R-TOL-064", name: "Tinder Bundle", category: "Fire Tools", description: "Easily ignitable materials" },
    { code: "R-TOL-065", name: "Fire Carrier", category: "Fire Tools", description: "Container for transporting embers" },
    { code: "R-TOL-066", name: "Torch", category: "Fire Tools", description: "Portable light source" },
    
    // Hunting/Fishing Tools
    { code: "R-TOL-080", name: "Fish Hook", category: "Hunting/Fishing Tools", description: "Curved tool for catching fish" },
    { code: "R-TOL-081", name: "Fishing Line", category: "Hunting/Fishing Tools", description: "Cord for fishing" },
    { code: "R-TOL-082", name: "Fish Trap", category: "Hunting/Fishing Tools", description: "Device for catching fish" },
    { code: "R-TOL-083", name: "Fishing Net", category: "Hunting/Fishing Tools", description: "Mesh for catching fish" },
    { code: "R-TOL-084", name: "Fishing Spear", category: "Hunting/Fishing Tools", description: "Spear designed for fishing" },
    { code: "R-TOL-085", name: "Snare", category: "Hunting/Fishing Tools", description: "Trap for catching animals" },
    { code: "R-TOL-086", name: "Deadfall Trap", category: "Hunting/Fishing Tools", description: "Weight-based animal trap" },
    { code: "R-TOL-087", name: "Bird Net", category: "Hunting/Fishing Tools", description: "Net for catching birds" },
    { code: "R-TOL-088", name: "Hunting Blind", category: "Hunting/Fishing Tools", description: "Concealment for hunting" },
    { code: "R-TOL-089", name: "Hunting Decoy", category: "Hunting/Fishing Tools", description: "Fake animal to attract prey" },
    
    // Crafting Tools
    { code: "R-TOL-100", name: "Bone Needle", category: "Crafting Tools", description: "Tool for sewing" },
    { code: "R-TOL-101", name: "Spindle", category: "Crafting Tools", description: "Tool for spinning fibers" },
    { code: "R-TOL-102", name: "Weaving Frame", category: "Crafting Tools", description: "Structure for weaving" },
    { code: "R-TOL-103", name: "Loom Weights", category: "Crafting Tools", description: "Weights for tensioning threads" },
    { code: "R-TOL-104", name: "Antler Pressure Flaker", category: "Crafting Tools", description: "Tool for knapping stone" },
    { code: "R-TOL-105", name: "Burnishing Tool", category: "Crafting Tools", description: "Tool for smoothing surfaces" },
    { code: "R-TOL-106", name: "Pottery Paddle", category: "Crafting Tools", description: "Tool for shaping clay" },
    { code: "R-TOL-107", name: "Scraping Tool", category: "Crafting Tools", description: "Tool for removing material" },
    { code: "R-TOL-108", name: "Leather Punch", category: "Crafting Tools", description: "Tool for making holes in leather" },
    { code: "R-TOL-109", name: "Basketry Tools", category: "Crafting Tools", description: "Tools for making baskets" },
    
    // Transport Tools
    { code: "R-TOL-120", name: "Travois", category: "Transport Tools", description: "Frame for dragging loads" },
    { code: "R-TOL-121", name: "Carrying Basket", category: "Transport Tools", description: "Container for transport" },
    { code: "R-TOL-122", name: "Reed Float", category: "Transport Tools", description: "Buoyant device for water" },
    { code: "R-TOL-123", name: "Log Raft", category: "Transport Tools", description: "Simple water transport" },
    { code: "R-TOL-124", name: "Dugout Canoe", category: "Transport Tools", description: "Boat made from hollowed log" },
    { code: "R-TOL-125", name: "Skin Boat", category: "Transport Tools", description: "Boat made with hide covering" },
    { code: "R-TOL-126", name: "Sled", category: "Transport Tools", description: "Runner-based transport" },
    { code: "R-TOL-127", name: "Carrying Frame", category: "Transport Tools", description: "Frame for carrying loads" }
  ]
};

const actions = {
  plains: {
    "P-BAS": [
      { code: "G-001", name: "Gather Wild Grasses", description: "Collect grasses for various uses" },
      { code: "G-002", name: "Collect Edible Roots", description: "Dig up edible roots from the soil" },
      { code: "H-001", name: "Hunt Small Game", description: "Hunt rabbits, rodents, and other small animals" },
      { code: "H-002", name: "Set Basic Snares", description: "Place simple traps for catching animals" },
      { code: "C-001", name: "Build Grass Huts", description: "Construct simple shelters using grass" },
      { code: "A-001", name: "Clear Land for Planting", description: "Prepare ground for cultivation" },
      { code: "A-002", name: "Plant Wild Seeds", description: "Sow collected seeds in prepared ground" },
      { code: "D-001", name: "Observe Animal Patterns", description: "Study animal behavior for future hunting" },
      { code: "X-001", name: "Survey Open Terrain", description: "Explore and map the surrounding grassland" }
    ],
    "P-LUS": [
      { code: "G-001", name: "Gather Wild Grasses", description: "Collect grasses for various uses" },
      { code: "G-002", name: "Collect Edible Roots", description: "Dig up edible roots from the soil" },
      { code: "G-003", name: "Harvest Wild Fruits", description: "Gather fruits from wild plants" },
      { code: "G-004", name: "Gather Medicinal Plants", description: "Collect plants with healing properties" },
      { code: "H-001", name: "Hunt Small Game", description: "Hunt rabbits, rodents, and other small animals" },
      { code: "H-003", name: "Track Larger Herds", description: "Follow and hunt larger animals that travel in groups" },
      { code: "C-001", name: "Build Grass Huts", description: "Construct simple shelters using grass" },
      { code: "A-001", name: "Clear Land for Planting", description: "Prepare ground for cultivation" },
      { code: "A-002", name: "Plant Wild Seeds", description: "Sow collected seeds in prepared ground" },
      { code: "A-003", name: "Create Garden Plots", description: "Establish small areas for intensive plant cultivation" },
      { code: "D-001", name: "Observe Animal Patterns", description: "Study animal behavior for future hunting" },
      { code: "D-002", name: "Attempt First Taming", description: "Try to domesticate wild animals" },
      { code: "S-001", name: "Establish Gathering Place", description: "Create a central location for community activities" },
      { code: "X-001", name: "Survey Open Terrain", description: "Explore and map the surrounding grassland" }
    ],
    "P-TAL": [
      { code: "G-001", name: "Gather Wild Grasses", description: "Collect tall grasses for construction and crafting" },
      { code: "G-002", name: "Collect Edible Seeds", description: "Harvest seeds from tall grass species" },
      { code: "H-001", name: "Hunt Small Game", description: "Hunt animals hiding in the tall grass" },
      { code: "C-001", name: "Build Grass Shelters", description: "Construct shelters using abundant tall grass" },
      { code: "X-001", name: "Survey Grass Patterns", description: "Study wind patterns through grass movement" }
    ],
    "P-FLW": [
      { code: "G-001", name: "Gather Wild Grasses", description: "Collect grasses for various uses" },
      { code: "G-003", name: "Harvest Wild Fruits", description: "Gather fruits from wild plants" },
      { code: "G-004", name: "Gather Medicinal Plants", description: "Collect plants with healing properties" },
      { code: "G-005", name: "Collect Honey", description: "Gather honey from wild bees attracted to flowers" },
      { code: "A-003", name: "Create Garden Plots", description: "Establish small areas for intensive plant cultivation" },
      { code: "S-002", name: "Perform Seasonal Rituals", description: "Conduct ceremonies related to flowering cycles" },
      { code: "S-003", name: "Create Floral Decorations", description: "Make decorative items from flowers" }
    ],
    "P-DRY": [
      { code: "G-001", name: "Gather Wild Grasses", description: "Collect grasses for various uses (limited)" },
      { code: "G-006", name: "Collect Drought-Resistant Seeds", description: "Gather seeds from hardy plants" },
      { code: "H-001", name: "Hunt Small Game", description: "Hunt animals adapted to dry conditions" },
      { code: "H-003", name: "Track Larger Herds", description: "Follow migrating animals seeking water" },
      { code: "C-002", name: "Build Shade Structures", description: "Construct shelters focused on providing shade" },
      { code: "T-001", name: "Create Hunting Weapons", description: "Craft tools for hunting in open terrain" },
      { code: "W-001", name: "Dig Simple Wells", description: "Create access to underground water" },
      { code: "X-002", name: "Search for Water Sources", description: "Explore to find hidden water" },
      { code: "X-003", name: "Scout Migration Routes", description: "Map paths of animal movement" }
    ],
    "P-FRT": [
      { code: "G-001", name: "Gather Wild Grasses", description: "Collect grasses for various uses" },
      { code: "G-002", name: "Collect Edible Roots", description: "Dig up abundant edible roots" },
      { code: "G-003", name: "Harvest Wild Fruits", description: "Gather fruits from wild plants" },
      { code: "C-001", name: "Build Grass Huts", description: "Construct simple shelters using grass" },
      { code: "C-003", name: "Create Storage Structures", description: "Build places to store harvested food" },
      { code: "A-001", name: "Clear Land for Planting", description: "Prepare ground for cultivation" },
      { code: "A-002", name: "Plant Wild Seeds", description: "Sow collected seeds in prepared ground" },
      { code: "A-003", name: "Create Garden Plots", description: "Establish small areas for intensive plant cultivation" },
      { code: "A-004", name: "Establish First Field", description: "Create larger cultivated area" },
      { code: "D-001", name: "Observe Animal Patterns", description: "Study animal behavior for future hunting" },
      { code: "D-002", name: "Attempt First Taming", description: "Try to domesticate wild animals" },
      { code: "D-003", name: "Create Grazing Area", description: "Establish protected area for animals" },
      { code: "S-001", name: "Establish Gathering Place", description: "Create a central location for community activities" },
      { code: "S-004", name: "Mark Territory Boundaries", description: "Define the limits of your settlement area" }
    ]
  },
  forest: {
    "F-OAK": [
      { code: "G-007", name: "Collect Acorns", description: "Gather acorns for food processing" },
      { code: "G-008", name: "Gather Fallen Wood", description: "Collect wood from the forest floor" },
      { code: "G-009", name: "Harvest Tree Bark", description: "Remove bark for various uses" },
      { code: "H-004", name: "Hunt Forest Animals", description: "Hunt animals that live in the forest" },
      { code: "H-005", name: "Set Forest Traps", description: "Place traps designed for forest wildlife" },
      { code: "C-004", name: "Build Wood Shelters", description: "Construct shelters using forest materials" },
      { code: "C-005", name: "Create Wooden Palisade", description: "Build a defensive wall of wooden stakes" },
      { code: "T-002", name: "Craft Wooden Tools", description: "Make tools from wood" },
      { code: "T-003", name: "Make Wooden Containers", description: "Create vessels for storage from wood" },
      { code: "S-005", name: "Establish Sacred Grove", description: "Designate a special area for spiritual practices" }
    ],
    "F-PIN": [
      { code: "G-008", name: "Gather Fallen Wood", description: "Collect wood from the forest floor" },
      { code: "G-010", name: "Collect Pine Resin", description: "Gather sticky substance from pine trees" },
      { code: "G-011", name: "Harvest Pine Nuts", description: "Collect edible seeds from pine cones" },
      { code: "H-004", name: "Hunt Forest Animals", description: "Hunt animals that live in the forest" },
      { code: "H-005", name: "Set Forest Traps", description: "Place traps designed for forest wildlife" },
      { code: "C-004", name: "Build Wood Shelters", description: "Construct shelters using forest materials" },
      { code: "C-006", name: "Create Pine Needle Bedding", description: "Make comfortable bedding from pine needles" },
      { code: "T-004", name: "Make Pitch Adhesive", description: "Create sticky substance for binding" },
      { code: "X-004", name: "Scout Forest Interior", description: "Explore deeper into the forest" }
    ],
    "F-JUN": [
      { code: "G-003", name: "Harvest Wild Fruits", description: "Gather fruits from jungle plants" },
      { code: "G-004", name: "Gather Medicinal Plants", description: "Collect tropical plants with healing properties" },
      { code: "G-012", name: "Collect Tropical Fibers", description: "Gather strong plant fibers for crafting" },
      { code: "G-013", name: "Gather Exotic Seeds", description: "Collect seeds from unusual jungle plants" },
      { code: "H-006", name: "Hunt Jungle Prey", description: "Hunt animals adapted to jungle environment" },
      { code: "C-007", name: "Build Elevated Structures", description: "Construct shelters raised above the ground" },
      { code: "C-008", name: "Create Rain Shelters", description: "Build structures to protect from tropical rain" },
      { code: "T-005", name: "Make Fiber Ropes", description: "Create strong cordage from jungle plants" },
      { code: "T-006", name: "Create Woven Containers", description: "Weave baskets and containers from flexible materials" }
    ],
    "F-DES": [
      { code: "G-008", name: "Gather Fallen Wood", description: "Collect abundant deadwood" },
      { code: "G-014", name: "Collect Fungus", description: "Gather mushrooms growing on dead trees" },
      { code: "H-007", name: "Hunt Scavengers", description: "Hunt animals that feed on decaying matter" },
      { code: "C-009", name: "Build With Deadwood", description: "Construct structures using dead trees" },
      { code: "T-007", name: "Make Charcoal", description: "Create charcoal from deadwood" },
      { code: "X-005", name: "Investigate Forest Decline", description: "Study what caused the forest to die" }
    ],
    "F-MAN": [
      { code: "G-015", name: "Collect Shellfish", description: "Gather mollusks from mangrove roots" },
      { code: "G-016", name: "Gather Mangrove Fruits", description: "Collect fruits from mangrove trees" },
      { code: "H-008", name: "Hunt Wading Birds", description: "Hunt birds that feed in shallow water" },
      { code: "H-009", name: "Fish In Mangrove Roots", description: "Catch fish hiding among roots" },
      { code: "C-010", name: "Build Stilted Structures", description: "Construct homes elevated above water" },
      { code: "T-008", name: "Make Reed Baskets", description: "Weave containers from water plants" },
      { code: "T-009", name: "Craft Fishing Tools", description: "Create specialized tools for mangrove fishing" },
      { code: "W-002", name: "Navigate Tidal Channels", description: "Learn to move through changing water levels" }
    ]
  },
  desert: {
    "D-SND": [
      { code: "G-017", name: "Gather Desert Seeds", description: "Collect seeds from desert plants" },
      { code: "G-018", name: "Collect Desert Plants", description: "Gather drought-resistant vegetation" },
      { code: "H-010", name: "Hunt Desert Animals", description: "Hunt creatures adapted to arid conditions" },
      { code: "C-011", name: "Dig Sand Shelters", description: "Create shelters partially buried in sand" },
      { code: "C-012", name: "Create Shade Structures", description: "Build shelters focused on providing shade" },
      { code: "T-010", name: "Make Sun Protection", description: "Craft items to shield from intense sunlight" },
      { code: "W-003", name: "Dig Deep Wells", description: "Create access to underground water" },
      { code: "X-006", name: "Search For Oases", description: "Explore to find water sources" }
    ],
    "D-ROC": [
      { code: "G-019", name: "Gather Lithic Material", description: "Collect stone for tool making" },
      { code: "G-020", name: "Collect Desert Herbs", description: "Gather rare plants growing among rocks" },
      { code: "H-010", name: "Hunt Desert Animals", description: "Hunt creatures adapted to rocky terrain" },
      { code: "C-013", name: "Build Stone Shelters", description: "Construct dwellings using abundant stone" },
      { code: "T-011", name: "Create Stone Tools", description: "Craft implements from quality stone" },
      { code: "W-004", name: "Collect Dew Water", description: "Gather moisture that collects on rocks" },
      { code: "X-007", name: "Find Cave Shelters", description: "Locate natural shelters in rock formations" },
      { code: "X-008", name: "Look For Mineral Deposits", description: "Search for valuable minerals" }
    ],
    "D-OAS": [
      { code: "G-003", name: "Harvest Wild Fruits", description: "Gather fruits growing near water" },
      { code: "G-021", name: "Collect Palm Fibers", description: "Gather materials from palm trees" },
      { code: "G-022", name: "Gather Water Plants", description: "Collect plants growing in or near water" },
      { code: "H-011", name: "Hunt Oasis Visitors", description: "Hunt animals that come to drink" },
      { code: "H-012", name: "Fish In Oasis Pool", description: "Catch fish from the oasis water" },
      { code: "C-014", name: "Build Oasis Shelters", description: "Construct homes near the water source" },
      { code: "A-005", name: "Plant Date Palms", description: "Cultivate palm trees for food" },
      { code: "A-006", name: "Create Irrigated Gardens", description: "Build small gardens using oasis water" },
      { code: "W-005", name: "Maintain Water Source", description: "Work to preserve the oasis water" },
      { code: "S-006", name: "Establish Trading Post", description: "Create a location for desert travelers to trade" }
    ]
  },
  mountains: {
    "M-LOW": [
      { code: "G-023", name: "Gather Mountain Herbs", description: "Collect unique plants from mountain slopes" },
      { code: "G-024", name: "Collect Mountain Berries", description: "Gather berries that grow at higher elevations" },
      { code: "H-013", name: "Hunt Mountain Goats", description: "Hunt agile animals on rocky terrain" },
      { code: "H-014", name: "Set Cliff Traps", description: "Place traps in strategic mountain locations" },
      { code: "C-015", name: "Build Against Slopes", description: "Construct shelters using the natural incline" },
      { code: "M-001", name: "Collect Surface Stones", description: "Gather useful rocks and stones" },
      { code: "M-002", name: "Find Mineral Deposits", description: "Search for valuable minerals" },
      { code: "X-009", name: "Scout Mountain Passes", description: "Explore routes through the mountains" },
      { code: "X-010", name: "Search For Caves", description: "Look for natural shelters in the rock" }
    ],
    "M-HIG": [
      { code: "G-025", name: "Gather Alpine Plants", description: "Collect rare plants from high elevations" },
      { code: "H-015", name: "Hunt High Altitude Game", description: "Hunt animals adapted to mountain heights" },
      { code: "C-016", name: "Build Windbreak Shelters", description: "Construct homes protected from strong winds" },
      { code: "C-017", name: "Create Stone Markers", description: "Build cairns and other navigation aids" },
      { code: "M-003", name: "Find Gem Deposits", description: "Search for precious stones" },
      { code: "M-004", name: "Collect Pure Water", description: "Gather water from mountain springs" },
      { code: "X-011", name: "Establish Lookout Points", description: "Create observation posts with wide views" },
      { code: "S-007", name: "Create Summit Shrine", description: "Build a sacred place at high elevation" }
    ],
    "M-VOL": [
      { code: "G-026", name: "Collect Volcanic Glass", description: "Gather obsidian for tools" },
      { code: "G-027", name: "Gather Sulfur Deposits", description: "Collect yellow mineral deposits" },
      { code: "C-018", name: "Build Heat-Resistant Shelter", description: "Create dwellings that withstand volcanic heat" },
      { code: "M-005", name: "Harvest Obsidian", description: "Collect volcanic glass for sharp tools" },
      { code: "M-006", name: "Collect Mineral Deposits", description: "Gather unique minerals formed by volcanic activity" },
      { code: "T-012", name: "Create Obsidian Tools", description: "Craft extremely sharp implements" },
      { code: "X-012", name: "Find Hot Springs", description: "Locate naturally heated water sources" },
      { code: "S-008", name: "Establish Fire Rituals", description: "Create ceremonies honoring volcanic forces" }
    ],
    "M-FOO": [
      { code: "G-023", name: "Gather Mountain Herbs", description: "Collect unique plants from foothills" },
      { code: "G-028", name: "Collect Foothill Plants", description: "Gather plants from transitional zones" },
      { code: "H-016", name: "Hunt Transitional Game", description: "Hunt animals that move between ecosystems" },
      { code: "C-019", name: "Build Against Hill", description: "Construct shelters using the natural hill" },
      { code: "C-020", name: "Create Terraced Space", description: "Build level areas on sloped ground" },
      { code: "A-007", name: "Establish Hill Gardens", description: "Create gardens on sloped terrain" },
      { code: "X-013", name: "Find Cave Shelters", description: "Look for natural shelters in hillsides" },
      { code: "X-014", name: "Locate Springs", description: "Find water sources emerging from hills" }
    ]
  },
  water: {
    "W-RIV": [
      { code: "G-029", name: "Collect Riverbank Clay", description: "Gather clay deposits from river edges" },
      { code: "G-030", name: "Gather River Plants", description: "Collect plants growing in and near water" },
      { code: "H-017", name: "Fish River Waters", description: "Catch fish from the flowing water" },
      { code: "H-018", name: "Hunt River Visitors", description: "Hunt animals that come to drink" },
      { code: "C-021", name: "Build Near Riverbank", description: "Construct shelters close to water access" },
      { code: "T-013", name: "Make Clay Vessels", description: "Create containers from river clay" },
      { code: "T-014", name: "Create Fishing Tools", description: "Craft implements for catching fish" },
      { code: "W-006", name: "Create Water Channel", description: "Dig small channels to direct water flow" },
      { code: "W-007", name: "Build Simple Dock", description: "Construct platform for water access" },
      { code: "X-015", name: "Follow River Course", description: "Explore along the river path" }
    ],
    "W-STR": [
      { code: "G-029", name: "Collect Stream Clay", description: "Gather clay deposits from stream banks" },
      { code: "G-030", name: "Gather Stream Plants", description: "Collect plants growing along streams" },
      { code: "H-017", name: "Fish Stream Waters", description: "Catch fish from flowing water" },
      { code: "H-018", name: "Hunt Stream Visitors", description: "Hunt animals that come to drink" },
      { code: "C-021", name: "Build Near Stream", description: "Construct shelters close to water access" },
      { code: "T-014", name: "Create Fishing Tools", description: "Craft implements for stream fishing" },
      { code: "W-006", name: "Create Small Dam", description: "Build structure to control water flow" },
      { code: "X-015", name: "Follow Stream Course", description: "Explore where the stream leads" }
    ],
    "W-LAK": [
      { code: "G-030", name: "Gather River Plants", description: "Collect plants growing in and near water" },
      { code: "G-031", name: "Collect Lakeside Reeds", description: "Gather tall water plants for crafting" },
      { code: "H-017", name: "Fish River Waters", description: "Catch fish from the lake" },
      { code: "H-019", name: "Hunt Lake Birds", description: "Hunt waterfowl and shore birds" },
      { code: "C-022", name: "Build Lakeside Shelters", description: "Construct homes near the lake shore" },
      { code: "C-023", name: "Create Fish Drying Racks", description: "Build structures for preserving fish" },
      { code: "T-014", name: "Create Fishing Tools", description: "Craft implements for catching fish" },
      { code: "T-015", name: "Make Reed Boats", description: "Construct simple watercraft from reeds" },
      { code: "W-008", name: "Build Lake Access", description: "Create safe ways to reach the water" }
    ],
    "W-PON": [
      { code: "G-030", name: "Gather Pond Plants", description: "Collect plants growing in and around ponds" },
      { code: "G-031", name: "Harvest Water Lilies", description: "Gather floating aquatic plants" },
      { code: "H-017", name: "Fish Pond Waters", description: "Catch fish from still water" },
      { code: "H-019", name: "Hunt Pond Visitors", description: "Hunt animals that come to drink" },
      { code: "C-022", name: "Build Pond-Side Shelters", description: "Construct homes near water source" },
      { code: "T-014", name: "Create Fishing Tools", description: "Craft implements for pond fishing" },
      { code: "W-005", name: "Maintain Water Quality", description: "Work to keep pond water clean" },
      { code: "X-016", name: "Study Pond Ecosystem", description: "Observe the relationships between pond species" }
    ],
    "W-MRS": [
      { code: "G-031", name: "Collect Marsh Reeds", description: "Gather tall water plants for crafting" },
      { code: "G-032", name: "Gather Salt-Tolerant Plants", description: "Collect specialized plants from brackish water" },
      { code: "H-019", name: "Hunt Marsh Birds", description: "Hunt waterfowl and wading birds" },
      { code: "H-021", name: "Fish Shallow Waters", description: "Catch fish from brackish waters" },
      { code: "C-024", name: "Build Elevated Structures", description: "Construct homes above tidal waters" },
      { code: "C-025", name: "Create Walkways", description: "Build paths through wet areas" },
      { code: "T-016", name: "Make Marsh Remedies", description: "Create medicines from marsh plants" },
      { code: "W-009", name: "Build Tidal Channels", description: "Create paths for water movement" },
      { code: "X-016", name: "Map Tidal Patterns", description: "Document how water levels change" }
    ],
    "W-SWP": [
      { code: "G-031", name: "Collect Lakeside Reeds", description: "Gather tall water plants for crafting" },
      { code: "G-032", name: "Gather Swamp Roots", description: "Collect specialized plants from wet soil" },
      { code: "H-020", name: "Hunt Swamp Animals", description: "Hunt creatures adapted to wetland life" },
      { code: "H-021", name: "Fish Swamp Waters", description: "Catch fish from murky waters" },
      { code: "C-024", name: "Build Raised Structures", description: "Construct homes elevated above water" },
      { code: "C-025", name: "Create Boardwalks", description: "Build wooden paths over wet ground" },
      { code: "T-016", name: "Make Swamp Remedies", description: "Create medicines from swamp plants" },
      { code: "W-009", name: "Build Drainage Channels", description: "Create paths for water movement" },
      { code: "X-016", name: "Map Safe Passages", description: "Find reliable routes through the swamp" }
    ],
    "W-BOG": [
      { code: "G-033", name: "Harvest Bog Plants", description: "Collect specialized bog vegetation" },
      { code: "G-034", name: "Collect Peat", description: "Gather decomposed plant material" },
      { code: "H-022", name: "Hunt Bog Visitors", description: "Hunt animals that visit the bog" },
      { code: "C-026", name: "Build on Firm Ground", description: "Construct shelters on stable areas" },
      { code: "T-017", name: "Use Peat for Fuel", description: "Process peat for burning" },
      { code: "W-010", name: "Create Stepping Paths", description: "Build safe routes across soft ground" },
      { code: "X-017", name: "Find Preserved Materials", description: "Search for items preserved in bog conditions" }
    ],
    "W-FEN": [
      { code: "G-033", name: "Harvest Fen Plants", description: "Collect specialized fen vegetation" },
      { code: "G-034", name: "Collect Peat Moss", description: "Gather spongy plant material" },
      { code: "H-022", name: "Hunt Fen Wildlife", description: "Hunt animals adapted to fen conditions" },
      { code: "C-026", name: "Build on Stable Ground", description: "Construct shelters on drier areas" },
      { code: "T-017", name: "Process Peat", description: "Prepare peat for various uses" },
      { code: "W-010", name: "Create Drainage", description: "Build channels to manage water" },
      { code: "X-017", name: "Study Water Chemistry", description: "Examine the unique water properties" }
    ],
    "W-EST": [
      { code: "G-030", name: "Gather Estuary Plants", description: "Collect plants from brackish water zones" },
      { code: "G-031", name: "Harvest Salt Marsh Grasses", description: "Gather specialized grasses" },
      { code: "H-017", name: "Fish Estuary Waters", description: "Catch fish from mixed fresh/salt water" },
      { code: "H-019", name: "Hunt Estuary Birds", description: "Hunt birds attracted to estuary ecosystems" },
      { code: "C-022", name: "Build Tidal-Aware Structures", description: "Construct homes considering water level changes" },
      { code: "T-014", name: "Create Specialized Fishing Tools", description: "Craft implements for estuary fishing" },
      { code: "T-015", name: "Make Salt Collection Tools", description: "Craft implements for gathering salt" },
      { code: "W-008", name: "Monitor Tidal Patterns", description: "Track and predict water level changes" }
    ],
    "W-DEL": [
      { code: "G-030", name: "Gather Delta Plants", description: "Collect plants from sediment-rich areas" },
      { code: "G-031", name: "Harvest River Cane", description: "Gather tall reeds from delta regions" },
      { code: "H-017", name: "Fish Rich Waters", description: "Catch fish from nutrient-rich delta" },
      { code: "H-019", name: "Hunt Delta Birds", description: "Hunt birds attracted to delta ecosystems" },
      { code: "C-022", name: "Build on Raised Land", description: "Construct homes on natural levees" },
      { code: "C-023", name: "Create Fishing Stations", description: "Build structures for fishing activities" },
      { code: "T-014", name: "Create Specialized Fishing Tools", description: "Craft implements for delta fishing" },
      { code: "W-008", name: "Navigate Channels", description: "Learn to move through changing waterways" },
      { code: "A-006", name: "Establish Fertile Gardens", description: "Create plots using rich delta soil" }
    ]
  },
  tundra: {
    "T-SNO": [
      { code: "G-035", name: "Gather Snow", description: "Collect snow for water and other uses" },
      { code: "H-023", name: "Hunt Snow-Dwelling Game", description: "Hunt animals adapted to snowy conditions" },
      { code: "C-027", name: "Build Snow Shelters", description: "Construct insulated shelters from snow" },
      { code: "C-028", name: "Create Wind Barriers", description: "Build structures to block cold winds" },
      { code: "T-018", name: "Make Snow Tools", description: "Craft implements for snow travel and hunting" },
      { code: "T-019", name: "Craft Cold-Weather Gear", description: "Create clothing and equipment for extreme cold" },
      { code: "X-018", name: "Find Safe Travel Routes", description: "Discover paths with minimal snow hazards" }
    ],
    "T-TUN": [
      { code: "G-036", name: "Gather Tundra Plants", description: "Collect hardy plants from cold environment" },
      { code: "G-037", name: "Collect Lichen", description: "Gather slow-growing plant-like organisms" },
      { code: "H-024", name: "Hunt Tundra Animals", description: "Hunt creatures adapted to harsh conditions" },
      { code: "C-029", name: "Build Insulated Shelters", description: "Construct homes designed to retain heat" },
      { code: "C-030", name: "Create Storage Caches", description: "Build protected food storage areas" },
      { code: "T-020", name: "Make Fur Clothing", description: "Craft warm garments from animal pelts" },
      { code: "X-019", name: "Map Seasonal Resources", description: "Document how resources change with seasons" }
    ],
    "T-TAI": [
      { code: "G-038", name: "Collect Taiga Berries", description: "Gather berries from forest edge" },
      { code: "G-039", name: "Gather Firewood", description: "Collect wood for essential heating" },
      { code: "H-025", name: "Hunt Taiga Animals", description: "Hunt creatures from the boreal forest" },
      { code: "C-031", name: "Build Log Structures", description: "Construct homes from available timber" },
      { code: "T-021", name: "Make Winter Tools", description: "Craft implements for cold conditions" },
      { code: "X-020", name: "Find Winter Shelter", description: "Locate protected areas for harsh weather" }
    ]
  },
  rocky: {
    "R-BLD": [
      { code: "G-040", name: "Gather Rock Plants", description: "Collect plants growing among boulders" },
      { code: "H-026", name: "Hunt Rock-Dwelling Prey", description: "Hunt animals that live among rocks" },
      { code: "C-032", name: "Build Against Boulders", description: "Construct shelters using large rocks as walls" },
      { code: "C-033", name: "Create Stone Structures", description: "Build using abundant stone materials" },
      { code: "M-007", name: "Find Special Stones", description: "Search for unusual or useful rocks" },
      { code: "T-022", name: "Make Stone Tools", description: "Craft implements from available stone" },
      { code: "X-021", name: "Discover Hidden Passages", description: "Find paths through boulder fields" }
    ],
    "R-CAV": [
      { code: "C-034", name: "Prepare Cave Dwelling", description: "Make natural caves suitable for habitation" },
      { code: "C-035", name: "Secure Cave Entrance", description: "Create protective barriers at cave openings" },
      { code: "S-009", name: "Create Cave Paintings", description: "Make artistic or symbolic markings on walls" },
      { code: "S-010", name: "Establish Echo Chamber", description: "Find or create spaces with acoustic properties" },
      { code: "X-022", name: "Explore Cave System", description: "Venture deeper into connected caves" },
      { code: "X-023", name: "Map Underground Resources", description: "Document useful materials found in caves" }
    ],
    "R-KAR": [
      { code: "G-041", name: "Gather Karst Plants", description: "Collect specialized plants from limestone areas" },
      { code: "C-036", name: "Build Near Sinkholes", description: "Construct shelters near karst features" },
      { code: "W-011", name: "Find Underground Water", description: "Locate water flowing through karst systems" },
      { code: "X-024", name: "Explore Karst Features", description: "Investigate sinkholes and limestone formations" },
      { code: "X-025", name: "Map Water Channels", description: "Document underground water movement" }
    ]
  },
  special: {
    "S-CRY": [
      { code: "G-042", name: "Harvest Crystal Fragments", description: "Carefully collect pieces of crystal" },
      { code: "C-037", name: "Build Aligned Structures", description: "Construct buildings in harmony with crystal energies" },
      { code: "T-023", name: "Create Crystal Tools", description: "Craft implements using crystal properties" },
      { code: "S-011", name: "Establish Crystal Rituals", description: "Develop ceremonies focused on crystal energy" },
      { code: "S-012", name: "Observe Light Patterns", description: "Study how light interacts with crystals" },
      { code: "X-026", name: "Study Crystal Properties", description: "Research the unique aspects of different crystals" }
    ],
    "S-ANC": [
      { code: "C-038", name: "Build Ritual Structures", description: "Construct buildings for ceremonial purposes" },
      { code: "S-013", name: "Perform Power Rituals", description: "Conduct ceremonies to connect with ancient energies" },
      { code: "S-014", name: "Create Power Markers", description: "Make symbols to indicate energy patterns" },
      { code: "X-027", name: "Study Ancient Remains", description: "Examine artifacts from previous civilizations" },
      { code: "X-028", name: "Map Energy Patterns", description: "Document the flow of power in the area" }
    ]
  },
  wasteland: {
    "L-ASH": [
      { code: "G-043", name: "Gather Ash", description: "Collect ash for various uses" },
      { code: "C-039", name: "Build Ash-Resistant Shelter", description: "Create dwellings that withstand ash conditions" },
      { code: "A-008", name: "Test Ash Fertility", description: "Experiment with growing plants in ash-rich soil" },
      { code: "X-029", name: "Find Safe Passages", description: "Discover routes with minimal ash hazards" },
      { code: "X-030", name: "Locate Surviving Plants", description: "Find vegetation that survived the ash fall" }
    ],
    "L-BRN": [
      { code: "G-044", name: "Collect Charcoal", description: "Gather burned wood remains" },
      { code: "G-045", name: "Find First Regrowth", description: "Locate new plants emerging after fire" },
      { code: "C-040", name: "Build Temporary Camp", description: "Create basic shelter in recovering land" },
      { code: "A-009", name: "Test Soil Recovery", description: "Assess soil condition after burning" },
      { code: "X-031", name: "Study Burn Patterns", description: "Analyze how fire moved through the area" }
    ]
  }
};

const culture = {
  language: [
    // Basic Communication
    { code: "C-LNG-001", name: "Gesture System", category: "Basic Communication", description: "Simple hand signals for basic concepts" },
    { code: "C-LNG-002", name: "Warning Calls", category: "Basic Communication", description: "Vocal signals to alert of danger" },
    { code: "C-LNG-003", name: "Basic Sound Signals", category: "Basic Communication", description: "Simple sounds with specific meanings" },
    { code: "C-LNG-004", name: "Food Identification Sounds", category: "Basic Communication", description: "Specific sounds to identify food types" },
    { code: "C-LNG-005", name: "Direction Indicators", category: "Basic Communication", description: "Ways to communicate spatial information" },
    { code: "C-LNG-006", name: "Hunting Coordination", category: "Basic Communication", description: "Signals used during group hunting" },
    { code: "C-LNG-007", name: "Danger Differentiation", category: "Basic Communication", description: "Different signals for various threats" },
    { code: "C-LNG-008", name: "Water Source Marking", category: "Basic Communication", description: "Ways to indicate water locations" },
    
    // Early Verbal Language
    { code: "C-LNG-020", name: "Named Objects", category: "Early Verbal Language", description: "Consistent words for physical items" },
    { code: "C-LNG-021", name: "Action Words", category: "Early Verbal Language", description: "Words describing activities" },
    { code: "C-LNG-022", name: "Personal Identifiers", category: "Early Verbal Language", description: "Names or terms for individuals" },
    { code: "C-LNG-023", name: "Quantity Indicators", category: "Early Verbal Language", description: "Ways to express amounts" },
    { code: "C-LNG-024", name: "Time Markers", category: "Early Verbal Language", description: "Words for expressing when events occur" },
    { code: "C-LNG-025", name: "Weather Descriptions", category: "Early Verbal Language", description: "Terms for different weather conditions" },
    { code: "C-LNG-026", name: "Location Terminology", category: "Early Verbal Language", description: "Words for describing places" },
    { code: "C-LNG-027", name: "Kinship Terms", category: "Early Verbal Language", description: "Words for family relationships" },
    { code: "C-LNG-028", name: "Emotional Expressions", category: "Early Verbal Language", description: "Ways to communicate feelings" },
    { code: "C-LNG-029", name: "Request Formations", category: "Early Verbal Language", description: "Ways to ask for things or actions" }
  ],
  beliefs: [
    // Natural World Beliefs
    { code: "C-BLF-001", name: "Weather Phenomena Interpretation", category: "Natural World Beliefs", description: "Understanding weather as meaningful signs" },
    { code: "C-BLF-002", name: "Animal Spirit Recognition", category: "Natural World Beliefs", description: "Belief in animal spiritual significance" },
    { code: "C-BLF-003", name: "Natural Feature Reverence", category: "Natural World Beliefs", description: "Respect for significant landscape features" },
    { code: "C-BLF-004", name: "Celestial Body Observation", category: "Natural World Beliefs", description: "Watching and interpreting sky objects" },
    { code: "C-BLF-005", name: "Plant Spirit Concepts", category: "Natural World Beliefs", description: "Belief in spiritual essence of plants" },
    { code: "C-BLF-006", name: "Seasonal Cycle Recognition", category: "Natural World Beliefs", description: "Understanding patterns of seasons" },
    { code: "C-BLF-007", name: "Water Source Beliefs", category: "Natural World Beliefs", description: "Special significance of water locations" },
    { code: "C-BLF-008", name: "Stone/Mineral Power Concepts", category: "Natural World Beliefs", description: "Beliefs about power in stones" },
    { code: "C-BLF-009", name: "Fire Origin Stories", category: "Natural World Beliefs", description: "Myths explaining the origin of fire" },
    
    // Supernatural Beliefs
    { code: "C-BLF-020", name: "Spirit World Concept", category: "Supernatural Beliefs", description: "Belief in realm of spirits" },
    { code: "C-BLF-021", name: "Dream Interpretation", category: "Supernatural Beliefs", description: "Finding meaning in dreams" },
    { code: "C-BLF-022", name: "Afterlife Beliefs", category: "Supernatural Beliefs", description: "Concepts of existence after death" },
    { code: "C-BLF-023", name: "Supernatural Beings", category: "Supernatural Beliefs", description: "Belief in non-human entities" },
    { code: "C-BLF-024", name: "Luck and Fortune Concepts", category: "Supernatural Beliefs", description: "Ideas about fate and chance" },
    { code: "C-BLF-025", name: "Protection Rituals", category: "Supernatural Beliefs", description: "Practices to ward off harm" },
    { code: "C-BLF-026", name: "Healing Energies", category: "Supernatural Beliefs", description: "Belief in spiritual healing forces" },
    { code: "C-BLF-027", name: "Creation Myths", category: "Supernatural Beliefs", description: "Stories explaining world origins" },
    { code: "C-BLF-028", name: "Taboo Development", category: "Supernatural Beliefs", description: "Forbidden actions or objects" },
    { code: "C-BLF-029", name: "Omens and Signs", category: "Supernatural Beliefs", description: "Interpreting events as predictions" }
  ],
  social: [
    // Basic Social Structure
    { code: "C-SOC-001", name: "Family Units", category: "Basic Social Structure", description: "Organization of immediate relatives" },
    { code: "C-SOC-002", name: "Age-Based Roles", category: "Basic Social Structure", description: "Different responsibilities by age" },
    { code: "C-SOC-003", name: "Gender Divisions", category: "Basic Social Structure", description: "Different roles based on gender" },
    { code: "C-SOC-004", name: "Skill-Based Recognition", category: "Basic Social Structure", description: "Status based on abilities" },
    { code: "C-SOC-005", name: "Resource Sharing System", category: "Basic Social Structure", description: "Methods for distributing goods" },
    { code: "C-SOC-006", name: "Group Decision Process", category: "Basic Social Structure", description: "How collective choices are made" },
    { code: "C-SOC-007", name: "Child Rearing Practices", category: "Basic Social Structure", description: "Methods for raising children" },
    { code: "C-SOC-008", name: "Elder Respect Customs", category: "Basic Social Structure", description: "Ways of honoring older members" },
    { code: "C-SOC-009", name: "Group Territory Concept", category: "Basic Social Structure", description: "Understanding of owned space" }
  ]
};

module.exports = {
  terrainTypes,
  resources,
  actions,
  culture
};
