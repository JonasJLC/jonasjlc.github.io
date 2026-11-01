export const site = {
  name: 'Jonas JLC',
  role: 'Senior Automation & AI Consultant',
  employer: 'Columbus, Data & AI',
  location: 'Aarhus, Denmark',
  tagline: 'Agent systems and AI platforms, built to be governed and repeatable.',
  current:
    'Senior Automation & AI consultant at Columbus, Data & AI. I work as developer, consultant and platform architect.',
  about: [
    'I build and run AI platforms on Microsoft Foundry, from the first agent to the infrastructure, pipelines and access control around it.',
    'Much of my work is helping teams move from low-code (Copilot Studio, Power Platform) to pro-code, without losing the speed that made low-code attractive.',
    'Before consulting I spent about four years in retail, where I co-started an AI team.',
  ],
  focus: [
    {
      title: 'Microsoft Foundry',
      summary: 'The platform for custom AI, and the governance around it.',
    },
    {
      title: 'Agent systems',
      summary: 'Single and multi-agent designs that hold up outside a demo.',
    },
    {
      title: 'Infrastructure as code',
      summary: 'Bicep, with CI/CD in Azure DevOps and GitHub.',
    },
    {
      title: 'Identity and access',
      summary: 'RBAC and Entra ID, designed in from the start.',
    },
    {
      title: 'Observability',
      summary: 'Seeing what agents and platforms actually do in production.',
    },
  ],
  layers: ['Agents', 'Platform', 'IaC & CI/CD', 'Governance'],
  // DRAFT principles, pending review.
  principles: [
    'Infrastructure as code first: if it is not in a repository, it does not exist.',
    'Governance as code: policy, access and guardrails live next to the thing they govern.',
    'Small, closeable increments over long-running efforts.',
    'Reusable frameworks over one-off solutions.',
  ],
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
  projects: [
    {
      title: 'AI Jeopardy',
      year: '2025',
      status: 'Live',
      href: '/jeopardy/',
      summary:
        'Event game with generated media and local content, served as a static site at a stable URL.',
      tags: ['game', 'static', 'media'],
    },
    {
      title: 'This site',
      year: '2026',
      status: 'Active',
      href: 'https://github.com/jonasjlc/jonasjlc.github.io',
      summary: 'Astro and pnpm with one content file, deployed to GitHub Pages from generated output.',
      tags: ['astro', 'pnpm', 'pages'],
    },
    {
      title: 'Project archive',
      year: 'Ongoing',
      status: 'Public',
      href: 'https://github.com/jonasjlc?tab=repositories',
      summary: 'A public holding area for experiments and prototypes.',
      tags: ['github', 'archive'],
    },
  ],
};

export type SiteProject = (typeof site.projects)[number];
