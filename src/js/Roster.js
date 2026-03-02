import React, { useEffect, useMemo, useState } from 'react';
import { fetchData, fetchExceptionsData, fetchRosterData, fetchSettingsData } from './Api';

const SG_TIME_ZONE = 'Asia/Singapore';
const MAIN_PLAYERS_REQUIRED = 3;

const MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toDateKey = (date) => {
  if (!date) return '';
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

const getSingaporeTodayUtc = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SG_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date());

  const day = parseInt(parts.find((part) => part.type === 'day')?.value || '1', 10);
  const monthText = String(parts.find((part) => part.type === 'month')?.value || 'Jan').toLowerCase();
  const year = parseInt(parts.find((part) => part.type === 'year')?.value || '1970', 10);
  const month = MONTH_INDEX[monthText] ?? 0;

  return new Date(Date.UTC(year, month, day));
};

function Roster({ appConfig }) {
  const [rosterRows, setRosterRows] = useState([]);
  const [bowlerStatsByName, setBowlerStatsByName] = useState({});
  const [activeBowlers, setActiveBowlers] = useState([]);

  const normalizeBowlerName = (name) => (
    String(name || '')
      .replace(/^[🟢🔴]\s*/u, '')
      .replace(/^\u00A0+/, '')
      .replace(/\s+/g, ' ')
      .trim()
  );

  useEffect(() => {
    let isCancelled = false;

    const loadRosterData = async () => {
      try {
        const [rosterResult, bowlersResult, settingsResult] = await Promise.allSettled([
          fetchRosterData(appConfig),
          fetchData(appConfig),
          fetchSettingsData(appConfig),
        ]);

        if (rosterResult.status !== 'fulfilled') {
          throw rosterResult.reason;
        }

        const data = rosterResult.value?.data || [];
        const bowlersData = bowlersResult.status === 'fulfilled'
          ? (bowlersResult.value?.data || [])
          : [];
        const settingsData = settingsResult.status === 'fulfilled'
          ? (settingsResult.value?.data || null)
          : null;

        let exceptionsData = [];
        try {
          const exceptionsResult = await fetchExceptionsData(appConfig, settingsData?.season || '');
          exceptionsData = exceptionsResult?.data || [];
        } catch (error) {
          console.warn('Error fetching exceptions data:', error);
        }

        if (!isCancelled) {
          const exceptionsByDate = exceptionsData.reduce((acc, row) => {
            const key = toDateKey(row.parsedDate);
            if (!key) return acc;

            acc[key] = [...(acc[key] || []), ...row.bowlers];
            return acc;
          }, {});

          const rosterWithExceptions = data.map((row) => {
            const key = toDateKey(row.parsedDate);
            const exceptionNames = exceptionsByDate[key] || [];
            const existingNames = new Set(
              (row.bowlers || []).map((entry) => normalizeBowlerName(entry.name).toLowerCase()).filter(Boolean)
            );

            const appendedExceptions = exceptionNames
              .map((name) => normalizeBowlerName(name))
              .filter((name) => name)
              .filter((name) => !existingNames.has(name.toLowerCase()))
              .map((name) => ({
                name,
                status: 'EXCEPTION',
                isReserve: false,
                isException: true,
              }));

            return {
              ...row,
              bowlers: [...(row.bowlers || []), ...appendedExceptions],
            };
          });

          setRosterRows(rosterWithExceptions);
          const statsMap = bowlersData.reduce((acc, bowler) => {
            const key = normalizeBowlerName(bowler.bowler).toLowerCase();
            if (!key) return acc;
            acc[key] = {
              hdcp: Number(bowler.hdcp) || 0,
              average: Number(bowler.average) || 0,
              totalGames: Number(bowler.totalGames) || 0,
            };
            return acc;
          }, {});

          const normalizedActiveBowlers = bowlersData
            .filter((bowler) => bowler.active !== false)
            .map((bowler) => ({
              name: normalizeBowlerName(bowler.bowler),
              totalGames: Number(bowler.totalGames) || 0,
              average: Number(bowler.average) || 0,
            }))
            .filter((bowler) => bowler.name);

          setBowlerStatsByName(statsMap);
          setActiveBowlers(normalizedActiveBowlers);
        }
      } catch (error) {
        console.error('Error fetching roster:', error);
      }
    };

    loadRosterData();

    return () => {
      isCancelled = true;
    };
  }, [appConfig]);

  const cards = useMemo(() => {
    const today = getSingaporeTodayUtc();
    return rosterRows.filter((row) => row.parsedDate >= today && Array.isArray(row.bowlers) && row.bowlers.length > 0);
  }, [rosterRows]);

  const formatDisplayDate = (dateValue, parsedDate) => {
    if (!parsedDate) return dateValue;
    const day = String(parsedDate.getUTCDate()).padStart(2, '0');
    const month = MONTH_SHORT[parsedDate.getUTCMonth()] || '';
    const year = parsedDate.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const sortByName = (entryA, entryB) => normalizeBowlerName(entryA.name).localeCompare(normalizeBowlerName(entryB.name));

  const pickSuggestedMainBowlers = (card, missingCount) => {
    if (missingCount <= 0) return [];

    const unavailableNames = new Set(
      (card.bowlers || [])
        .map((entry) => normalizeBowlerName(entry.name).toLowerCase())
        .filter(Boolean)
    );

    const candidates = activeBowlers
      .filter((bowler) => !unavailableNames.has(bowler.name.toLowerCase()))
      .sort((entryA, entryB) => {
        const gamesDiff = entryA.totalGames - entryB.totalGames;
        if (gamesDiff !== 0) return gamesDiff;

        const averageDiff = entryA.average - entryB.average;
        if (averageDiff !== 0) return averageDiff;

        return entryA.name.localeCompare(entryB.name);
      });

    return candidates.slice(0, missingCount).map((bowler) => ({
      ...bowler,
      isSuggestion: true,
      status: 'SUGGESTED',
    }));
  };

  return (
    <section className="roster-container">
      <div className="roster-grid">
        {cards.map((card, index) => (
          <article className={`roster-card ${index === 0 ? 'roster-card-next' : ''}`} key={`${card.league}-${card.date}-${card.opponent}`}>
            <h3 className="roster-date">Date: {formatDisplayDate(card.date, card.parsedDate)}</h3>
            <p className="roster-opponent"><strong>Team: {card.opponent || 'TBD'}</strong></p>
            <table className="roster-bowlers-table" aria-label={`Bowlers for ${card.date}`}>
              <tbody>
              {(() => {
                const confirmedEntries = [...card.bowlers]
                  .filter((entry) => {
                    if (entry.isReserve || entry.isException) return false;
                    const statusText = String(entry.status || '').trim().toUpperCase();
                    return statusText === 'YES';
                  })
                  .sort(sortByName);
                const pendingEntries = [...card.bowlers]
                  .filter((entry) => {
                    if (entry.isReserve || entry.isException) return false;
                    const statusText = String(entry.status || '').trim().toUpperCase();
                    return statusText !== 'YES';
                  })
                  .sort(sortByName);
                const reserveEntries = [...card.bowlers]
                  .filter((entry) => entry.isReserve)
                  .sort(sortByName);
                const exceptionEntries = [...card.bowlers]
                  .filter((entry) => entry.isException || String(entry.status || '').trim().toUpperCase() === 'EXCEPTION')
                  .sort(sortByName);

                const missingMainCount = Math.max(MAIN_PLAYERS_REQUIRED - (confirmedEntries.length + pendingEntries.length), 0);
                const suggestionEntries = pickSuggestedMainBowlers(card, missingMainCount).sort(sortByName);

                const orderedEntries = [
                  ...confirmedEntries,
                  ...pendingEntries,
                  ...reserveEntries,
                  ...suggestionEntries,
                  ...(exceptionEntries.length > 0 ? [{ isExceptionLabel: true, key: `${card.date}-exceptions-label` }] : []),
                  ...exceptionEntries,
                ];

                return orderedEntries.map((entry, entryIndex) => {
                  if (entry.isExceptionLabel) {
                    return (
                      <tr className="roster-item roster-item-exceptions-label" key={entry.key}>
                        <td colSpan={3} className="roster-exceptions-label-cell">❌ Unable to Play</td>
                      </tr>
                    );
                  }

                  const stats = bowlerStatsByName[normalizeBowlerName(entry.name).toLowerCase()] || { hdcp: '-' };
                  const displayName = entry.isReserve
                    ? `${entry.name} (Reserve)`
                    : (entry.isSuggestion ? `💡 ${entry.name}` : entry.name);
                  const statusText = String(entry.status || '').trim().toUpperCase();
                  const isException = entry.isException || statusText === 'EXCEPTION';
                  const isSuggestion = statusText === 'SUGGESTED' || entry.isSuggestion;
                  const isConfirmed = statusText === 'YES';
                  const statusIcon = isException ? '' : (isSuggestion ? '💡' : (isConfirmed ? '✅' : '?'));
                  const statusClassName = isException
                    ? 'status-exception'
                    : (isConfirmed ? 'status-confirmed' : 'status-pending');
                  const statusAriaLabel = isException
                    ? undefined
                    : (isSuggestion ? 'suggested' : (isConfirmed ? 'confirmed' : 'pending response'));

                  return (
                    <tr className="roster-item" key={`${card.date}-${entry.name}-${entry.isReserve ? 'reserve' : 'main'}-${entryIndex}`}>
                      <td className="roster-item-name">{displayName}</td>
                      <td className="roster-item-hdcp"><span className="roster-hdcp-badge">H {stats.hdcp}</span></td>
                      <td className={`roster-item-status ${statusClassName}`} aria-label={statusAriaLabel}>
                        {!isException && <span className={`roster-status-icon ${statusClassName}`}>{statusIcon}</span>}
                      </td>
                    </tr>
                  );
                });
              })()}
              </tbody>
            </table>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Roster;
