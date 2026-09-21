import { Link } from "react-router-dom";

export default function EmptyState({ testId, message, to, action }: { testId: string; message: string; to: string; action: string }) {
  return (
    <div className="card empty-state" data-testid={testId}>
      <p>{message}</p>
      <Link to={to} className="btn btn-primary">{action}</Link>
    </div>
  );
}
