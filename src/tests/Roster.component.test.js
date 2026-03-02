import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/dom';
import Roster from '../js/Roster';
import { fetchData, fetchExceptionsData, fetchRosterData, fetchSettingsData } from '../js/Api';

jest.mock('../js/Api', () => ({
  fetchData: jest.fn(),
  fetchExceptionsData: jest.fn(),
  fetchRosterData: jest.fn(),
  fetchSettingsData: jest.fn(),
}));

describe('Roster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders upcoming roster card with bowlers and handicap', async () => {
    const appConfig = { league: 'sgcc' };
    const futureDate = new Date(Date.UTC(2099, 0, 1));

    fetchRosterData.mockResolvedValue({
      data: [
        {
          league: 'sgcc',
          date: '01/Jan/2099',
          parsedDate: futureDate,
          opponent: 'Strikers',
          bowlers: [
            { name: 'Alice', status: 'YES', isReserve: false },
            { name: 'Bob', status: 'NO', isReserve: true },
          ],
        },
      ],
    });

    fetchData.mockResolvedValue({
      data: [
        { bowler: '🟢\u00A0\u00A0Alice', hdcp: 10, average: 180, totalGames: 20 },
        { bowler: '🟢\u00A0\u00A0Bob', hdcp: 7, average: 170, totalGames: 18 },
        { bowler: '🟢\u00A0\u00A0Charlie', hdcp: 11, average: 190, totalGames: 22 },
      ],
    });

    fetchSettingsData.mockResolvedValue({
      data: {
        season: '2026',
      },
    });

    fetchExceptionsData.mockResolvedValue({
      data: [
        {
          parsedDate: futureDate,
          bowlers: ['Charlie', 'Aaron'],
        },
      ],
    });

    render(<Roster appConfig={appConfig} />);

    await waitFor(() => {
      expect(screen.getByText('Team: Strikers')).toBeInTheDocument();
    });

    expect(fetchRosterData).toHaveBeenCalledWith(appConfig);
    expect(fetchData).toHaveBeenCalledWith(appConfig);
    expect(fetchSettingsData).toHaveBeenCalledWith(appConfig);
    expect(fetchExceptionsData).toHaveBeenCalledWith(appConfig, '2026');
    expect(screen.getByText('❌ Unable to Play')).toBeInTheDocument();
    expect(screen.getByText('Aaron')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Bob (Reserve)')).toBeInTheDocument();
    expect(screen.getByText('H 10')).toBeInTheDocument();
    expect(screen.getByLabelText('confirmed')).toBeInTheDocument();
    expect(screen.getByLabelText('pending response')).toBeInTheDocument();
    expect(screen.queryByLabelText('exception')).not.toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Bowlers for 01/Jan/2099' });
    const nameCells = Array.from(table.querySelectorAll('td.roster-item-name')).map((cell) => cell.textContent);
    expect(nameCells).toEqual(['Alice', 'Bob (Reserve)', 'Aaron', 'Charlie']);
    expect(within(table).getByText('Bob (Reserve)').closest('tr').nextElementSibling).toHaveClass('roster-item-exceptions-label');
  });

  test('handles roster fetch failure without crashing', async () => {
    const appConfig = { league: 'sgcc' };
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    fetchRosterData.mockRejectedValue(new Error('network down'));
    fetchData.mockResolvedValue({ data: [] });
    fetchSettingsData.mockResolvedValue({ data: null });
    fetchExceptionsData.mockResolvedValue({ data: [] });

    render(<Roster appConfig={appConfig} />);

    await waitFor(() => {
      expect(fetchRosterData).toHaveBeenCalledWith(appConfig);
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(screen.queryByText(/Team:/)).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  test('shows suggestions below reserve and above exceptions when main players are fewer than three', async () => {
    const appConfig = { league: 'sgcc' };
    const futureDate = new Date(Date.UTC(2099, 0, 8));

    fetchRosterData.mockResolvedValue({
      data: [
        {
          league: 'sgcc',
          date: '08/Jan/2099',
          parsedDate: futureDate,
          opponent: 'Lane Masters',
          bowlers: [
            { name: 'Alice', status: 'YES', isReserve: false },
            { name: 'Bob', status: 'NO', isReserve: true },
          ],
        },
      ],
    });

    fetchData.mockResolvedValue({
      data: [
        { bowler: '🟢\u00A0\u00A0Alice', active: true, hdcp: 10, average: 180, totalGames: 20 },
        { bowler: '🟢\u00A0\u00A0Bob', active: true, hdcp: 7, average: 170, totalGames: 18 },
        { bowler: '🟢\u00A0\u00A0Carol', active: true, hdcp: 11, average: 190, totalGames: 8 },
        { bowler: '🟢\u00A0\u00A0Derek', active: true, hdcp: 12, average: 175, totalGames: 6 },
      ],
    });

    fetchSettingsData.mockResolvedValue({
      data: {
        season: '2026',
      },
    });

    fetchExceptionsData.mockResolvedValue({
      data: [
        {
          parsedDate: futureDate,
          bowlers: ['Ethan'],
        },
      ],
    });

    render(<Roster appConfig={appConfig} />);

    await waitFor(() => {
      expect(screen.getByText('Team: Lane Masters')).toBeInTheDocument();
    });

    const table = screen.getByRole('table', { name: 'Bowlers for 08/Jan/2099' });
    const nameCells = Array.from(table.querySelectorAll('td.roster-item-name')).map((cell) => cell.textContent);

    expect(nameCells).toEqual(['Alice', 'Bob (Reserve)', '💡 Carol', '💡 Derek', 'Ethan']);
    expect(within(table).getAllByLabelText('suggested')).toHaveLength(2);
    expect(within(table).getByText('Bob (Reserve)').closest('tr').nextElementSibling).toHaveTextContent('💡 Carol');
    expect(within(table).getByText('💡 Derek').closest('tr').nextElementSibling).toHaveClass('roster-item-exceptions-label');
  });

  test('orders confirmed mains by hdcp, then average, then games, then score; pending stays alphabetical', async () => {
    const appConfig = { league: 'sgcc' };
    const futureDate = new Date(Date.UTC(2099, 0, 15));

    fetchRosterData.mockResolvedValue({
      data: [
        {
          league: 'sgcc',
          date: '15/Jan/2099',
          parsedDate: futureDate,
          opponent: 'Split Happens',
          bowlers: [
            { name: 'Alice', status: 'YES', isReserve: false },
            { name: 'Ben', status: 'YES', isReserve: false },
            { name: 'Carl', status: 'YES', isReserve: false },
            { name: 'Dane', status: 'YES', isReserve: false },
            { name: 'Maya', status: 'YES', isReserve: false },
            { name: 'Noah', status: 'NO', isReserve: false },
            { name: 'Zane', status: 'NO', isReserve: false },
            { name: 'Rico', status: 'YES', isReserve: true },
          ],
        },
      ],
    });

    fetchData.mockResolvedValue({
      data: [
        { bowler: '🟢\u00A0\u00A0Alice', active: true, hdcp: 10, average: 170, totalGames: 30, totalScore: 5100 },
        { bowler: '🟢\u00A0\u00A0Ben', active: true, hdcp: 10, average: 180, totalGames: 10, totalScore: 1800 },
        { bowler: '🟢\u00A0\u00A0Carl', active: true, hdcp: 10, average: 180, totalGames: 20, totalScore: 3500 },
        { bowler: '🟢\u00A0\u00A0Dane', active: true, hdcp: 10, average: 180, totalGames: 20, totalScore: 3600 },
        { bowler: '🟢\u00A0\u00A0Maya', active: true, hdcp: 8, average: 165, totalGames: 8, totalScore: 1320 },
        { bowler: '🟢\u00A0\u00A0Noah', active: true, hdcp: 7, average: 168, totalGames: 14, totalScore: 2352 },
        { bowler: '🟢\u00A0\u00A0Zane', active: true, hdcp: 6, average: 166, totalGames: 12, totalScore: 1992 },
        { bowler: '🟢\u00A0\u00A0Rico', active: true, hdcp: 6, average: 165, totalGames: 10, totalScore: 1650 },
      ],
    });

    fetchSettingsData.mockResolvedValue({
      data: {
        season: '2026',
      },
    });

    fetchExceptionsData.mockResolvedValue({ data: [] });

    render(<Roster appConfig={appConfig} />);

    await waitFor(() => {
      expect(screen.getByText('Team: Split Happens')).toBeInTheDocument();
    });

    const table = screen.getByRole('table', { name: 'Bowlers for 15/Jan/2099' });
    const nameCells = Array.from(table.querySelectorAll('td.roster-item-name')).map((cell) => cell.textContent);

    expect(nameCells).toEqual(['Alice', 'Ben', 'Carl', 'Dane', 'Maya', 'Noah', 'Zane', 'Rico (Reserve)']);
  });
});