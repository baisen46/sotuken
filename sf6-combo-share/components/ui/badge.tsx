export function Badge({
  children,
  className = "",
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "secondary";
}) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-sm";

  let variantClass = "";

  if (variant === "default") {
    variantClass = "bg-gray-800 text-white border-transparent";
  } else if (variant === "outline") {
    variantClass = "border-gray-500 text-gray-800 bg-white";
  } else if (variant === "secondary") {
    variantClass = "bg-gray-100 text-gray-700 border-transparent";
  }

  return (
    <span className={`${base} ${variantClass} ${className}`}>
      {children}
    </span>
  );
}
