import React from 'react';
import { PageHeader, Panel, linkClass } from '../../src/components/ui';

const PODCASTS = [
  {
    name: 'WenDirkCast',
    url: 'https://www.youtube.com/@WenDirkCast',
    description: 'The OGs of MFL sharing weekly insights, banter and official MFL news.',
  },
  {
    name: 'Quinny3001',
    url: 'https://www.youtube.com/@Quinny3001',
    description: 'Legend Quinny sharing his MFL strategies and vast football knowledge. He also has a great beginner tutorial:',
    tutorialUrl: 'https://www.youtube.com/watch?v=B7ogIjJG99k',
  },
  {
    name: 'McBrideAce',
    url: 'https://www.youtube.com/@McBrideAce',
    description: 'Legend McBride sharing his MFL strategies and awesome sense of humour giving honest and straight forward news on MFL and Sorare.',
  },
  {
    name: 'YorkshireTeaXP',
    url: 'https://www.youtube.com/@YorkshireTeaXP',
    description: 'New MFL podcast with 3 lads talking about MFL strategies more in-depth and weekly banter, awesome pod.',
  },
  {
    name: 'NepentheZMFL',
    url: 'https://www.youtube.com/@NepentheZMFL',
    description: 'Legend Nepenthez shares his unique MFL strategies and thoughts.',
  },
  {
    name: 'calvinatorFC',
    url: 'https://www.youtube.com/@calvinatorFC',
    description: 'MFL OG Calvinator shares some awesome MFL features overviews and thoughts good historic videos on MFL strategy.',
  },
  {
    name: 'Andrew Laird MFL Thoughts',
    url: 'https://www.youtube.com/playlist?list=PLiGKN12xXhvWkzfpWSZLUFruNBXwLxOna',
    description: 'Previous Sorare ambassador Andrew Laird sharing his MFL thoughts.',
  },
];

// Each site's colour: its initials tile, and its name in the light and dark themes
const SITES = [
  {
    name: 'MFLdata.com',
    initials: 'MD',
    url: 'https://mfldata.com',
    tile: 'bg-blue-400/16 text-blue-600 dark:text-blue-400',
    link: 'text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300',
    description: 'Useful for viewing player information, player position ratings, has an AI-powered Assistant Manager so you can chat to about your agency strategy, team management, team tactics, and player progression, still under development.',
  },
  {
    name: 'mfl-assistant.com',
    initials: 'MA',
    url: 'https://mfl-assistant.com',
    tile: 'bg-fuchsia-400/16 text-fuchsia-600 dark:text-fuchsia-400',
    link: 'text-fuchsia-600 dark:text-fuchsia-400 hover:text-fuchsia-500 dark:hover:text-fuchsia-300',
    description: 'Useful for viewing player information, club information, set up market listing email notifications (new marketplace listings your buying/sniping), set up daily player progression report (emails you every 24H showing your players progress), search for recent sales information for players (useful for estimating player market value and demand), shows graphs for MFL user growth and country geolocation for users and clubs.',
  },
  {
    name: 'Flowty MFL Pack Marketplace',
    initials: 'FL',
    url: 'https://www.flowty.io/collection/0x8ebcbfd516b1da27/MFLPack',
    tile: 'bg-indigo-400/16 text-indigo-600 dark:text-indigo-400',
    link: 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300',
    description: 'Flowty is a marketplace where you can buy and sell your MFL reward packs, useful for turning $MFL into USD, or to buy fresh players for your Agency (your paying a premium, but get the pack open excitement).',
  },
];

const COACH_TOOLS = [
  {
    kicker: 'Formation meta',
    name: 'Formation Meta',
    url: 'https://mfl-coach.com/formation-meta',
    description: '(select the match engine and compare super useful for setting your formations against other teams)',
  },
  {
    kicker: 'Friendly match finder',
    name: 'Opponent Finder',
    url: 'https://mfl-coach.com/opponent-finder',
    description: 'useful for pre-season team setup and find teams with specific formations and team overalls',
  },
  {
    kicker: 'Squad builder tool',
    name: 'Squad Builder',
    url: 'https://mfl-coach.com/squad-builder',
    description: 'useful pre-season for building your teams from your Agency player pool',
  },
];

// A box's main link stretches over the whole box (the box must be `relative`), so clicking anywhere in it follows the link.
// Any other link in the box sits above it with `relative z-10`.
const stretchedClass = "after:absolute after:inset-0 after:content-['']";
const boxHoverClass = 'relative transition-colors hover:border-line-hover';

const ExternalLink: React.FC<{ href: string; className: string; stretched?: boolean; children: React.ReactNode }> = ({
  href,
  className,
  stretched = false,
  children,
}) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={`transition-colors ${stretched ? stretchedClass : ''} ${className}`}>
    {children} ↗
  </a>
);

export default function ResourcesPage() {
  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader title="MFL Resources" subtitle="Here are some useful resources for MFL managers:" />

      <Panel className="flex flex-col gap-4 p-[22px]">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-purple-400/16 text-violet-ink">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </span>
          <h2 className="m-0 font-display text-2xl font-bold text-fg">MFL Podcasts</h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-2.5">
          {PODCASTS.map(podcast => (
            <div key={podcast.name} className={`flex gap-3.5 px-4 py-3.5 rounded-2xl border border-line bg-inset ${boxHoverClass}`}>
              <span className="flex-none grid place-items-center w-10 h-10 rounded-full border border-violet-line bg-violet-bg font-display text-sm font-extrabold text-violet-ink">
                {podcast.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
              </span>
              <div className="flex flex-col gap-1 min-w-0">
                <ExternalLink stretched href={podcast.url} className="self-start text-[15px] font-bold text-violet-ink hover:text-violet-ink-2">
                  {podcast.name}
                </ExternalLink>
                <p className="m-0 text-sm leading-normal text-fg-4 text-pretty">
                  {podcast.description}
                  {podcast.tutorialUrl && (
                    <>
                      {' '}
                      <ExternalLink href={podcast.tutorialUrl} className="relative z-10 font-semibold text-violet-ink hover:text-violet-ink-2 hover:underline">
                        Beginner Tutorial
                      </ExternalLink>{' '}
                      and private members area with more live streams, videos and tutorials.
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
        {SITES.map(site => (
          <Panel key={site.name} className={`flex flex-col gap-3 p-[22px] ${boxHoverClass}`}>
            <span className={`grid place-items-center w-10 h-10 rounded-xl font-display text-[15px] font-extrabold ${site.tile}`}>
              {site.initials}
            </span>
            <ExternalLink stretched href={site.url} className={`self-start font-display text-[22px] font-bold ${site.link}`}>
              {site.name}
            </ExternalLink>
            <p className="m-0 text-sm leading-relaxed text-fg-4 text-pretty">{site.description}</p>
          </Panel>
        ))}
      </div>

      <Panel className="flex flex-col gap-4 p-[22px]">
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-orange-400/16 font-display text-[15px] font-extrabold text-orange-600 dark:text-orange-400">
            MC
          </span>
          <div className="flex flex-col gap-0.5">
            <ExternalLink
              stretched
              href="https://mfl-coach.com"
              className="self-start font-display text-[22px] font-bold text-orange-600 dark:text-orange-400 hover:text-orange-500 dark:hover:text-orange-300"
            >
              mfl-coach.com
            </ExternalLink>
            <span className="text-sm font-medium text-fg-4">Useful for Formation meta, Squad builder and other coach tools:</span>
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-2.5">
          {COACH_TOOLS.map(tool => (
            <div key={tool.name} className={`flex flex-col gap-1.5 p-4 rounded-2xl border border-line bg-inset ${boxHoverClass}`}>
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-3">{tool.kicker}</span>
              <ExternalLink stretched href={tool.url} className="self-start text-base font-bold text-orange-ink hover:text-orange-600 dark:hover:text-orange-300">
                {tool.name}
              </ExternalLink>
              <span className="text-sm leading-normal text-fg-4 text-pretty">{tool.description}</span>
            </div>
          ))}
        </div>
      </Panel>

      <p className="m-0 pt-1.5 text-center text-sm font-medium text-muted">
        If you have any suggestions for resources to add, please let me know via Twitter{' '}
        <a href="https://x.com/dogesports69" target="_blank" rel="noopener noreferrer" className={`font-semibold ${linkClass}`}>
          https://x.com/dogesports69
        </a>
      </p>
    </div>
  );
}
