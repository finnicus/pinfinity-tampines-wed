import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import App from '../js/App';
import { fetchAppConfigFromURL, fetchData, fetchRosterData, fetchSettingsData, getAppConfigFromURL } from '../js/Api';

jest.mock('../js/Summary', () => () => null);
jest.mock('../js/Roster', () => () => null);
jest.mock('../js/Suggestion', () => () => null);

jest.mock('../js/Api', () => ({
  ...jest.requireActual('../js/Api'),
  fetchData: jest.fn(),
  fetchRosterData: jest.fn(),
  fetchSettingsData: jest.fn(),
  fetchAppConfigFromURL: jest.fn(),
  getAppConfigFromURL: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const baseConfig = {
  league: 'dummy',
  view: 'default',
  title: 'Generic League',
  logo: 'generic',
  useDummyData: true,
  refreshInterval: 300000,
};

test('renders loading state', () => {
  getAppConfigFromURL.mockReturnValue(baseConfig);
  fetchData.mockImplementation(() => new Promise(() => {}));
  fetchRosterData.mockImplementation(() => new Promise(() => {}));
  fetchSettingsData.mockImplementation(() => new Promise(() => {}));
  fetchAppConfigFromURL.mockImplementation(() => new Promise(() => {}));
  render(<App />);
  expect(screen.getByText(/loading data/i)).toBeInTheDocument();
});

test('uses tessensohn logo when league is tessensohn', async () => {
  const tessensohnConfig = {
    league: 'tessensohn',
    view: 'default',
    title: 'Tessensohn League',
    logo: 'tessensohn',
    useDummyData: false,
    refreshInterval: 300000,
  };

  getAppConfigFromURL.mockReturnValue(tessensohnConfig);
  fetchAppConfigFromURL.mockResolvedValue(tessensohnConfig);

  render(<App />);

  const logoImage = await screen.findByAltText('Tessensohn League logo');
  expect(logoImage).toHaveAttribute('src', expect.stringContaining('tessensohn.png'));
});

test('auto-refreshes after 30 minutes of inactivity', () => {
  jest.useFakeTimers();
  const originalLocation = window.location;
  const reloadMock = jest.fn();

  delete window.location;
  window.location = {
    ...originalLocation,
    reload: reloadMock,
  };

  getAppConfigFromURL.mockReturnValue(baseConfig);
  fetchAppConfigFromURL.mockResolvedValue(baseConfig);

  render(<App />);

  act(() => {
    jest.advanceTimersByTime(30 * 60 * 1000);
  });

  expect(reloadMock).toHaveBeenCalledTimes(1);

  window.location = originalLocation;
  jest.useRealTimers();
});

test('registers and cleans up idle activity listeners', () => {
  const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
  const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

  getAppConfigFromURL.mockReturnValue(baseConfig);
  fetchAppConfigFromURL.mockResolvedValue(baseConfig);

  const { unmount } = render(<App />);

  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((eventName) => {
    expect(addEventListenerSpy).toHaveBeenCalledWith(eventName, expect.any(Function), { passive: true });
  });

  unmount();

  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((eventName) => {
    expect(removeEventListenerSpy).toHaveBeenCalledWith(eventName, expect.any(Function));
  });

  addEventListenerSpy.mockRestore();
  removeEventListenerSpy.mockRestore();
});
