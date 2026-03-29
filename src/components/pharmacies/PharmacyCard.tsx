import { MapPin, Phone } from 'lucide-react';
import type { Pharmacy } from '../../types';
import { formatShortAddress } from '../../utils/format';

interface PharmacyCardProps {
  pharmacy: Pharmacy;
  onClick: () => void;
}

export function PharmacyCard({ pharmacy, onClick }: PharmacyCardProps) {
  return (
    <div
      onClick={onClick}
      className="card cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">💊</span>
            <h3 className="font-semibold text-gray-900 truncate">{pharmacy.name || pharmacy.address.neighborhood || pharmacy.address.city || 'Farmácia'}</h3>
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
              <span>{formatShortAddress(pharmacy.address)}</span>
            </div>

            {pharmacy.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span>{pharmacy.phone}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
