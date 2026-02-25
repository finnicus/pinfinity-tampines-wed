import { render, screen } from '@testing-library/react';
import App from './App';
import { fetchData } from './Api';

jest.mock('./Api', () => ({
  ...jest.requireActual('./Api'),
  fetchData: jest.fn(),
}));

test('renders loading state', () => {
  fetchData.mockImplementation(() => new Promise(() => {}));
  render(<App />);
  expect(screen.getByText(/loading data/i)).toBeInTheDocument();
});
