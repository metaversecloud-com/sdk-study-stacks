export const IconButton = ({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) => (
  <div className="tooltip">
    <span className="p3 tooltip-content" style={{ whiteSpace: "nowrap" }}>
      {label}
    </span>
    <button
      type="button"
      className={`btn btn-icon${danger ? " btn-danger-outline" : " btn-outline"}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  </div>
);

export default IconButton;
