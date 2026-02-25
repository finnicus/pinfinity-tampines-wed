import React, { useState, useMemo } from 'react';
import TimeAgo from 'react-timeago';
import { getAppConfigFromURL } from './Api';
import Summary from './Summary';
import pinfinityLogo from './pinfinity.png';
import tampinesLogo from './tampines.png';
import './App.css';

const LOGO_BY_LEAGUE = {
  pinfinity: pinfinityLogo,
  tampines: tampinesLogo,
};

function App() {
  const appConfig = useMemo(() => getAppConfigFromURL(window.location.search), []);
  const logoSrc = LOGO_BY_LEAGUE[appConfig.logo] || pinfinityLogo;
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /> Loading data...</div>;
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-content">
          <div className="logo-section">
            <img src={logoSrc} alt={`${appConfig.title} logo`} className="site-logo" />
            <h1>{appConfig.title}</h1>
          </div>
          <div className="live-badge">
            Last Updated: {lastUpdated ? <TimeAgo date={lastUpdated} /> : 'Loading...'}
          </div>
        </div>
      </header>

      <main className="main-content">
        <Summary
          appConfig={appConfig}
          onLoadingChange={setLoading}
          onLastUpdatedChange={setLastUpdated}
        />
      </main>
    </div>
  );
}

export default App;
