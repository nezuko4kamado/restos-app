// Automatic category detection for products based on their names
// Supports Italian, English, and Spanish keywords

export interface CategoryDefinition {
  name: string;
  icon: string;
  color: string;
  keywords: string[];
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    name: 'Bevande',
    icon: '🥤',
    color: 'from-blue-500 to-cyan-500',
    keywords: [
      // Italian
      'acqua', 'vino', 'birra', 'succo', 'caffè', 'tè', 'the', 'cola', 'aranciata',
      'limonata', 'spremuta', 'latte', 'bevanda', 'drink', 'cocktail', 'aperitivo',
      'liquore', 'amaro', 'grappa', 'whisky', 'vodka', 'gin', 'rum', 'champagne',
      'prosecco', 'spumante', 'bibita', 'energy', 'isotonica', 'acqua minerale',
      // English
      'water', 'wine', 'beer', 'juice', 'coffee', 'tea', 'soda', 'milk', 'drink',
      'beverage', 'cocktail', 'liquor', 'whiskey', 'champagne', 'sparkling',
      // Spanish
      'agua', 'vino', 'cerveza', 'zumo', 'jugo', 'café', 'té', 'leche', 'bebida',
      'refresco', 'gaseosa', 'licor', 'champán', 'cava', 'tinto', 'blanco', 'rosado',
      'agua mineral', 'agua con gas', 'agua sin gas', 'batido', 'smoothie'
    ]
  },
  {
    name: 'Carne',
    icon: '🥩',
    color: 'from-red-500 to-pink-500',
    keywords: [
      // Italian
      'manzo', 'vitello', 'pollo', 'tacchino', 'maiale', 'suino', 'agnello',
      'coniglio', 'anatra', 'oca', 'carne', 'bistecca', 'costata', 'filetto',
      'fesa', 'petto', 'cosce', 'salsiccia', 'salame', 'prosciutto', 'speck',
      'bresaola', 'mortadella', 'coppa', 'pancetta', 'guanciale', 'lardo',
      // English
      'beef', 'chicken', 'pork', 'turkey', 'lamb', 'meat', 'steak', 'ham',
      'bacon', 'sausage', 'salami', 'veal', 'duck', 'rabbit',
      // Spanish
      'carne', 'ternera', 'vaca', 'res', 'pollo', 'pavo', 'cerdo', 'cordero',
      'conejo', 'pato', 'bistec', 'filete', 'chuleta', 'costilla', 'pechuga',
      'muslo', 'jamón', 'chorizo', 'salchichón', 'salchicha', 'tocino', 'panceta',
      'lomo', 'solomillo', 'entrecot', 'chuletón'
    ]
  },
  {
    name: 'Pesce',
    icon: '🐟',
    color: 'from-cyan-500 to-blue-600',
    keywords: [
      // Italian
      'pesce', 'salmone', 'tonno', 'branzino', 'orata', 'sogliola', 'merluzzo',
      'baccalà', 'trota', 'spigola', 'gamberi', 'gamberetti', 'scampi', 'aragosta',
      'granchio', 'calamari', 'totani', 'seppie', 'polpo', 'cozze', 'vongole',
      'ostriche', 'capesante', 'frutti di mare', 'pesce spada', 'sardine',
      'acciughe', 'alici', 'sgombro',
      // English
      'fish', 'salmon', 'tuna', 'cod', 'shrimp', 'lobster', 'crab', 'squid',
      'octopus', 'mussels', 'clams', 'seafood', 'trout', 'bass', 'sole',
      'haddock', 'mackerel', 'anchovy', 'sardine', 'oyster', 'scallop',
      // Spanish
      'pescado', 'salmón', 'atún', 'bacalao', 'merluza', 'lubina', 'dorada',
      'trucha', 'lenguado', 'gambas', 'camarones', 'langosta', 'cangrejo',
      'calamares', 'pulpo', 'sepia', 'mejillones', 'almejas', 'ostras',
      'vieiras', 'mariscos', 'pez espada', 'sardinas', 'anchoas', 'boquerones'
    ]
  },
  {
    name: 'Verdure',
    icon: '🥬',
    color: 'from-green-500 to-emerald-500',
    keywords: [
      // Italian
      'verdura', 'pomodoro', 'pomodori', 'insalata', 'lattuga', 'rucola', 'spinaci',
      'carote', 'patate', 'cipolle', 'aglio', 'peperoni', 'melanzane', 'zucchine',
      'cetrioli', 'sedano', 'finocchio', 'cavolo', 'cavolfiore', 'broccoli',
      'asparagi', 'carciofi', 'fagiolini', 'piselli', 'fave', 'lenticchie',
      'ceci', 'fagioli', 'ravanelli', 'rape', 'barbabietole', 'porri', 'zucca',
      // English
      'vegetables', 'tomato', 'lettuce', 'carrot', 'potato', 'onion', 'garlic',
      'pepper', 'eggplant', 'zucchini', 'cucumber', 'celery', 'cabbage', 'broccoli',
      'asparagus', 'artichoke', 'beans', 'peas', 'lentils', 'chickpeas', 'radish',
      // Spanish
      'verdura', 'verduras', 'tomate', 'tomates', 'lechuga', 'zanahoria', 'patata',
      'papa', 'cebolla', 'ajo', 'pimiento', 'pimientos', 'berenjena', 'calabacín',
      'pepino', 'apio', 'col', 'repollo', 'coliflor', 'brócoli', 'brécol',
      'espárragos', 'alcachofa', 'judías', 'guisantes', 'lentejas', 'garbanzos',
      'rábano', 'remolacha', 'puerro', 'calabaza', 'espinacas', 'acelgas'
    ]
  },
  {
    name: 'Frutta',
    icon: '🍎',
    color: 'from-orange-500 to-red-500',
    keywords: [
      // Italian
      'frutta', 'mela', 'mele', 'pera', 'pere', 'banana', 'banane', 'arancia',
      'arance', 'mandarino', 'mandarini', 'limone', 'limoni', 'pompelmo', 'fragola',
      'fragole', 'ciliegia', 'ciliegie', 'pesca', 'pesche', 'albicocca', 'albicocche',
      'prugna', 'prugne', 'susina', 'susine', 'uva', 'melone', 'anguria', 'cocomero',
      'kiwi', 'ananas', 'mango', 'papaya', 'avocado', 'cocco', 'dattero', 'fico',
      'melograno',
      // English
      'fruit', 'apple', 'pear', 'banana', 'orange', 'lemon', 'strawberry',
      'cherry', 'peach', 'plum', 'grape', 'melon', 'watermelon', 'kiwi', 'pineapple',
      'mango', 'papaya', 'avocado', 'coconut', 'date', 'fig', 'pomegranate',
      // Spanish
      'fruta', 'frutas', 'manzana', 'pera', 'plátano', 'banana', 'naranja',
      'mandarina', 'limón', 'pomelo', 'fresa', 'cereza', 'melocotón', 'durazno',
      'albaricoque', 'damasco', 'ciruela', 'uva', 'melón', 'sandía', 'kiwi',
      'piña', 'ananá', 'mango', 'papaya', 'aguacate', 'palta', 'coco', 'dátil',
      'higo', 'granada'
    ]
  },
  {
    name: 'Pane e Cereali',
    icon: '🥖',
    color: 'from-amber-500 to-yellow-600',
    keywords: [
      // Italian
      'pane', 'pasta', 'riso', 'farina', 'cereali', 'baguette', 'focaccia',
      'grissini', 'crackers', 'fette biscottate', 'piadina', 'pizza', 'spaghetti',
      'penne', 'fusilli', 'rigatoni', 'tagliatelle', 'lasagne', 'gnocchi',
      'risotto', 'orzo', 'farro', 'quinoa', 'couscous', 'polenta', 'semola',
      // English
      'bread', 'pasta', 'rice', 'flour', 'cereal', 'noodles', 'spaghetti',
      'macaroni', 'wheat', 'grain', 'oats', 'barley', 'quinoa', 'couscous',
      // Spanish
      'pan', 'pasta', 'arroz', 'harina', 'cereales', 'baguette', 'barra',
      'galletas', 'tostadas', 'pizza', 'espaguetis', 'macarrones', 'fideos',
      'tallarines', 'lasaña', 'ñoquis', 'risotto', 'cebada', 'trigo', 'avena',
      'quinoa', 'cuscús', 'polenta', 'sémola', 'integral', 'centeno'
    ]
  },
  {
    name: 'Latticini',
    icon: '🧀',
    color: 'from-yellow-400 to-amber-500',
    keywords: [
      // Italian
      'latte', 'formaggio', 'formaggi', 'yogurt', 'burro', 'panna', 'ricotta',
      'mozzarella', 'parmigiano', 'grana', 'pecorino', 'gorgonzola', 'mascarpone',
      'stracchino', 'robiola', 'taleggio', 'fontina', 'provolone', 'scamorza',
      'caciotta', 'emmental', 'brie', 'camembert', 'feta', 'philadelphia',
      // English
      'milk', 'cheese', 'yogurt', 'butter', 'cream', 'mozzarella', 'parmesan',
      'dairy', 'cheddar', 'gouda', 'ricotta', 'mascarpone', 'brie', 'feta',
      // Spanish
      'leche', 'queso', 'yogur', 'mantequilla', 'nata', 'crema', 'requesón',
      'mozzarella', 'parmesano', 'manchego', 'cabrales', 'burgos', 'tetilla',
      'mahón', 'idiazábal', 'roncal', 'queso fresco', 'queso curado', 'lácteos',
      'productos lácteos'
    ]
  },
  {
    name: 'Dolci',
    icon: '🍰',
    color: 'from-pink-500 to-rose-500',
    keywords: [
      // Italian
      'dolce', 'dolci', 'torta', 'torte', 'gelato', 'biscotti', 'biscotto',
      'cioccolato', 'cioccolata', 'caramelle', 'cioccolatini', 'nutella',
      'marmellata', 'miele', 'zucchero', 'crostata', 'tiramisù', 'panna cotta',
      'budino', 'mousse', 'meringhe', 'amaretti', 'cannoli', 'sfogliatelle',
      'cornetto', 'brioche', 'croissant', 'muffin', 'cupcake', 'brownie',
      // English
      'dessert', 'cake', 'ice cream', 'cookies', 'chocolate', 'candy', 'sweets',
      'jam', 'honey', 'sugar', 'pie', 'pudding', 'mousse', 'meringue', 'muffin',
      'cupcake', 'brownie', 'croissant', 'donut', 'doughnut',
      // Spanish
      'dulce', 'dulces', 'postre', 'tarta', 'pastel', 'helado', 'galletas',
      'chocolate', 'bombones', 'caramelos', 'mermelada', 'miel', 'azúcar',
      'flan', 'natillas', 'mousse', 'merengue', 'magdalena', 'cruasán',
      'croissant', 'donut', 'rosquilla', 'churros', 'turrón', 'mazapán',
      'polvorón', 'mantecado'
    ]
  },
  {
    name: 'Condimenti',
    icon: '🌶️',
    color: 'from-red-600 to-orange-600',
    keywords: [
      // Italian
      'olio', 'aceto', 'sale', 'pepe', 'spezie', 'basilico', 'prezzemolo',
      'rosmarino', 'salvia', 'origano', 'timo', 'alloro', 'menta', 'maggiorana',
      'curry', 'paprika', 'peperoncino', 'zafferano', 'cannella', 'noce moscata',
      'chiodi di garofano', 'zenzero', 'curcuma', 'senape', 'ketchup', 'maionese',
      'salsa', 'pesto', 'sugo', 'ragù', 'dado', 'brodo', 'condimento',
      // English
      'oil', 'vinegar', 'salt', 'pepper', 'spices', 'herbs', 'basil', 'parsley',
      'oregano', 'thyme', 'curry', 'chili', 'ginger', 'cinnamon', 'sauce',
      'ketchup', 'mayonnaise', 'mustard', 'saffron', 'nutmeg', 'clove',
      // Spanish
      'aceite', 'vinagre', 'sal', 'pimienta', 'especias', 'hierbas', 'albahaca',
      'perejil', 'romero', 'salvia', 'orégano', 'tomillo', 'laurel', 'menta',
      'curry', 'pimentón', 'paprika', 'guindilla', 'chile', 'azafrán', 'canela',
      'nuez moscada', 'clavo', 'jengibre', 'cúrcuma', 'mostaza', 'ketchup',
      'mayonesa', 'salsa', 'aliño', 'aderezo', 'caldo', 'cubito'
    ]
  },
  {
    name: 'Altro',
    icon: '📦',
    color: 'from-slate-500 to-gray-600',
    keywords: []
  }
];

/**
 * Automatically detects the category of a product based on its name
 * Supports Italian, English, and Spanish keywords
 * @param productName - The name of the product
 * @returns The detected category name
 */
export function detectCategory(productName: string): string {
  if (!productName) return 'Altro';

  const normalizedName = productName.toLowerCase().trim();

  // Check each category's keywords
  for (const category of CATEGORIES) {
    if (category.name === 'Altro') continue; // Skip "Altro" category

    for (const keyword of category.keywords) {
      if (normalizedName.includes(keyword.toLowerCase())) {
        return category.name;
      }
    }
  }

  // If no match found, return "Altro"
  return 'Altro';
}

/**
 * Gets the category definition by name
 * @param categoryName - The name of the category
 * @returns The category definition or undefined
 */
export function getCategoryDefinition(categoryName: string): CategoryDefinition | undefined {
  return CATEGORIES.find(cat => cat.name === categoryName);
}

/**
 * Gets all available categories
 * @returns Array of all category definitions
 */
export function getAllCategories(): CategoryDefinition[] {
  return CATEGORIES;
}