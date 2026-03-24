import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, Home } from "@/components/icons";
import "./NotFoundPage.css";

export function NotFoundPage(): ReactElement {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <AlertCircle size={64} className="not-found-icon" />
        <h1 className="not-found-title">Page Not Found</h1>
        <p className="not-found-description">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn-primary">
            <Home size={18} />
            Go Home
          </Link>
          <button onClick={() => history.back()} className="btn-secondary">
            <ArrowLeft size={18} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
