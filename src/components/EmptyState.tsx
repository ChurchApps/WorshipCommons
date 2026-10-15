import React from "react";
import { Link } from "react-router-dom";

interface Props {
  testId: string;
  message: string;
  to: string;
  action: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<Props> = (props) => {
  return (
    <div className="card empty-state" data-testid={props.testId}>
      <p>{props.message}</p>
      {props.children}
      <Link to={props.to} className="btn btn-primary">{props.action}</Link>
    </div>
  );
};
