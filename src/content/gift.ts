export const gift = {
  nicknames: ['Mussi', 'Bubbi', 'Wong', 'Wongtong', 'Won', 'Wonton', 'CAM', 'CAMAL', 'bingbong', 'Chokoladefabrik', 'plang', 'Plingplang'],
  gate: {
    title: 'Hvad er dit kælenavn?',
    copy: 'En lille gave venter på dig. Først skal jeg lige vide, at det er dig.',
    alternatives: 'Du havde også fået adgang, hvis du havde svaret følgende:',
    error: 'Det var ikke lige det kælenavn, jeg tænkte på. Prøv et andet ♥',
  },
  riddle: {
    title: 'Hvor skal vi hen?',
    copy: 'Vi skal til et sted i Kerteminde, hvor varme bade og ro venter. Navnet består af to engelske ord: Det første betyder “stor” eller “fantastisk”, og det andet betyder “nordlig”. Hvad hedder stedet?',
    hints: ['Det første ord er GREAT.', 'Det andet ord er NORTHERN.'],
    answers: ['Great Northern'],
    error: 'Ikke helt endnu. Prøv igen — eller få et lille hint.',
  },
  title: '1x Midday Spa Getaway',
  destination: 'Great Northern',
  date: '31. oktober – 1. november',
  message: 'Tid til varme bade, god mad og en pause fra hverdagen. Kun os to.',
  itinerary: [
    { time: '12.00', title: 'Frokost', description: 'Frokost på Great Northern' },
    { time: '13.00–16.00', title: 'Spa', description: 'Tre timer med ro og varme bade' },
    { time: '19.30', title: 'Middag', description: 'Tre-retters menu' },
  ],
  images: [
    { src: '/gave/assets/spa-exterior.webp', alt: 'Great Northern Spa omgivet af træer og grøn natur' },
    { src: '/gave/assets/spa-pool.webp', alt: 'Poolen under det høje træloft i Great Northern Spa' },
  ],
} as const;

export type Gift = typeof gift;
