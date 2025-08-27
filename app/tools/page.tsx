"use client";

import React from 'react';
import Link from 'next/link';

interface ToolCardProps {
  title: string;
  description: string;
  url: string;
  features: string[];
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, url, features }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {title}
        </h3>
        <Link 
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center space-x-2 group"
        >
          <span>Visit</span>
          <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
      </div>
      <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
        {description}
      </p>
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
          Key Features:
        </h4>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start space-x-2">
              <span className="text-blue-500 dark:text-blue-400 mt-1">•</span>
              <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default function ToolsPage() {
  const tools = [
    {
      title: "MFLdata.com",
      description: "Useful for viewing player information, player position ratings, has an AI-powered Assistant Manager so you can chat to about your agency strategy, team management, team tactics, and player progression, still under development.",
      url: "https://mfldata.com",
      features: [
        "Player information and position ratings",
        "AI-powered Assistant Manager for strategy discussions",
        "Agency strategy, team management, and tactics support",
        "Player progression tracking",
        "Under active development"
      ]
    },
    {
      title: "MFLPlayer.info",
      description: "Useful for viewing player information, player position ratings (find those players who can play multiple positions), training option with individual stats toggles to estimate how long before the next Overall jump, estimating player value, estimating contract loan percentages, full player table with filters and sorting, mobile first design, very well done app.",
      url: "https://mflplayer.info",
      features: [
        "Player information and position ratings",
        "Multi-position player finder",
        "Training progress estimation with stat toggles",
        "Player value estimation",
        "Contract loan percentage calculator",
        "Full player table with filters and sorting",
        "Mobile-first responsive design"
      ]
    },
    {
      title: "mfl-assistant.com",
      description: "Useful for viewing player information, club information, set up market listing email notifications (new marketplace listings your buying/sniping), set up daily player progression report (emails you every 24H showing your players progress), search for recent sales information for players (useful for estimating player market value and demand), shows graphs for MFL user growth and country geolocation for users and clubs.",
      url: "https://mfl-assistant.com",
      features: [
        "Player and club information",
        "Market listing email notifications",
        "Daily player progression reports",
        "Recent sales data for market analysis",
        "MFL user growth analytics",
        "Country geolocation data for users and clubs"
      ]
    },
    {
      title: "mfl-coach.com",
      description: "Useful for Formation meta (winning percentages vs other formations), friendly match finder useful for pre-season team setup and find teams with specific formations and team overalls, Squad builder tool useful pre-season for building your teams from your Agency player pool, Match Analysis tool a bit limited at the moment but could be useful for pre-season batch friendlies as it lets you select multiple matches and totals the stats.",
      url: "https://mfl-coach.com",
      features: [
        "Formation meta analysis with winning percentages",
        "Friendly match finder for pre-season setup",
        "Squad builder tool for team construction",
        "Match analysis for batch friendly comparisons",
        "Formation comparison against different match engines"
      ]
    },
    {
      title: "metafixerlab.com",
      description: "Useful for estimating the amount of $MFL you are generating for the current season, really in-depth breakdowns of $MFL earnings and real-time analysis.",
      url: "https://metafixerlab.com",
      features: [
        "Season $MFL earnings estimation",
        "In-depth $MFL earnings breakdowns",
        "Real-time earnings analysis",
        "Detailed financial tracking"
      ]
    },
    {
      title: "Flowty Marketplace",
      description: "Flowty is a marketplace where you can buy and sell your MFL reward packs, useful for turning $MFL into USD, or to buy fresh players for your Agency (your paying a premium, but get the pack open excitement).",
      url: "https://www.flowty.io/collection/0x8ebcbfd516b1da27/MFLPack",
      features: [
        "Buy and sell MFL reward packs",
        "Convert $MFL to USD",
        "Purchase fresh players for your Agency",
        "Pack opening excitement",
        "Premium marketplace for MFL assets"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Useful MFL Tools
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Here are some useful tools for MFL managers to enhance your gameplay experience
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tools.map((tool, index) => (
            <ToolCard
              key={index}
              title={tool.title}
              description={tool.description}
              url={tool.url}
              features={tool.features}
            />
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
            <p className="text-gray-600 dark:text-gray-300">
              <span className="font-semibold">Note:</span> These tools are developed by the MFL community and are not officially affiliated with MFL. 
              Always verify information and use at your own discretion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
