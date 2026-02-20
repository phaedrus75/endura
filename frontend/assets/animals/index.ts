// Animal image mappings
// Maps animal names to their image require statements

export const animalImages: { [key: string]: any } = {
  'Sunda Island Tiger': require('./sunda island tiger.png'),
  'Javan Rhino': require('./javan rhino.png'),
  'Amur Leopard': require('./amur leopard.png'),
  'Mountain Gorilla': require('./mountain gorilla.png'),
  'Tapanuli Orangutan': require('./tapanuli orangutan.png'),
  'Polar Bear': require('./polar bear.png'),
  'African Forest Elephant': require('./african forest elephant.png'),
  'Hawksbill Turtle': require('./hawksbill turtle.png'),
  'Calamian Deer': require('./calamian deer.png'),
  'Axolotl': require('./axolotl.png'),
  'Red Wolf': require('./red wolf.png'),
  'Monarch Butterfly': require('./monarch butterfly.png'),
  'Red Panda': require('./red panda.png'),
  'Panda': require('./panda.png'),
  'Mexican Bobcat': require('./mexican bobcat.png'),
  'Chinchilla': require('./chinchilla.png'),
  'Otter': require('./otter.png'),
  'Koala': require('./koala.png'),
  'Langur Monkey': require('./langur monkey.png'),
  'Pacific Pocket Mouse': require('./pacific pocket mouse.png'),
  'Wallaby': require('./wallaby.png'),
  'Avahi': require('./avahi.png'),
  'Blue Whale': require('./blue whale.png'),
  'Gray Bat': require('./gray bat.png'),
  'Grey Parrot': require('./grey parrot.png'),
  'Grizzly Bear': require('./grizzly bear.png'),
  'Mountain Zebra': require('./mountain zebra.png'),
  'Pangolin': require('./pangolin.png'),
  'Seal': require('./seal.png'),
  'Wombat': require('./wombat.png'),
};

// Get animal image by name, with fallback
export const getAnimalImage = (name: string): any => {
  return animalImages[name] || null;
};

// List of all animal names in unlock order
export const ANIMAL_NAMES_IN_ORDER = [
  'Sunda Island Tiger',
  'Javan Rhino',
  'Amur Leopard',
  'Mountain Gorilla',
  'Tapanuli Orangutan',
  'Polar Bear',
  'African Forest Elephant',
  'Hawksbill Turtle',
  'Calamian Deer',
  'Axolotl',
  'Red Wolf',
  'Monarch Butterfly',
  'Red Panda',
  'Panda',
  'Mexican Bobcat',
  'Chinchilla',
  'Otter',
  'Koala',
  'Langur Monkey',
  'Pacific Pocket Mouse',
  'Wallaby',
  'Avahi',
  'Blue Whale',
  'Gray Bat',
  'Grey Parrot',
  'Grizzly Bear',
  'Mountain Zebra',
  'Pangolin',
  'Seal',
  'Wombat',
];
