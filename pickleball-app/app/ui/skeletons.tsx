const shimmers =
  'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent';

export function CardSkeleton() {
  return (
    <div
      className={`${shimmers} relative overflow-hidden rounded-xl bg-gray-100 p-2 shadow-sm`}
    >
      <div className="flex p-4">
        <div className="h-5 w-5 rounded-md bg-gray-200" />
        <div className="ml-2 h-6 w-16 rounded-md bg-gray-200 text-sm font-medium" />
      </div>
      <div className="flex items-center justify-center truncate rounded-xl bg-white px-4 py-8">
        <div className="h-7 w-20 rounded-md bg-gray-200" />
      </div>
    </div>
  );
}

export function MatchCardSkeleton() {
  return (
    <div className={`${shimmers} relative overflow-hidden rounded-[50px] border-4 border-gray-100 bg-white p-10`}>
      <div className="space-y-6">
        <div className="h-12 w-full rounded-[32px] bg-gray-100" />
        <div className="h-4 w-12 mx-auto rounded bg-gray-100" />
        <div className="h-12 w-full rounded-[32px] bg-gray-100" />
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className={`${shimmers} relative flex flex-col rounded-[40px] bg-gray-900 p-8`}>
      <div className="mb-6 h-8 w-32 self-center rounded bg-gray-800" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex justify-between border-b border-gray-800 pb-3">
            <div className="h-4 w-24 rounded bg-gray-800" />
            <div className="h-4 w-8 rounded bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <>
      <div
        className={`${shimmers} relative mb-4 h-8 w-36 rounded-md bg-gray-100`}
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-8">
        <div className="col-span-1 md:col-span-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <MatchCardSkeleton />
              <MatchCardSkeleton />
           </div>
        </div>
        <div className="col-span-1 md:col-span-2">
           <LeaderboardSkeleton />
        </div>
      </div>
    </>
  );
}