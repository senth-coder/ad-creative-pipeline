'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="error-page"><section className="ops-card"><h1>We couldn’t load the workspace</h1><p>Your saved work has not been cleared. Try again, or ask your administrator to check the database connection and migrations.</p><button className="primary-btn" onClick={reset}>Try again</button></section></main>}
