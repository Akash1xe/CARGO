export default function EmptyState({ title = 'No results found', message, children }) {
  return (
    <div className="editorial-empty-state">
      <div className="editorial-empty-icon" aria-hidden="true"><span /></div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {children && <div>{children}</div>}
    </div>
  );
}
