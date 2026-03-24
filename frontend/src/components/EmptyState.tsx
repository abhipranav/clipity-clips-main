import type { ReactElement } from "react";
import type { IconComponent } from "./icons";
import { Link } from "react-router-dom";
import { ArrowRight } from "./icons";
import "./EmptyState.css";

interface EmptyStateProps {
  icon: IconComponent;
  title: string;
  description: string;
  action?: {
    label: string;
    to: string;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps): ReactElement {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={48} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && (
        <Link to={action.to} className="empty-state-action">
          {action.label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
