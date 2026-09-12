export const gift = {
  recipientName: '',
  departure: '',
  optionalImage: '',
  opening: {
    classification: 'FORTROLIG RESERVATION',
    purpose: 'Et lille ophold for os to',
    duration: 'En nat væk fra hverdagen',
  },
  packing: [
    { item: 'Badetøj', pack: 'Det får en særlig god opgave.', leave: 'Modigt. Men måske lidt upraktisk.' },
    { item: 'En blød morgenkåbe', pack: 'Det lyder som en plan med plads til ro.', leave: 'Fair nok. Der findes heldigvis varme håndklæder.' },
    { item: 'Din yndlingsbog', pack: 'En god pause fortjener en god bog.', leave: 'Så er der mere plads til at kigge ud.' },
    { item: 'Behagelige sko', pack: 'Klar til små ture og langsomme skridt.', leave: 'Bare rolig, vi skal ikke på vandretur.' },
    { item: 'En varm trøje', pack: 'Den kan blive god, når luften er frisk.', leave: 'Vi finder nok et sted at varme os.' },
    { item: 'Solbriller', pack: 'Optimistisk. Det kan jeg godt lide.', leave: 'Det danske vejr får lov at overraske os.' },
    { item: 'Telefonopladeren', pack: 'Praktisk sans registreret.', leave: 'En lille digital detox har også sin charme.' },
    { item: 'Et kortspil', pack: 'Måske bliver der tid til en langsom runde.', leave: 'Vi finder på noget andet hyggeligt.' },
    { item: 'Din yndlingssnack', pack: 'Prioriteterne er helt rigtige.', leave: 'Der venter stadig noget godt.' },
    { item: 'Nysgerrighed', pack: 'Den er den vigtigste ting på listen.', leave: 'Så låner du lidt af min undervejs.' },
  ],
  location: {
    clues: ['Vi bliver i Danmark.', 'Vi skal til Fyn.', 'Havet er tæt på.', 'Byen begynder med K.', 'Kerte_____'],
    hints: ['Tænk på en hyggelig kystby på det nordøstlige Fyn.', 'Byens navn slutter på “minde”.'],
    answers: ['kerteminde', 'kerte minde'],
  },
  namePuzzle: {
    sizeAnswers: ['stor', 'big', 'great'],
    directionAnswers: ['nord', 'north'],
    sizeHint: 'Det modsatte af lille er et dansk ord på fire bogstaver.',
    directionHint: 'Kompasnålen peger mod toppen af kortet.',
  },
  details: {
    date: '',
    checkIn: '',
    checkOut: '',
    hotelStay: '',
    dinner: '',
    spaAccess: '',
    treatments: '',
    breakfast: '',
    address: '',
    message: '',
  },
} as const;

export type Gift = typeof gift;
