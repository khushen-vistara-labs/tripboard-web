"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { DateTime } from "luxon";
import type { AppScreen } from "../../components/app/AppShell";
import { buildSearchDocuments, matchExcerpt, searchDocuments, searchScopes, type SearchData } from "./section-search";

export function SectionSearch({ screen, data, children }: { screen: AppScreen; data: SearchData; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const scope = searchScopes[screen];
  const placeholder = screen === "plan" || screen === "overview" ? "All days: places, streets, food, notes…" : screen === "money" ? "Merchants, accounts, amounts…" : scope.hint;
  const deferredQuery = useDeferredValue(query);
  const documents = useMemo(() => buildSearchDocuments(data, screen), [data, screen]);
  const results = useMemo(() => searchDocuments(documents, deferredQuery), [documents, deferredQuery]);
  const searching = query.trim().length > 0;
  useEffect(() => { if (expanded) input.current?.focus(); }, [expanded]);
  const close = () => { setQuery(""); setExpanded(false); trigger.current?.focus(); };
  const clear = () => { setQuery(""); input.current?.focus(); };

  return <>
    <div className="section-search">
      <form className={`section-search-control${expanded ? " expanded" : ""}`} role="search" aria-label={`${scope.label} search`} onSubmit={(event) => event.preventDefault()}>
        <button ref={trigger} type="button" className="section-search-trigger" aria-label={expanded ? `Close ${scope.label} search` : `Search ${scope.label}`} title={expanded ? "Close search" : `Search ${scope.label}`} aria-expanded={expanded} aria-controls={id} onClick={() => expanded ? close() : setExpanded(true)}><Search size={19}/></button>
        <div id={id} className="section-search-entry" hidden={!expanded}>
          <label className="sr-only" htmlFor={`${id}-input`}>Search {scope.label}</label>
          <input ref={input} id={`${id}-input`} type="search" value={query} placeholder={placeholder} aria-describedby={`${id}-hint`} autoComplete="off" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); if (query) clear(); else close(); } }}/>
          {query && <button type="button" className="section-search-clear" aria-label="Clear section search" onClick={clear}><X size={17}/></button>}
          <span className="sr-only" id={`${id}-hint`}>{scope.hint}</span>
        </div>
      </form>
    </div>
    {searching && <section className="section-search-results" aria-label={`${scope.label} search results`} aria-busy={deferredQuery !== query}>
      <header className="section-search-heading"><div><h1>Search {scope.label}</h1><p role="status">{results.length} result{results.length === 1 ? "" : "s"} for “{deferredQuery.trim()}”</p></div><button type="button" className="button secondary" onClick={clear}>Back to {scope.label}</button></header>
      {results.length === 0 && <div className="panel empty-state"><Search size={27}/><h2>No matches in {scope.label}</h2><p>Try another place, street, food, or phrase from your notes.</p></div>}
      <div className="section-search-list">{results.map((result) => <article className="panel section-search-result" key={result.id}>
        <div className="section-search-meta"><span>{result.kind}</span>{result.date && <time dateTime={result.date}>{DateTime.fromISO(result.date).toFormat("d LLL yyyy")}</time>}</div>
        <h2><HighlightedText text={result.title} query={deferredQuery}/></h2>
        <div className="section-search-matches">{(result.matches.length ? result.matches : result.fields).slice(0, 3).map((field, index) => <p key={index}><strong>{field.label}: </strong><HighlightedText text={matchExcerpt(field.value, deferredQuery)} query={deferredQuery}/></p>)}</div>
        <details className="section-search-details"><summary>All details</summary><dl>{result.fields.map((field, index) => <div key={index}><dt>{field.label}</dt><dd><HighlightedText text={field.value} query={deferredQuery}/></dd></div>)}</dl></details>
        {result.href && <a className="section-search-link" href={result.href}>{result.action}<ArrowRight size={15}/></a>}
      </article>)}</div>
    </section>}
    <div hidden={searching}>{children}</div>
  </>;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const terms = [...new Set(query.trim().split(/\s+/).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!terms.length) return <>{text}</>;
  const pattern = terms.map((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return /^[a-z0-9]$/i.test(term) ? `\\b${escaped}\\b` : escaped;
  }).join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  return <>{parts.map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part)}</>;
}
