export default function IndustriesPage() {
  return <main className="section"><div className="container"><h2>Industries</h2><div className="grid-3">{['Property operations', 'Maintenance teams', 'Cleaning crews', 'Landscaping', 'Inspections', 'Service businesses'].map(x => <div className="card" key={x}><h3>{x}</h3><p>Built for teams that need fast dispatch, field proof, and clean client accountability.</p></div>)}</div></div></main>;
}
