/**
 * Loader component
 * Simple spinning loading indicator.
 * Used for loading states across the application.
 */
export default function Loader() {
  return (
    <div className="flex justify-center">
      <div className="w-10 h-10 border-4 border-t-black border-gray-300 rounded-full animate-spin" />
    </div>
  );
}
