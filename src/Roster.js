import React, { useEffect, useMemo, useState } from 'react';
import { fetchData, fetchRosterData } from './Api';

const SG_TIME_ZONE = 'Asia/Singapore';

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
        const [{ data }, { data: bowlersData }] = await Promise.all([
          fetchRosterData(appConfig),
          fetchData(appConfig),
        ]);
        if (!isCancelled) {
          setRosterRows(data);
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
          setBowlerStatsByName(statsMap);
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
    const upcoming = rosterRows.filter((row) => row.parsedDate >= today);

    if (appConfig.view === 'roster') {
      return upcoming.slice(0, 3);
    }

    return upcoming.slice(0, 3);
  }, [appConfig.view, rosterRows]);

  const formatDisplayDate = (dateValue, parsedDate) => {
    if (!parsedDate) return dateValue;
    const day = String(parsedDate.getUTCDate()).padStart(2, '0');
    const month = MONTH_SHORT[parsedDate.getUTCMonth()] || '';
    const year = parsedDate.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <section className="roster-container">
      <div className="roster-grid">
        {cards.map((card) => (
          <article className="roster-card" key={`${card.league}-${card.date}-${card.opponent}`}>
            <h3 className="roster-date">Date: {formatDisplayDate(card.date, card.parsedDate)}</h3>
            <p className="roster-opponent"><strong>Team: {card.opponent || 'TBD'}</strong></p>
            <table className="roster-bowlers-table" aria-label={`Bowlers for ${card.date}`}>
              <tbody>
              {[...card.bowlers]
                .sort((entryA, entryB) => {
                  if (entryA.isReserve && !entryB.isReserve) return 1;
                  if (!entryA.isReserve && entryB.isReserve) return -1;

                  const statsA = bowlerStatsByName[normalizeBowlerName(entryA.name).toLowerCase()] || { hdcp: -1, average: Number.MAX_SAFE_INTEGER, totalGames: -1 };
                  const statsB = bowlerStatsByName[normalizeBowlerName(entryB.name).toLowerCase()] || { hdcp: -1, average: Number.MAX_SAFE_INTEGER, totalGames: -1 };

                  const hdcpDiff = statsB.hdcp - statsA.hdcp;
                  if (hdcpDiff !== 0) return hdcpDiff;

                  const averageDiff = statsA.average - statsB.average;
                  if (averageDiff !== 0) return averageDiff;

                  return statsB.totalGames - statsA.totalGames;
                })
                .map((entry) => {
                  const stats = bowlerStatsByName[normalizeBowlerName(entry.name).toLowerCase()] || { hdcp: '-' };
                  const displayName = entry.isReserve
                    ? `${entry.name} (Reserve)`
                    : entry.name;
                  const isConfirmed = String(entry.status || '').trim().toUpperCase() === 'YES';
                  const statusIcon = isConfirmed ? '✅' : '?';
                  const statusClassName = isConfirmed ? 'status-confirmed' : 'status-pending';

                  return (
                    <tr className="roster-item" key={`${card.date}-${entry.name}-${entry.isReserve ? 'reserve' : 'main'}`}>
                      <td className="roster-item-name">{displayName}</td>
                      <td className="roster-item-hdcp"><span className="roster-hdcp-badge">H {stats.hdcp}</span></td>
                      <td className={`roster-item-status ${statusClassName}`} aria-label={isConfirmed ? 'confirmed' : 'pending response'}>
                        <span className={`roster-status-icon ${statusClassName}`}>{statusIcon}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Roster;
