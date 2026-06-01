export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700">LeaderPrism</h1>
          <p className="text-sm text-gray-500 mt-1">360° Leadership Assessment Platform</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-8">{children}</div>
      </div>
    </div>
  );
}
