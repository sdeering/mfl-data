import DatabaseViewer from '../../src/components/DatabaseViewer';

export default function DatabasePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Database Status
        </h1>
        <DatabaseViewer />
      </div>
    </div>
  );
}

