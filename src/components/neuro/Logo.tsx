export function Logo() {
  return (
    <div className="absolute left-6 top-6 z-20 sm:left-10 sm:top-10">
      <div className="size-24 overflow-hidden rounded-full bg-white shadow-xl sm:size-28">
        <img
          src="/neurosense-logo.jpeg"
          alt="NeuroSense"
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}