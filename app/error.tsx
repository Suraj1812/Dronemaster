'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="standalone"><h1>Something went wrong</h1><button className="button primary" onClick={reset}>Try again</button></main>;}
