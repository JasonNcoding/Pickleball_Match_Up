export default function Tournament(){ 
    return (<div className="space-y-4">
    <h1 className="text-2xl font-bold">Tournament Leaderboard</h1>
    <p className="text-gray-600">Check out the current standings and match results.</p>
    {/* Placeholder for leaderboard content */}
    <div className="rounded-lg bg-gray-100 p-4">
      <h2 className="text-xl font-semibold mb-2">Current Standings</h2>
      <ul className="space-y-1">
        <li className="flex justify-between">
          <span>Player A</span>
          <span>3 Wins</span>
        </li>
        <li className="flex justify-between">
          <span>Player B</span>
          <span>2 Wins</span>
        </li>
        <li className="flex justify-between">
          <span>Player C</span>
          <span>1 Win</span>
        </li>
      </ul>
    </div>
  </div>)
}