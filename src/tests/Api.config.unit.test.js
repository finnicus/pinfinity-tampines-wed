import axios from 'axios';
import {
  fetchAppConfigFromURL,
  getAppConfigFromURL,
  getAppConfigFromUrl,
} from '../js/Api';

jest.mock('axios');

describe('app config helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getAppConfigFromURL returns dummy defaults when query is empty', () => {
    const config = getAppConfigFromURL('');

    expect(config.league).toBe('dummy');
    expect(config.view).toBe('default');
    expect(config.title).toBe('Generic League');
    expect(config.logo).toBe('generic');
    expect(config.useDummyData).toBe(true);
    expect(config.refreshInterval).toBe(300000);
  });

  test('getAppConfigFromURL normalizes query params and alias returns same output', () => {
    const config = getAppConfigFromURL('?league= SGCC &view=  compact  ');
    const aliasConfig = getAppConfigFromUrl('?league= SGCC &view=  compact  ');

    expect(config.league).toBe('sgcc');
    expect(config.view).toBe('compact');
    expect(config.title).toBe('Sgcc');
    expect(config.logo).toBe('sgcc');
    expect(config.useDummyData).toBe(false);
    expect(aliasConfig).toEqual(config);
  });

  test('getAppConfigFromURL uses tessensohn logo when league is in query string', () => {
    const config = getAppConfigFromURL('?league=tessensohn');

    expect(config.league).toBe('tessensohn');
    expect(config.logo).toBe('tessensohn');
    expect(config.useDummyData).toBe(false);
  });

  test('getAppConfigFromURL reads league from hash fragment format', () => {
    const config = getAppConfigFromURL('#/?league=tessensohn');

    expect(config.league).toBe('tessensohn');
    expect(config.logo).toBe('tessensohn');
    expect(config.useDummyData).toBe(false);
  });

  test('fetchAppConfigFromURL returns base config for dummy league without network call', async () => {
    const config = await fetchAppConfigFromURL('?league=dummy');

    expect(config.useDummyData).toBe(true);
    expect(config.title).toBe('Generic League');
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('fetchAppConfigFromURL applies title from settings for non-dummy league', async () => {
    axios.get.mockResolvedValue({
      data: [
        'League,Active,A,B,C,Reserved,Season,Title',
        'sgcc,TRUE,LEAST,LEAST,LEAST,LEAST,2026,SGCC Prime League',
      ].join('\n'),
    });

    const config = await fetchAppConfigFromURL('?league=sgcc');

    expect(config.league).toBe('sgcc');
    expect(config.useDummyData).toBe(false);
    expect(config.logo).toBe('sgcc');
    expect(config.title).toBe('SGCC Prime League');
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});