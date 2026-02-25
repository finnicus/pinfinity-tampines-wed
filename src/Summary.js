import React, { useState, useEffect, useCallback } from 'react';
import { useReactTable, getCoreRowModel, createColumnHelper } from '@tanstack/react-table';
import { fetchData } from './Api';

const columnHelper = createColumnHelper();

const columns = [
  columnHelper.accessor('bowler', {
    header: 'Bowler',
    cell: info => {
      const genderClass = info.row.original.gender === 'F' ? 'female-name' : 'male-name';
      return <span className={`bowler-name ${genderClass}`}>{info.getValue()}</span>;
    },
    size: 100,
  }),
  columnHelper.accessor('hdcp', {
    header: 'Hdcp',
    cell: info => <strong>{info.getValue()}</strong>,
    size: 30,
  }),
  columnHelper.accessor('totalGames', {
    header: 'Games',
    cell: info => info.getValue().toLocaleString(),
    size: 30,
  }),
  columnHelper.accessor('totalScore', {
    header: 'Score',
    cell: info => info.getValue().toLocaleString(),
    size: 50,
  }),
  columnHelper.accessor('average', {
    header: 'Avg',
    cell: info => <span className="highlight">{info.getValue()}</span>,
    size: 50,
  }),
];

function Summary({ appConfig, onLoadingChange, onLastUpdatedChange }) {
  const [data, setData] = useState([]);

  const loadBowlersData = useCallback(async () => {
    try {
      const { data: bowlersData, updatedAt, source } = await fetchData(appConfig);
      setData(bowlersData);
      onLastUpdatedChange(updatedAt);
      const logMessage = source === 'dummy'
        ? `Dummy bowlers data loaded at: ${updatedAt.toLocaleString()}`
        : `Bowlers data updated from CSV at: ${updatedAt.toLocaleString()}`;
      console.log(logMessage);
    } catch (error) {
      console.error('Error fetching bowlers:', error);
    } finally {
      onLoadingChange(false);
    }
  }, [appConfig, onLastUpdatedChange, onLoadingChange]);

  useEffect(() => {
    loadBowlersData();

    const intervalId = setInterval(loadBowlersData, appConfig.refreshInterval);
    return () => clearInterval(intervalId);
  }, [appConfig.refreshInterval, loadBowlersData]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="table-container">
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

export default Summary;