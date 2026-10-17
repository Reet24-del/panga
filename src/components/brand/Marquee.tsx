// A ticker of things every freelancer has heard.

const LINES = [
  '“Simple site hai”',
  '“Just one small change”',
  '“15k is fine na?”',
  '“Can you also do the logo?”',
  '“My cousin said it’s easy”',
  '“Small changes later also”',
  '“ASAP please”',
  '“Thoda adjust kar lo”',
];

export function Marquee() {
  const items = [...LINES, ...LINES];
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {items.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </div>
    </div>
  );
}
