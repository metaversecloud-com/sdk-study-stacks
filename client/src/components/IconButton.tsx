export const IconButton = ({
  label,
  icon,
  isTextBtn,
  danger = false,
  onClick,
}: {
  label: string;
  icon: string;
  isTextBtn: boolean;
  danger?: boolean;
  onClick: () => void;
}) => (
  <div className="tooltip">
    <span className="p3 tooltip-content" style={{ whiteSpace: "nowrap" }}>
      {label}
    </span>
    {!isTextBtn ? (
      <button
        type="button"
        className={`btn btn-icon${danger ? " btn-danger-outline" : " btn-outline"}`}
        onClick={onClick}
        aria-label={label}
        title={label}
      >
        <img src={`https://sdk-style.s3.amazonaws.com/icons/${icon}.svg`} alt="" aria-hidden="true" />
      </button>
    ) : (
      <a className="cursor-pointer" onClick={onClick} aria-label={label} title={label}>
        <img src={`https://sdk-style.s3.amazonaws.com/icons/${icon}.svg`} alt="" aria-hidden="true" />
      </a>
    )}
  </div>
);

export default IconButton;
