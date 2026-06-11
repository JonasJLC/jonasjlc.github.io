export const site = {
  name: 'Jonas JLC',
  role: 'Software, automation, and AI experiments',
  location: 'Copenhagen',
  intro:
    'A small public index of shipped things, experiments, and tools I want to keep easy to find.',
  note:
    'The site is deliberately plain in its data model: change this file, add a project object, ship the build.',
  availability: 'Available for focused software and AI product work.',
  links: [
    {
      label: 'GitHub',
      href: 'https://github.com/jonasjlc',
    },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/jonasjlc',
    },
    {
      label: 'Email',
      href: 'mailto:hello@jonasjlc.dev',
    },
  ],
  highlights: [
    'Prefer small systems with obvious update paths',
    'Keep projects public when they are useful to revisit',
    'Use automation where it removes repeated manual work',
  ],
  projects: [
    {
      title: 'AI Jeopardy',
      year: '2025',
      status: 'Live',
      href: '/jeopardy/',
      summary:
        'Event game with generated media, local content, and a static deploy that still lives at a stable URL.',
      tags: ['game', 'static', 'media'],
      featured: true,
    },
    {
      title: 'Personal site system',
      year: '2026',
      status: 'Active',
      href: 'https://github.com/jonasjlc/jonasjlc.github.io',
      summary:
        'The current site: Astro, pnpm, one content file, and GitHub Pages deployment from generated output.',
      tags: ['astro', 'pnpm', 'pages'],
      featured: true,
    },
    {
      title: 'Project archive',
      year: 'Ongoing',
      status: 'Public',
      href: 'https://github.com/jonasjlc?tab=repositories',
      summary:
        'A public holding area for experiments, utilities, and prototypes before they deserve a dedicated write-up.',
      tags: ['github', 'archive'],
      featured: false,
    },
  ],
};

export type SiteProject = (typeof site.projects)[number];
