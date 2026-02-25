import axios from 'axios';

export const REFRESH_INTERVAL = 300000; // 5 minutes in milliseconds
const MASTER_WORKBOOK = '2PACX-1vQLJDJ0tRftkDJQ8v0DO35q6Kymvp2GmdMwfeP8r6GuHcEAL97EJp1K9qlF8oOLTWvTW-Xg8d0l3UtP';
const BOWLERS_SHEET = '1560652729';
const ROSTERS_SHEET = '2108495623';
const SETTINGS_SHEET = '1970364122';

const DUMMY_LEAGUE = {
  title: 'Generic League',
  logo: 'generic',
  useDummyData: true,
};

const DEFAULT_LEAGUE = 'dummy';
const DEFAULT_VIEW = 'default';

const buildDataSheetUrl = (gid) => (
  'https://docs.google.com/spreadsheets/d/e/' + MASTER_WORKBOOK + '/pub?gid=' + gid + '&single=true&output=csv'
);

const BOWLERS_SHEET_URL = buildDataSheetUrl(BOWLERS_SHEET);
const ROSTERS_SHEET_URL = buildDataSheetUrl(ROSTERS_SHEET);
const SETTINGS_SHEET_URL = buildDataSheetUrl(SETTINGS_SHEET);

const DUMMY_BOWLERS_DATA = [
  {
    bowler: '🟢\u00A0\u00A0Dummy Alpha',
    gender: 'M',
    active: true,
    hdcp: 0,
    totalGames: 30,
    totalScore: 6200,
    average: 206,
  },
  {
    bowler: '🟢\u00A0\u00A0Dummy Bravo',
    gender: 'F',
    active: true,
    hdcp: 8,
    totalGames: 24,
    totalScore: 4152,
    average: 173,
  },
  {
    bowler: '🔴\u00A0\u00A0Dummy Charlie',
    gender: 'M',
    active: false,
    hdcp: 12,
    totalGames: 18,
    totalScore: 2880,
    average: 160,
  },
];

const parseCSVLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const parseCSV = (csvText) => {
  const lines = csvText.split('\n').map((line) => line.replace(/\r$/, '')).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line).map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((header, i) => row[header] = values[i] || '');
    return row;
  });
};

export const getAppConfigFromURL = (search = '') => {
  const query = new URLSearchParams(search);
  const leagueParam = (query.get('league') || '').trim().toLowerCase();
  const viewParam = (query.get('view') || DEFAULT_VIEW).trim().toLowerCase();
  const league = leagueParam || DEFAULT_LEAGUE;
  const isDummyLeague = league === DEFAULT_LEAGUE;
  const titleFallback = isDummyLeague
    ? DUMMY_LEAGUE.title
    : league.charAt(0).toUpperCase() + league.slice(1);

  return {
    league,
    view: viewParam || DEFAULT_VIEW,
    title: titleFallback,
    logo: isDummyLeague ? DUMMY_LEAGUE.logo : league,
    useDummyData: isDummyLeague,
    bowlersSheetUrl: BOWLERS_SHEET_URL,
    rostersSheetUrl: ROSTERS_SHEET_URL,
    settingsSheetUrl: SETTINGS_SHEET_URL,
    refreshInterval: REFRESH_INTERVAL,
  };
};

export const getAppConfigFromUrl = getAppConfigFromURL;

export const fetchAppConfigFromURL = async (search = '') => {
  const baseConfig = getAppConfigFromURL(search);
  if (baseConfig.useDummyData) {
    return baseConfig;
  }

  const { data: settingsData } = await fetchSettingsData(baseConfig);
  if (!settingsData) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    title: settingsData.title || baseConfig.title,
    logo: baseConfig.league,
    useDummyData: false,
  };
};

export const fetchSettingsData = async (config) => {
  const response = await axios.get(config.settingsSheetUrl || SETTINGS_SHEET_URL);
  const parsedData = parseCSV(response.data);

  const settingsRows = parsedData.filter((row) => {
    const rowLeague = String(row.League || row.league || '').trim().toLowerCase();
    return rowLeague === config.league;
  });

  if (settingsRows.length === 0) {
    return {
      data: null,
      updatedAt: new Date(),
      source: 'csv',
    };
  }

  const activeRow = settingsRows.find((row) => {
    const activeText = String(row.Active || row.active || '').trim().toUpperCase();
    return activeText === 'TRUE' || activeText === 'YES' || activeText === '1';
  }) || settingsRows[0];

  return {
    data: {
      A: String(activeRow.A || activeRow.a || '').trim().toUpperCase(),
      B: String(activeRow.B || activeRow.b || '').trim().toUpperCase(),
      C: String(activeRow.C || activeRow.c || '').trim().toUpperCase(),
      Reserved: String(activeRow.Reserved || activeRow.reserved || '').trim().toUpperCase(),
      season: String(activeRow.Season || activeRow.season || '').trim(),
      title: String(activeRow.Title || activeRow.title || '').trim(),
    },
    updatedAt: new Date(),
    source: 'csv',
  };
};

export const fetchData = async (bowlers) => {
  if (bowlers.useDummyData) {
    return {
      data: bowlers.dummyData || DUMMY_BOWLERS_DATA,
      updatedAt: new Date(),
      source: 'dummy',
    };
  }

  const response = await axios.get(bowlers.bowlersSheetUrl);
  const parsedData = parseCSV(response.data);
  const filteredData = parsedData.filter(row => {
    const rowLeague = String(row.League || row.league || '').trim().toLowerCase();
    return rowLeague === bowlers.league;
  });

  const data = filteredData.map(row => {
    const gender = row.Gender || row.gender;
    const normalizedGender = String(gender || '').trim().toUpperCase();
    const active = row.Active === 'YES' || row.active === 'yes';
    const statusIcon = active ? '🟢' : '🔴';
    const bowlerName = (row.Bowler || row.bowler || '').replace(/\s+/g, ' ').trim();

    const totalGames = parseInt(row['Total Games'] || row['total games'] || 0);
    const totalScore = parseInt(row['Total Score'] || row['total score'] || 0);
    const average = parseInt(row.Average || row.average || 0) || 0;
    const hdcp = parseInt(row.Hdcp || row.HDCP || row.hdcp || 0) || 0;

    return {
      bowler: `${statusIcon}\u00A0\u00A0${bowlerName}`,
      gender: normalizedGender,
      active,
      hdcp,
      totalGames,
      totalScore,
      average,
    };
  }).sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;

    const averageDiff = b.average - a.average;
    if (averageDiff !== 0) return averageDiff;

    const gamesDiff = b.totalGames - a.totalGames;
    if (gamesDiff !== 0) return gamesDiff;

    return a.hdcp - b.hdcp;
  });

  return {
    data,
    updatedAt: new Date(),
    source: 'csv',
  };
};

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

const parseRosterDate = (value) => {
  const dateText = String(value || '').trim();
  const match = dateText.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = MONTH_INDEX[match[2].toLowerCase()];
  const year = parseInt(match[3], 10);
  if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return null;

  return new Date(Date.UTC(year, month, day));
};

export const fetchRosterData = async (config) => {
  const response = await axios.get(config.rostersSheetUrl || ROSTERS_SHEET_URL);
  const parsedData = parseCSV(response.data);

  const data = parsedData
    .filter((row) => {
      const rowLeague = String(row.League || row.league || '').trim().toLowerCase();
      return rowLeague === config.league;
    })
    .map((row) => {
      const date = String(row.Date || row.date || '').trim();
      const parsedDate = parseRosterDate(date);
      const slots = {
        A: {
          slot: 'A',
          name: String(row['Bowler A'] || row['bowler a'] || '').trim(),
          status: String(row['Status A'] || row['status a'] || '').trim(),
          isReserve: false,
        },
        B: {
          slot: 'B',
          name: String(row['Bowler B'] || row['bowler b'] || '').trim(),
          status: String(row['Status B'] || row['status b'] || '').trim(),
          isReserve: false,
        },
        C: {
          slot: 'C',
          name: String(row['Bowler C'] || row['bowler c'] || '').trim(),
          status: String(row['Status C'] || row['status c'] || '').trim(),
          isReserve: false,
        },
        Reserved: {
          slot: 'Reserved',
          name: String(row['Bowler R'] || row['bowler r'] || '').trim(),
          status: String(row['Status R'] || row['status r'] || '').trim(),
          isReserve: true,
        },
      };

      const bowlers = Object.values(slots).filter((entry) => entry.name);

      return {
        league: String(row.League || row.league || '').trim(),
        date,
        parsedDate,
        opponent: String(row.Opponent || row.opponent || '').trim(),
        slots,
        bowlers,
      };
    })
    .filter((row) => row.parsedDate)
    .sort((a, b) => a.parsedDate - b.parsedDate);

  return {
    data,
    updatedAt: new Date(),
    source: 'csv',
  };
};