import React, { useEffect, useMemo, useState } from 'react';
import { fetchData, fetchExceptionsData, fetchRosterData, fetchSettingsData } from './Api';

const SG_TIME_ZONE = 'Asia/Singapore';
const SLOT_ORDER = ['A', 'B', 'C', 'Reserved'];
const MAIN_SLOT_ORDER = ['A', 'B', 'C'];
const STATUS_EXCEPTION = 'EXCEPTION';
const GROUP_A_NAMES = new Set(['dan', 'bernard', 'jacob', 'daniel']);
const WILLIAM_NAME = 'william';
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getSingaporeTodayUtc = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SG_TIME_ZONE,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date());

  const day = parseInt(parts.find((part) => part.type === 'day')?.value || '1', 10);
  const month = parseInt(parts.find((part) => part.type === 'month')?.value || '1', 10);
  const year = parseInt(parts.find((part) => part.type === 'year')?.value || '1970', 10);

  return new Date(Date.UTC(year, month - 1, day));
};

const normalizeName = (name) => (
  String(name || '')
    .replace(/^[🟢🔴]\s*/u, '')
    .replace(/^\u00A0+/, '')
    .replace(/\s+/g, ' ')
    .trim()
);

const monthKeyForDate = (date) => `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;

const toDateKey = (date) => {
  if (!date) return '';
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

const getParticipationCount = (match) => (
  (match?.bowlers || []).filter((entry) => !entry.isReserve).length
);

const isMainEntry = (entry) => !entry?.isReserve && !entry?.isException && String(entry?.status || '').trim().toUpperCase() !== STATUS_EXCEPTION;

const pickLeastGames = (candidates) => {
  if (!candidates || candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    const gamesDiff = a.totalGames - b.totalGames;
    if (gamesDiff !== 0) return gamesDiff;

    const averageDiff = a.average - b.average;
    if (averageDiff !== 0) return averageDiff;

    return a.name.localeCompare(b.name);
  });
  return sorted[0];
};

/**
 * Build a roster-card style view for upcoming matches so Suggestion and Roster
 * evaluate participation the same way.
 *
 * Plain-language summary:
 * - Start with upcoming schedule rows.
 * - Add exception bowlers to the same date.
 * - Treat the merged result as what the roster "really looks like" for selection logic.
 */
const buildUpcomingRosterCards = (upcoming, exceptionsData) => {
  const exceptionsByDate = exceptionsData.reduce((acc, row) => {
    const key = toDateKey(row.parsedDate);
    if (!key) return acc;

    acc[key] = [...(acc[key] || []), ...row.bowlers];
    return acc;
  }, {});

  return upcoming.map((match, upcomingIndex) => {
    const key = toDateKey(match.parsedDate);
    const exceptionNames = exceptionsByDate[key] || [];
    const baseBowlers = Array.isArray(match.bowlers)
      ? match.bowlers
      : Object.values(match.slots || {})
        .filter((entry) => normalizeName(entry?.name))
        .map((entry) => ({
          slot: entry.slot,
          name: normalizeName(entry.name),
          status: entry.status,
          isReserve: Boolean(entry.isReserve),
        }));

    const existingNames = new Set(
      baseBowlers.map((entry) => normalizeName(entry.name).toLowerCase()).filter(Boolean)
    );

    const appendedExceptions = exceptionNames
      .map((name) => normalizeName(name))
      .filter((name) => name)
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name) => ({
        name,
        status: STATUS_EXCEPTION,
        isReserve: false,
        isException: true,
      }));

    return {
      ...match,
      upcomingIndex,
      bowlers: [...baseBowlers, ...appendedExceptions],
    };
  });
};

/**
 * Decide which upcoming match should receive suggestions.
 *
 * Business rule in plain language:
 * 1) Find the last upcoming roster card where participation exists (excluding reserves).
 * 2) If that card has fewer than 3 main bowlers, stop (no suggestion card shown).
 * 3) Otherwise, suggest for the immediate next upcoming match.
 */
const pickNextSuggestionMatch = (upcoming) => {
  const rosterCards = upcoming.filter((match) => getParticipationCount(match) > 0);
  const lastRosterCard = rosterCards.length > 0 ? rosterCards[rosterCards.length - 1] : null;

  const mainBowlerCountInLastRosterCard = lastRosterCard
    ? (lastRosterCard.bowlers || []).filter(isMainEntry).length
    : 0;

  if (!lastRosterCard || mainBowlerCountInLastRosterCard < 3) {
    return null;
  }

  return upcoming[lastRosterCard.upcomingIndex + 1] || null;
};

function Suggestion({ appConfig }) {
  const [settings, setSettings] = useState(null);
  const [nextMatch, setNextMatch] = useState(null);
  const [bowlerPool, setBowlerPool] = useState([]);
  const [rosterRows, setRosterRows] = useState([]);
  const [bowlerStatsByName, setBowlerStatsByName] = useState({});

  useEffect(() => {
    let cancelled = false;

    const loadSuggestionData = async () => {
      try {
        const [{ data: settingsData }, { data: rosterData }, { data: bowlersData }] = await Promise.all([
          fetchSettingsData(appConfig),
          fetchRosterData(appConfig),
          fetchData(appConfig),
        ]);

        if (cancelled) return;

        setSettings(settingsData);
        setRosterRows(rosterData);

        let exceptionsData = [];
        try {
          const exceptionsResult = await fetchExceptionsData(appConfig, settingsData?.season || '');
          exceptionsData = exceptionsResult?.data || [];
        } catch (error) {
          console.warn('Error fetching exceptions data:', error);
        }

        const additionalGamesByName = rosterData.reduce((acc, match) => {
          const slots = [match?.slots?.A, match?.slots?.B, match?.slots?.C];
          slots.forEach((slot) => {
            const name = normalizeName(slot?.name).toLowerCase();
            const isYes = String(slot?.status || '').trim().toUpperCase() === 'YES';
            if (!name || !isYes) return;
            acc[name] = (acc[name] || 0) + 4;
          });
          return acc;
        }, {});

        const today = getSingaporeTodayUtc();
        const upcoming = rosterData
          .filter((match) => match.parsedDate >= today)
          .sort((a, b) => a.parsedDate - b.parsedDate);

        const upcomingAsRosterCards = buildUpcomingRosterCards(upcoming, exceptionsData);
        setNextMatch(pickNextSuggestionMatch(upcomingAsRosterCards));

        const activeBowlers = bowlersData
          .filter((bowler) => bowler.active)
          .map((bowler) => ({
            name: normalizeName(bowler.bowler),
            hdcp: Number(bowler.hdcp) || 0,
            average: Number(bowler.average) || 0,
            totalGames: (Number(bowler.totalGames) || 0) + (additionalGamesByName[normalizeName(bowler.bowler).toLowerCase()] || 0),
          }));

        const statsMap = bowlersData.reduce((acc, bowler) => {
          const key = normalizeName(bowler.bowler).toLowerCase();
          if (!key) return acc;
          acc[key] = {
            hdcp: Number(bowler.hdcp) || 0,
            average: Number(bowler.average) || 0,
            totalGames: Number(bowler.totalGames) || 0,
          };
          return acc;
        }, {});

        setBowlerPool(activeBowlers);
        setBowlerStatsByName(statsMap);
      } catch (error) {
        console.error('Error generating suggestions:', error);
      }
    };

    loadSuggestionData();

    return () => {
      cancelled = true;
    };
  }, [appConfig]);

  const suggestions = useMemo(() => {
    if (!settings || !nextMatch) return [];

    const monthKey = monthKeyForDate(nextMatch.parsedDate);
    const williamMonthlyAssigned = MAIN_SLOT_ORDER
      .map((slotKey) => nextMatch.slots?.[slotKey])
      .filter((slot) => normalizeName(slot?.name).toLowerCase() === WILLIAM_NAME)
      .length;
    let williamMonthlyGenerated = 0;

    const alreadyChosen = new Set(
      Object.values(nextMatch.slots || {})
        .map((slot) => normalizeName(slot.name).toLowerCase())
        .filter(Boolean)
    );

    const availableBase = bowlerPool.filter((bowler) => !alreadyChosen.has(bowler.name.toLowerCase()));

    const existingRosterForMonth = rosterRows.filter((match) => {
      if (!match?.parsedDate) return false;
      return monthKeyForDate(match.parsedDate) === monthKey;
    });

    const williamExistingGamesInMonth = existingRosterForMonth.reduce((count, match) => {
      const entries = MAIN_SLOT_ORDER.map((slotKey) => match.slots?.[slotKey]);
      return count + entries.filter((entry) => normalizeName(entry.name).toLowerCase() === WILLIAM_NAME).length;
    }, 0);

    const canUseWilliam = () => (williamExistingGamesInMonth + williamMonthlyAssigned + williamMonthlyGenerated) < 1;

    /**
     * Slot-level suggestion algorithm in plain language:
     * - If slot is already filled, keep that name.
     * - If slot is manual, skip auto-pick.
     * - Otherwise choose the fairest available bowler (least games first, with tie-breakers).
     * - Apply special rules for Anchor / Group+Least / William restrictions.
     * - Never duplicate a bowler in the same suggested lineup.
     */
    const pickForLeast = (slotKey) => {
      let candidates = availableBase.filter((bowler) => !alreadyChosen.has(bowler.name.toLowerCase()));
      if ((slotKey === 'C' || slotKey === 'Reserved')) {
        candidates = candidates.filter((bowler) => bowler.name.toLowerCase() !== WILLIAM_NAME);
      }
      return pickLeastGames(candidates);
    };

    const generated = SLOT_ORDER.map((slotKey) => {
      const currentEntry = nextMatch.slots?.[slotKey];
      const hasAssigned = Boolean(normalizeName(currentEntry?.name));
      const mode = String(settings?.[slotKey] || '').toUpperCase();
      const normalizedMode = mode.replace(/\s+/g, '').replace(';', ',');

      if (hasAssigned) {
        return {
          slot: slotKey,
          mode,
          suggestion: normalizeName(currentEntry.name),
          generated: false,
          note: 'Already assigned',
        };
      }

      if (normalizedMode === 'MANUAL') {
        return {
          slot: slotKey,
          mode,
          suggestion: '-',
          generated: false,
          note: 'Manual - skipped',
        };
      }

      let selected = null;

      if (normalizedMode === 'ANCHOR') {
        let candidates = availableBase
          .filter((bowler) => !alreadyChosen.has(bowler.name.toLowerCase()))
          .filter((bowler) => bowler.hdcp === 0);

        if (slotKey === 'A') {
          candidates = candidates.filter((bowler) => bowler.name.toLowerCase() !== WILLIAM_NAME);
        }

        selected = pickLeastGames(candidates);
      } else if (normalizedMode === 'GROUP,LEAST' || normalizedMode === 'GROUP_LEAST') {
        const slotAName = normalizeName(nextMatch.slots?.A?.name).toLowerCase();

        const normalCandidates = availableBase.filter((bowler) => !alreadyChosen.has(bowler.name.toLowerCase()));
        const william = normalCandidates.find((bowler) => bowler.name.toLowerCase() === WILLIAM_NAME) || null;

        if (GROUP_A_NAMES.has(slotAName) && william && canUseWilliam()) {
          const leastCandidate = pickLeastGames(normalCandidates);
          if (leastCandidate && leastCandidate.name.toLowerCase() === WILLIAM_NAME) {
            selected = william;
          }
        }

        if (!selected) {
          selected = pickLeastGames(normalCandidates);
        }
      } else {
        selected = pickForLeast(slotKey);
      }

      if (selected) {
        alreadyChosen.add(selected.name.toLowerCase());
        if (selected.name.toLowerCase() === WILLIAM_NAME) {
          williamMonthlyGenerated += 1;
        }
      }

      return {
        slot: slotKey,
        mode,
        suggestion: selected ? selected.name : '-',
        generated: Boolean(selected),
        note: selected ? 'Generated' : 'No eligible bowler',
      };
    });

    return generated;
  }, [bowlerPool, nextMatch, rosterRows, settings]);

  const formatDisplayDate = (parsedDate) => {
    if (!parsedDate) return '';
    const day = String(parsedDate.getUTCDate()).padStart(2, '0');
    const month = MONTH_SHORT[parsedDate.getUTCMonth()] || '';
    const year = parsedDate.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const sortedSuggestions = useMemo(() => {
    return suggestions
      .map((item) => {
        const isReserve = item.slot === 'Reserved';
        const baseName = normalizeName(item.suggestion);
        const stats = bowlerStatsByName[baseName.toLowerCase()] || {
          hdcp: -1,
          average: Number.MAX_SAFE_INTEGER,
          totalGames: -1,
        };

        return {
          ...item,
          isReserve,
          displayName: isReserve && item.suggestion !== '-' ? `${item.suggestion} (Reserve)` : item.suggestion,
          hdcpValue: item.suggestion === '-' ? '-' : stats.hdcp,
          sortHdcp: stats.hdcp,
          sortAverage: stats.average,
          sortGames: stats.totalGames,
        };
      })
      .sort((a, b) => {
        if (a.isReserve && !b.isReserve) return 1;
        if (!a.isReserve && b.isReserve) return -1;

        const hdcpDiff = b.sortHdcp - a.sortHdcp;
        if (hdcpDiff !== 0) return hdcpDiff;

        const averageDiff = a.sortAverage - b.sortAverage;
        if (averageDiff !== 0) return averageDiff;

        return b.sortGames - a.sortGames;
      });
  }, [bowlerStatsByName, suggestions]);

  if (!nextMatch || !settings) {
    return null;
  }

  return (
    <section className="roster-container suggestion-wrap">
      <article className="roster-card suggestion-card">
        <p className="suggestion-label">💡 Suggestion</p>
        <h3 className="roster-date">Date: {formatDisplayDate(nextMatch.parsedDate)}</h3>
        <p className="roster-opponent"><strong>Team: {nextMatch.opponent || 'TBD'}</strong></p>
        <table className="roster-bowlers-table suggestion-table" aria-label={`Suggestions for ${nextMatch.date}`}>
          <tbody>
            {sortedSuggestions.map((item) => {
              return (
                <tr className="roster-item" key={`${nextMatch.date}-${item.slot}`}>
                  <td className="roster-item-name">{item.displayName}</td>
                  <td className="roster-item-hdcp"><span className="roster-hdcp-badge">H {item.hdcpValue}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </article>
    </section>
  );
}

export default Suggestion;
