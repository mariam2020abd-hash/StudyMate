type Props = { number: string; title: string; description: string };

export default function FeatureCard({ number, title, description }: Props) {
  return <article className="card feature">
    <span className="feature-number">{number}</span>
    <h3>{title}</h3><p>{description}</p>
  </article>;
}
