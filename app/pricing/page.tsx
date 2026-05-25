export default function PricingPage() {
  return <main className="section"><div className="container"><h2>Pricing</h2><div className="grid-3">{['Starter', 'Growth', 'Enterprise'].map((x, i) => <div className="card" key={x}><h3>{x}</h3><h2>{i === 0 ? '$99' : i === 1 ? '$299' : 'Custom'}</h2><p>Per month, built for teams that want clean operations and verified field work.</p></div>)}</div></div></main>;
}
