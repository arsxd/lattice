type IconName = "home" | "chevron" | "back" | "forward" | "browse" | "details";
const paths: Record<IconName, string> = {
  browse: "M2 2.5h12v11H2zM6 2.5v11",
  details: "M2 2.5h12v11H2zM10 2.5v11",
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
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
