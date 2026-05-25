export default function ProductPage() {
  return <main className="section"><div className="container"><h2>Product</h2><div className="grid-3">{['Job dispatch', 'Live status', 'Proof reports'].map(x => <div className="card" key={x}><h3>{x}</h3><p>EverittOS gives managers one luxury-grade workspace to move work from request to verified completion.</p></div>)}</div></div></main>;
}
