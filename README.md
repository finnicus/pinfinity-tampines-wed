# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

## Versioning

- Version format is `year.mmdd.minor` (example: `2026.0225.3`).
- Every `npm run deploy` now auto-increments `minor` for the current day.
- On a new day, `minor` resets to `1` automatically.
- Manual trigger (without deploy): `npm run version:auto`.

## Data Source Notes

- `Average` and `Hdcp` are sourced directly from the sheet data and are no longer computed in the app.
- Ensure the source sheet includes `Average` and `Hdcp` columns (case-insensitive keys are supported).

## Roster Sorting Logic

The roster card in `Roster.js` is displayed in grouped order:

1. Confirmed main bowlers (`YES`)
2. Pending main bowlers (not `YES`)
3. Reserve bowlers
4. Suggested bowlers (when fewer than 3 mains are assigned)
5. Exception bowlers (`EXCEPTION`)

### Confirmed Bowlers Ranking

Confirmed bowlers are not alphabetical. They are sorted by these tie-break rules:

1. Lower `Hdcp` appears lower in the list (higher `Hdcp` appears first)
2. If `Hdcp` is tied, higher `Average` appears lower in the list
3. If `Hdcp` and `Average` are tied, higher `Total Games` appears lower in the list
4. If `Hdcp`, `Average`, and `Total Games` are tied, higher `Total Score` appears lower in the list

This keeps ordering deterministic while following team selection preference for confirmed players.

## URL Parameters

- You can now pass query params to control runtime configuration.
- Example: `?league=tampines&view=default`
- `league` selects the configured league data source.
- If `league` is missing or unknown, it defaults to `dummy` and uses dummy values for all displayed data.
- `view` is parsed and preserved for view-specific logic (defaults to `default`).

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
