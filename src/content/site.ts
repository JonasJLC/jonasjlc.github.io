export const site = {
  name: 'Jonas JLC',
  role: 'Builder, developer, and practical AI tinkerer',
  location: 'Copenhagen, Denmark',
  intro:
    'I build small, useful software projects with a bias for clear interfaces, sturdy systems, and fast iteration.',
  note:
    'This site is intentionally simple: update this file when a new project, link, or short bio detail changes.',
  availability: 'Open to interesting software, automation, and AI product work.',
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
    'Product-minded engineering',
    'AI experiments and automation',
    'Simple systems that are easy to maintain',
  ],
  projects: [
    {
      title: 'AI Jeopardy',
      year: '2025',
      status: 'Live',
      href: '/jeopardy/',
      summary:
        'A custom Jeopardy game built for a New Year event, with generated media, local content, and a fast static deployment.',
      tags: ['Game', 'Static app', 'AI media'],
      featured: true,
    },
    {
      title: 'Personal site system',
      year: '2026',
      status: 'Active',
      href: 'https://github.com/jonasjlc/jonasjlc.github.io',
      summary:
        'This portfolio, rebuilt as a tiny Astro site where new projects are added by editing one content file.',
      tags: ['Astro', 'pnpm', 'GitHub Pages'],
      featured: true,
    },
    {
      title: 'Project archive',
      year: 'Ongoing',
      status: 'Public',
      href: 'https://github.com/jonasjlc?tab=repositories',
      summary:
        'A running archive of experiments, utilities, and prototypes. Promote the best work here as it matures.',
      tags: ['Open source', 'Experiments'],
      featured: false,
    },
  ],
};

export type SiteProject = (typeof site.projects)[number];
