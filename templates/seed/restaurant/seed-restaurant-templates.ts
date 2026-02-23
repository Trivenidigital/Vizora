/**
 * Database seed script for restaurant templates
 *
 * Seeds 12 restaurant templates from the HTML files in this directory
 * into the Vizora database using the Content model (type='template', isGlobal=true).
 *
 * These templates use data-field attributes for inline editing (WYSIWYG),
 * not Handlebars variables. The sampleData JSON captures the default
 * field values embedded in each HTML file.
 *
 * Usage:
 *   npx ts-node templates/seed/restaurant/seed-restaurant-templates.ts
 *
 * Options:
 *   --clear   Remove all existing restaurant library templates before seeding
 */

import { PrismaClient } from '@vizora/database';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

interface RestaurantTemplateSeed {
  /** File name in this directory */
  file: string;
  /** Thumbnail PNG file name in thumbnails/ subdirectory */
  thumbnailFile: string;
  /** Display name in the template library */
  name: string;
  /** Description shown in the library card */
  description: string;
  /** Tags for filtering/search */
  libraryTags: string[];
  /** beginner | intermediate */
  difficulty: 'beginner' | 'intermediate';
  /** landscape or portrait */
  templateOrientation: 'landscape' | 'portrait';
  /** Default display duration in seconds */
  duration: number;
  /** Whether to feature on the library homepage */
  isFeatured: boolean;
  /** Default field values embedded in the HTML */
  sampleData: Record<string, string>;
}

const restaurantTemplateSeeds: RestaurantTemplateSeed[] = [
  // ── 01 Daily Specials ──────────────────────────────────────────────────
  {
    file: '01-daily-specials.html',
    thumbnailFile: '01-daily-specials.png',
    name: 'Daily Specials Board',
    description:
      'Elegant daily specials menu with rustic wood-grain background. Shows up to 5 dishes with descriptions and prices, plus restaurant name and date.',
    libraryTags: ['restaurant', 'menu', 'daily-specials', 'fine-dining'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 30,
    isFeatured: true,
    sampleData: {
      title: "Today\u2019s Specials",
      subtitle: 'Crafted with care by our chef',
      restaurant_name: 'The Rustic Table',
      date: 'Sunday, February 23',
      item1_name: 'Pan-Seared Salmon',
      item1_price: '$24.95',
      item1_desc: 'Fresh Atlantic salmon with lemon dill butter sauce, roasted asparagus',
      item2_name: 'Braised Short Ribs',
      item2_price: '$28.50',
      item2_desc: 'Slow-cooked beef short ribs, red wine reduction, creamy polenta',
      item3_name: 'Wild Mushroom Risotto',
      item3_price: '$19.75',
      item3_desc: 'Arborio rice with porcini, shiitake, and truffle oil',
      item4_name: 'Grilled Lamb Chops',
      item4_price: '$32.00',
      item4_desc: 'Herb-crusted New Zealand lamb, mint chimichurri, fingerling potatoes',
      item5_name: 'Citrus Panna Cotta',
      item5_price: '$11.50',
      item5_desc: 'Vanilla bean panna cotta with blood orange compote',
    },
  },

  // ── 02 Full Menu ───────────────────────────────────────────────────────
  {
    file: '02-full-menu.html',
    thumbnailFile: '02-full-menu.png',
    name: 'Full Restaurant Menu',
    description:
      'Three-section fine dining menu (appetizers, mains, desserts) with a dark noir theme. Supports up to 13 items across three columns.',
    libraryTags: ['restaurant', 'menu', 'full-menu', 'fine-dining', 'noir'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 45,
    isFeatured: true,
    sampleData: {
      restaurant_name: 'NOIR',
      tagline: 'Fine Dining & Cocktails',
      section1_title: 'Appetizers',
      app1_name: 'Burrata & Heirloom Tomato',
      app1_price: '$16',
      app1_desc: 'San Marzano, aged balsamic, basil oil',
      app2_name: 'Tuna Tartare',
      app2_price: '$18',
      app2_desc: 'Yellowfin, avocado mousse, sesame crisp',
      app3_name: 'French Onion Soup',
      app3_price: '$14',
      app3_desc: 'Caramelized onion, Gruy\u00e8re, sourdough crouton',
      app4_name: 'Crispy Calamari',
      app4_price: '$15',
      app4_desc: 'Lightly battered, saffron aioli, charred lemon',
      section2_title: 'Mains',
      main1_name: 'Filet Mignon 8oz',
      main1_price: '$48',
      main1_desc: 'USDA Prime, bone marrow butter, truffle jus',
      main2_name: 'Lobster Tail',
      main2_price: '$52',
      main2_desc: 'Cold-water, drawn butter, grilled asparagus',
      main3_name: 'Duck Confit',
      main3_price: '$38',
      main3_desc: 'Crispy leg, cherry gastrique, parsnip pur\u00e9e',
      main4_name: 'Grilled Sea Bass',
      main4_price: '$42',
      main4_desc: 'Mediterranean, olive tapenade, fennel salad',
      main5_name: 'Truffle Pasta',
      main5_price: '$34',
      main5_desc: 'Handmade tagliatelle, black truffle, Parmigiano',
      section3_title: 'Desserts',
      dessert1_name: 'Cr\u00e8me Br\u00fbl\u00e9e',
      dessert1_price: '$14',
      dessert1_desc: 'Tahitian vanilla, caramelized sugar, fresh berries',
      dessert2_name: 'Chocolate Fondant',
      dessert2_price: '$16',
      dessert2_desc: 'Valrhona 70%, molten center, vanilla gelato',
      dessert3_name: 'Tiramisu',
      dessert3_price: '$13',
      dessert3_desc: 'Espresso-soaked ladyfingers, mascarpone, cocoa',
      dessert4_name: 'Cheese Board',
      dessert4_price: '$22',
      dessert4_desc: 'Artisan selection, honeycomb, fig compote, walnut bread',
      footer_text: 'Please inform your server of any dietary requirements or allergies',
    },
  },

  // ── 03 Coffee Shop ────────────────────────────────────────────────────
  {
    file: '03-coffee-shop.html',
    thumbnailFile: '03-coffee-shop.png',
    name: 'Coffee Shop Menu',
    description:
      'Warm, inviting coffee shop menu with hot drinks, cold drinks, and pastry sections. Earthy tones with a cozy aesthetic.',
    libraryTags: ['restaurant', 'coffee', 'cafe', 'menu', 'beverages', 'pastries'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 30,
    isFeatured: false,
    sampleData: {
      shop_name: 'Ember',
      tagline: 'Freshly Roasted Daily',
      section1_title: 'Hot Drinks',
      hot1_name: 'Espresso',
      hot1_price: '$3.50',
      hot2_name: 'Americano',
      hot2_price: '$4.00',
      hot3_name: 'Cappuccino',
      hot3_price: '$5.00',
      hot4_name: 'Caf\u00e9 Latte',
      hot4_price: '$5.50',
      hot5_name: 'Mocha',
      hot5_price: '$5.75',
      hot6_name: 'Hot Chocolate',
      hot6_price: '$4.50',
      section2_title: 'Cold Drinks',
      cold1_name: 'Iced Latte',
      cold1_price: '$5.50',
      cold2_name: 'Cold Brew',
      cold2_price: '$5.00',
      cold3_name: 'Frapp\u00e9',
      cold3_price: '$6.00',
      cold4_name: 'Iced Matcha',
      cold4_price: '$5.75',
      cold5_name: 'Fresh Lemonade',
      cold5_price: '$4.00',
      section3_title: 'Pastries',
      pastry1_name: 'Butter Croissant',
      pastry1_price: '$3.75',
      pastry2_name: 'Blueberry Muffin',
      pastry2_price: '$4.25',
      pastry3_name: 'Cinnamon Roll',
      pastry3_price: '$4.50',
      pastry4_name: 'Banana Bread',
      pastry4_price: '$3.50',
      pastry5_name: 'Chocolate Chip Cookie',
      pastry5_price: '$2.75',
      footer_hours: 'Open Daily 6:30 AM \u2013 8:00 PM',
      footer_wifi: 'Free Wi-Fi Available',
      footer_extra: 'Ask About Our Loyalty Card',
    },
  },

  // ── 04 Pizza Menu ─────────────────────────────────────────────────────
  {
    file: '04-pizza-menu.html',
    thumbnailFile: '04-pizza-menu.png',
    name: 'Pizza Menu Board',
    description:
      'Wood-fired pizza menu with three size columns (S/M/L). Fits 7 pizza varieties with descriptions and a footer for notes.',
    libraryTags: ['restaurant', 'pizza', 'menu', 'italian'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 30,
    isFeatured: false,
    sampleData: {
      restaurant_name: 'Napoli Fire',
      tagline: 'Wood-Fired Artisan Pizza',
      size_small: '10"',
      size_medium: '14"',
      size_large: '18"',
      pizza1_name: 'Margherita',
      pizza1_desc: 'Fresh mozzarella, San Marzano tomatoes, basil',
      pizza1_s: '$12',
      pizza1_m: '$16',
      pizza1_l: '$20',
      pizza2_name: 'Pepperoni',
      pizza2_desc: 'Classic pepperoni, mozzarella, marinara',
      pizza2_s: '$13',
      pizza2_m: '$17',
      pizza2_l: '$21',
      pizza3_name: 'Quattro Formaggi',
      pizza3_desc: 'Mozzarella, gorgonzola, parmesan, fontina',
      pizza3_s: '$14',
      pizza3_m: '$18',
      pizza3_l: '$22',
      pizza4_name: 'Prosciutto e Rucola',
      pizza4_desc: 'Prosciutto di Parma, arugula, shaved parmesan',
      pizza4_s: '$15',
      pizza4_m: '$19',
      pizza4_l: '$23',
      pizza5_name: 'Diavola',
      pizza5_desc: 'Spicy salami, nduja, chili flakes, honey drizzle',
      pizza5_s: '$14',
      pizza5_m: '$18',
      pizza5_l: '$22',
      pizza6_name: 'Supreme',
      pizza6_desc: 'Pepperoni, sausage, peppers, onions, mushrooms, olives',
      pizza6_s: '$15',
      pizza6_m: '$19',
      pizza6_l: '$24',
      pizza7_name: 'Truffle Mushroom',
      pizza7_desc: 'Wild mushrooms, truffle cream, fontina, thyme',
      pizza7_s: '$16',
      pizza7_m: '$20',
      pizza7_l: '$25',
      footer_note: 'Ask about our gluten-free cauliflower crust',
      footer_note2: 'Extra toppings $2 each',
    },
  },

  // ── 05 Happy Hour ─────────────────────────────────────────────────────
  {
    file: '05-happy-hour.html',
    thumbnailFile: '05-happy-hour.png',
    name: 'Happy Hour Specials',
    description:
      'Vibrant happy hour board showing cocktails, beer/wine, and bar bites with original and discounted prices side-by-side.',
    libraryTags: ['restaurant', 'bar', 'happy-hour', 'drinks', 'specials'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 30,
    isFeatured: true,
    sampleData: {
      heading: 'Happy Hour',
      time_range: '4 PM \u2013 7 PM',
      frequency: 'Every Weekday',
      bar_name: 'Pulse Lounge',
      col1_title: 'Cocktails',
      cocktail1_name: 'Margarita',
      cocktail1_old: '$14',
      cocktail1_new: '$8',
      cocktail2_name: 'Mojito',
      cocktail2_old: '$13',
      cocktail2_new: '$7',
      cocktail3_name: 'Old Fashioned',
      cocktail3_old: '$15',
      cocktail3_new: '$9',
      cocktail4_name: 'Espresso Martini',
      cocktail4_old: '$16',
      cocktail4_new: '$9',
      col2_title: 'Beer & Wine',
      beer1_name: 'Draft Beer',
      beer1_old: '$8',
      beer1_new: '$4',
      beer2_name: 'House Wine',
      beer2_old: '$12',
      beer2_new: '$6',
      beer3_name: 'Craft IPA',
      beer3_old: '$9',
      beer3_new: '$5',
      col3_title: 'Bites',
      bite1_name: 'Wings (10pc)',
      bite1_old: '$16',
      bite1_new: '$10',
      bite2_name: 'Nachos',
      bite2_old: '$14',
      bite2_new: '$8',
      bite3_name: 'Sliders (3)',
      bite3_old: '$15',
      bite3_new: '$9',
    },
  },

  // ── 06 Breakfast Menu ─────────────────────────────────────────────────
  {
    file: '06-breakfast-menu.html',
    thumbnailFile: '06-breakfast-menu.png',
    name: 'Breakfast Menu',
    description:
      'Bright morning-themed breakfast menu with eggs/omelettes, pancakes/waffles, and beverages sections. Includes weekend brunch promo banner.',
    libraryTags: ['restaurant', 'breakfast', 'brunch', 'menu', 'morning'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 30,
    isFeatured: false,
    sampleData: {
      restaurant_name: 'Morning Glory Kitchen',
      serving_time: 'Served 7 AM \u2013 11 AM',
      section1_title: 'Eggs & Omelettes',
      egg1_name: 'Classic Eggs Benedict',
      egg1_price: '$14.95',
      egg1_desc: 'Poached eggs, Canadian bacon, hollandaise, English muffin',
      egg2_name: 'Western Omelette',
      egg2_price: '$12.95',
      egg2_desc: 'Ham, peppers, onions, cheddar cheese',
      egg3_name: 'Avocado Toast',
      egg3_price: '$13.50',
      egg3_desc: 'Sourdough, smashed avocado, poached eggs, everything seasoning',
      egg4_name: 'Huevos Rancheros',
      egg4_price: '$13.95',
      egg4_desc: 'Fried eggs, black beans, salsa verde, tortilla, cotija',
      section2_title: 'Pancakes & Waffles',
      pan1_name: 'Buttermilk Stack (3)',
      pan1_price: '$11.95',
      pan1_desc: 'Classic buttermilk pancakes, maple syrup, whipped butter',
      pan2_name: 'Belgian Waffle',
      pan2_price: '$12.95',
      pan2_desc: 'Crispy waffle, fresh berries, whipped cream',
      pan3_name: 'Banana Foster French Toast',
      pan3_price: '$14.50',
      pan3_desc: 'Brioche, caramelized bananas, pecans, cinnamon',
      pan4_name: 'Lemon Ricotta Pancakes',
      pan4_price: '$13.50',
      pan4_desc: 'Light, fluffy, lemon zest, blueberry compote',
      section3_title: 'Beverages',
      bev1_name: 'Fresh Squeezed OJ',
      bev1_price: '$5.00',
      bev2_name: 'Coffee',
      bev2_price: '$3.50',
      bev2_note: 'Unlimited Refills',
      bev3_name: 'Mimosa',
      bev3_price: '$8.00',
      bev4_name: 'Smoothie of the Day',
      bev4_price: '$7.50',
      promo_line1: 'Weekend Brunch Special',
      promo_line2: 'Bottomless Mimosas $18',
    },
  },

  // ── 07 Food Truck (PORTRAIT) ──────────────────────────────────────────
  {
    file: '07-food-truck.html',
    thumbnailFile: '07-food-truck.png',
    name: 'Food Truck Menu',
    description:
      'Bold, high-contrast portrait-mode menu for food trucks. Lists main combos, sides, and drinks with an order CTA at the bottom.',
    libraryTags: ['restaurant', 'food-truck', 'menu', 'street-food', 'portrait'],
    difficulty: 'beginner',
    templateOrientation: 'portrait',
    duration: 30,
    isFeatured: false,
    sampleData: {
      truck_name: 'BLAZE BITES',
      tagline: 'STREET EATS',
      combo1_name: 'THE CLASSIC',
      combo1_price: '$9.50',
      combo1_desc: 'Double smash burger, American cheese, secret sauce, pickles',
      combo2_name: 'LOADED FRIES',
      combo2_price: '$7.00',
      combo2_desc: 'Cheese sauce, bacon bits, jalape\u00f1os, sour cream',
      combo3_name: 'CRISPY CHICKEN',
      combo3_price: '$10.50',
      combo3_desc: 'Fried chicken sandwich, slaw, spicy mayo, brioche bun',
      combo4_name: 'STREET TACOS (3)',
      combo4_price: '$11.00',
      combo4_desc: 'Carne asada, cilantro, onion, lime, corn tortillas',
      combo5_name: 'VEGGIE WRAP',
      combo5_price: '$8.50',
      combo5_desc: 'Grilled veggies, hummus, feta, spinach tortilla',
      sides_title: 'SIDES',
      side1_name: 'Regular Fries',
      side1_price: '$4.00',
      side2_name: 'Onion Rings',
      side2_price: '$5.00',
      side3_name: 'Mac & Cheese',
      side3_price: '$5.50',
      drinks_title: 'DRINKS',
      drink1_name: 'Fountain Soda',
      drink1_price: '$2.50',
      drink2_name: 'Fresh Lemonade',
      drink2_price: '$4.00',
      drink3_name: 'Bottled Water',
      drink3_price: '$2.00',
      cta_text: 'ORDER HERE \u2192',
      cta_subtext: 'CASH & CARD ACCEPTED',
    },
  },

  // ── 08 Dessert Menu ───────────────────────────────────────────────────
  {
    file: '08-dessert-menu.html',
    thumbnailFile: '08-dessert-menu.png',
    name: 'Dessert Menu',
    description:
      'Elegant pastel dessert menu showcasing 8 handcrafted desserts with descriptions and prices. Soft, romantic color palette.',
    libraryTags: ['restaurant', 'dessert', 'menu', 'sweets', 'fine-dining'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 30,
    isFeatured: false,
    sampleData: {
      restaurant_name: 'P\u00e9tale',
      subtitle: 'Handcrafted Desserts',
      dessert1_name: 'Vanilla Bean Cr\u00e8me Br\u00fbl\u00e9e',
      dessert1_price: '$12.00',
      dessert1_desc: 'Tahitian vanilla custard, caramelized sugar crust',
      dessert2_name: 'Dark Chocolate Torte',
      dessert2_price: '$14.00',
      dessert2_desc: 'Flourless chocolate cake, raspberry coulis, gold leaf',
      dessert3_name: 'Strawberry Shortcake',
      dessert3_price: '$11.00',
      dessert3_desc: 'Fresh strawberries, vanilla sponge, Chantilly cream',
      dessert4_name: 'Matcha Tiramisu',
      dessert4_price: '$13.00',
      dessert4_desc: 'Green tea mascarpone, ladyfingers, white chocolate dust',
      dessert5_name: 'Salted Caramel Cheesecake',
      dessert5_price: '$12.50',
      dessert5_desc: 'New York style, salted caramel drizzle, pecan crumble',
      dessert6_name: 'Mango Panna Cotta',
      dessert6_price: '$11.50',
      dessert6_desc: 'Coconut panna cotta, mango compote, passion fruit',
      dessert7_name: 'Pistachio Gelato Trio',
      dessert7_price: '$10.00',
      dessert7_desc: 'Three scoops: pistachio, dark chocolate, vanilla bean',
      dessert8_name: 'Lemon Tart',
      dessert8_price: '$11.00',
      dessert8_desc: 'Buttery shortcrust, lemon curd, torched meringue',
      footer_message: 'Please inform your server of any allergies or dietary requirements',
    },
  },

  // ── 09 Bar & Cocktail (intermediate) ──────────────────────────────────
  {
    file: '09-bar-cocktail.html',
    thumbnailFile: '09-bar-cocktail.png',
    name: 'Bar & Cocktail Menu',
    description:
      'Sophisticated dark-themed bar menu with four sections: signature cocktails (with descriptions), classics, wine, and craft beer. Art-deco inspired.',
    libraryTags: ['restaurant', 'bar', 'cocktail', 'drinks', 'lounge'],
    difficulty: 'intermediate',
    templateOrientation: 'landscape',
    duration: 45,
    isFeatured: true,
    sampleData: {
      bar_name: 'THE GILDED FOX',
      bar_subtitle: 'Cocktail Lounge & Bar',
      section1_title: 'SIGNATURE COCKTAILS',
      cocktail1_name: 'Midnight Gold',
      cocktail1_price: '$18',
      cocktail1_desc: 'Bourbon, honey, lemon, activated charcoal, gold flake',
      cocktail2_name: 'Velvet Rose',
      cocktail2_price: '$17',
      cocktail2_desc: 'Gin, rose water, elderflower, prosecco, dried rose',
      cocktail3_name: 'Tokyo Drift',
      cocktail3_price: '$19',
      cocktail3_desc: 'Japanese whisky, yuzu, shiso, ginger beer',
      cocktail4_name: 'Smoky Paloma',
      cocktail4_price: '$16',
      cocktail4_desc: 'Mezcal, grapefruit, lime, smoked salt rim',
      section2_title: 'CLASSICS',
      classic1_name: 'Manhattan',
      classic1_price: '$15',
      classic2_name: 'Negroni',
      classic2_price: '$14',
      classic3_name: 'Martini',
      classic3_price: '$15',
      classic4_name: 'Daiquiri',
      classic4_price: '$13',
      section3_title: 'WINE',
      wine1_name: 'House Red',
      wine1_price: '$12 / $48',
      wine2_name: 'House White',
      wine2_price: '$11 / $44',
      wine3_name: 'Ros\u00e9',
      wine3_price: '$13 / $52',
      section4_title: 'CRAFT BEER',
      beer1_name: 'Local IPA',
      beer1_price: '$9',
      beer2_name: 'Belgian Wheat',
      beer2_price: '$8',
      beer3_name: 'Stout',
      beer3_price: '$9',
      beer4_name: 'Pilsner',
      beer4_price: '$7',
      footer_message: 'Please enjoy responsibly \u00b7 Ask about our seasonal specials',
    },
  },

  // ── 10 Combo Deals ────────────────────────────────────────────────────
  {
    file: '10-combo-deals.html',
    thumbnailFile: '10-combo-deals.png',
    name: 'Combo Deals Board',
    description:
      'Three-tier combo deal display for fast-casual restaurants. Shows tiered pricing with included items and savings badges.',
    libraryTags: ['restaurant', 'combo', 'deals', 'fast-food', 'value'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 25,
    isFeatured: false,
    sampleData: {
      restaurant_name: 'STACK',
      subtitle: 'LIMITED TIME COMBOS',
      combo1_label: 'COMBO #1',
      combo1_name: 'THE STARTER',
      combo1_item1: 'Classic Burger',
      combo1_item2: 'Regular Fries',
      combo1_item3: 'Soft Drink',
      combo1_price: '$9.99',
      combo2_label: 'COMBO #2',
      combo2_name: 'THE FAN FAVORITE',
      combo2_item1: 'Double Cheeseburger',
      combo2_item2: 'Large Fries',
      combo2_item3: 'Soft Drink',
      combo2_item4: 'Cookie',
      combo2_price: '$13.99',
      combo2_savings: 'SAVE $3.50!',
      combo3_label: 'COMBO #3',
      combo3_name: 'THE FEAST',
      combo3_item1: 'Double Bacon Burger',
      combo3_item2: 'Large Fries',
      combo3_item3: 'Onion Rings',
      combo3_item4: 'Large Drink',
      combo3_item5: 'Milkshake',
      combo3_price: '$18.99',
      combo3_savings: 'SAVE $5.00!',
    },
  },

  // ── 11 Bakery Cafe ────────────────────────────────────────────────────
  {
    file: '11-bakery-cafe.html',
    thumbnailFile: '11-bakery-cafe.png',
    name: 'Bakery & Cafe Menu',
    description:
      'Warm bakery menu with four sections: morning pastries, artisan breads, sandwiches, and sweet treats. Flour-dusted aesthetic.',
    libraryTags: ['restaurant', 'bakery', 'cafe', 'menu', 'pastries', 'bread'],
    difficulty: 'beginner',
    templateOrientation: 'landscape',
    duration: 30,
    isFeatured: false,
    sampleData: {
      bakery_name: 'Flour & Fold',
      tagline: 'Freshly Baked Daily',
      section1_title: 'Morning Pastries',
      pastry1_name: 'Butter Croissant',
      pastry1_price: '$3.75',
      pastry2_name: 'Pain au Chocolat',
      pastry2_price: '$4.25',
      pastry3_name: 'Almond Croissant',
      pastry3_price: '$4.75',
      pastry4_name: 'Danish (Seasonal)',
      pastry4_price: '$4.50',
      pastry5_name: 'Scone (Blueberry or Cranberry)',
      pastry5_price: '$3.50',
      section2_title: 'Artisan Breads',
      bread1_name: 'Sourdough Boule',
      bread1_price: '$7.50',
      bread2_name: 'Multigrain Loaf',
      bread2_price: '$6.50',
      bread3_name: 'Olive Focaccia',
      bread3_price: '$8.00',
      bread4_name: 'Baguette',
      bread4_price: '$4.00',
      bread5_name: 'Ciabatta',
      bread5_price: '$5.00',
      section3_title: 'Sandwiches',
      sand1_name: 'Turkey & Brie',
      sand1_price: '$12.50',
      sand1_desc: 'Smoked turkey, brie, fig jam, arugula on ciabatta',
      sand2_name: 'Caprese',
      sand2_price: '$11.00',
      sand2_desc: 'Fresh mozzarella, tomato, basil, pesto on focaccia',
      sand3_name: 'Ham & Gruyere',
      sand3_price: '$11.50',
      sand3_desc: 'Black forest ham, gruyere, dijon on baguette',
      section4_title: 'Sweet Treats',
      sweet1_name: 'Macarons (3pc)',
      sweet1_price: '$6.00',
      sweet2_name: 'Chocolate Eclair',
      sweet2_price: '$5.50',
      sweet3_name: 'Fruit Tart',
      sweet3_price: '$6.50',
      sweet4_name: 'Carrot Cake Slice',
      sweet4_price: '$5.00',
    },
  },

  // ── 12 Order Status (intermediate) ────────────────────────────────────
  {
    file: '12-order-status.html',
    thumbnailFile: '12-order-status.png',
    name: 'Order Status Board',
    description:
      'Live order status display with three columns: Preparing, Ready for Pickup, and Picked Up. Shows order numbers, wait times, and average wait. Ideal for fast-casual and QSR.',
    libraryTags: ['restaurant', 'order-status', 'kitchen', 'queue', 'qsr'],
    difficulty: 'intermediate',
    templateOrientation: 'landscape',
    duration: 10,
    isFeatured: true,
    sampleData: {
      board_title: 'ORDER STATUS',
      current_time: '11:45 AM',
      avg_wait: 'Avg Wait: 6 min',
      col1_title: 'Preparing',
      col1_count: '4',
      prep_order1: '247',
      prep_time1: '2 min',
      prep_order2: '251',
      prep_time2: '4 min',
      prep_order3: '253',
      prep_time3: '5 min',
      prep_order4: '256',
      prep_time4: '7 min',
      col2_title: 'Ready for Pickup',
      col2_count: '4',
      ready_order1: '244',
      ready_time1: 'Ready',
      ready_order2: '248',
      ready_time2: 'Ready',
      ready_order3: '250',
      ready_time3: 'Ready',
      ready_order4: '252',
      ready_time4: 'Ready',
      col3_title: 'Picked Up',
      col3_count: '4',
      done_order1: '238',
      done_time1: '11:22',
      done_order2: '241',
      done_time2: '11:28',
      done_order3: '243',
      done_time3: '11:35',
      done_order4: '245',
      done_time4: '11:39',
    },
  },
];

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

async function main() {
  const prisma = new PrismaClient();
  const clearFirst = process.argv.includes('--clear');
  const templateDir = path.resolve(__dirname);

  try {
    console.log('Restaurant Template Seeder');
    console.log('='.repeat(50));
    console.log(`Templates to seed: ${restaurantTemplateSeeds.length}`);

    // ── Verify all HTML + thumbnail files exist before starting ──────────
    const thumbnailDir = path.join(templateDir, 'thumbnails');
    for (const seed of restaurantTemplateSeeds) {
      const filePath = path.join(templateDir, seed.file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing template file: ${filePath}`);
      }
      const thumbPath = path.join(thumbnailDir, seed.thumbnailFile);
      if (!fs.existsSync(thumbPath)) {
        console.warn(`  WARNING: Missing thumbnail: ${thumbPath}`);
      }
    }
    console.log('All HTML files verified.');

    // ── Find or create the system organization ──────────────────────────
    let systemOrg = await prisma.organization.findFirst({
      where: { name: 'Vizora System' },
    });
    if (!systemOrg) {
      systemOrg = await prisma.organization.create({
        data: { name: 'Vizora System', slug: 'vizora-system' },
      });
      console.log(`Created system organization: ${systemOrg.id}`);
    } else {
      console.log(`Using existing system organization: ${systemOrg.id}`);
    }

    // ── Optionally clear existing restaurant templates ──────────────────
    if (clearFirst) {
      console.log('\nClearing existing restaurant library templates...');
      // Only delete templates whose metadata category is 'restaurant' and that are global
      const allGlobal = await prisma.content.findMany({
        where: { isGlobal: true, type: 'template', status: 'active' },
        select: { id: true, metadata: true },
      });
      const restaurantIds = allGlobal
        .filter((t) => {
          const meta = t.metadata as Record<string, unknown> | null;
          return meta?.category === 'restaurant';
        })
        .map((t) => t.id);

      if (restaurantIds.length > 0) {
        const deleted = await prisma.content.deleteMany({
          where: { id: { in: restaurantIds } },
        });
        console.log(`Deleted ${deleted.count} existing restaurant templates.`);
      } else {
        console.log('No existing restaurant templates to delete.');
      }
    }

    // ── Build set of existing template names to skip duplicates ─────────
    const existingNames = new Set(
      (
        await prisma.content.findMany({
          where: { isGlobal: true, type: 'template' },
          select: { name: true },
        })
      ).map((t) => t.name),
    );

    // ── Seed each template ──────────────────────────────────────────────
    let created = 0;
    let skipped = 0;

    for (const seed of restaurantTemplateSeeds) {
      if (existingNames.has(seed.name)) {
        console.log(`  SKIP: "${seed.name}" (already exists)`);
        skipped++;
        continue;
      }

      // Read the full HTML content from disk
      const filePath = path.join(templateDir, seed.file);
      const templateHtml = fs.readFileSync(filePath, 'utf-8');

      // Thumbnail served as static file from Next.js public directory
      // Files are at: web/public/templates/thumbnails/restaurant/{filename}.png
      const previewImageUrl = `/templates/thumbnails/restaurant/${seed.thumbnailFile}`;

      await prisma.content.create({
        data: {
          name: seed.name,
          description: seed.description,
          type: 'template',
          url: '', // Inline HTML template — no external URL
          duration: seed.duration,
          templateOrientation: seed.templateOrientation,
          isGlobal: true,
          status: 'active',
          organizationId: systemOrg.id,
          metadata: {
            // Template HTML content (the full file)
            templateHtml,
            // Pre-rendered HTML is the same since these are static (no Handlebars)
            renderedHtml: templateHtml,
            renderedAt: new Date().toISOString(),
            // Library metadata
            isLibraryTemplate: true,
            category: 'restaurant',
            libraryTags: seed.libraryTags,
            difficulty: seed.difficulty,
            isFeatured: seed.isFeatured,
            // Thumbnail preview image
            previewImageUrl,
            // Data source config
            dataSource: { type: 'manual', manualData: seed.sampleData },
            refreshConfig: { enabled: false, intervalMinutes: 0 },
            // Sample data (used by WYSIWYG editor to populate data-field elements)
            sampleData: seed.sampleData,
            // System template marker
            source: 'system',
          },
        },
      });

      console.log(`  CREATE: "${seed.name}" (${seed.file}, ${seed.templateOrientation})`);
      created++;
    }

    // ── Summary ─────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(50));
    console.log(`Done! Created: ${created}, Skipped: ${skipped}`);
    console.log('Restaurant templates are ready.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
