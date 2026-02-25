import { render, screen } from '@testing-library/react';
import App from './App';
import { fetchAppConfigFromURL, fetchData, fetchRosterData, fetchSettingsData, getAppConfigFromURL } from './Api';

jest.mock('./Api', () => ({
  ...jest.requireActual('./Api'),
  fetchData: jest.fn(),
  fetchRosterData: jest.fn(),
  fetchSettingsData: jest.fn(),
  fetchAppConfigFromURL: jest.fn(),
}));

test('renders loading state', () => {
  fetchData.mockImplementation(() => new Promise(() => {}));
  fetchRosterData.mockImplementation(() => new Promise(() => {}));
  fetchSettingsData.mockImplementation(() => new Promise(() => {}));
  fetchAppConfigFromURL.mockImplementation(() => new Promise(() => {}));
  render(<App />);
  expect(screen.getByText(/loading data/i)).toBeInTheDocument();
});
