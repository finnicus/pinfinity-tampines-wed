import axios from 'axios';
import { fetchData } from './Api';

jest.mock('axios');

describe('fetchData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns dummy data when useDummyData is true', async () => {
    const dummyData = [{ bowler: '🟢\u00A0\u00A0Alice', average: 200 }];

    const result = await fetchData({
      useDummyData: true,
      dummyData,
      bowlersSheetUrl: 'https://example.com/sheet.csv',
      league: 'pinfinity',
    });

    expect(result.source).toBe('dummy');
    expect(result.data).toEqual(dummyData);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('fetches CSV, filters by league, maps fields, and sorts active bowlers first', async () => {
    axios.get.mockResolvedValue({
      data: [
        'League,Bowler,Gender,Active,Total Games,Total Score,Average,Hdcp',
        'pinfinity,Carol,F,YES,10,2000,200,0',
        'pinfinity,Bob,M,YES,20,3600,180,10',
        'tampines,Ignored,M,YES,30,6000,200,0',
        'pinfinity,Alice,F,NO,8,1400,175,0',
      ].join('\n'),
    });

    const result = await fetchData({
      useDummyData: false,
      bowlersSheetUrl: 'https://example.com/sheet.csv',
      league: 'pinfinity',
    });

    expect(axios.get).toHaveBeenCalledWith('https://example.com/sheet.csv');
    expect(result.source).toBe('csv');
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.data).toHaveLength(3);

    expect(result.data[0]).toMatchObject({
      bowler: '🟢\u00A0\u00A0Carol',
      gender: 'F',
      active: true,
      hdcp: 0,
      totalGames: 10,
      totalScore: 2000,
      average: 200,
    });

    expect(result.data[1]).toMatchObject({
      bowler: '🟢\u00A0\u00A0Bob',
      active: true,
      hdcp: 10,
      totalGames: 20,
    });

    expect(result.data[2]).toMatchObject({
      bowler: '🔴\u00A0\u00A0Alice',
      active: false,
      average: 175,
    });
  });
});
