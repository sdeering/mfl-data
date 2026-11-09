/*
 * MFL Data tactics import. The "Import from MFL" bookmark loads this on app.playmfl.com, where you're logged in. MFL's
 * match reports show a club's tactics only to its owner, so it asks MFL for them as the app does, with the app's own
 * login, which never leaves the page. For each of your clubs it walks back through the last matches played, newest
 * first, and sends each match's tactics and players' stats to MFL Data's tactics log. A played match's report doesn't
 * change, so matches imported before are skipped, and so are those whose report shows no tactics (you didn't own the
 * club then), which this browser remembers.
 */
(() => {
  const SCRIPT = (() => {
    try {
      return new URL(document.currentScript.src);
    } catch {
      return null;
    }
  })();
  const SITE = SCRIPT ? SCRIPT.origin : 'https://mfldata.com';
  /** The bookmark's key: it proves to MFL Data whose clubs these are */
  const KEY = SCRIPT ? SCRIPT.searchParams.get('key') : null;
  const MFL_API = 'https://api.playmfl.com';
  /** Matches looked back over per club */
  const MAX_PER_CLUB = 40;
  /** Between requests to MFL: it blocks bursts */
  const GAP_MS = 1600;
  const TEAM_KEYS = ['width', 'directness', 'sideAttackLeft', 'farShot', 'crosses', 'dribble', 'offensiveEngagement', 'depth', 'compactness', 'pressing', 'aggressivity', 'clearance'];
  /** What MFL Data keeps of each player's line in a report */
  const LINE_KEYS = ['playerId', 'position', 'time', 'rating', 'goals', 'assists', 'xG', 'shots', 'chancesCreated', 'dribblingSuccess', 'defensiveDuelsWon'];
  /** Matches whose report showed no tactics, kept in this browser so they aren't read again */
  const NO_TACTICS = 'mfldata.noTactics';

  if (window.__mfldataImport) return;
  window.__mfldataImport = true;
  let cancelled = false;

  // The progress box
  const box = document.createElement('div');
  box.setAttribute('style', [
    'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483647', 'width:min(360px,calc(100vw - 32px))', 'max-height:60vh', 'overflow:auto',
    'background:#0f1411', 'color:#e6ece8', 'border:1px solid #2b3530', 'border-radius:14px', 'box-shadow:0 12px 40px rgba(0,0,0,.5)',
    'font:500 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif', 'padding:14px 16px',
  ].join(';'));
  const head = document.createElement('div');
  head.setAttribute('style', 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px');
  head.innerHTML = '<b style="color:#c6f432;font-size:14px">MFL Data · Tactics import</b>';
  const close = document.createElement('button');
  close.textContent = '×';
  close.title = 'Stop and close';
  close.setAttribute('style', 'background:none;border:0;color:#9aa69f;font-size:20px;line-height:1;cursor:pointer;padding:0 2px');
  close.onclick = () => {
    cancelled = true;
    box.remove();
    window.__mfldataImport = false;
  };
  head.appendChild(close);
  const lines = document.createElement('div');
  box.append(head, lines);
  document.body.appendChild(box);

  const COLOURS = { good: '#c6f432', bad: '#f87171', muted: '#9aa69f' };
  const say = (text, tone) => {
    const line = document.createElement('div');
    line.textContent = text;
    if (tone) line.style.color = COLOURS[tone];
    lines.appendChild(line);
    box.scrollTop = box.scrollHeight;
    return line;
  };
  const finish = (text, tone) => {
    if (text) say(text, tone);
    const link = document.createElement('a');
    link.href = `${SITE}/matches`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open the tactics log on MFL Data →';
    link.setAttribute('style', 'display:inline-block;margin-top:8px;color:#c6f432;font-weight:700');
    lines.appendChild(link);
    window.__mfldataImport = false;
  };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const day = time => new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  class Stop extends Error {}

  /** A public MFL request, spaced out */
  const mfl = async (path, headers) => {
    await pause(GAP_MS);
    if (cancelled) throw new Stop('');
    const response = await fetch(`${MFL_API}${path}`, { headers: { Accept: 'application/json', ...headers } });
    if (response.status === 429) throw new Stop('MFL asked us to slow down. Try again in 10 minutes.');
    if (response.status === 401 || response.status === 403) throw new Stop('MFL needs you logged in again: reload this page and click the bookmark again.');
    if (!response.ok) throw new Error(`MFL answered ${response.status} for ${path}`);
    return response.json();
  };

  /**
   * MFL's login, as the app sends it: kept from the app's next request to MFL, which opening a page in the app makes.
   * It stays in this page, and only goes to MFL.
   */
  const borrowLogin = nudge =>
    new Promise(resolve => {
      const original = window.fetch;
      let done = false;
      const stop = value => {
        if (done) return;
        done = true;
        if (window.fetch === watcher) window.fetch = original;
        clearTimeout(timer);
        clearTimeout(hint);
        resolve(value);
      };
      function watcher(input, init) {
        try {
          const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
          if (url.startsWith(MFL_API)) {
            const value = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined)).get('Authorization');
            if (value) stop(value);
          }
        } catch {
          // Leave the app's request alone
        }
        return original.apply(this, arguments);
      }
      window.fetch = watcher;
      const hint = setTimeout(() => say('Still waiting for MFL: click any page in the MFL app.', 'muted'), 6000);
      const timer = setTimeout(() => stop(null), 45000);
      nudge();
    });

  const walletOf = () => {
    for (const [key, pick] of [['AUTH_TOKEN', value => value && value.data && value.data.walletAddress], ['CURRENT_USER', value => value && value.addr]]) {
      try {
        const wallet = pick(JSON.parse(localStorage.getItem(key)));
        if (typeof wallet === 'string' && wallet) return wallet;
      } catch {
        // Try the next
      }
    }
    return null;
  };

  /** Our side of a report's formation, cut down to the tactics */
  const tacticsOf = formation => {
    const kept = { type: formation.type, playersInstructions: formation.playersInstructions || {} };
    for (const key of TEAM_KEYS) kept[key] = formation[key] ?? null;
    return kept;
  };
  /** A side's players' lines, cut down to what's kept */
  const linesOf = side => ((side && side.playersStats) || []).map(line => Object.fromEntries(LINE_KEYS.map(key => [key, line[key]])));

  const noTactics = (() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(NO_TACTICS) || '[]'));
    } catch {
      return new Set();
    }
  })();
  const rememberNoTactics = matchId => {
    noTactics.add(matchId);
    try {
      localStorage.setItem(NO_TACTICS, JSON.stringify([...noTactics].slice(-2000)));
    } catch {
      // Read again next time
    }
  };

  const run = async () => {
    if (location.hostname !== 'app.playmfl.com') throw new Stop('Open app.playmfl.com, log in, and click the bookmark there.');
    if (!KEY) throw new Stop('This bookmark is out of date. Drag the new one from the tactics log on MFL Data, then click it again.');
    const wallet = walletOf();
    if (!wallet) throw new Stop('Log in to MFL first, then click the bookmark again.');

    say('Finding your clubs…', 'muted');
    const owned = await mfl(`/clubs?walletAddress=${encodeURIComponent(wallet)}`);
    const clubs = owned.map(item => item.club || item).filter(club => club && club.type !== 'ARENA' && !club.offChain);
    if (!clubs.length) throw new Stop('No clubs found on this wallet.');

    const plans = [];
    for (const club of clubs) {
      const details = await mfl(`/clubs/${club.id}`);
      const squadId = details.squads && details.squads[0] && details.squads[0].id;
      if (!squadId) continue;
      const listed = await mfl(`/matches?squadId=${squadId}&past=true&limit=${MAX_PER_CLUB + 5}`);
      const played = listed.filter(match => match.status === 'ENDED').sort((a, b) => b.startDate - a.startDate).slice(0, MAX_PER_CLUB);
      const known = await fetch(`${SITE}/api/tactics-import?clubId=${club.id}&key=${encodeURIComponent(KEY)}`).then(response => response.json()).catch(() => ({}));
      if (!known.success) throw new Stop(known.error || 'MFL Data is unreachable. Try again in a few minutes.');
      const imported = new Set(known.imported);
      const matches = played.filter(match => !imported.has(match.id) && !noTactics.has(match.id));
      say(`${club.name}: ${matches.length ? `${matches.length} to read` : 'up to date'}${imported.size ? ` · ${played.filter(match => imported.has(match.id)).length} imported before` : ''}`, 'muted');
      if (matches.length) plans.push({ club, squadId, matches });
    }
    if (!plans.length) {
      finish('Everything is imported already.', 'good');
      return;
    }

    say('Borrowing the MFL app’s login…', 'muted');
    const newest = plans[0].matches[0];
    const login = await borrowLogin(() => {
      const router = window.next && window.next.router;
      if (router && typeof router.push === 'function') router.push(`/matches/${newest.id}`).catch(() => {});
    });
    if (!login) throw new Stop("Couldn't get MFL's login. Reload this page and click the bookmark again.");

    let total = 0;
    for (const { club, squadId, matches } of plans) {
      if (cancelled) return;
      const line = say(`${club.name}: reading…`);
      const counts = { saved: 0, updated: 0, unchanged: 0, noTactics: 0, skipped: 0 };
      let refused = null;
      for (const [index, match] of matches.entries()) {
        if (cancelled) return;
        const home = match.homeSquad.id === squadId;
        line.textContent = `${club.name}: ${index + 1}/${matches.length} · ${day(match.startDate)} vs ${home ? match.awayTeamName : match.homeTeamName}…`;
        const report = await mfl(`/matches/${match.id}/report`, { Authorization: login });
        const ours = home ? report.home : report.away;
        const theirs = home ? report.away : report.home;
        if (!ours || !ours.formation) {
          // MFL shows tactics only to whoever owned the club for that match
          counts.noTactics++;
          rememberNoTactics(match.id);
          continue;
        }
        const response = await fetch(`${SITE}/api/tactics-import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: KEY,
            clubId: club.id,
            matchId: match.id,
            formation: tacticsOf(ours.formation),
            report: { ours: linesOf(ours), theirs: linesOf(theirs) },
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (response.status === 429) throw new Stop(result.error || 'MFL Data is busy. Try again in a few minutes.');
        if (!response.ok || !result.success) {
          refused = result.error || `MFL Data answered ${response.status}`;
          break;
        }
        if (result.status in counts) counts[result.status]++;
        else counts.skipped++;
      }
      total += counts.saved + counts.updated;
      const parts = [];
      if (counts.saved) parts.push(`${counts.saved} new`);
      if (counts.updated) parts.push(`${counts.updated} corrected`);
      if (counts.unchanged) parts.push(`${counts.unchanged} already right`);
      if (counts.noTactics) parts.push(`${counts.noTactics} not yours then`);
      if (counts.skipped) parts.push(`${counts.skipped} skipped`);
      if (refused) {
        line.textContent = `${club.name}: ${refused}`;
        line.style.color = COLOURS.bad;
      } else {
        line.textContent = `${club.name}: ${parts.join(', ') || 'nothing new'}`;
        line.style.color = counts.saved + counts.updated ? COLOURS.good : COLOURS.muted;
      }
    }
    finish(`Done: ${total} match${total === 1 ? '' : 'es'} logged.`, total ? 'good' : 'muted');
  };

  run().catch(error => {
    if (cancelled) return;
    if (error instanceof Stop) finish(error.message, error.message ? 'bad' : undefined);
    else finish(`Stopped: ${error && error.message ? error.message : error}`, 'bad');
  });
})();
