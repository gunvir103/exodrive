export default function FleetLoading() {
  return (
    <div className="h-screen w-full bg-black flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="text-lg">Loading Fleet...</p>
      </div>
    </div>
  );
}

