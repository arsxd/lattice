type IconName = "home" | "chevron" | "back" | "forward";
const paths: Record<IconName, string> = {
  home: "m2.5 7 5.5-4.5L13.5 7M4 6v7h3V9h2v4h3V6",
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
