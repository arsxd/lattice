type IconName = "home" | "chevron" | "back" | "forward" | "browse" | "details";
const paths: Record<Exclude<IconName, "details">, string> = {
  browse: "M2 2.5h12v11H2zM6 2.5v11",
  home: "M2.5 7 8 2.5 13.5 7M4 6v7.5h8V6",
  chevron: "m6 4 4 4-4 4",
  back: "M12 8H4m4-4L4 8l4 4",
  forward: "M4 8h8M8 4l4 4-4 4",
};
export function NavigationIcon({
  name,
  size = 16,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      className="navigation-icon"
      width={size}
      height={size}
      viewBox={name === "details" ? "0 0 24 24" : "0 0 16 16"}
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "details" ? 1.6 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === "details" ? (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M15 4v16" />
        </>
      ) : (
        <path d={paths[name]} />
      )}
    </svg>
  );
}
