#!/usr/bin/env node
const path = require('path');
const sb = require('./scoreboard');

const sample = [
  {
    name: 'ANZR Warfare 24/7',
    shortName: 'ANZR',
    status: 'success',
    currentMap: 'Foy',
    alliesScore: 3,
    axisScore: 2,
    totalPlayers: 45,
    alliesPlayers: 22,
    axisPlayers: 23,
    nextMap: 'Carentan',
    statsUrl: 'https://server-stats.anzr.org/servers/anzr-warfare-24-7',
    fetchedAt: new Date().toISOString(),
  },
  {
    name: 'SCC Public',
    status: 'error',
    error: 'Offline',
    statsUrl: 'https://server-stats.anzr.org/servers/scc-public',
    fetchedAt: new Date().toISOString(),
  },
];

const out = sb.buildDiscordMessage(sample);
console.log(out);
