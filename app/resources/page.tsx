import React from 'react';

export default function ResourcesPage() {
  return (
    <div className="min-h-screen">
      <div className="p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            MFL Resources
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Here are some useful resources for MFL managers:
          </p>

          <div className="space-y-8">
            {/* MFL Podcasts */}
            <div className="border-l-4 border-purple-500 pl-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                MFL Podcasts
              </h2>
              <div className="text-gray-600 dark:text-gray-300 space-y-3">
                <p>
                  <a
                    href="https://www.youtube.com/@WenDirkCast"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
                  >
                    WenDirkCast
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> - The OGs of MFL sharing weekly insights, banter and official MFL news.
                </p>
                <p>
                  <a
                    href="https://www.youtube.com/@Quinny3001"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
                  >
                    Quinny3001
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> - Legend Quinny sharing his MFL strategies and vast football knowledge. He also has a great beginner tutorial: 
                  <a
                    href="https://www.youtube.com/watch?v=B7ogIjJG99k"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center ml-1"
                  >
                    Beginner Tutorial
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  and private members area with more live streams, videos and tutorials.
                </p>
                <p>
                  <a
                    href="https://www.youtube.com/@McBrideAce"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
                  >
                    McBrideAce
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> - Legend McBride sharing his MFL strategies and awesome sense of humour giving honest and straight forward news on MFL and Sorare.
                </p>
                <p>
                  <a
                    href="https://www.youtube.com/@YorkshireTeaXP"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
                  >
                    YorkshireTeaXP
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> - New MFL podcast with 3 lads talking about MFL strategies more in-depth and weekly banter, awesome pod.
                </p>
                <p>
                  <a
                    href="https://www.youtube.com/@NepentheZMFL"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
                  >
                    NepentheZMFL
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> - Legend Nepenthez shares his unique MFL strategies and thoughts.
                </p>
                <p>
                  <a
                    href="https://www.youtube.com/@calvinatorFC"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
                  >
                    calvinatorFC
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> - MFL OG Calvinator shares some awesome MFL features overviews and thoughts good historic videos on MFL strategy.
                </p>
                <p>
                  <a
                    href="https://www.youtube.com/playlist?list=PLiGKN12xXhvWkzfpWSZLUFruNBXwLxOna"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
                  >
                    Andrew Laird MFL Thoughts
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> - Previous Sorare ambassador Andrew Laird sharing his MFL thoughts.
                </p>
              </div>
            </div>
            {/* MFLdata.com */}
            <div className="border-l-4 border-blue-500 pl-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                <a 
                  href="https://mfldata.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                >
                  MFLdata.com
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Useful for viewing player information, player position ratings, has an AI-powered Assistant Manager so you can chat to about your agency strategy, team management, team tactics, and player progression, still under development.
              </p>
            </div>

            {/* MFLPlayer.info */}
            <div className="border-l-4 border-green-500 pl-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                <a 
                  href="https://mflplayer.info" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 dark:text-green-400 hover:underline inline-flex items-center"
                >
                  MFLPlayer.info
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                Useful for viewing player information, player position ratings (find those players who can play multiple positions), training option with individual stats toggles to estimate how long before the next Overall jump, estimating player value, estimating contract loan percentages.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                <a 
                  href="https://mflplayer.info/players-table" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 dark:text-green-400 hover:underline inline-flex items-center"
                >
                  Full player table
                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a> with filters and sorting, mobile first design, very well done app.
              </p>
            </div>

            {/* mfl-assistant.com */}
            <div className="border-l-4 border-purple-500 pl-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                <a 
                  href="https://mfl-assistant.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
                >
                  mfl-assistant.com
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Useful for viewing player information, club information, set up market listing email notifications (new marketplace listings your buying/sniping), set up daily player progression report (emails you every 24H showing your players progress), search for recent sales information for players (useful for estimating player market value and demand), shows graphs for MFL user growth and country geolocation for users and clubs.
              </p>
            </div>

            {/* mfl-coach.com */}
            <div className="border-l-4 border-orange-500 pl-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                <a 
                  href="https://mfl-coach.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center"
                >
                  mfl-coach.com
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </h2>
              <div className="text-gray-600 dark:text-gray-300 space-y-3">
                <p>
                  Useful for Formation meta, Squad builder and other coach tools:
                </p>
                <p>
                  <a 
                    href="https://mfl-coach.com/formation-meta" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center"
                  >
                    Formation Meta
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> (select the match engine and compare super useful for setting your formations against other teams)
                </p>
                <p>
                  Friendly match finder:
                </p>
                <p>
                  <a 
                    href="https://mfl-coach.com/opponent-finder" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center"
                  >
                    Opponent Finder
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> useful for pre-season team setup and find teams with specific formations and team overalls
                </p>
                <p>
                  Squad builder tool:
                </p>
                <p>
                  <a 
                    href="https://mfl-coach.com/squad-builder" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center"
                  >
                    Squad Builder
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> useful pre-season for building your teams from your Agency player pool
                </p>
                <p>
                  Match Analysis tool:
                </p>
                <p>
                  <a 
                    href="https://mfl-coach.com/match-analysis" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center"
                  >
                    Match Analysis
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a> a bit limited at the moment but could be useful for pre-season batch friendlies as it lets you select multiple matches and totals the stats, so you can run say 5 friendlies (team setup A) and compare against another 5 friendlies (team setup B).
                </p>
              </div>
        </div>

            {/* metafixerlab.com */}
            <div className="border-l-4 border-red-500 pl-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                <a 
                  href="https://metafixerlab.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-red-600 dark:text-red-400 hover:underline inline-flex items-center"
                >
                  metafixerlab.com
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Useful for estimating the amount of $MFL you are generating for the current season, really in-depth breakdowns of $MFL earnings and real-time analysis.
              </p>
        </div>

            {/* Flowty */}
            <div className="border-l-4 border-indigo-500 pl-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                <a 
                  href="https://www.flowty.io/collection/0x8ebcbfd516b1da27/MFLPack" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Flowty MFL Pack Marketplace
                </a>
              </h2>
            <p className="text-gray-600 dark:text-gray-300">
                Flowty is a marketplace where you can buy and sell your MFL reward packs, useful for turning $MFL into USD, or to buy fresh players for your Agency (your paying a premium, but get the pack open excitement).
            </p>
            </div>
          </div>

            <br/>
          <p>If you have any suggestions for resources to add, please let me know via Twitter <a href="https://x.com/dogesports69" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://x.com/dogesports69</a></p>

      </div>
    </div>
  );
}
