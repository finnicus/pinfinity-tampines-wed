import React, { useState, useMemo, useEffect } from 'react';
import TimeAgo from 'react-timeago';
import { fetchAppConfigFromURL, getAppConfigFromURL } from './Api';
import Summary from './Summary';
import Roster from './Roster';
import Suggestion from './Suggestion';
import tessenjohnLogo from './tessenjohn.png';
import tampinesLogo from './tampines.png';
import sgccLogo from './sgcc.png';
import genericLogo from './generic.png';
import './App.css';

const LOGO_BY_LEAGUE = {
  tessenjohn : tessenjohnLogo,
  tampines: tampinesLogo,
  sgcc: sgccLogo,
};

const setDocumentIcon = (href, rel) => {
  let iconTag = document.querySelector(`link[rel="${rel}"]`);
  if (!iconTag) {
    iconTag = document.createElement('link');
    iconTag.setAttribute('rel', rel);
    document.head.appendChild(iconTag);
  }
  iconTag.setAttribute('href', href);
};

function App() {
  const initialConfig = useMemo(() => getAppConfigFromURL(window.location.search), []);
  const [appConfig, setAppConfig] = useState(initialConfig);
  const logoSrc = LOGO_BY_LEAGUE[appConfig.logo] || genericLogo;
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const hydrateConfig = async () => {
      try {
        const resolvedConfig = await fetchAppConfigFromURL(window.location.search);
        if (!cancelled) {
          setAppConfig(resolvedConfig);
        }
      } catch (error) {
        console.error('Error loading app config:', error);
      }
    };

    hydrateConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = appConfig.title;
    setDocumentIcon(logoSrc, 'icon');
    setDocumentIcon(logoSrc, 'apple-touch-icon');
  }, [appConfig.title, logoSrc]);

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
        {loading && <div className="loading-screen"><div className="spinner" /> Loading data...</div>}
        <Summary
          appConfig={appConfig}
          onLoadingChange={setLoading}
          onLastUpdatedChange={setLastUpdated}
        />
        <Roster appConfig={appConfig} />
        <Suggestion appConfig={appConfig} />
      </main>
    </div>
  );
}

export default App;
