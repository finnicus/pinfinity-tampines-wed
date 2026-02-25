import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useReactTable, getCoreRowModel, createColumnHelper } from '@tanstack/react-table';
import TimeAgo from 'react-timeago';
import { BOWLERS_SHEET_URL, FEMALE_AVERAGE_THRESHOLD, MALE_AVERAGE_THRESHOLD, MALE_MAX_HANDICAP, FEMALE_MAX_HANDICAP, REFRESH_INTERVAL } from './Data';
import './App.css';

const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((header, i) => row[header] = values[i] || '');
    return row;
  });
};

const columnHelper = createColumnHelper();

const columns = [
  columnHelper.accessor('bowler', {
    header: 'Bowler Name',
    cell: info => <span className="bowler-name">{info.getValue()}</span>,
    size: 100,
  }),
  columnHelper.accessor('hdcp', {
    header: 'Handicap',
    cell: info => <strong>{info.getValue()}</strong>,
    size: 30,
  }),
  columnHelper.accessor('totalGames', {
    header: 'Total Games',
    cell: info => info.getValue().toLocaleString(),
    size: 30,
  }),
  columnHelper.accessor('totalScore', {
    header: 'Total Score',
    cell: info => info.getValue().toLocaleString(),
    size: 50,
  }),
  columnHelper.accessor('average', {
    header: 'Average',
    cell: info => <span className="highlight">{info.getValue()}</span>,
    size: 50,
  }),
];

function App() {
  const [bowlersData, setBowlersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchBowlersData = useCallback(async () => {
    try {
      const response = await axios.get(BOWLERS_SHEET_URL);
      const parsedData = parseCSV(response.data);
      const bowlers = parsedData.map(row => {
        const gender = row.Gender || row.gender;
        const active = row.Active === 'YES' || row.active === 'yes';
        const statusIcon = active ? '🟢' : '🔴';
        
        // Calculate average from total score and games
        const totalGames = parseInt(row['Total Games'] || row['total games'] || 0);
        const totalScore = parseInt(row['Total Score'] || row['total score'] || 0);
        const average = totalGames > 0 ? Math.floor(totalScore / totalGames) : 0;
        
        // Calculate handicap based on gender
        let hdcp = 0;
        if (gender.toLowerCase() === 'M' || gender.toLowerCase() === 'm') {
          hdcp = Math.floor((MALE_AVERAGE_THRESHOLD - Math.floor(average))*0.5);
          hdcp = Math.max(0, hdcp);
          hdcp = Math.min(MALE_MAX_HANDICAP, hdcp);
        }
        else {
          hdcp = Math.floor((FEMALE_AVERAGE_THRESHOLD - Math.floor(average))*0.5);
          hdcp = Math.max(0, hdcp);
          hdcp = Math.min(FEMALE_MAX_HANDICAP, hdcp);
        }
        
        return {
          bowler: `${statusIcon} ${row.Bowler || row.bowler} [${gender}]`,
          gender,
          active,
          hdcp,
          totalGames,
          totalScore,
          average
        };
      }).sort((a, b) => {
        // 1. Active bowlers first
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        
        // For active bowlers only, apply different sorting based on hdcp
        if (a.active && b.active) {
          // If both have hdcp = 0, sort by average descending
          if (a.hdcp === 0 && b.hdcp === 0) {
            return b.average - a.average;
          }
          // If both have hdcp != 0, sort by total games descending
          if (a.hdcp !== 0 && b.hdcp !== 0) {
            return b.totalGames - a.totalGames;
          }
          // If one has hdcp = 0 and other doesn't, hdcp = 0 comes first
          if (a.hdcp === 0 && b.hdcp !== 0) return -1;
          if (a.hdcp !== 0 && b.hdcp === 0) return 1;
        }
        
        // For inactive bowlers, sort by average descending as fallback
        return b.average - a.average;
      });
      setBowlersData(bowlers);
      const updateTime = new Date();
      setLastUpdated(updateTime);
      console.log(`Bowlers data updated from CSV at: ${updateTime.toLocaleString()}`);
    } catch (error) {
      console.error('Error fetching bowlers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBowlersData();
    
    // Set up interval to update every 3 minutes (180,000 ms)
    const intervalId = setInterval(fetchBowlersData, REFRESH_INTERVAL);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchBowlersData]);

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /> Loading bowlers...</div>;
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-content">
          <h1>Pinfinity Tampines Wednesday</h1>
          <div className="live-badge">
            Last Updated: {lastUpdated ? <TimeAgo date={lastUpdated} /> : 'Loading...'}
          </div>
        </div>
      </header>

      <main className="main-content">
        <BowlersTable data={bowlersData} />
      </main>
    </div>
  );
}

function BowlersTable({ data }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      {/* DESKTOP: Simple Table with Grid Lines */}
      <div className="table-container desktop">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : header.column.columnDef.header}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {cell.column.columnDef.cell(cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  );
}

export default App;
