export default function AccountDisabledPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="mb-4 text-5xl">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Account Disabled
        </h1>
        <p className="text-gray-600">
          Your account has been deactivated. Please contact an administrator
          if you believe this is an error.
        </p>
      </div>
    </div>
  );
}
