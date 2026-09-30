import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { Compass } from 'lucide-react';

export function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      message="That screen doesn’t exist in the prototype."
      action={
        <Link to="/" className="rounded-md bg-primary px-3 py-1.5 font-medium text-white hover:bg-primary/90">
          Back to Offers
        </Link>
      }
    />
  );
}
