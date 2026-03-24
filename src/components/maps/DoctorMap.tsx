import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Doctor } from '../../types';
import { formatShortAddress } from '../../utils/format';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface DoctorMapProps {
  doctors: Doctor[];
  selectedDoctorId?: string;
  onDoctorClick?: (doctor: Doctor) => void;
  height?: string;
  showRoute?: boolean;
}

// Custom marker icons
const defaultIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const selectedIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 10.3 12.5 28.5 12.5 28.5S25 22.8 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#2563eb"/>
      <circle cx="12.5" cy="12.5" r="6" fill="white"/>
    </svg>
  `),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

// Component to fit map bounds
function MapBounds({ doctors }: { doctors: Doctor[] }) {
  const map = useMap();

  useEffect(() => {
    const doctorsWithCoords = doctors.filter(d => d.coordinates);
    if (doctorsWithCoords.length === 0) return;

    const bounds = L.latLngBounds(
      doctorsWithCoords.map(d => [d.coordinates!.latitude, d.coordinates!.longitude])
    );

    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [doctors, map]);

  return null;
}

export function DoctorMap({
  doctors,
  selectedDoctorId,
  onDoctorClick,
  height = '400px',
  showRoute = false
}: DoctorMapProps) {
  const doctorsWithCoords = doctors.filter(d => d.coordinates);

  // Default center (São Paulo)
  const defaultCenter: [number, number] = [-23.5505, -46.6333];

  const center = doctorsWithCoords.length > 0
    ? [doctorsWithCoords[0].coordinates!.latitude, doctorsWithCoords[0].coordinates!.longitude] as [number, number]
    : defaultCenter;

  if (doctorsWithCoords.length === 0) {
    return (
      <div
        className="bg-gray-100 rounded-lg flex items-center justify-center text-gray-500"
        style={{ height }}
      >
        Nenhum médico com localização disponível
      </div>
    );
  }

  return (
    <div style={{ height }} className="rounded-lg overflow-hidden">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBounds doctors={doctorsWithCoords} />

        {doctorsWithCoords.map((doctor, index) => (
          <Marker
            key={doctor.id}
            position={[doctor.coordinates!.latitude, doctor.coordinates!.longitude]}
            icon={doctor.id === selectedDoctorId ? selectedIcon : defaultIcon}
            eventHandlers={{
              click: () => onDoctorClick?.(doctor)
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                {showRoute && (
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded mb-2">
                    #{index + 1}
                  </span>
                )}
                <h3 className="font-semibold">{doctor.name}</h3>
                <p className="text-sm text-gray-600">CRM {doctor.crm}</p>
                {doctor.specialty && (
                  <p className="text-sm text-gray-500">{doctor.specialty}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {formatShortAddress(doctor.address)}
                </p>
                {onDoctorClick && (
                  <button
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                    onClick={() => onDoctorClick(doctor)}
                  >
                    Ver detalhes
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
