"use client";

export default function DemoBanner({ expiresAt }: { expiresAt?: string | null }) {
  if (!expiresAt) {
    return (
      <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium">
        This is a demonstration store — explore the features, but orders are not real.
      </div>
    );
  }

  const expiry = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium">
      This is a demonstration store — explore the features, but orders are not real.
      {daysLeft > 0 ? ` Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.` : ' Expired.'}
    </div>
  );
}
