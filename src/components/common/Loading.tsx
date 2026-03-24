interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function Loading({ size = 'md', text }: LoadingProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div
        className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}
      />
      {text && <p className="mt-3 text-gray-500 text-sm">{text}</p>}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Loading size="lg" text="Carregando..." />
    </div>
  );
}

export function ButtonLoading() {
  return (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
  );
}
