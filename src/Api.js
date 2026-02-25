import axios from 'axios';

export const REFRESH_INTERVAL = 300000; // 5 minutes in milliseconds
const MASTER_WORKBOOK = '2PACX-1vQLJDJ0tRftkDJQ8v0DO35q6Kymvp2GmdMwfeP8r6GuHcEAL97EJp1K9qlF8oOLTWvTW-Xg8d0l3UtP';
const BOWLERS_SHEET = '1560652729';

const LEAGUE_CONFIG = {
  tampines: {
    title: 'Pinfinity Tampines Wednesday',
    logo: 'tampines',
    useDummyData: false,
  },
  tessenjohn: {
    title: 'Pinfinity Tessenjohn Tuesday',
    logo: 'tessenjohn',
    useDummyData: false,
  },
  sgcc: {
    title: 'SGCC Pin Pals Wednesday',
    logo: 'sgcc',
    useDummyData: false,
  },
  dummy: {
    title: 'Pinfinity Dummy',
    logo: 'pinfinity',
    useDummyData: true,
  },
};

const DEFAULT_LEAGUE = 'dummy';
const DEFAULT_VIEW = 'default';

const buildDataSheetUrl = (gid) => (
  'https://docs.google.com/spreadsheets/d/e/' + MASTER_WORKBOOK + '/pub?gid=' + gid + '&single=true&output=csv'
);

const BOWLERS_SHEET_URL = buildDataSheetUrl(BOWLERS_SHEET);


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

export const getAppConfigFromURL = (search = '') => {
  const query = new URLSearchParams(search);
  const leagueParam = (query.get('league') || '').trim().toLowerCase();
  const viewParam = (query.get('view') || DEFAULT_VIEW).trim().toLowerCase();
  const league = LEAGUE_CONFIG[leagueParam] ? leagueParam : DEFAULT_LEAGUE;
  const leagueSettings = LEAGUE_CONFIG[league];

  return {
    league,
    view: viewParam || DEFAULT_VIEW,
    title: leagueSettings.title,
    logo: leagueSettings.logo || 'pinfinity',
    useDummyData: Boolean(leagueSettings.useDummyData),
    bowlersSheetUrl: BOWLERS_SHEET_URL,
    refreshInterval: REFRESH_INTERVAL,
  };
};

export const getAppConfigFromUrl = getAppConfigFromURL;

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

    if (a.active && b.active) {
      if (a.hdcp === 0 && b.hdcp === 0) {
        return b.average - a.average;
      }
      if (a.hdcp !== 0 && b.hdcp !== 0) {
        return b.totalGames - a.totalGames;
      }
      if (a.hdcp === 0 && b.hdcp !== 0) return -1;
      if (a.hdcp !== 0 && b.hdcp === 0) return 1;
    }

    return b.average - a.average;
  });

  return {
    data,
    updatedAt: new Date(),
    source: 'csv',
  };
};